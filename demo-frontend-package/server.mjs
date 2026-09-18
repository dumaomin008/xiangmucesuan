import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8'
};

function loadEnvFile() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(payload);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

/**
 * 可选 AI 代理：Secret 只存在服务端环境变量，绝不下发到浏览器。
 * 未配置时返回 503，前端应降级到本地引擎解读。
 */
function aiConfig() {
  return {
    apiKey: process.env.DEMO_AI_API_KEY || '',
    baseUrl: (process.env.DEMO_AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.DEMO_AI_MODEL || 'gpt-4o-mini'
  };
}

async function callChatCompletions({ system, user, temperature = 0.2 }) {
  const { apiKey, baseUrl, model } = aiConfig();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      body: {
        ok: false,
        code: 'AI_NOT_CONFIGURED',
        message: '未配置 DEMO_AI_API_KEY。请使用本地引擎解读，测算结果不受影响。'
      }
    };
  }

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return {
        ok: false,
        status: 502,
        body: {
          ok: false,
          code: 'AI_UPSTREAM_ERROR',
          message: '大模型服务暂时不可用，已保留本地解读。',
          detail: text.slice(0, 300)
        }
      };
    }

    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return {
        ok: false,
        status: 502,
        body: { ok: false, code: 'AI_EMPTY', message: '大模型未返回内容，请使用本地解读。' }
      };
    }

    return { ok: true, text, model };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        code: 'AI_PROXY_FAILED',
        message: 'AI 代理调用失败，测算结果不受影响。',
        detail: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

async function handleAiExplain(request, response) {
  let body;
  try {
    body = await readJson(request);
  } catch {
    return sendJson(response, 400, { ok: false, code: 'BAD_REQUEST', message: '请求体必须是 JSON' });
  }

  if (!body?.engineMetrics) {
    return sendJson(response, 400, {
      ok: false,
      code: 'MISSING_ENGINE_METRICS',
      message: '缺少引擎结果，拒绝由模型自行计算。'
    });
  }

  const system = [
    '你是新能源重卡「AI项目测算助手」。',
    '你只能解释用户提供的引擎测算结果与本地洞察，禁止重新计算或编造数字。',
    '若本地解读已给出风险与建议，可在其基础上润色，不得推翻引擎 KPI。',
    '输出简体中文，结构：结论 / 风险 / 建议。'
  ].join('');

  const result = await callChatCompletions({
    system,
    user: JSON.stringify(body, null, 2),
    temperature: 0.2
  });

  if (!result.ok) return sendJson(response, result.status, result.body);

  return sendJson(response, 200, {
    ok: true,
    source: 'remote_llm',
    text: result.text,
    model: result.model
  });
}

/**
 * 结构化意图解析：LLM 只输出 Intent JSON，禁止 KPI。
 * 前端必须做 Schema Validation；失败则回退本地规则。
 */
async function handleAiIntent(request, response) {
  let body;
  try {
    body = await readJson(request);
  } catch {
    return sendJson(response, 400, { ok: false, code: 'BAD_REQUEST', message: '请求体必须是 JSON' });
  }

  const question = String(body?.question || '').trim();
  if (!question) {
    return sendJson(response, 400, { ok: false, code: 'MISSING_QUESTION', message: '缺少 question' });
  }

  const system = [
    '你是新能源重卡项目测算业务意图解析器。',
    '只输出一个 JSON 对象，不要 Markdown，不要解释。',
    '允许字段：kind, title, patches, scenarioName, queryTarget, compareHint, requiresConfirmation, scope。',
    'kind 枚举：query|diagnose|modify|create_scenario|compare|sensitivity|advice|report|confirm|cancel|scope_choice|unmatched。',
    'patches[].field 仅允许：electricityPrice|fleetSize|freightPrice|tripsPerVehicleMonth|distanceKm|loadTon|loadedEnergyConsumption|driverCostPerTrip|monthlyRentPerVehicle。',
    'patches[].operation 仅允许：set|add|multiply。',
    'scope 仅允许：project|vehicle|all_routes|route|segment。',
    '严禁输出或修改 monthlyProfit、monthlyRevenue、monthlyTotalCost、profitMargin、IRR、cashFlow 等 KPI。',
    '修改类意图必须 requiresConfirmation=true。'
  ].join('');

  const user = JSON.stringify({
    question,
    projectId: body?.projectId || null,
    scenarioId: body?.scenarioId || null,
    availableParams: [
      'electricityPrice',
      'fleetSize',
      'freightPrice',
      'tripsPerVehicleMonth',
      'distanceKm',
      'loadTon',
      'loadedEnergyConsumption',
      'driverCostPerTrip',
      'monthlyRentPerVehicle'
    ],
    note: '不要计算或返回任何利润/收入/成本/IRR/现金流数字。'
  });

  const result = await callChatCompletions({ system, user, temperature: 0 });
  if (!result.ok) return sendJson(response, result.status, result.body);

  let intent = null;
  try {
    const trimmed = result.text.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    intent = JSON.parse(start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed);
  } catch {
    return sendJson(response, 502, {
      ok: false,
      code: 'AI_INVALID_JSON',
      message: '大模型未返回合法 JSON，已回退本地规则。',
      raw: result.text.slice(0, 400)
    });
  }

  return sendJson(response, 200, {
    ok: true,
    source: 'remote_llm_intent',
    intent,
    model: result.model
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  if (request.method === 'POST' && url.pathname === '/api/demo-ai/explain') {
    return handleAiExplain(request, response);
  }
  if (request.method === 'POST' && url.pathname === '/api/demo-ai/intent') {
    return handleAiIntent(request, response);
  }
  if (request.method === 'GET' && url.pathname === '/api/demo-ai/status') {
    return sendJson(response, 200, {
      ok: true,
      configured: Boolean(process.env.DEMO_AI_API_KEY),
      model: process.env.DEMO_AI_MODEL || 'gpt-4o-mini'
    });
  }

  const pathname = decodeURIComponent(url.pathname);
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = join(root, safePath);

  if (!existsSync(filePath) || !statSync(filePath).isFile()) filePath = join(root, 'index.html');

  response.writeHead(200, {
    'Content-Type': types[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Demo Frontend: http://${host}:${port}/#/login`);
  console.log(`AI proxy: ${process.env.DEMO_AI_API_KEY ? 'configured' : 'local-only (set DEMO_AI_API_KEY to enable)'}`);
});
