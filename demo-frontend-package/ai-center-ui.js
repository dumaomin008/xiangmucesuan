/**
 * 项目测算中心 AI 对话工作台。
 * 只负责交互与渲染；金额由 AiCenterCore 基于 Calculation Engine 结果生成。
 */
(function (global) {
  const SEED_QUESTION = "分析一下最近的测算项目经营情况，并给我关键结论";
  const VIEW_KEY = "pm-calc-center-view";
  const ACTIVE_KEY = "pm-ai-active-id";
  const FAIL_KEY = "pm-ai-force-fail";
  const FALLBACK_COPY = "AI 在线解读暂时不可用，已使用本地分析结果，项目测算不受影响。";

  let generation = 0;
  let loading = false;
  let collapsed = {
    left: typeof matchMedia === "function" && matchMedia("(max-width: 860px)").matches,
    right: typeof matchMedia === "function" && matchMedia("(max-width: 1180px)").matches,
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
  }

  function core() {
    return global.AiCenterCore || null;
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function uid() {
    return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function notify(message, type) {
    if (typeof toast === "function") toast(message, type);
  }

  function rerenderApp() {
    if (typeof global.render === "function") global.render();
  }

  function navigate(href) {
    if (!href) return;
    if (href === "view:list") {
      setView("list");
      rerenderApp();
      return;
    }
    if (typeof go === "function") go(href);
    else location.hash = href;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getView() {
    try {
      return sessionStorage.getItem(VIEW_KEY) === "list" ? "list" : "ai";
    } catch {
      return "ai";
    }
  }

  function setView(view) {
    try {
      sessionStorage.setItem(VIEW_KEY, view === "list" ? "list" : "ai");
    } catch {
      /* ignore */
    }
  }

  function aiMode() {
    try {
      const stored = localStorage.getItem(core()?.AI_MODE_STORAGE_KEY || "pm-ai-mode");
      if (stored === "deepseek" || stored === "mock") return stored;
    } catch {
      /* ignore */
    }
    return "mock";
  }

  function setMode(mode) {
    try {
      localStorage.setItem(core()?.AI_MODE_STORAGE_KEY || "pm-ai-mode", mode === "deepseek" ? "deepseek" : "mock");
    } catch {
      /* ignore */
    }
  }

  function storageKey() {
    return core()?.CONVERSATION_STORAGE_KEY || "pm-ai-conversations-v1";
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(storageKey());
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveAll(list) {
    const trimmed = list
      .slice()
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 20)
      .map((item) => ({ ...item, messages: (item.messages || []).slice(-40) }));
    localStorage.setItem(storageKey(), JSON.stringify(trimmed));
  }

  function activeId() {
    try {
      return sessionStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  }

  function setActive(id) {
    try {
      sessionStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function collectProjects() {
    const pm = global.PmCalc;
    if (!pm?.listScenarios) return [];
    const shellProjects = typeof projects !== "undefined" ? projects : [];
    const visible = typeof visibleProjects === "function" ? visibleProjects() : shellProjects;
    const ids = new Set(visible.map((item) => item.id));
    const grouped = new Map();
    for (const scenario of pm.listScenarios()) {
      if (!ids.has(scenario.projectId)) continue;
      if (!grouped.has(scenario.projectId)) {
        const shell = shellProjects.find((item) => item.id === scenario.projectId);
        const ctx = pm.getProjectContext ? pm.getProjectContext(scenario.projectId) : null;
        grouped.set(scenario.projectId, {
          projectId: scenario.projectId,
          projectName: shell?.name || ctx?.projectName || scenario.projectId,
          customer: shell?.customer || ctx?.customer || "—",
          scenarios: [],
        });
      }
      const flows = Array.isArray(scenario.results?.full?.cashFlows)
        ? scenario.results.full.cashFlows.slice(0, 18).map((row) => ({
            monthIndex: Number(row.monthIndex) || 0,
            revenueCashIn: String(row.revenueCashIn ?? "0"),
            currentNetCashFlow: String(row.currentNetCashFlow ?? "0"),
            isProjectMonth: row.isProjectMonth !== false,
          }))
        : [];
      grouped.get(scenario.projectId).scenarios.push({
        id: scenario.id,
        name: scenario.name,
        status: scenario.status,
        projectId: scenario.projectId,
        metrics: scenario.results?.metrics || null,
        calculatedAt: scenario.results?.calculatedAt || null,
        inputs: scenario.inputs,
        cashFlows: flows,
      });
    }
    return [...grouped.values()];
  }

  function runSensitivity(params) {
    return global.PmCalc.runSensitivity(params);
  }

  function ensureSeed() {
    const list = loadAll();
    if (list.length) {
      if (!activeId() || !list.some((item) => item.id === activeId())) setActive(list[0].id);
      return list;
    }
    const api = core();
    if (!api) return [];
    const now = new Date().toISOString();
    const response = api.buildCenterResponse({
      question: SEED_QUESTION,
      projects: collectProjects(),
      runSensitivity,
    });
    const conv = {
      id: "seed-ops-analysis",
      title: "分析最近的测算项目经营情况",
      createdAt: now,
      updatedAt: now,
      context: response.context || {},
      messages: [
        { id: "seed-user", role: "user", text: SEED_QUESTION, createdAt: now },
        { id: "seed-ai", role: "assistant", response, createdAt: now },
      ],
    };
    saveAll([conv]);
    setActive(conv.id);
    return [conv];
  }

  function currentConversation() {
    const list = loadAll();
    return list.find((item) => item.id === activeId()) || list[0] || null;
  }

  function timeLabel(iso) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return "";
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (date >= start) {
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  }

  function sidebarHtml(list) {
    const api = core();
    const groups = api
      ? api.groupConversations(list)
      : { today: list, recent: [], earlier: [] };
    const sections = [
      ["今天", groups.today],
      ["最近7天", groups.recent],
      ["更早", groups.earlier],
    ];
    const body = sections
      .filter(([, items]) => items.length)
      .map(([label, items]) => {
        const rows = items
          .map((item) => {
            const active = item.id === (activeId() || list[0]?.id) ? " is-active" : "";
            return `<button type="button" class="ai-history-item${active}" data-ai-open="${esc(item.id)}"><span>${esc(item.title)}</span><time>${esc(timeLabel(item.updatedAt))}</time></button>`;
          })
          .join("");
        return `<div class="ai-history-group"><div class="ai-history-label">${label}</div>${rows}</div>`;
      })
      .join("");
    return `<aside class="ai-side" aria-label="我的对话"><div class="ai-side-head"><strong>我的对话</strong><button type="button" class="btn small primary" data-ai-new>+ 新建对话</button></div><div class="ai-history">${body || '<p class="help">还没有对话</p>'}</div></aside>`;
  }

  function questionsFor(conv) {
    const api = core();
    if (!api) return [];
    return api.suggestedQuestions(conv?.context?.projectId ? conv.context : undefined);
  }

  function railHtml(conv) {
    const questions = questionsFor(conv)
      .map((q) => `<button type="button" class="ai-suggest" data-ai-send="${esc(q)}">${esc(q)}</button>`)
      .join("");
    return `<aside class="ai-rail" aria-label="你可以这样问"><section><div class="ai-rail-title">你可以这样问</div><div class="ai-suggests">${questions}</div></section><section><div class="ai-rail-title">快捷操作</div><div class="ai-quick"><button type="button" class="btn" data-ai-send="帮我测算一个新的运输项目">新建测算项目</button><button type="button" class="btn" data-ai-picker="compare">项目对比分析</button><button type="button" class="btn" data-ai-send="哪些项目存在较大风险，原因是什么？">风险方案评估</button><button type="button" class="btn" data-ai-export>导出数据报表</button></div></section><section class="ai-cap"><div class="ai-rail-title">AI 助手能力</div><p>理解问题、读取已保存测算、在需要时调用测算引擎，再用图表和结论解释结果。月收入、成本、利润、利润率和车辆数不由模型估算。</p></section></aside>`;
  }

  function welcomeHtml() {
    const api = core();
    const items = [
      "从资料中提取项目参数",
      "新建项目测算",
      "分析项目盈利能力",
      "对比不同测算方案",
      "识别经营风险",
      "做敏感性分析",
      "解释测算结果",
      "生成经营分析结论",
    ];
    const chips = (api ? api.WELCOME_QUESTIONS : []).map((q) => `<button type="button" class="ai-suggest" data-ai-send="${esc(q)}">${esc(q)}</button>`).join("");
    return `<div class="ai-welcome"><div class="ai-avatar" aria-hidden="true">AI</div><div><h2>你好，我是项目测算 AI 助手</h2><p>我可以帮你：</p><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul><div class="ai-suggests">${chips}</div></div></div>`;
  }

  function chartSvg(block) {
    if (block.chartType === "pie") return pieSvg(block.slices || []);
    if (block.chartType === "horizontalBar") return hbarSvg(block);
    if (block.chartType === "line" || block.chartType === "sensitivity") return lineSvg(block);
    return barSvg(block);
  }

  function pieSvg(slices) {
    const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0) || 1;
    const colors = ["#3079fc", "#1dce7c", "#ff9126", "#7d8da1", "#e93c3a"];
    let angle = -Math.PI / 2;
    const paths = slices.map((slice, index) => {
      const sweep = (Math.max(0, slice.value) / total) * Math.PI * 2;
      if (sweep >= Math.PI * 2 - 0.001) return `<circle cx="50" cy="50" r="36" fill="${colors[index % colors.length]}" />`;
      const start = angle;
      angle += sweep;
      const x1 = 50 + 36 * Math.cos(start);
      const y1 = 50 + 36 * Math.sin(start);
      const x2 = 50 + 36 * Math.cos(angle);
      const y2 = 50 + 36 * Math.sin(angle);
      const large = sweep > Math.PI ? 1 : 0;
      return `<path d="M50 50 L${x1.toFixed(2)} ${y1.toFixed(2)} A36 36 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${colors[index % colors.length]}" />`;
    });
    return `<svg class="ai-pie" viewBox="0 0 100 100" role="img">${paths.join("")}<circle cx="50" cy="50" r="22" fill="#fff"/></svg>`;
  }

  function legend(block) {
    const colors = ["#3079fc", "#1dce7c", "#ff9126", "#7d8da1", "#e93c3a"];
    const items = block.slices
      ? block.slices.map((slice, index) => `<li><i style="background:${colors[index % colors.length]}"></i>${esc(slice.name)}</li>`)
      : (block.series || []).map((series, index) => `<li><i style="background:${colors[index % colors.length]}"></i>${esc(series.name)}</li>`);
    return items.length ? `<ul class="ai-legend">${items.join("")}</ul>` : "";
  }

  function barSvg(block) {
    const series = block.series || [];
    const cats = block.categories || [];
    const values = series.flatMap((item) => item.values);
    const min = Math.min(0, ...values, 0);
    const max = Math.max(0, ...values, 1);
    const span = max - min || 1;
    const width = 640;
    const height = 220;
    const left = 8;
    const bottom = 28;
    const top = 12;
    const plotW = width - left - 8;
    const plotH = height - top - bottom;
    const group = plotW / Math.max(cats.length, 1);
    const barW = Math.max(6, (group * 0.7) / Math.max(series.length, 1));
    const colors = ["#3079fc", "#1dce7c", "#ff9126"];
    const yOf = (value) => top + ((max - value) / span) * plotH;
    const zero = yOf(0);
    const bars = series
      .map((item, sIndex) =>
        item.values
          .map((value, i) => {
            const x = left + i * group + (group - series.length * barW) / 2 + sIndex * barW;
            const y = yOf(Math.max(value, 0));
            const y2 = yOf(Math.min(value, 0));
            const h = Math.max(1, Math.abs(y2 - y));
            const fill = value < 0 ? "#e93c3a" : colors[sIndex % colors.length];
            return `<rect x="${x.toFixed(1)}" y="${Math.min(y, y2).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${fill}" />`;
          })
          .join(""),
      )
      .join("");
    const labels = cats
      .map((cat, i) => `<text x="${(left + i * group + group / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="11" fill="#666">${esc(cat)}</text>`)
      .join("");
    return `<svg class="ai-plot" viewBox="0 0 ${width} ${height}" role="img"><line x1="${left}" y1="${zero.toFixed(1)}" x2="${width - 8}" y2="${zero.toFixed(1)}" stroke="#edf0f4"/>${bars}${labels}</svg>`;
  }

  function hbarSvg(block) {
    const values = block.series?.[0]?.values || [];
    const cats = block.categories || [];
    const min = Math.min(0, ...values, 0);
    const max = Math.max(0, ...values, 1);
    const span = max - min || 1;
    const rowH = 28;
    const height = Math.max(48, cats.length * rowH + 8);
    const rows = values
      .map((value, index) => {
        const y = 8 + index * rowH;
        const w = (Math.abs(value) / span) * 280;
        const x = value < 0 ? 220 - w : 220;
        return `<text x="8" y="${y + 14}" font-size="11" fill="#333">${esc(cats[index] || "")}</text><rect x="${x.toFixed(1)}" y="${y + 4}" width="${Math.max(w, 1).toFixed(1)}" height="12" rx="2" fill="${value < 0 ? "#e93c3a" : "#3079fc"}"/>`;
      })
      .join("");
    return `<svg class="ai-plot" viewBox="0 0 520 ${height}" role="img">${rows}</svg>`;
  }

  function lineSvg(block) {
    const values = block.series?.[0]?.values || [];
    const cats = block.categories || [];
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const span = max - min || 1;
    const width = 640;
    const height = 220;
    const left = 12;
    const top = 16;
    const plotW = width - 24;
    const plotH = 160;
    const step = values.length > 1 ? plotW / (values.length - 1) : plotW;
    const coords = values.map((value, index) => {
      const x = left + index * step;
      const y = top + ((max - value) / span) * plotH;
      return [x, y];
    });
    const d = coords.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");
    const hi = typeof block.highlightIndex === "number" ? coords[block.highlightIndex] : null;
    const stepLabel = Math.max(1, Math.ceil(cats.length / 6));
    const labels = cats
      .map((cat, index) => ({ cat, index }))
      .filter((item) => item.index % stepLabel === 0)
      .map((item) => `<text x="${(left + item.index * step).toFixed(1)}" y="${height - 10}" text-anchor="middle" font-size="11" fill="#666">${esc(item.cat)}</text>`);
    const dot = hi ? `<circle cx="${hi[0].toFixed(1)}" cy="${hi[1].toFixed(1)}" r="4" fill="#e93c3a"/>` : "";
    return `<svg class="ai-plot" viewBox="0 0 ${width} ${height}" role="img"><path d="${d}" fill="none" stroke="#3079fc" stroke-width="2"/>${dot}${labels.join("")}</svg>`;
  }

  function kpiHtml(items) {
    return `<div class="ai-kpis">${items
      .map((item) => {
        const unit = item.unit && item.value !== "—" ? `<em>${esc(item.unit)}</em>` : "";
        return `<button type="button" class="ai-kpi" title="${esc(item.hint || item.label)}" data-ai-scroll="table"><span>${esc(item.label)}</span><strong>${esc(item.value)}${unit}</strong><small class="is-${esc(item.trend)}">${esc(item.trendLabel || "")}</small></button>`;
      })
      .join("")}</div>`;
  }

  function tableHtml(block) {
    const head = `<div class="ai-table-head"><strong>${esc(block.title || "明细")}</strong><span><button type="button" class="btn ghost small" data-ai-view="list">查看全部</button><button type="button" class="btn ghost small" data-ai-export>导出</button></span></div>`;
    const columns = block.columns || [];
    const rows = (block.rows || [])
      .map((row) => {
        const cells = columns
          .map((col) => {
            const value = row[col.key] ?? "—";
            const signed = col.signed && typeof row.profitRaw === "number";
            const cls = signed ? (row.profitRaw < 0 ? "is-negative" : row.profitRaw > 0 ? "is-positive" : "") : "";
            const align = col.align === "right" ? "num" : "";
            return `<td class="${align} ${cls}">${esc(value)}</td>`;
          })
          .join("");
        const enter = row.projectId
          ? `<td><button type="button" class="btn ghost small" data-ai-go="${esc(`/projects/${row.projectId}/calculation${row.scenarioId ? `/${row.scenarioId}` : ""}`)}">进入项目</button></td>`
          : "<td></td>";
        return `<tr>${cells}${enter}</tr>`;
      })
      .join("");
    return `<div class="ai-table" data-ai-table><div class="table-wrap">${head}<table><thead><tr>${columns.map((col) => `<th class="${col.align === "right" ? "num" : ""}">${esc(col.label)}</th>`).join("")}<th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="8">暂无明细</td></tr>'}</tbody></table></div></div>`;
  }

  function blockHtml(block) {
    if (!block) return "";
    if (block.type === "text") return `<p class="ai-text">${esc(block.text)}</p>`;
    if (block.type === "kpi") return kpiHtml(block.data || []);
    if (block.type === "chart") {
      return `<figure class="ai-chart"><figcaption>${esc(block.title)}</figcaption>${chartSvg(block)}${legend(block)}${block.note ? `<p class="help">${esc(block.note)}</p>` : ""}</figure>`;
    }
    if (block.type === "table") return tableHtml(block);
    if (block.type === "conclusion") {
      return `<section class="ai-conclusion"><h3>${esc(block.title || "AI 结论与建议")}</h3><ol>${(block.items || []).map((item) => `<li>${esc(item)}</li>`).join("")}</ol></section>`;
    }
    if (block.type === "risk") {
      const cards = (block.data || [])
        .map((item) => {
          const tone = item.level === "高" ? "danger" : item.level === "中" ? "warning" : "success";
          const go = item.projectId ? ` data-ai-go="/projects/${esc(item.projectId)}/calculation${item.scenarioId ? `/${esc(item.scenarioId)}` : ""}"` : "";
          return `<article class="ai-risk"><div><strong>${esc(item.name)}</strong><span class="tag ${tone}">${esc(item.level)}</span></div><p>${esc(item.evidence)}</p>${go ? `<button type="button" class="btn ghost small" ${go}>进入项目</button>` : ""}</article>`;
        })
        .join("");
      return `<section class="ai-risks"><h3>风险提示</h3><div class="ai-risk-grid">${cards || '<p class="help">暂无需要标出的风险</p>'}</div></section>`;
    }
    if (block.type === "calculation") {
      const profit = (block.items || []).find((item) => item.label === "月利润");
      const summary = profit
        ? `<p class="ai-sensitivity-summary" data-ai-sensitivity>原月利润 ${esc(profit.before)}，调整后月利润 ${esc(profit.after)}，利润变化 ${esc(profit.delta)}。</p>`
        : "";
      const rows = (block.items || [])
        .map((item) => {
          const neg = typeof item.deltaRaw === "number" && item.deltaRaw < 0 ? "is-negative" : "is-positive";
          return `<tr data-ai-metric="${esc(item.label)}"><td>${esc(item.label)}</td><td class="num" data-ai-before>${esc(item.before)}</td><td class="num" data-ai-after>${esc(item.after)}</td><td class="num ${neg}" data-ai-delta>${esc(item.delta)}</td></tr>`;
        })
        .join("");
      return `<section class="ai-calc"><h3>${esc(block.title)}</h3>${summary}<div class="table-wrap"><table><thead><tr><th>指标</th><th class="num">${esc(block.beforeLabel)}</th><th class="num">${esc(block.afterLabel)}</th><th class="num">变化</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    }
    return "";
  }

  function actionsHtml(actions) {
    if (!actions?.length) return "";
    return `<div class="ai-actions">${actions
      .map((action) => {
        if (action.kind === "navigate") return `<button type="button" class="btn small" data-ai-go="${esc(action.href || "")}">${esc(action.label)}</button>`;
        if (action.kind === "ask") return `<button type="button" class="btn small" data-ai-send="${esc(action.ask || action.label)}">${esc(action.label)}</button>`;
        if (action.kind === "export") return `<button type="button" class="btn small" data-ai-export>${esc(action.label)}</button>`;
        if (action.kind === "picker") return `<button type="button" class="btn small" data-ai-picker="${esc(action.picker || "compare")}">${esc(action.label)}</button>`;
        if (action.kind === "import") return `<button type="button" class="btn small" data-ai-import>${esc(action.label)}</button>`;
        if (action.kind === "import-confirm") return `<button type="button" class="btn small primary" data-ai-import-confirm>${esc(action.label)}</button>`;
        if (action.kind === "import-edit") return `<button type="button" class="btn small" data-ai-import-edit>${esc(action.label)}</button>`;
        return "";
      })
      .join("")}</div>`;
  }

  function messageHtml(message) {
    if (message.role === "user") {
      return `<article class="ai-msg is-user"><div class="ai-bubble">${esc(message.text || "")}</div></article>`;
    }
    if (message.pending) {
      return `<article class="ai-msg"><div class="ai-avatar" aria-hidden="true">AI</div><div class="ai-loading" role="status"><strong>${esc(message.stage || "正在理解你的问题...")}</strong><span class="ai-loading-bar"></span></div></article>`;
    }
    const response = message.response || { message: message.text || "", blocks: [], actions: [] };
    const error = message.error
      ? `<div class="ai-error" role="status" data-ai-fallback="1"><p>${esc(FALLBACK_COPY)}</p><div><button type="button" class="btn small" data-ai-retry>重新生成</button><button type="button" class="btn small" data-ai-view="list">进入传统测算</button></div></div>`
      : "";
    const stopped = message.stopped ? `<p class="help">已停止生成。</p>` : "";
    return `<article class="ai-msg"><div class="ai-avatar" aria-hidden="true">AI</div><div class="ai-answer">${error}${stopped}<p class="ai-lead">${esc(response.message || "")}</p>${(response.blocks || []).map(blockHtml).join("")}${actionsHtml(response.actions)}</div></article>`;
  }

  function threadHtml(conv) {
    if (!conv || !conv.messages?.length) return welcomeHtml();
    return conv.messages.map(messageHtml).join("");
  }

  function render(options) {
    const api = core();
    const list = api ? ensureSeed() : [];
    const conv = list.find((item) => item.id === activeId()) || list[0] || null;
    const mode = aiMode();
    if (!api) {
      return `${options.breadcrumbHtml || ""}<div class="page-head"><div><h1>项目测算中心</h1><p>AI 工作台未加载，传统测算仍可使用。</p></div><div class="head-actions"><button type="button" class="btn primary" data-calc-view="list">传统列表视图</button></div></div>`;
    }
    return `${options.breadcrumbHtml || ""}
      <div class="page-head ai-page-head"><div><h1>项目测算中心</h1><p>和 AI 一起，快速完成项目测算、方案对比与经营分析</p></div>
        <div class="head-actions"><div class="ai-view-toggle" role="tablist"><button type="button" class="btn small primary" data-ai-view="ai">AI对话测算</button><button type="button" class="btn small" data-ai-view="list">传统列表视图</button></div>${options.demoToolsHtml || ""}</div>
      </div>
      <div class="ai-center ${collapsed.left ? "is-left-collapsed" : ""} ${collapsed.right ? "is-right-collapsed" : ""}" id="ai-center" data-ai-mode="${esc(mode)}">
        <div class="ai-fold"><button type="button" class="btn ghost small" data-ai-collapse="left">${collapsed.left ? "展开对话" : "收起对话"}</button><button type="button" class="btn ghost small" data-ai-collapse="right">${collapsed.right ? "展开推荐" : "收起推荐"}</button></div>
        ${sidebarHtml(list)}
        <section class="ai-main" aria-label="AI 对话"><div class="ai-thread" id="ai-thread">${threadHtml(conv)}</div>
          <form class="ai-composer" id="ai-form">
            <button type="button" class="btn ghost" id="ai-attach" aria-label="上传附件">附件</button>
            <input id="ai-file" type="file" hidden accept=".xlsx,.xls,.pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf">
            <textarea id="ai-input" rows="1" maxlength="2000" placeholder="请输入您的问题，例如：&quot;帮我对比杭州和临港项目的盈利能力&quot;"></textarea>
            <button type="submit" class="btn primary" id="ai-send">发送</button>
          </form>
        </section>
        ${railHtml(conv)}
        <div class="ai-picker" id="ai-picker" hidden></div>
      </div>`;
  }

  function paintThread() {
    const node = $("#ai-thread");
    if (!node) return;
    node.innerHTML = threadHtml(currentConversation());
    node.scrollTop = node.scrollHeight;
  }

  function paintChrome() {
    const root = $("#ai-center");
    if (!root) return;
    const list = loadAll();
    const side = $(".ai-side", root);
    const rail = $(".ai-rail", root);
    if (side) side.outerHTML = sidebarHtml(list);
    if (rail) rail.outerHTML = railHtml(currentConversation());
    paintThread();
  }

  function stagesFor(intent) {
    if (intent === "SENSITIVITY_ANALYSIS") return ["正在理解你的问题...", "正在读取项目数据...", "正在执行测算...", "正在生成分析..."];
    if (intent === "CREATE_CALCULATION" || intent === "GENERAL_CHAT") return ["正在理解你的问题...", "正在生成分析..."];
    return ["正在理解你的问题...", "正在读取项目数据...", "正在生成分析..."];
  }

  function updateConversation(conv) {
    const list = loadAll().filter((item) => item.id !== conv.id);
    list.unshift(conv);
    saveAll(list);
    setActive(conv.id);
  }

  async function maybePolish(response, question, signal) {
    if (aiMode() !== "deepseek") return false;
    if (localStorage.getItem(FAIL_KEY) === "1") {
      const error = new Error("timeout");
      error.name = "TimeoutError";
      throw error;
    }
    const snapshot = collectProjects().map((project) => project.scenarios.find((s) => s.metrics)?.metrics).find(Boolean) || { source: "engine" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const run = global.DemoApi?.fetch
        ? (path, init) => global.DemoApi.fetch(path, init)
        : (path, init) => fetch(path, init);
      const res = await run("/api/demo-ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          engineMetrics: snapshot,
          localNarrative: response.message,
          instruction: "只润色解释，禁止新增或改写任何金额、利润率、车辆数。",
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.text || data.fallback === true) throw new Error("ai-unavailable");
      const allowed = JSON.stringify(response);
      const numbers = String(data.text).match(/\d[\d,]*(?:\.\d+)?/g) || [];
      const safe = numbers.every((raw) => allowed.includes(raw) || allowed.includes(raw.replace(/,/g, "")));
      if (!safe) throw new Error("ai-unavailable");
      response.blocks = response.blocks.concat([{ type: "text", text: `补充说明（不改变测算数字）：${data.text}` }]);
      return false;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function submit(text) {
    const question = String(text || "").trim();
    if (!question || loading || !core()) return;
    const existing = currentConversation();
    const now = new Date().toISOString();
    const conv = existing || {
      id: uid(),
      title: "新对话",
      createdAt: now,
      updatedAt: now,
      context: {},
      messages: [],
    };
    if (!conv.messages.length) conv.title = core().conversationTitle(question);
    else if (conv.messages.filter((item) => item.role === "user").length === 0) conv.title = core().conversationTitle(question);
    conv.messages.push({ id: uid(), role: "user", text: question, createdAt: now });
    const pending = { id: uid(), role: "assistant", pending: true, stage: "正在理解你的问题...", createdAt: now };
    conv.messages.push(pending);
    conv.updatedAt = new Date().toISOString();
    updateConversation(conv);
    loading = true;
    const token = ++generation;
    paintChrome();
    syncSendButton();
    const input = $("#ai-input");
    if (input) input.value = "";
    try {
      if (/演示资料/.test(question)) {
        await runImport({ sample: true, conv, pending, token });
        return;
      }
      const intent = core().detectIntent(question);
      for (const stage of stagesFor(intent)) {
        if (token !== generation) break;
        pending.stage = stage;
        paintThread();
        await sleep(global.__AI_CENTER_FAST ? 0 : 280);
      }
      if (token !== generation) {
        pending.pending = false;
        pending.stopped = true;
        pending.response = { intent, message: "已停止生成。项目数据没有变化。", blocks: [], actions: [] };
        updateConversation(conv);
        return;
      }
      const response = core().buildCenterResponse({
        question,
        intent,
        projects: collectProjects(),
        runSensitivity,
        focusProjectId: conv.context?.projectId,
      });
      let failed = false;
      if (aiMode() === "deepseek") {
        pending.stage = "正在生成分析...";
        paintThread();
        try {
          await maybePolish(response, question);
        } catch {
          failed = true;
        }
      }
      if (token !== generation) {
        pending.pending = false;
        pending.stopped = true;
        pending.response = response;
        updateConversation(conv);
        return;
      }
      pending.pending = false;
      pending.response = response;
      pending.error = failed;
      if (response.context) conv.context = { ...conv.context, ...response.context };
      conv.updatedAt = new Date().toISOString();
      updateConversation(conv);
    } finally {
      loading = false;
      paintChrome();
      syncSendButton();
    }
  }

  function mapParams(parameters) {
    return (parameters || []).map((item) => ({
      label: item.label,
      value: item.normalizedValue ?? item.value,
      unit: item.unit,
      status: item.status,
      group: item.group || "参数",
    }));
  }

  async function runImport({ sample, file, conv, pending, token }) {
    const api = global.PmCalc?.importApi;
    pending.stage = sample ? "正在识别项目参数..." : "正在识别项目参数...";
    paintThread();
    await sleep(global.__AI_CENTER_FAST ? 0 : 300);
    if (!api || token !== generation) {
      pending.pending = false;
      pending.error = true;
      pending.response = {
        intent: "IMPORT_CALCULATION",
        message: "资料识别没有完成。",
        blocks: [],
        actions: [{ id: "list", label: "进入传统测算", kind: "navigate", href: "view:list" }],
      };
      updateConversation(conv);
      loading = false;
      paintChrome();
      syncSendButton();
      return;
    }
    try {
      const session = api.createSession({ source: "ai-center" });
      if (sample) api.loadDemoSamples(session.id);
      else {
        const added = api.addFiles(session.id, [{ name: file.name, mimeType: file.type || "", size: file.size || 0 }]);
        if (!added?.trace?.ok) throw new Error(added?.trace?.detail || "文件未能加入解析");
      }
      const parsed = api.parseFiles(session.id);
      const ready = parsed.session || api.getSession(session.id);
      const response = core().buildImportPreview(sample ? (ready?.files?.[0]?.name || "演示测算资料") : file.name, mapParams(ready?.parameters));
      response.context = { importSessionId: session.id };
      pending.pending = false;
      pending.response = response;
      conv.context = { ...conv.context, importSessionId: session.id };
      conv.updatedAt = new Date().toISOString();
      updateConversation(conv);
    } catch (err) {
      pending.pending = false;
      pending.error = true;
      const raw = String(err?.message || "");
      const friendly = raw.length > 80 || /stack|TypeError|at\s+\w+/.test(raw)
        ? "资料识别暂时不可用，可改用演示资料或手动填写。项目测算不受影响。"
        : raw || "资料识别暂时不可用，可改用演示资料或手动填写。项目测算不受影响。";
      pending.response = {
        intent: "IMPORT_CALCULATION",
        message: friendly,
        blocks: [],
        actions: [
          { id: "retry", label: "重新生成", kind: "import" },
          { id: "list", label: "进入传统测算", kind: "navigate", href: "view:list" },
        ],
      };
      updateConversation(conv);
    } finally {
      loading = false;
      paintChrome();
      syncSendButton();
    }
  }

  async function attachFile(file) {
    if (!file || loading) return;
    const allowed = /\.(xlsx|xls|pdf|docx?|png|jpe?g)$/i;
    if (!allowed.test(file.name)) {
      notify("请上传 Excel、PDF、Word 或图片", "error");
      return;
    }
    const now = new Date().toISOString();
    const conv = currentConversation() || { id: uid(), title: "导入资料测算", createdAt: now, updatedAt: now, context: {}, messages: [] };
    conv.messages.push({ id: uid(), role: "user", text: `已上传：${file.name}`, createdAt: now });
    const pending = { id: uid(), role: "assistant", pending: true, stage: "AI 正在识别项目参数...", createdAt: now };
    conv.messages.push(pending);
    updateConversation(conv);
    loading = true;
    const token = ++generation;
    paintChrome();
    syncSendButton();
    await runImport({ file, conv, pending, token });
  }

  function confirmImport() {
    const api = global.PmCalc?.importApi;
    const conv = currentConversation();
    const sessionId = conv?.context?.importSessionId;
    if (!api || !sessionId) {
      notify("没有可确认的导入会话", "error");
      return;
    }
    const gate = api.canStart(sessionId);
    if (!gate.ok) {
      notify(gate.reasons?.[0] || "还有参数需要确认", "error");
      navigate(`/calculation/import/${sessionId}`);
      return;
    }
    const user = typeof state !== "undefined" ? state.user : null;
    const result = api.createScenario(sessionId, {
      createTempProject: true,
      tempName: "AI导入测算项目",
      region: user?.region && user.region !== "—" ? user.region : "华东大区",
      ownerName: user?.name || "林晨",
    });
    if (!result?.scenario || !result.project) {
      notify(result?.errors?.[0] || "还不能开始测算", "error");
      navigate(`/calculation/import/${sessionId}`);
      return;
    }
    if (typeof projects !== "undefined" && !projects.some((item) => item.id === result.project.projectId)) {
      projects.push({
        id: result.project.projectId,
        name: result.project.projectName,
        customer: result.project.customer || "待补客户",
        region: result.project.region || "华东大区",
        owner: user?.name || result.project.owner || "林晨",
        members: user?.name ? [user.name] : [],
        stage: "10%线索建联",
        status: "进行中",
        eco: "未对接",
        tractor: result.scenario.inputs?.fleetSize || 0,
        trailer: 0,
        updated: "",
        type: "临时测算",
        source: "AI导入",
        place: "",
      });
    }
    notify("已调用测算引擎并保存方案");
    navigate(`/projects/${result.project.projectId}/calculation/${result.scenario.id}`);
  }

  function exportCsv() {
    const rows = collectProjects();
    const money = global.PmCalc?.formatMoney || ((value) => String(value ?? ""));
    const pct = global.PmCalc?.formatPercent || ((value) => String(value ?? ""));
    const header = ["项目", "方案", "月收入", "月成本", "月利润", "利润率", "车辆数"];
    const body = rows.map((project) => {
      const scenario = [...project.scenarios].filter((item) => item.metrics && item.calculatedAt).sort((a, b) => String(b.calculatedAt).localeCompare(String(a.calculatedAt)))[0] || project.scenarios.find((item) => item.metrics);
      const metrics = scenario?.metrics;
      return [project.projectName, scenario?.name || "", metrics ? money(metrics.monthlyRevenue) : "", metrics ? money(metrics.monthlyTotalCost) : "", metrics ? money(metrics.monthlyProfit) : "", metrics ? pct(metrics.profitMargin) : "", metrics?.fleetSize ?? ""];
    });
    const csv = `\uFEFF${[header, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "项目测算经营分析.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    notify("已导出当前测算结果");
  }

  function openPicker(kind) {
    const host = $("#ai-picker");
    if (!host) return;
    const rows = collectProjects();
    if (rows.length < (kind === "compare" ? 2 : 1)) {
      notify(kind === "compare" ? "至少需要 2 个测算项目" : "还没有可复制的项目", "error");
      return;
    }
    host.hidden = false;
    host.innerHTML = `<div class="ai-picker-card" role="dialog" aria-modal="true"><h3>${kind === "compare" ? "选择要对比的项目" : "复制哪一个项目的测算"}</h3><p>${kind === "compare" ? "最少选择 2 个项目，确认后用已保存结果生成对比。" : "将进入该项目并新建方案，参数来自演示基准，确认后才测算。"}</p><div class="ai-picker-list">${rows
      .map((project) => `<label><input type="${kind === "compare" ? "checkbox" : "radio"}" name="ai-pick" value="${esc(project.projectId)}"> ${esc(project.projectName)}</label>`)
      .join("")}</div><div class="ai-actions"><button type="button" class="btn" data-ai-picker-close>取消</button><button type="button" class="btn primary" data-ai-picker-ok="${esc(kind)}">确定</button></div></div>`;
  }

  function confirmPicker(kind) {
    const host = $("#ai-picker");
    const checked = [...(host?.querySelectorAll("input:checked") || [])].map((input) => input.value);
    if (kind === "compare") {
      if (checked.length < 2) {
        notify("请至少选择 2 个项目", "error");
        return;
      }
      const names = checked.map((id) => collectProjects().find((item) => item.projectId === id)?.projectName || id);
      if (host) host.hidden = true;
      void submit(`对比${names.join("和")}的盈利能力`);
      return;
    }
    if (!checked[0]) {
      notify("请选择项目", "error");
      return;
    }
    if (host) host.hidden = true;
    global.CalculationApp?.createScenarioForProject?.(checked[0]);
  }

  function syncSendButton() {
    const button = $("#ai-send");
    if (!button) return;
    button.textContent = loading ? "停止" : "发送";
    button.dataset.mode = loading ? "stop" : "send";
  }

  function newConversation() {
    const now = new Date().toISOString();
    const conv = { id: uid(), title: "新对话", createdAt: now, updatedAt: now, context: {}, messages: [] };
    const list = loadAll();
    list.unshift(conv);
    saveAll(list);
    setActive(conv.id);
    generation += 1;
    loading = false;
    rerenderApp();
    setTimeout(() => $("#ai-input")?.focus(), 0);
  }

  function retry() {
    const conv = currentConversation();
    const lastUser = [...(conv?.messages || [])].reverse().find((item) => item.role === "user");
    if (!lastUser || !conv) return;
    conv.messages = conv.messages.filter((item) => item !== conv.messages[conv.messages.length - 1] || item.role !== "assistant");
    const previous = conv.messages[conv.messages.length - 1];
    if (previous?.role === "user") conv.messages.pop();
    updateConversation(conv);
    void submit(lastUser.text.startsWith("已上传：") ? "请用演示资料识别项目参数" : lastUser.text);
  }

  function bind() {
    const root = $("#ai-center");
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";
    const modeSelect = $("#ai-mode-select");
    if (modeSelect) {
      modeSelect.value = aiMode();
      modeSelect.onchange = () => {
        setMode(modeSelect.value);
        notify(modeSelect.value === "deepseek" ? "已切换为 deepseek，解读走服务端" : "已切换为 mock，不请求外部 API");
      };
    }
    $("#ai-force-fail")?.addEventListener("click", () => {
      const next = localStorage.getItem(FAIL_KEY) === "1" ? "0" : "1";
      localStorage.setItem(FAIL_KEY, next);
      if (next === "1") setMode("deepseek");
      if (modeSelect) modeSelect.value = aiMode();
      notify(next === "1" ? "下一次对话将模拟 DeepSeek 超时" : "已取消模拟超时");
    });
    root.addEventListener("click", (event) => {
      const target = event.target.closest("[data-ai-new],[data-ai-open],[data-ai-send],[data-ai-go],[data-ai-view],[data-ai-export],[data-ai-picker],[data-ai-import],[data-ai-import-confirm],[data-ai-import-edit],[data-ai-retry],[data-ai-collapse],[data-ai-scroll],[data-ai-picker-close],[data-ai-picker-ok]");
      if (!target || !root.contains(target)) return;
      if (target.dataset.aiNew != null) {
        newConversation();
        return;
      }
      if (target.dataset.aiOpen) {
        setActive(target.dataset.aiOpen);
        paintChrome();
        return;
      }
      if (target.dataset.aiSend) {
        void submit(target.dataset.aiSend);
        return;
      }
      if (target.dataset.aiGo) {
        navigate(target.dataset.aiGo);
        return;
      }
      if (target.dataset.aiView) {
        setView(target.dataset.aiView);
        if (typeof global.render === "function") global.render();
        return;
      }
      if (target.dataset.aiExport != null) {
        exportCsv();
        return;
      }
      if (target.dataset.aiPicker) {
        openPicker(target.dataset.aiPicker);
        return;
      }
      if (target.dataset.aiPickerClose != null) {
        const host = $("#ai-picker");
        if (host) host.hidden = true;
        return;
      }
      if (target.dataset.aiPickerOk) {
        confirmPicker(target.dataset.aiPickerOk);
        return;
      }
      if (target.dataset.aiImport != null) {
        $("#ai-file")?.click();
        return;
      }
      if (target.dataset.aiImportConfirm != null) {
        confirmImport();
        return;
      }
      if (target.dataset.aiImportEdit != null) {
        const sessionId = currentConversation()?.context?.importSessionId;
        if (sessionId) navigate(`/calculation/import/${sessionId}`);
        else notify("请先上传资料", "error");
        return;
      }
      if (target.dataset.aiRetry != null) {
        retry();
        return;
      }
      if (target.dataset.aiCollapse) {
        const key = target.dataset.aiCollapse;
        collapsed[key] = !collapsed[key];
        if (typeof global.render === "function") global.render();
        return;
      }
      if (target.dataset.aiScroll) {
        $("#ai-thread [data-ai-table]")?.scrollIntoView({ block: "nearest" });
      }
    });
    $("#ai-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = $("#ai-send");
      if (button?.dataset.mode === "stop") {
        generation += 1;
        loading = false;
        syncSendButton();
        return;
      }
      void submit($("#ai-input")?.value || "");
    });
    $("#ai-input")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        $("#ai-form")?.requestSubmit();
      }
    });
    $("#ai-input")?.addEventListener("input", (event) => {
      const input = event.target;
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    });
    $("#ai-attach")?.addEventListener("click", () => $("#ai-file")?.click());
    $("#ai-file")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void attachFile(file);
    });
    const thread = $("#ai-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  function resetLeadershipDemo() {
    try {
      localStorage.removeItem(storageKey());
      localStorage.setItem(core()?.AI_MODE_STORAGE_KEY || "pm-ai-mode", "mock");
      localStorage.removeItem(FAIL_KEY);
      sessionStorage.removeItem(ACTIVE_KEY);
      sessionStorage.setItem(VIEW_KEY, "ai");
    } catch {
      /* ignore */
    }
    if (typeof projects !== "undefined" && Array.isArray(projects)) {
      for (let i = projects.length - 1; i >= 0; i -= 1) {
        if (projects[i]?.source === "AI导入" || projects[i]?.type === "临时测算") projects.splice(i, 1);
      }
    }
    generation += 1;
    loading = false;
    global.PmCalc?.resetDemoData?.();
    const route = String(location.hash || "").replace(/^#/, "");
    if (route !== "/calculation") {
      if (typeof go === "function") go("/calculation");
      else location.hash = "/calculation";
    }
  }

  global.AiCenter = { render, bind, getView, setView, resetLeadershipDemo };
})(window);
