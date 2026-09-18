import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

const documentImport = await import('./lib/document-import.server.mjs').catch((error) => {
  console.warn(`document-import bundle unavailable: ${error instanceof Error ? error.message : error}`);
  return null;
});

const uploadRoot = join(tmpdir(), 'pm-calc-import');

function sweepUploads() {
  if (!existsSync(uploadRoot) || !documentImport) return;
  const ttl = documentImport.UPLOAD_LIMITS.ttlMs;
  for (const id of readdirSync(uploadRoot)) {
    if (!documentImport.safeFileId(id)) continue;
    const dir = join(uploadRoot, id);
    try {
      if (Date.now() - statSync(dir).mtimeMs > ttl) rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function readRaw(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('TOO_LARGE');
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, boundary) {
  const delim = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(delim);
  while (start !== -1) {
    const next = buffer.indexOf(delim, start + delim.length);
    if (next === -1) break;
    let part = buffer.subarray(start + delim.length, next);
    if (part[0] === 13 && part[1] === 10) part = part.subarray(2);
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2);
    }
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headerText = part.subarray(0, headerEnd).toString('utf8');
      const body = part.subarray(headerEnd + 4);
      const name = /name="([^"]*)"/.exec(headerText)?.[1] || '';
      const filename = /filename="([^"]*)"/.exec(headerText)?.[1] || '';
      const mime = /Content-Type:\s*([^\r\n]+)/i.exec(headerText)?.[1]?.trim() || '';
      parts.push({ name, filename, mime, body });
    }
    start = next;
  }
  return parts;
}

function documentAiConfig() {
  if (documentImport?.resolveDocumentAiConfig) return documentImport.resolveDocumentAiConfig(process.env);
  const apiKey = process.env.AI_API_KEY || process.env.DEMO_AI_API_KEY || '';
  const provider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
  const baseUrl = (process.env.AI_BASE_URL || process.env.DEMO_AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const model = process.env.AI_MODEL || process.env.DEMO_AI_MODEL || (provider === 'deepseek' ? 'deepseek-flash' : 'gpt-4o-mini');
  return { provider, apiKey, baseUrl, model, configured: Boolean(apiKey) };
}

async function handleImportConfig(_request, response) {
  const mode = documentImport ? documentImport.getDocumentParserMode() : 'demo';
  const limits = documentImport?.UPLOAD_LIMITS || { maxFiles: 8, maxFileBytes: 10 * 1024 * 1024, maxTotalBytes: 25 * 1024 * 1024 };
  const ai = documentAiConfig();
  return sendJson(response, 200, {
    ok: true,
    mode,
    maxFiles: limits.maxFiles,
    maxFileBytes: limits.maxFileBytes,
    maxTotalBytes: limits.maxTotalBytes,
    aiConfigured: ai.configured,
    aiProvider: ai.provider,
    aiModel: ai.model,
    bundleReady: Boolean(documentImport)
  });
}

async function handleImportUpload(request, response) {
  if (!documentImport) return sendJson(response, 503, { ok: false, message: '真实解析模块未构建' });
  if (documentImport.getDocumentParserMode() !== 'real') {
    return sendJson(response, 409, { ok: false, message: '当前服务端为 demo 模式，不接收二进制上传' });
  }
  sweepUploads();
  const ctype = request.headers['content-type'] || '';
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ctype)?.[1] || /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ctype)?.[2];
  if (!boundary) return sendJson(response, 400, { ok: false, message: '需要 multipart/form-data' });
  let raw;
  try {
    raw = await readRaw(request, documentImport.UPLOAD_LIMITS.maxTotalBytes + 1024 * 1024);
  } catch {
    return sendJson(response, 413, { ok: false, message: '上传超过总大小上限' });
  }
  const parts = parseMultipart(raw, boundary.trim());
  const files = parts.filter((p) => p.filename);
  if (!files.length) return sendJson(response, 400, { ok: false, message: '没有文件' });
  if (files.length > documentImport.UPLOAD_LIMITS.maxFiles) {
    return sendJson(response, 400, { ok: false, message: '超过文件数量上限' });
  }
  mkdirSync(uploadRoot, { recursive: true });
  const saved = [];
  const errors = [];
  let total = 0;
  for (const part of files) {
    const check = documentImport.validateIncomingFile({
      name: part.filename,
      mimeType: part.mime,
      size: part.body.length
    });
    if (!check.ok) {
      errors.push(check.message);
      continue;
    }
    total += part.body.length;
    if (total > documentImport.UPLOAD_LIMITS.maxTotalBytes) {
      errors.push('超过总大小上限');
      break;
    }
    const fileId = randomUUID();
    const dir = join(uploadRoot, fileId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'blob'), part.body);
    writeFileSync(
      join(dir, 'meta.json'),
      JSON.stringify({ fileId, name: part.filename, mimeType: part.mime, size: part.body.length })
    );
    saved.push({ fileId, name: part.filename, mimeType: part.mime, size: part.body.length });
  }
  return sendJson(response, 200, { ok: saved.length > 0, files: saved, errors });
}

async function handleImportParse(request, response) {
  if (!documentImport) return sendJson(response, 503, { ok: false, message: '真实解析模块未构建' });
  if (documentImport.getDocumentParserMode() !== 'real') {
    return sendJson(response, 409, { ok: false, message: '当前不是 real 模式' });
  }
  let body;
  try {
    body = await readJson(request);
  } catch {
    return sendJson(response, 400, { ok: false, message: '请求体必须是 JSON' });
  }
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.map(String) : [];
  if (!fileIds.length) return sendJson(response, 400, { ok: false, message: '缺少 fileIds' });
  const files = [];
  const missing = [];
  for (const fileId of fileIds) {
    if (!documentImport.safeFileId(fileId)) {
      missing.push(fileId);
      continue;
    }
    const dir = join(uploadRoot, fileId);
    const metaPath = join(dir, 'meta.json');
    const blobPath = join(dir, 'blob');
    if (!existsSync(metaPath) || !existsSync(blobPath)) {
      missing.push(fileId);
      continue;
    }
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    files.push({
      fileId,
      fileName: meta.name,
      mimeType: meta.mimeType,
      bytes: readFileSync(blobPath)
    });
  }
  const ai = documentAiConfig();
  const outcome = await documentImport.parseRealDocuments(files, {
    projects: Array.isArray(body.projects) ? body.projects : [],
    llm: ai.configured
      ? {
          apiKey: ai.apiKey,
          baseUrl: ai.baseUrl,
          model: ai.model
        }
      : undefined
  });
  return sendJson(response, 200, {
    ...outcome,
    missingFileIds: missing,
    parameters: outcome.parameters
  });
}

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
  const resolved = documentAiConfig();
  return {
    apiKey: resolved.apiKey,
    baseUrl: resolved.baseUrl,
    model: resolved.model
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
        thinking: { type: 'disabled' },
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
      configured: documentAiConfig().configured,
      model: documentAiConfig().model,
      provider: documentAiConfig().provider
    });
  }
  if (request.method === 'GET' && url.pathname === '/api/demo-import/config') {
    return handleImportConfig(request, response);
  }
  if (request.method === 'POST' && url.pathname === '/api/demo-import/upload') {
    return handleImportUpload(request, response);
  }
  if (request.method === 'POST' && url.pathname === '/api/demo-import/parse') {
    return handleImportParse(request, response);
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
  const ai = documentAiConfig();
  console.log(`AI Provider: ${ai.provider}`);
  console.log(`AI Model: ${ai.model}`);
  console.log(`AI Configured: ${ai.configured}`);
});
