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
    left: typeof matchMedia === "function" && matchMedia("(max-width: 1023px)").matches,
    right: typeof matchMedia === "function" && matchMedia("(max-width: 1279px)").matches,
  };
  let attachments = [];
  let openMenuId = "";
  let showDropzone = false;
  let filePickIntent = "stage";
  let drawer = null;

  const KEY_FIELDS = [
    { key: "fleetSize", label: "车辆数量", unit: "台", group: "项目运营", kind: "fleet" },
    { key: "tripsPerVehicleMonth", label: "单车月趟次", unit: "趟", group: "项目运营", kind: "segment" },
    { key: "distanceKm", label: "运输距离", unit: "km", group: "项目运营", kind: "segment" },
    { key: "electricityPrice", label: "能源单价", unit: "元/kWh", group: "成本", kind: "segment" },
    { key: "freightPrice", label: "运价", unit: "元", group: "成本", kind: "segment" },
    { key: "monthlyRentPerVehicle", label: "单车月租", unit: "元", group: "成本", kind: "rent" },
    { key: "loadedEnergyConsumption", label: "重载能耗", unit: "kWh/km", group: "成本", kind: "segment" },
    { key: "driverCostPerTrip", label: "司机单趟成本", unit: "元/趟", group: "成本", kind: "segment" },
  ];

  const WELCOME_SCENES = [
    { icon: "✦", title: "帮我测算一个新项目", desc: "从项目资料开始测算", ask: "帮我测算一个新的运输项目" },
    { icon: "▣", title: "分析已有项目经营情况", desc: "收入、成本与利润分析", ask: "分析最近测算项目经营情况" },
    { icon: "⇄", title: "对比两个测算方案", desc: "找出关键差异", ask: "对比两个项目的盈利能力" },
    { icon: "!", title: "识别项目经营风险", desc: "找出敏感因素和风险点", ask: "哪些项目存在较大风险，原因是什么？" },
  ];

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

  function readField(inputs, field) {
    if (!inputs || !field) return null;
    if (field.kind === "fleet") {
      const value = inputs.fleetSize ?? inputs.vehicle?.fleetSize;
      return value == null || value === "" ? null : value;
    }
    if (field.kind === "rent") {
      const value = inputs.vehicle?.monthlyRentPerVehicle;
      return value == null || value === "" ? null : value;
    }
    const segment = inputs.routes?.[0]?.segments?.[0];
    if (!segment) return null;
    const value = segment[field.key];
    return value == null || value === "" ? null : value;
  }

  function writeField(inputs, field, value) {
    if (field.kind === "fleet") {
      const count = Math.max(1, Math.round(Number(value)));
      inputs.fleetSize = count;
      if (inputs.vehicle) inputs.vehicle.fleetSize = count;
      return;
    }
    if (field.kind === "rent") {
      if (!inputs.vehicle) inputs.vehicle = {};
      inputs.vehicle.monthlyRentPerVehicle = String(value);
      return;
    }
    for (const route of inputs.routes || []) {
      for (const segment of route.segments || []) segment[field.key] = String(value);
    }
  }

  function latestOf(project) {
    if (!project) return null;
    const calculated = (project.scenarios || []).filter((item) => item.metrics && item.calculatedAt);
    if (calculated.length) return [...calculated].sort((a, b) => String(b.calculatedAt).localeCompare(String(a.calculatedAt)))[0];
    return (project.scenarios || []).find((item) => item.metrics) || project.scenarios?.[0] || null;
  }

  function focusedBundle(conv) {
    const projects = collectProjects();
    const project = conv?.context?.projectId ? projects.find((item) => item.projectId === conv.context.projectId) : null;
    const scenario = project
      ? project.scenarios.find((item) => item.id === conv.context?.schemeId) || latestOf(project)
      : null;
    const sessionId = conv?.context?.importSessionId;
    const session = sessionId && global.PmCalc?.importApi?.getSession ? global.PmCalc.importApi.getSession(sessionId) : null;
    return { project, scenario, session };
  }

  function sidebarHtml(list) {
    const api = core();
    const groups = api ? api.groupConversations(list) : { today: list, recent: [], earlier: [] };
    const sections = [
      ["今天", groups.today],
      ["最近 7 天", groups.recent],
      ["更早", groups.earlier],
    ];
    const body = sections
      .filter(([, items]) => items.length)
      .map(([label, items]) => {
        const rows = items
          .map((item) => {
            const active = item.id === (activeId() || list[0]?.id) ? " is-active" : "";
            const menu = openMenuId === item.id ? " is-menu" : "";
            const title = item.title && item.title !== "新对话" ? item.title : "新测算";
            const pop = openMenuId === item.id
              ? `<div class="ai-history-pop" role="menu"><button type="button" data-ai-rename="${esc(item.id)}">重命名</button><button type="button" data-ai-delete="${esc(item.id)}">删除</button></div>`
              : "";
            return `<div class="ai-history-item${active}${menu}" data-ai-open="${esc(item.id)}" role="button" tabindex="0"><div class="ai-history-main"><span>${esc(title)}</span><time>${esc(timeLabel(item.updatedAt))}</time></div><button type="button" class="ai-history-more" data-ai-menu="${esc(item.id)}" aria-label="会话操作">⋯</button>${pop}</div>`;
          })
          .join("");
        return `<div class="ai-history-group"><div class="ai-history-label">${label}</div>${rows}</div>`;
      })
      .join("");
    return `<aside class="ai-side" aria-label="测算会话"><div class="ai-side-head"><strong>测算会话</strong></div><button type="button" class="btn primary ai-new" data-ai-new>+ 新建测算</button><div class="ai-history">${body || '<p class="help">还没有测算</p>'}</div></aside>`;
  }

  function railHtml(conv) {
    const { project, scenario, session } = focusedBundle(conv);
    if (!project && !session) {
      return `<aside class="ai-rail" aria-label="当前测算"><div class="ai-rail-title">当前测算</div><div class="ai-context-empty"><strong>当前暂无测算项目</strong><p>创建项目或导入资料后，这里会展示 AI 已理解的项目参数。</p></div></aside>`;
    }
    const params = session?.parameters || [];
    const recognized = params.filter((item) => item.status !== "MISSING" && item.normalizedValue != null && item.normalizedValue !== "");
    const pending = params.filter((item) => item.status === "MISSING" || item.status === "CONFLICT" || item.status === "NEED_CONFIRMATION" || item.status === "INFERRED");
    const missing = params.filter((item) => item.status === "MISSING");
    const inputs = scenario ? global.PmCalc?.getScenario?.(scenario.id)?.inputs : null;
    const keyRows = KEY_FIELDS.map((field) => ({ field, value: readField(inputs, field) })).filter((row) => row.value != null).slice(0, 8);
    const missingInputs = inputs ? KEY_FIELDS.filter((field) => readField(inputs, field) == null).slice(0, 6) : [];
    const status = session && pending.length
      ? "参数确认中"
      : scenario?.metrics
        ? "已测算"
        : "待测算";
    const tone = status === "已测算" ? "ok" : status === "参数确认中" ? "warn" : "muted";
    const name = project?.projectName || session?.files?.[0]?.name || "资料测算";
    const versions = conv?.versions?.length
      ? conv.versions
            : scenario
              ? [{ label: "V1 当前方案" }]
        : [];
    const versionHtml = versions.length
      ? `<div class="ai-context-block"><div class="ai-context-label">测算版本</div><ol class="ai-versions">${versions.map((item) => `<li>${esc(item.label)}</li>`).join("")}</ol></div>`
      : "";
    const fileCount = session?.files?.length || 0;
    const progress = session
      ? `<div class="ai-context-block"><div class="ai-context-label">资料</div><p>${fileCount} 个文件</p><div class="ai-context-label">参数识别</div><dl class="ai-progress"><div><dt>已识别</dt><dd>${recognized.length}</dd></div><div><dt>待确认</dt><dd>${pending.length}</dd></div><div><dt>缺失</dt><dd>${missing.length}</dd></div></dl></div>`
      : "";
    const keys = keyRows.length
      ? `<div class="ai-context-block"><div class="ai-context-label">关键参数</div><dl class="ai-keys">${keyRows.map((row) => `<div><dt>${esc(row.field.label)}</dt><dd>${esc(row.value)} ${esc(row.field.unit)}</dd></div>`).join("")}</dl></div>`
      : "";
    const missSource = missing.length ? missing.map((item) => item.label) : missingInputs.map((item) => item.label);
    const miss = missSource.length
      ? `<div class="ai-missing" role="status"><strong>还需要确认 ${missSource.length} 项信息</strong><ul>${missSource.map((label) => `<li>${esc(label)}</li>`).join("")}</ul><button type="button" class="btn small" data-ai-fill>去补充</button></div>`
      : "";
    const open = project && scenario
      ? `<button type="button" class="btn small" data-ai-go="/projects/${esc(project.projectId)}/calculation/${esc(scenario.id)}">查看全部参数</button>`
      : session
        ? `<button type="button" class="btn small" data-ai-import-edit>查看全部参数</button>`
        : "";
    return `<aside class="ai-rail" aria-label="当前测算"><div class="ai-rail-title">当前测算</div><h2 class="ai-context-name">${esc(name)}</h2><p class="ai-context-status is-${tone}"><i></i>${status}</p>${progress}${keys}${miss}${versionHtml}<div class="ai-context-actions">${open}<button type="button" class="btn small" data-ai-adjust>调整参数</button></div></aside>`;
  }

  function welcomeHtml() {
    const scenes = WELCOME_SCENES.map((item) => `<button type="button" class="ai-scene" data-ai-send="${esc(item.ask)}"><span aria-hidden="true">${esc(item.icon)}</span><strong>${esc(item.title)}</strong><em>${esc(item.desc)}</em></button>`).join("");
    const drop = showDropzone
      ? `<div class="ai-drop" data-ai-drop tabindex="0"><strong>拖入项目资料，或点击选择文件</strong><p>支持 Excel / Word / PDF 等已接入格式</p></div>`
      : "";
    return `<div class="ai-welcome"><div class="ai-avatar" aria-hidden="true">AI</div><div class="ai-welcome-copy"><h2>今天想测算什么项目？</h2><p>直接描述项目情况，或者上传已有项目资料，我会帮助你识别参数、完成测算并分析经营结果。</p><div class="ai-welcome-actions"><button type="button" class="btn primary" data-ai-import>导入项目资料</button><button type="button" class="btn" data-ai-send="帮我测算一个新的运输项目">新建空白测算</button></div>${drop}<div class="ai-scenes">${scenes}</div></div></div>`;
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

  function resultActions(response) {
    const ctx = response?.context || {};
    if (!ctx.projectId || !ctx.schemeId) return null;
    if (response.intent === "CREATE_CALCULATION" || response.intent === "IMPORT_CALCULATION") return null;
    return [
      { kind: "navigate", label: "查看完整测算", href: `/projects/${ctx.projectId}/calculation/${ctx.schemeId}` },
      { kind: "adjust", label: "调整参数" },
      { kind: "recalc", label: "重新测算" },
      { kind: "ask", label: "风险分析", ask: "哪些项目存在较大风险，原因是什么？" },
      { kind: "picker", label: "方案对比", picker: "compare" },
    ];
  }

  function actionsHtml(actions, response) {
    const preferred = resultActions(response);
    const list = preferred || actions || [];
    if (!list.length) return "";
    return `<div class="ai-actions">${list
      .map((action) => {
        if (action.kind === "navigate") return `<button type="button" class="btn small" data-ai-go="${esc(action.href || "")}">${esc(action.label)}</button>`;
        if (action.kind === "ask") return `<button type="button" class="btn small" data-ai-send="${esc(action.ask || action.label)}">${esc(action.label)}</button>`;
        if (action.kind === "export") return `<button type="button" class="btn small" data-ai-export>${esc(action.label)}</button>`;
        if (action.kind === "picker") return `<button type="button" class="btn small" data-ai-picker="${esc(action.picker || "compare")}">${esc(action.label)}</button>`;
        if (action.kind === "import") return `<button type="button" class="btn small" data-ai-import>${esc(action.label)}</button>`;
        if (action.kind === "import-confirm") return `<button type="button" class="btn small primary" data-ai-import-confirm>${esc(action.label)}</button>`;
        if (action.kind === "import-edit") return `<button type="button" class="btn small" data-ai-import-edit>${esc(action.label)}</button>`;
        if (action.kind === "adjust") return `<button type="button" class="btn small" data-ai-adjust>${esc(action.label)}</button>`;
        if (action.kind === "recalc") return `<button type="button" class="btn small" data-ai-recalc>${esc(action.label)}</button>`;
        return "";
      })
      .join("")}</div>`;
  }

  function loadingHtml(message) {
    const done = message.done || [];
    const items = [
      ...done.map((item) => `<li class="is-done">✓ ${esc(item)}</li>`),
      `<li class="is-current">● ${esc(message.stage || "正在理解你的问题")}</li>`,
    ];
    return `<article class="ai-msg"><div class="ai-avatar" aria-hidden="true">AI</div><div class="ai-loading" role="status"><ul class="ai-steps">${items.join("")}</ul><span class="ai-loading-bar"></span></div></article>`;
  }

  function messageHtml(message) {
    if (message.role === "user") {
      return `<article class="ai-msg is-user"><div class="ai-bubble">${esc(message.text || "")}</div></article>`;
    }
    if (message.pending) return loadingHtml(message);
    const response = message.response || { message: message.text || "", blocks: [], actions: [] };
    const error = message.error
      ? `<div class="ai-error" role="status" data-ai-fallback="1"><strong>AI 服务暂时未响应</strong><p>你的项目数据和已完成测算不会丢失。</p><p>${esc(FALLBACK_COPY)}</p><div><button type="button" class="btn small" data-ai-retry>重新尝试</button><button type="button" class="btn small" data-ai-view="list">继续使用传统测算</button></div></div>`
      : "";
    const stopped = message.stopped ? `<p class="help">已停止生成。</p>` : "";
    const failed = message.calcFailed
      ? `<div class="ai-error is-calc" role="status"><strong>本次测算未成功完成。</strong><p>原因：${esc(message.calcReason || "测算引擎没有返回结果")}</p></div>`
      : "";
    return `<article class="ai-msg"><div class="ai-avatar" aria-hidden="true">AI</div><div class="ai-answer">${error}${failed}${stopped}<p class="ai-lead">${esc(response.message || "")}</p>${(response.blocks || []).map(blockHtml).join("")}${actionsHtml(response.actions, response)}</div></article>`;
  }

  function threadHtml(conv) {
    if (!conv || !conv.messages?.length) return welcomeHtml();
    return `<div class="ai-feed">${conv.messages.map(messageHtml).join("")}</div>`;
  }

  function modelLabel() {
    return aiMode() === "deepseek" ? "DeepSeek" : "本地分析";
  }

  function filesHtml() {
    if (!attachments.length) return "";
    return `<div class="ai-file-row">${attachments
      .map((item) => `<span class="ai-file-chip"><em>文档</em>${esc(item.name)}<button type="button" data-ai-file-remove="${esc(item.id)}" aria-label="移除${esc(item.name)}">×</button></span>`)
      .join("")}</div>`;
  }

  function render(options) {
    const api = core();
    const list = api ? ensureSeed() : [];
    const conv = list.find((item) => item.id === activeId()) || list[0] || null;
    const mode = aiMode();
    if (!api) {
      return `${options.breadcrumbHtml || ""}<div class="page-head"><div><h1>项目测算中心</h1><p>AI 工作台未加载，传统测算仍可使用。</p></div><div class="head-actions"><button type="button" class="btn primary" data-calc-view="list">传统列表视图</button></div></div>`;
    }
    const empty = !conv?.messages?.length ? " is-empty" : "";
    return `${options.breadcrumbHtml || ""}
      <div class="page-head ai-page-head"><div><h1>项目测算中心</h1><p class="ai-subtitle">和 AI 一起，快速完成项目测算、方案对比与经营分析</p></div>
        <div class="head-actions"><div class="ai-view-toggle" role="tablist"><button type="button" class="btn small primary" data-ai-view="ai">AI 对话测算</button><button type="button" class="btn small" data-ai-view="list">传统列表视图</button></div>${options.demoToolsHtml || ""}</div>
      </div>
      <div class="ai-center ${collapsed.left ? "is-left-collapsed" : ""} ${collapsed.right ? "is-right-collapsed" : ""}" id="ai-center" data-ai-mode="${esc(mode)}">
        <div class="ai-fold"><button type="button" class="btn ghost small" data-ai-collapse="left">${collapsed.left ? "展开会话" : "收起会话"}</button><button type="button" class="btn ghost small" data-ai-collapse="right">${collapsed.right ? "展开上下文" : "收起上下文"}</button></div>
        ${sidebarHtml(list)}
        <section class="ai-main" aria-label="AI 测算工作区"><div class="ai-thread${empty}" id="ai-thread">${threadHtml(conv)}</div>
          <div class="ai-compose" id="ai-compose">
            <div id="ai-file-slot">${filesHtml()}</div>
            <form class="ai-composer" id="ai-form">
              <button type="button" class="ai-clip" id="ai-attach" aria-label="上传附件"><span aria-hidden="true">📎</span></button>
              <input id="ai-file" type="file" hidden multiple accept=".xlsx,.xls,.pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf">
              <textarea id="ai-input" rows="1" maxlength="2000" placeholder="输入项目情况，也可以直接拖入项目资料..."></textarea>
              <div class="ai-composer-side"><span class="ai-model">${esc(modelLabel())}</span><button type="submit" class="btn primary" id="ai-send" data-mode="send">发送</button></div>
            </form>
          </div>
        </section>
        ${railHtml(conv)}
        <div class="ai-picker" id="ai-picker" hidden></div>
        <aside class="ai-drawer" id="ai-drawer" hidden></aside>
      </div>`;
  }

  function paintThread() {
    const node = $("#ai-thread");
    if (!node) return;
    const conv = currentConversation();
    node.classList.toggle("is-empty", !conv?.messages?.length);
    node.innerHTML = threadHtml(conv);
    node.scrollTop = conv?.messages?.length ? node.scrollHeight : 0;
  }

  function paintFiles() {
    const slot = $("#ai-file-slot");
    if (slot) slot.innerHTML = filesHtml();
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
    paintFiles();
    paintDrawer();
  }

  function stagesFor(intent) {
    if (intent === "SENSITIVITY_ANALYSIS") return ["正在读取项目数据", "正在执行项目测算", "正在整理测算结果"];
    if (intent === "IMPORT_CALCULATION") return ["正在读取项目资料", "正在识别测算参数"];
    if (intent === "CREATE_CALCULATION" || intent === "GENERAL_CHAT") return ["正在理解你的问题"];
    return ["正在读取已保存测算", "正在整理经营结论"];
  }

  function doneLabel(stage) {
    const map = {
      "正在读取项目数据": "已读取项目数据",
      "正在执行项目测算": "已调用测算引擎",
      "正在整理测算结果": "已整理测算结果",
      "正在理解你的问题": "已理解问题",
      "正在读取项目资料": "已读取项目资料",
      "正在识别测算参数": "已识别测算参数",
      "正在读取已保存测算": "已读取已保存测算",
      "正在整理经营结论": "已整理经营结论",
    };
    return map[stage] || stage;
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
      title: "新测算",
      createdAt: now,
      updatedAt: now,
      context: {},
      messages: [],
    };
    if (!conv.messages.length) conv.title = core().conversationTitle(question);
    else if (conv.messages.filter((item) => item.role === "user").length === 0) conv.title = core().conversationTitle(question);
    conv.messages.push({ id: uid(), role: "user", text: question, createdAt: now });
    const pending = { id: uid(), role: "assistant", pending: true, stage: "正在理解你的问题", done: [], createdAt: now };
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
      const stages = stagesFor(intent);
      for (let index = 0; index < stages.length; index += 1) {
        if (token !== generation) break;
        pending.done = stages.slice(0, index).map(doneLabel);
        pending.stage = stages[index];
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

  async function runImport({ sample, file, files, conv, pending, token }) {
    const api = global.PmCalc?.importApi;
    const batch = files || (file ? [file] : []);
    pending.done = [];
    pending.stage = "正在读取项目资料";
    paintThread();
    await sleep(global.__AI_CENTER_FAST ? 0 : 280);
    if (!api || token !== generation) {
      pending.pending = false;
      pending.response = {
        intent: "IMPORT_CALCULATION",
        message: "未能完整读取该文件。",
        blocks: [{ type: "text", text: "你可以重新上传，或者直接告诉我项目的关键参数。" }],
        actions: [
          { id: "retry", label: "重新上传", kind: "import" },
          { id: "list", label: "继续使用传统测算", kind: "navigate", href: "view:list" },
        ],
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
        const added = api.addFiles(session.id, batch.map((item) => ({ name: item.name, mimeType: item.type || "", size: item.size || 0 })));
        if (!added?.trace?.ok) throw new Error(added?.trace?.detail || "文件未能加入解析");
      }
      pending.done = ["已读取项目资料"];
      pending.stage = "正在识别测算参数";
      paintThread();
      const parsed = api.parseFiles(session.id);
      const ready = parsed.session || api.getSession(session.id);
      const mapped = mapParams(ready?.parameters);
      const recognized = mapped.filter((item) => item.value != null && item.value !== "" && item.status !== "MISSING").length;
      const needConfirm = mapped.filter((item) => item.status === "MISSING" || item.status === "CONFLICT" || item.status === "NEED_CONFIRMATION" || item.status === "INFERRED").length;
      pending.done = ["已读取项目资料", `已提取 ${recognized} 个测算参数`];
      pending.stage = needConfirm ? `发现 ${needConfirm} 个参数需要确认` : "测算参数已识别";
      paintThread();
      await sleep(global.__AI_CENTER_FAST ? 0 : 220);
      if (token !== generation) return;
      const fileName = sample ? (ready?.files?.[0]?.name || "演示测算资料") : batch.map((item) => item.name).join("、");
      const response = core().buildImportPreview(fileName, mapped);
      response.context = { importSessionId: session.id };
      pending.pending = false;
      pending.response = response;
      conv.context = { ...conv.context, importSessionId: session.id };
      if (conv.title === "新测算" || conv.title === "新对话") conv.title = fileName.replace(/\.[^.]+$/, "") || "新测算";
      conv.updatedAt = new Date().toISOString();
      updateConversation(conv);
    } catch (err) {
      pending.pending = false;
      const raw = String(err?.message || "");
      const friendly = raw.length > 80 || /stack|TypeError|at\s+\w+/.test(raw) ? "文件内容无法按当前解析规则读取" : raw || "文件内容无法按当前解析规则读取";
      pending.response = {
        intent: "IMPORT_CALCULATION",
        message: "未能完整读取该文件。",
        blocks: [{ type: "text", text: `${friendly}。你可以重新上传，或者直接告诉我项目的关键参数。` }],
        actions: [
          { id: "retry", label: "重新上传", kind: "import" },
          { id: "list", label: "继续使用传统测算", kind: "navigate", href: "view:list" },
        ],
      };
      updateConversation(conv);
    } finally {
      loading = false;
      paintChrome();
      syncSendButton();
    }
  }

  const FILE_PATTERN = /\.(xlsx|xls|pdf|docx?|png|jpe?g)$/i;

  function addAttachments(fileList, intent) {
    const files = [...fileList].filter(Boolean);
    const accepted = files.filter((file) => FILE_PATTERN.test(file.name));
    if (!accepted.length) {
      notify("请上传 Excel、PDF、Word 或图片", "error");
      return;
    }
    if (intent === "start") {
      void startImport(accepted, "");
      return;
    }
    accepted.forEach((file) => attachments.push({ id: uid(), name: file.name, file }));
    paintFiles();
  }

  async function startImport(files, note) {
    if (!files?.length || loading) return;
    showDropzone = false;
    const now = new Date().toISOString();
    const names = files.map((file) => file.name).join("、");
    const conv = currentConversation() || { id: uid(), title: "新测算", createdAt: now, updatedAt: now, context: {}, messages: [] };
    const text = [String(note || "").trim(), `已上传：${names}`].filter(Boolean).join("\n");
    conv.messages.push({ id: uid(), role: "user", text, createdAt: now });
    const pending = { id: uid(), role: "assistant", pending: true, stage: "正在读取项目资料", done: [], createdAt: now };
    conv.messages.push(pending);
    updateConversation(conv);
    loading = true;
    const token = ++generation;
    attachments = [];
    paintChrome();
    syncSendButton();
    const input = $("#ai-input");
    if (input) input.value = "";
    await runImport({ files, conv, pending, token });
  }

  async function attachFile(file) {
    if (!file) return;
    await startImport([file], "");
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
    const conv = { id: uid(), title: "新测算", createdAt: now, updatedAt: now, context: {}, messages: [] };
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

  function paintDrawer() {
    const host = $("#ai-drawer");
    if (!host) return;
    if (!drawer) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    const stored = global.PmCalc?.getScenario?.(drawer.scenarioId);
    const groups = ["项目运营", "成本"];
    const body = groups
      .map((group) => {
        const fields = KEY_FIELDS.filter((field) => field.group === group)
          .map((field) => {
            const value = readField(stored?.inputs, field);
            return `<label class="ai-drawer-field"><span>${esc(field.label)}</span><input class="input" data-ai-param="${esc(field.key)}" value="${esc(value ?? "")}" inputmode="decimal"><em>${esc(field.unit)}</em></label>`;
          })
          .join("");
        return `<fieldset><legend>${group}</legend>${fields}</fieldset>`;
      })
      .join("");
    host.hidden = false;
    host.innerHTML = `<div class="ai-drawer-card" role="dialog" aria-modal="true" aria-labelledby="ai-drawer-title"><h3 id="ai-drawer-title">调整测算参数</h3><p class="help">提交后调用测算引擎重算。利润、收入和成本只使用引擎结果。</p>${body}<div class="ai-actions"><button type="button" class="btn" data-ai-drawer-close>取消</button><button type="button" class="btn primary" data-ai-drawer-save>重新测算</button></div></div>`;
  }

  function openDrawer() {
    const conv = currentConversation();
    const bundle = focusedBundle(conv);
    const scenarioId = bundle.scenario?.id || conv?.context?.schemeId;
    const stored = scenarioId ? global.PmCalc?.getScenario?.(scenarioId) : null;
    if (!stored?.inputs) {
      notify("还没有可调整的测算方案。请先确认参数并完成测算。", "error");
      return;
    }
    drawer = { scenarioId, projectId: bundle.project?.projectId || conv?.context?.projectId };
    paintDrawer();
  }

  function metricDelta(before, after) {
    const left = Number(before);
    const right = Number(after);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return { text: "—", raw: null };
    const delta = right - left;
    const text = global.PmCalc.formatMoney(delta);
    return { text: delta > 0 ? `+${text}` : text, raw: delta };
  }

  function buildRecalcResponse(before, after, labels, projectId, schemeId) {
    const money = global.PmCalc.formatMoney;
    const pct = global.PmCalc.formatPercent;
    const rows = [
      ["月收入", "monthlyRevenue", false],
      ["月成本", "monthlyTotalCost", false],
      ["月利润", "monthlyProfit", false],
      ["利润率", "profitMargin", true],
    ].map(([label, key, isPercent]) => {
      const delta = isPercent
        ? {
            text: before ? `${((Number(after[key]) - Number(before[key])) * 100 >= 0 ? "+" : "")}${((Number(after[key]) - Number(before[key])) * 100).toFixed(2)} pt` : "—",
            raw: before ? Number(after[key]) - Number(before[key]) : null,
          }
        : metricDelta(before?.[key], after[key]);
      return {
        label,
        before: before ? (isPercent ? pct(before[key]) : money(before[key])) : "—",
        after: isPercent ? pct(after[key]) : money(after[key]),
        delta: delta.text,
        afterRaw: Number(after[key]),
        deltaRaw: delta.raw,
      };
    });
    const profit = rows.find((item) => item.label === "月利润");
    const margin = rows.find((item) => item.label === "利润率");
    const reason = labels.length ? labels.join("、") : "当前参数";
    return {
      intent: "CALCULATION_EXPLAIN",
      message: `已根据${reason}重新测算。`,
      blocks: [
        {
          type: "text",
          text: `月利润：${profit.before} → ${profit.after}。利润率：${margin.before} → ${margin.after}。变化来自测算引擎对同一方案的重算。`,
        },
        {
          type: "kpi",
          data: [
            { key: "revenue", label: "月收入", value: money(after.monthlyRevenue), raw: Number(after.monthlyRevenue), unit: "元", trend: "none" },
            { key: "cost", label: "月成本", value: money(after.monthlyTotalCost), raw: Number(after.monthlyTotalCost), unit: "元", trend: "none" },
            { key: "profit", label: "月利润", value: money(after.monthlyProfit), raw: Number(after.monthlyProfit), unit: "元", trend: Number(after.monthlyProfit) >= 0 ? "up" : "down" },
            { key: "margin", label: "利润率", value: pct(after.profitMargin), raw: Number(after.profitMargin), trend: "none" },
          ],
        },
        { type: "calculation", title: "参数调整前后", beforeLabel: "调整前", afterLabel: "调整后", items: rows },
      ],
      actions: [],
      context: { projectId, schemeId },
    };
  }

  async function recalculate(patches) {
    if (loading || !global.PmCalc?.saveScenario) return;
    const conv = currentConversation();
    const bundle = focusedBundle(conv);
    const scenarioId = bundle.scenario?.id || conv?.context?.schemeId;
    const stored = scenarioId ? global.PmCalc.getScenario(scenarioId) : null;
    if (!stored?.inputs) {
      notify("还没有可重算的方案。请先确认参数并完成测算。", "error");
      return;
    }
    const inputs = JSON.parse(JSON.stringify(stored.inputs));
    const changed = [];
    for (const patch of patches || []) {
      const field = KEY_FIELDS.find((item) => item.key === patch.key);
      if (!field || patch.value === "" || patch.value == null) continue;
      const numeric = Number(patch.value);
      if (!Number.isFinite(numeric)) {
        notify(`${field.label}需要填写数字`, "error");
        return;
      }
      if (field.kind === "fleet" && numeric <= 0) {
        notify("车辆数量必须大于 0", "error");
        return;
      }
      if (numeric < 0) {
        notify(`${field.label}不能为负数`, "error");
        return;
      }
      const prev = readField(inputs, field);
      if (String(prev ?? "") === String(patch.value) || Number(prev) === numeric) continue;
      writeField(inputs, field, patch.value);
      changed.push(field.label);
    }
    const now = new Date().toISOString();
    const projectId = stored.projectId;
    const host = conv || { id: uid(), title: bundle.project?.projectName || "新测算", createdAt: now, updatedAt: now, context: {}, messages: [] };
    host.messages.push({ id: uid(), role: "user", text: changed.length ? `请按新的${changed.join("、")}重新测算` : "请重新测算当前方案", createdAt: now });
    const pending = { id: uid(), role: "assistant", pending: true, stage: "正在执行项目测算", done: ["已读取当前参数"], createdAt: now };
    host.messages.push(pending);
    host.updatedAt = now;
    updateConversation(host);
    loading = true;
    const token = ++generation;
    drawer = null;
    paintChrome();
    syncSendButton();
    try {
      await sleep(global.__AI_CENTER_FAST ? 0 : 280);
      if (token !== generation) return;
      const saved = global.PmCalc.saveScenario({
        id: stored.id,
        projectId: stored.projectId,
        name: stored.name,
        version: stored.version,
        status: stored.status,
        inputs,
        notes: stored.notes,
        inputsSource: stored.inputsSource,
      });
      if (!saved?.results?.metrics) throw new Error("测算引擎没有返回结果");
      pending.pending = false;
      pending.response = buildRecalcResponse(stored.results?.metrics || null, saved.results.metrics, changed, saved.projectId, saved.id);
      host.context = { ...(host.context || {}), projectId: saved.projectId, schemeId: saved.id };
      host.versions = host.versions || [];
      const index = host.versions.length + 1;
      host.versions.push({
        id: `v${index}`,
        label: `V${index} ${changed[0] ? `调整${changed[0]}` : "重新测算"}`,
        scenarioId: saved.id,
        at: new Date().toISOString(),
      });
      const projectName = collectProjects().find((item) => item.projectId === saved.projectId)?.projectName;
      if (projectName && (host.title === "新测算" || host.title === "新对话")) host.title = projectName;
      host.updatedAt = new Date().toISOString();
      updateConversation(host);
    } catch (err) {
      const raw = String(err?.message || "测算引擎没有返回结果");
      pending.pending = false;
      pending.calcFailed = true;
      pending.calcReason = raw.length > 80 ? "测算引擎没有返回可用结果" : raw;
      pending.response = {
        intent: "CALCULATION_EXPLAIN",
        message: "本次测算未成功完成。",
        blocks: [],
        actions: [],
        context: { projectId, schemeId: scenarioId },
      };
      updateConversation(host);
    } finally {
      loading = false;
      paintChrome();
      syncSendButton();
    }
  }

  function renameConversation(id) {
    const conv = loadAll().find((item) => item.id === id);
    if (!conv || typeof modal !== "function") return;
    openMenuId = "";
    modal("重命名测算", `<div class="field"><label for="ai-rename-input">名称</label><input id="ai-rename-input" class="input" value="${esc(conv.title === "新对话" ? "新测算" : conv.title)}"></div>`, "保存", () => {
      const value = $("#ai-rename-input")?.value.trim();
      if (!value) return false;
      conv.title = value;
      updateConversation(conv);
      paintChrome();
    });
  }

  function deleteConversation(id) {
    if (typeof modal !== "function") return;
    openMenuId = "";
    modal("删除测算会话", "只删除这条对话记录。已保存的测算方案仍可在传统列表中查看。", "删除", () => {
      const list = loadAll().filter((item) => item.id !== id);
      saveAll(list);
      if (activeId() === id) setActive(list[0]?.id || "");
      paintChrome();
    });
  }

  function clearCurrentThread() {
    const conv = currentConversation();
    if (!conv) {
      newConversation();
      return;
    }
    conv.messages = [];
    conv.title = "新测算";
    conv.context = {};
    conv.versions = [];
    conv.updatedAt = new Date().toISOString();
    updateConversation(conv);
    showDropzone = false;
    paintChrome();
  }

  function openProjectAnalysis(projectId, projectName, schemeId) {
    setView("ai");
    const now = new Date().toISOString();
    const conv = {
      id: uid(),
      title: projectName || "新测算",
      createdAt: now,
      updatedAt: now,
      context: { projectId, schemeId: schemeId || undefined },
      messages: [],
      versions: schemeId ? [{ id: "v1", label: "V1 当前方案", scenarioId: schemeId, at: now }] : [],
    };
    const list = loadAll();
    list.unshift(conv);
    saveAll(list);
    setActive(conv.id);
    generation += 1;
    loading = false;
    rerenderApp();
    setTimeout(() => {
      void submit("帮我分析一下这个项目的经营情况");
    }, 40);
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
      if (typeof global.render === "function") global.render();
    });
    $("#ai-clear-thread")?.addEventListener("click", () => clearCurrentThread());
    root.addEventListener("click", (event) => {
      const target = event.target.closest("[data-ai-new],[data-ai-open],[data-ai-send],[data-ai-go],[data-ai-view],[data-ai-export],[data-ai-picker],[data-ai-import],[data-ai-import-confirm],[data-ai-import-edit],[data-ai-retry],[data-ai-collapse],[data-ai-scroll],[data-ai-picker-close],[data-ai-picker-ok],[data-ai-menu],[data-ai-rename],[data-ai-delete],[data-ai-file-remove],[data-ai-adjust],[data-ai-recalc],[data-ai-fill],[data-ai-drop],[data-ai-drawer-close],[data-ai-drawer-save]");
      if (!target || !root.contains(target)) return;
      if (target.dataset.aiMenu) {
        openMenuId = openMenuId === target.dataset.aiMenu ? "" : target.dataset.aiMenu;
        paintChrome();
        return;
      }
      if (target.dataset.aiRename) {
        renameConversation(target.dataset.aiRename);
        return;
      }
      if (target.dataset.aiDelete) {
        deleteConversation(target.dataset.aiDelete);
        return;
      }
      if (target.dataset.aiFileRemove) {
        attachments = attachments.filter((item) => item.id !== target.dataset.aiFileRemove);
        paintFiles();
        return;
      }
      if (target.dataset.aiDrawerClose != null) {
        drawer = null;
        paintDrawer();
        return;
      }
      if (target.dataset.aiDrawerSave != null) {
        const patches = [...root.querySelectorAll("[data-ai-param]")].map((input) => ({ key: input.dataset.aiParam, value: input.value.trim() }));
        drawer = null;
        paintDrawer();
        void recalculate(patches);
        return;
      }
      if (target.dataset.aiAdjust != null) {
        openDrawer();
        return;
      }
      if (target.dataset.aiRecalc != null) {
        void recalculate([]);
        return;
      }
      if (target.dataset.aiFill != null) {
        const conv = currentConversation();
        if (conv?.context?.importSessionId) navigate(`/calculation/import/${conv.context.importSessionId}`);
        else openDrawer();
        return;
      }
      if (target.closest("[data-ai-drop]")) {
        filePickIntent = "start";
        showDropzone = true;
        $("#ai-file")?.click();
        return;
      }
      if (openMenuId) {
        openMenuId = "";
        paintChrome();
      }
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
        filePickIntent = "start";
        showDropzone = true;
        paintThread();
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
      if (attachments.length) {
        const files = attachments.map((item) => item.file);
        const note = $("#ai-input")?.value || "";
        attachments = [];
        paintFiles();
        void startImport(files, note);
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
    $("#ai-attach")?.addEventListener("click", () => {
      filePickIntent = "stage";
      $("#ai-file")?.click();
    });
    $("#ai-file")?.addEventListener("change", (event) => {
      const files = [...(event.target.files || [])];
      event.target.value = "";
      if (files.length) addAttachments(files, filePickIntent);
      filePickIntent = "stage";
    });
    root.addEventListener("dragover", (event) => {
      if (!event.target.closest("#ai-compose, [data-ai-drop]")) return;
      event.preventDefault();
      $("#ai-compose")?.classList.add("is-drag");
    });
    root.addEventListener("dragleave", (event) => {
      if (event.target.closest("#ai-compose")) $("#ai-compose")?.classList.remove("is-drag");
    });
    root.addEventListener("drop", (event) => {
      const dropzone = event.target.closest("[data-ai-drop]");
      const compose = event.target.closest("#ai-compose");
      if (!dropzone && !compose) return;
      event.preventDefault();
      $("#ai-compose")?.classList.remove("is-drag");
      if (event.dataTransfer?.files?.length) addAttachments(event.dataTransfer.files, dropzone ? "start" : "stage");
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
    attachments = [];
    drawer = null;
    openMenuId = "";
    showDropzone = false;
    generation += 1;
    loading = false;
    global.PmCalc?.resetDemoData?.();
    const route = String(location.hash || "").replace(/^#/, "");
    if (route !== "/calculation") {
      if (typeof go === "function") go("/calculation");
      else location.hash = "/calculation";
    }
  }

  global.AiCenter = { render, bind, getView, setView, resetLeadershipDemo, openProjectAnalysis };
})(window);
