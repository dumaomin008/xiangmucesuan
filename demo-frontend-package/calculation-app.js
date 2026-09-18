/**
 * 项目测算模块 UI（Demo 壳层内，Phase 4 视觉对齐 Design Spec）
 * 依赖 window.PmCalc；不改业务公式。终审：草稿待确认 → 开始测算 → 引擎重算。
 */
(function (global) {
  const money = (v) => (global.PmCalc ? global.PmCalc.formatMoney(v) : "—");
  const pct = (v) => (global.PmCalc ? global.PmCalc.formatPercent(v) : "—");
  const statusLabel = (s) => (global.PmCalc ? global.PmCalc.scenarioStatusLabel(s) : s);

  const EDIT_FIELDS = [
    { id: "calc-fleet", label: "车辆数", allowZero: false, integer: true, min: 1, max: 5000 },
    { id: "calc-rent", label: "单车月租", allowZero: false, min: 0, max: 1e7 },
    { id: "calc-distance", label: "里程", allowZero: false, min: 0, max: 1e6 },
    { id: "calc-load", label: "载重", allowZero: true, min: 0, max: 200 },
    { id: "calc-price", label: "运价", allowZero: true, min: 0, max: 1e6 },
    { id: "calc-trips", label: "趟次", allowZero: false, min: 0, max: 1e4 },
    { id: "calc-elec", label: "电价", allowZero: true, min: 0, max: 100 },
    { id: "calc-energy", label: "能耗", allowZero: false, min: 0, max: 100 },
    { id: "calc-driver", label: "司机成本", allowZero: true, min: 0, max: 1e6 },
  ];

  function requireCalc() {
    if (!global.PmCalc) {
      return `<div class="state-page"><div><h1>测算引擎未加载</h1><p>请确认已引入 lib/pm-calc.bundle.js。核心测算不可 Mock。</p><button class="btn primary" data-go="/projects">返回项目管理</button></div></div>`;
    }
    return null;
  }

  function calcIcon() {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h5M8 15h3M14 14l2 2 3-3"/></svg>';
  }

  function breadcrumb(items) {
    return `<nav class="calc-breadcrumb" aria-label="面包屑">${items
      .map((item, index) => {
        const last = index === items.length - 1;
        if (last || !item.href) return `<span class="calc-crumb current" aria-current="page">${esc(item.label)}</span>`;
        return `<button type="button" class="calc-crumb link" data-go="${esc(item.href)}">${esc(item.label)}</button><span class="calc-crumb-sep" aria-hidden="true">/</span>`;
      })
      .join("")}</nav>`;
  }

  function statusTag(status) {
    const tone =
      status === "baseline" ? "success" : status === "calculated" ? "info" : status === "draft" ? "warning" : status === "archived" ? "warning" : "";
    return `<span class="tag ${tone} calc-status">${esc(statusLabel(status))}</span>`;
  }

  function formatCalcTime(iso) {
    if (!iso) return "—";
    return esc(String(iso).replace("T", " ").slice(0, 19));
  }

  /** 核心结果第一屏：收入/成本/利润/利润率/车辆数/单车利润/现金流/IRR */
  function metricStrip(metrics, options = {}) {
    if (!metrics) {
      return `<div class="calc-empty-result" role="status">
        <strong>尚未执行测算</strong>
        <p>请确认下方测算参数后点击「开始测算」。结果必须由 Calculation Engine 产出。</p>
      </div>`;
    }
    const profit = Number(metrics.monthlyProfit);
    const profitTone = Number.isFinite(profit) ? (profit > 0 ? "positive" : profit < 0 ? "negative" : "") : "";
    const marginText =
      metrics.profitMargin == null
        ? metrics.profitMarginReason
          ? `无法计算（${esc(metrics.profitMarginReason)}）`
          : "—"
        : pct(metrics.profitMargin);
    const irrText =
      metrics.irr == null
        ? metrics.irrReason
          ? `无解（${esc(metrics.irrReason)}）`
          : "—"
        : pct(metrics.irr);
    const perVehicle =
      metrics.profitPerVehicle == null
        ? metrics.profitPerVehicleReason
          ? "—"
          : "—"
        : money(metrics.profitPerVehicle);
    const items = [
      ["月收入", money(metrics.monthlyRevenue), "元", ""],
      ["月总成本", money(metrics.monthlyTotalCost), "元", ""],
      ["月利润", money(metrics.monthlyProfit), "元", profitTone],
      ["利润率", marginText, "", profitTone],
      ["车辆数", metrics.fleetSize != null ? String(metrics.fleetSize) : "—", "台", ""],
      ["单车月利润", perVehicle, "元", profitTone],
      ["累计现金流", money(metrics.cumulativeCashFlow), "元", ""],
      ["IRR", irrText, "", ""],
    ];
    const meta = `<div class="calc-result-meta">
      <span>固定成本：${money(metrics.monthlyFixedCost)} 元</span>
      <span>变动成本：${money(metrics.monthlyVariableCost)} 元</span>
      <span>能源相关已计入变动成本</span>
      <span>转正月：${metrics.firstPositiveMonth ?? "—"}</span>
      <span>最后测算时间：${formatCalcTime(options.calculatedAt)}</span>
    </div>`;
    return `<div class="vehicle-metrics calc-result-metrics" aria-label="测算结果摘要">${items
      .map(([label, value, unit, tone]) => {
        const showUnit = Boolean(unit) && value !== "—" && !String(value).includes("无解") && !String(value).includes("无法");
        return `<article class="metric-card calc-result-metric ${tone}"><div class="metric-main"><div class="metric-label">${label}</div><div class="metric-value">${value}${showUnit ? `<span class="metric-unit">${unit}</span>` : ""}</div></div></article>`;
      })
      .join("")}</div>${meta}`;
  }

  function contextFacts(ctx) {
    if (!ctx) return "";
    const cells = [
      ["项目名称", esc(ctx.projectName)],
      ["项目编号", esc(ctx.projectId)],
      ["客户", esc(ctx.customer || "—")],
      ["区域", esc(ctx.region || "—")],
      ["项目负责人", esc(ctx.owner || "—")],
      ["项目类型", esc(ctx.projectType || "—")],
      ["项目地点", esc(ctx.place || "—")],
      ["需求车辆", ctx.tractorDemand ?? "—"],
    ];
    return `<div class="calc-context-block">
      <div class="calc-section-kicker"><span class="tag info">项目自动带入</span><span>只读 · 以 projectId 关联，不用项目名称做主键</span></div>
      <div class="facts calc-context-facts">${cells
        .map(([label, value]) => `<div><div class="fact-label">${label}</div><div class="fact-value">${value}</div></div>`)
        .join("")}</div>
      <p class="calc-context-note">以上为项目管理系统上下文；测算方案参数在下方独立维护。引擎 ${esc(global.PmCalc.engineVersion)} · LocalStorage</p>
    </div>`;
  }

  function changeRateText(base, next, isPctPoint) {
    const lv = Number(base);
    const rv = Number(next);
    if (!Number.isFinite(lv) || !Number.isFinite(rv)) return "—";
    if (lv === 0) return rv === 0 ? "0.00%" : "—";
    if (isPctPoint) {
      const delta = (rv - lv) * 100;
      return `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} pt`;
    }
    const rate = ((rv - lv) / Math.abs(lv)) * 100;
    return `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%`;
  }

  function compareStrip(list) {
    if (list.length < 2) return "";
    const baseline = list.find((s) => s.status === "baseline") || list.find((s) => s.results) || list[0];
    const peer = list.find((s) => s.id !== baseline.id && s.results) || list.find((s) => s.id !== baseline.id);
    const a = baseline?.results?.metrics;
    const b = peer?.results?.metrics;
    if (!a || !b || !peer) return "";
    const defs = [
      { label: "月收入（元）", key: "monthlyRevenue", mode: "money" },
      { label: "月总成本（元）", key: "monthlyTotalCost", mode: "money" },
      { label: "月利润（元）", key: "monthlyProfit", mode: "money" },
      { label: "利润率", key: "profitMargin", mode: "pct" },
      { label: "累计现金流（元）", key: "cumulativeCashFlow", mode: "money" },
      { label: "IRR", key: "irr", mode: "pct" },
    ];
    return `<section class="panel calc-compare-panel">
      <div class="section-title"><div><h2>方案对比</h2><p>基准值 / 对比方案值 / 差值 / 变化率 · 数字来自真实引擎结果快照</p></div></div>
      <div class="table-wrap"><table class="calc-compare-table">
        <thead><tr><th>指标</th><th class="num">基准值<br><span class="object-meta">${esc(baseline.name)}</span></th><th class="num">对比方案值<br><span class="object-meta">${esc(peer.name)}</span></th><th class="num">差值</th><th class="num">变化率</th></tr></thead>
        <tbody>${defs
          .map((def) => {
            const lv = a[def.key];
            const rv = b[def.key];
            const ln = Number(lv);
            const rn = Number(rv);
            const left = def.mode === "pct" ? (lv == null ? "—" : pct(lv)) : money(lv);
            const right = def.mode === "pct" ? (rv == null ? "—" : pct(rv)) : money(rv);
            const diff = Number.isFinite(ln) && Number.isFinite(rn) ? rn - ln : null;
            const diffText =
              diff === null ? "—" : def.mode === "pct" ? pct(String(diff)) : money(String(diff));
            const rateText = changeRateText(lv, rv, def.mode === "pct");
            const diffClass = diff === null ? "" : diff > 0 ? "is-positive" : diff < 0 ? "is-negative" : "";
            return `<tr><td>${def.label}</td><td class="num">${left}</td><td class="num">${right}</td><td class="num ${diffClass}">${diffText}</td><td class="num ${diffClass}">${rateText}</td></tr>`;
          })
          .join("")}</tbody>
      </table></div>
    </section>`;
  }

  function scenarioRows(list, projectId) {
    if (!list.length) {
      return `<tr class="empty-row"><td colspan="8">该项目暂无测算方案${canEdit() ? `<br><button class="btn primary" style="margin-top:12px" data-calc-new="${esc(projectId)}">新建测算方案</button>` : ""}</td></tr>`;
    }
    return list
      .map((s) => {
        const m = s.results?.metrics;
        const profit = m ? Number(m.monthlyProfit) : null;
        const profitClass = profit === null || !Number.isFinite(profit) ? "" : profit >= 0 ? "is-positive" : "is-negative";
        return `<tr>
          <td class="object-cell"><div class="object-name" data-go="/projects/${esc(s.projectId)}/calculation/${esc(s.id)}">${esc(s.name)}</div><div class="object-meta">${esc(s.id)} · ${esc(s.version)}${s.inputsSource === "demo_baseline" ? " · 演示基准参数" : ""}</div></td>
          <td>${statusTag(s.status)}</td>
          <td class="num">${m ? money(m.monthlyRevenue) : "—"}</td>
          <td class="num ${profitClass}">${m ? money(m.monthlyProfit) : "—"}</td>
          <td class="num">${m ? pct(m.profitMargin) : "—"}</td>
          <td>${esc((s.updatedAt || "").replace("T", " ").slice(0, 16) || "—")}</td>
          <td><span class="object-meta">${esc(s.calculationVersion || "—")}</span></td>
          <td><div class="table-actions">
            <button class="btn ghost small text-action" data-go="/projects/${esc(s.projectId)}/calculation/${esc(s.id)}">打开</button>
            ${canEdit() ? `<button class="btn ghost small text-action" data-calc-dup="${esc(s.id)}">复制</button><button class="btn ghost small text-action danger" data-calc-del="${esc(s.id)}">删除</button>` : ""}
          </div></td>
        </tr>`;
      })
      .join("");
  }

  function resetDemoButton() {
    return `<button type="button" class="btn" id="calc-reset-seed" title="清除本机测算 LocalStorage 并恢复演示种子">一键恢复演示数据</button>`;
  }

  function calcCenterPage() {
    const blocked = requireCalc();
    if (blocked) return shell(blocked);
    global.PmCalc.ensureRepos();
    const visibleIds = new Set(visibleProjects().map((p) => p.id));
    const all = global.PmCalc.listScenarios().filter((s) => visibleIds.has(s.projectId));
    const byProject = new Map();
    for (const s of all) {
      if (!byProject.has(s.projectId)) byProject.set(s.projectId, []);
      byProject.get(s.projectId).push(s);
    }

    const tableBody = [...byProject.entries()]
      .map(([projectId, scenarios]) => {
        const p = projects.find((x) => x.id === projectId);
        const baseline = scenarios.find((s) => s.status === "baseline") || scenarios.find((s) => s.results) || scenarios[0];
        const m = baseline?.results?.metrics;
        const profit = m ? Number(m.monthlyProfit) : null;
        return `<tr>
          <td class="object-cell"><div class="object-name" data-go="/projects/${esc(projectId)}/calculation">${esc(p?.name || projectId)}</div><div class="object-meta">${esc(projectId)} · ${esc(p?.customer || "")}</div></td>
          <td class="num">${scenarios.length}</td>
          <td>${baseline ? statusTag(baseline.status) : "—"}</td>
          <td class="num">${m ? money(m.monthlyRevenue) : "—"}</td>
          <td class="num ${profit === null || !Number.isFinite(profit) ? "" : profit >= 0 ? "is-positive" : "is-negative"}">${m ? money(m.monthlyProfit) : "—"}</td>
          <td class="num">${m ? pct(m.profitMargin) : "—"}</td>
          <td><button class="btn ghost small text-action" data-go="/projects/${esc(projectId)}/calculation">进入测算</button></td>
        </tr>`;
      })
      .join("");

    return shell(`${breadcrumb([
      { label: "业务管理" },
      { label: "项目测算中心" },
    ])}
    ${pageHead("项目测算中心", "跨项目查看测算方案 · 核心数字由浏览器真实计算引擎产出", `${stateControl()}${resetDemoButton()}`)}
    <section class="metric-section calc-center-metrics" aria-label="测算中心摘要">
      <div class="vehicle-metrics compact-inventory-metrics calc-center-metric-row">
        <article class="metric-card"><div class="metric-main"><div class="metric-label">可见测算项目</div><div class="metric-value">${byProject.size}<span class="metric-unit">个</span></div></div></article>
        <article class="metric-card"><div class="metric-main"><div class="metric-label">方案总数</div><div class="metric-value">${all.length}<span class="metric-unit">个</span></div></div></article>
        <article class="metric-card"><div class="metric-main"><div class="metric-label">计算引擎</div><div class="metric-value calc-engine-value">${esc(global.PmCalc.engineVersion)}</div></div></article>
        <article class="metric-card"><div class="metric-main"><div class="metric-label">存储方式</div><div class="metric-value calc-engine-value">LocalStorage</div></div></article>
      </div>
    </section>
    <section class="panel project-list-panel calc-center-panel">
      <div class="section-title" style="padding:14px 0 0"><div><h2>测算项目一览</h2><p>按项目编号关联；不使用项目名称作为主键</p></div></div>
      <div class="table-wrap responsive"><table>
        <thead><tr><th>项目</th><th class="num">方案数</th><th>基准状态</th><th class="num">基准营收</th><th class="num">基准利润</th><th class="num">利润率</th><th>操作</th></tr></thead>
        <tbody>${tableBody || `<tr class="empty-row"><td colspan="7">当前可见项目尚无测算方案。请从项目详情进入「项目测算」并新建。</td></tr>`}</tbody>
      </table></div>
    </section>`);
  }

  function projectCalculationPage(projectId) {
    const blocked = requireCalc();
    if (blocked) return shell(blocked);
    const p = projects.find((x) => x.id === projectId);
    if (!p) return errorPage("404");
    if (!permittedProjects().includes(p)) return errorPage("403");

    global.PmCalc.syncProjectFromShell(p);
    const ctx = global.PmCalc.buildProjectContext(p);
    const list = global.PmCalc.listScenarios(projectId);
    global.PmCalc.ensureRepos().parameters.savePreferences({
      lastProjectId: projectId,
      lastScenarioId: list[0]?.id || null,
    });

    return shell(`<div class="calc-page">
      ${breadcrumb([
        { label: "项目管理", href: "/projects" },
        { label: p.name, href: `/projects/${projectId}` },
        { label: "项目测算" },
      ])}
      <div class="object-header project-object-header calc-object-header">
        <div class="object-header-top">
          <div>
            <button class="btn ghost small" data-go="/projects/${esc(projectId)}">${icons.back}<span>返回项目详情</span></button>
            <h1 style="margin-top:12px">项目测算</h1>
            <div class="object-id project-identity">
              <span>${esc(p.id)}</span>
              <span>${esc(p.customer)}</span>
              <span>${list.length} 个方案</span>
            </div>
          </div>
          <div class="head-actions">
            ${canEdit() ? `<button class="btn primary" data-calc-new="${esc(projectId)}">${icons.plus}<span>新建方案</span></button>` : '<span class="tag">只读视图</span>'}
            ${resetDemoButton()}
            <button class="btn" data-go="/calculation">测算中心</button>
          </div>
        </div>
        ${contextFacts(ctx)}
      </div>
      ${compareStrip(list)}
      <section class="panel project-list-panel calc-scenario-panel">
        <div class="section-title" style="padding:14px 0 0"><div><h2>测算方案</h2><p>一个项目可保存多个方案；新建先加载演示基准参数并待确认，点击开始测算后才出结果</p></div></div>
        <div class="table-wrap responsive"><table>
          <thead><tr><th>方案</th><th>状态</th><th class="num">月营收</th><th class="num">月利润</th><th class="num">利润率</th><th>更新时间</th><th>引擎版本</th><th>操作</th></tr></thead>
          <tbody>${scenarioRows(list, projectId)}</tbody>
        </table></div>
      </section>
    </div>`);
  }

  function editableFields(inputs, inputsSource) {
    const seg = inputs.routes?.[0]?.segments?.[0];
    if (!seg) return `<div class="tag danger">演示基准参数结构不完整</div>`;
    const fleet = inputs.fleetSize ?? inputs.vehicle?.fleetSize ?? 1;
    const demoBanner =
      inputsSource === "demo_baseline"
        ? `<div class="calc-demo-banner" role="note">
            <span class="tag warning">演示基准参数</span>
            <span>当前预填为系统演示样本参数，<strong>不是</strong>本项目真实业务数据。确认或修改后请点击「开始测算」。</span>
          </div>`
        : `<div class="calc-demo-banner is-user" role="note">
            <span class="tag info">测算方案参数</span>
            <span>修改后需重新测算；KPI 一律由 Calculation Engine 计算，页面不自行估算。</span>
          </div>`;
    return `${demoBanner}
    <div class="form-grid calc-param-grid" id="calc-param-form">
      <div class="field"><label for="calc-fleet">车辆数</label><input class="input" id="calc-fleet" type="number" min="1" step="1" value="${esc(fleet)}" data-calc-field></div>
      <div class="field"><label for="calc-rent">单车月租 / 车辆租金（元）</label><input class="input" id="calc-rent" type="number" step="0.01" value="${esc(inputs.vehicle?.monthlyRentPerVehicle || "")}" data-calc-field></div>
      <div class="field"><label for="calc-distance">路段1里程（km）</label><input class="input" id="calc-distance" type="number" step="0.01" value="${esc(seg.distanceKm)}" data-calc-field></div>
      <div class="field"><label for="calc-load">载重（吨）</label><input class="input" id="calc-load" type="number" step="0.01" value="${esc(seg.loadTon)}" data-calc-field></div>
      <div class="field"><label for="calc-price">运价</label><input class="input" id="calc-price" type="number" step="0.01" value="${esc(seg.freightPrice)}" data-calc-field></div>
      <div class="field"><label for="calc-trips">单车月趟数</label><input class="input" id="calc-trips" type="number" step="0.01" value="${esc(seg.tripsPerVehicleMonth)}" data-calc-field></div>
      <div class="field"><label for="calc-elec">电价（元/kWh）</label><input class="input" id="calc-elec" type="number" step="0.01" value="${esc(seg.electricityPrice)}" data-calc-field></div>
      <div class="field"><label for="calc-energy">满载能耗（kWh/km）</label><input class="input" id="calc-energy" type="number" step="0.01" value="${esc(seg.loadedEnergyConsumption)}" data-calc-field></div>
      <div class="field span-2"><label for="calc-driver">司机成本（元/趟，路段覆盖）</label><input class="input" id="calc-driver" type="number" step="0.01" value="${esc(seg.driverCostPerTrip || "0")}" data-calc-field></div>
    </div>
    <div id="calc-field-error" class="field-error calc-field-error" hidden></div>
    <p class="help">运价 / 电价 / 能耗 / 里程 / 趟次 / 车辆数 / 载重 / 司机成本 / 车辆租金变更后，收入、成本、利润、现金流、IRR 等均由引擎重算。</p>`;
  }

  function readFormFingerprint() {
    const fleetRaw = $("#calc-fleet")?.value ?? "";
    return JSON.stringify({
      fleet: Math.max(0, Math.round(Number(fleetRaw) || 0)),
      rent: String($("#calc-rent")?.value ?? ""),
      distanceKm: String($("#calc-distance")?.value ?? ""),
      loadTon: String($("#calc-load")?.value ?? ""),
      freightPrice: String($("#calc-price")?.value ?? ""),
      trips: String($("#calc-trips")?.value ?? ""),
      electricityPrice: String($("#calc-elec")?.value ?? ""),
      energy: String($("#calc-energy")?.value ?? ""),
      driver: String($("#calc-driver")?.value ?? ""),
    });
  }

  function validateEditableForm() {
    for (const field of EDIT_FIELDS) {
      const el = $(`#${field.id}`);
      const raw = (el?.value ?? "").trim();
      if (raw === "") return `${field.label}不能为空`;
      if (raw.toLowerCase() === "nan" || /[^\d.eE+\-]/.test(raw.replace(/^\+/, ""))) {
        // allow scientific notation digits; still catch obvious junk
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) return `${field.label}必须是有效数字（不能为 NaN / Infinity）`;
      if (n < 0) return `${field.label}不能为负数`;
      if (!field.allowZero && n === 0) return `${field.label}必须大于 0`;
      if (field.integer && (!Number.isInteger(n) || n < 1)) return `${field.label}必须为正整数`;
      if (typeof field.max === "number" && n > field.max) return `${field.label}超出合理范围（最大 ${field.max}）`;
      if (typeof field.min === "number" && n < field.min) return `${field.label}不能小于 ${field.min}`;
    }
    return null;
  }

  function applyEditableFields(inputs) {
    const next = JSON.parse(JSON.stringify(inputs));
    const fleet = Math.round(Number($("#calc-fleet")?.value));
    next.fleetSize = fleet;
    if (next.vehicle) {
      next.vehicle.fleetSize = fleet;
      next.vehicle.monthlyRentPerVehicle = String($("#calc-rent")?.value ?? next.vehicle.monthlyRentPerVehicle);
    }
    const seg = next.routes?.[0]?.segments?.[0];
    if (seg) {
      seg.distanceKm = String($("#calc-distance")?.value ?? seg.distanceKm);
      seg.loadTon = String($("#calc-load")?.value ?? seg.loadTon);
      seg.freightPrice = String($("#calc-price")?.value ?? seg.freightPrice);
      seg.tripsPerVehicleMonth = String($("#calc-trips")?.value ?? seg.tripsPerVehicleMonth);
      seg.electricityPrice = String($("#calc-elec")?.value ?? seg.electricityPrice);
      seg.loadedEnergyConsumption = String($("#calc-energy")?.value ?? seg.loadedEnergyConsumption);
      seg.driverCostPerTrip = String($("#calc-driver")?.value ?? seg.driverCostPerTrip ?? "0");
    }
    return next;
  }

  function showFieldError(message) {
    const box = $("#calc-field-error");
    if (!box) {
      toast(message, "error");
      return;
    }
    if (!message) {
      box.hidden = true;
      box.textContent = "";
      return;
    }
    box.hidden = false;
    box.textContent = message;
  }

  function aiPanelMarkup(scenarioId) {
    return `<section class="panel calc-workspace-section calc-ai-panel" data-calc-ai-panel="${esc(scenarioId)}">
      <div class="section-title">
        <div>
          <h2>AI 解读</h2>
          <p>先由引擎出数，再解释风险与建议 · AI 故障不阻塞测算</p>
        </div>
        <div class="head-actions">
          <button type="button" class="btn small" id="calc-ai-refresh">生成解读</button>
        </div>
      </div>
      <div class="field" style="margin-bottom:12px">
        <label class="sr-only" for="calc-ai-question">提问</label>
        <input class="input" id="calc-ai-question" placeholder="例如：能不能做？最大成本是什么？有哪些风险？" value="请解释当前测算结果、主要风险与下一步建议">
      </div>
      <div id="calc-ai-body" class="calc-ai-body" aria-live="polite">
        <div class="help">点击「生成解读」查看基于引擎结果的分析。未配置大模型时使用本地规则解读。</div>
      </div>
    </section>`;
  }

  function renderAiBody(insight, remoteText, remoteError) {
    const riskHtml = (insight.risks || [])
      .map(
        (r) => `<article class="calc-ai-risk ${esc(r.level)}">
          <div class="calc-ai-risk-head"><strong>${esc(r.name)}</strong><span class="tag ${r.level === "高" ? "danger" : r.level === "中" ? "warning" : "success"}">${esc(r.level)}</span></div>
          <p>${esc(r.evidence)}</p>
          <p class="calc-ai-reco">建议：${esc(r.recommendation)}</p>
        </article>`,
      )
      .join("");
    const highlights = (insight.highlights || []).map((h) => `<li>${esc(h)}</li>`).join("");
    const suggestions = (insight.suggestions || []).map((s) => `<li>${esc(s)}</li>`).join("");
    const remoteBlock = remoteText
      ? `<div class="calc-ai-remote"><div class="calc-ai-remote-label">大模型润色（未改动引擎数字）</div><div class="calc-ai-remote-text">${esc(remoteText)}</div></div>`
      : remoteError
        ? `<div class="calc-ai-degrade"><span class="tag warning">AI 暂不可用</span><span>${esc(remoteError)} 已自动使用本地引擎解读。</span></div>`
        : `<div class="calc-ai-degrade"><span class="tag info">本地解读</span><span>未启用远端大模型；核心测算结果不受影响。</span></div>`;

    return `${remoteBlock}
      <div class="calc-ai-summary"><strong>${esc(insight.title)}</strong><p>${esc(insight.summary)}</p></div>
      <div class="calc-ai-columns">
        <div><h3>要点</h3><ul>${highlights || "<li>暂无</li>"}</ul></div>
        <div><h3>建议</h3><ul>${suggestions || "<li>暂无</li>"}</ul></div>
      </div>
      <div class="calc-ai-risks"><h3>风险清单（敏感性由引擎重算）</h3><div class="calc-ai-risk-grid">${riskHtml || '<div class="help">暂无风险项</div>'}</div></div>
      <p class="calc-ai-disclaimer">${esc(insight.disclaimer)} · ${esc(insight.source)} · ${esc((insight.generatedAt || "").replace("T", " ").slice(0, 19))}</p>`;
  }

  async function runAiAnalysis(scenarioId, project) {
    const body = $("#calc-ai-body");
    const question = $("#calc-ai-question")?.value?.trim() || "";
    if (!body || !global.PmCalc?.analyzeScenario) return;
    body.innerHTML = `<div class="help">正在基于引擎结果生成解读…</div>`;
    let insight;
    try {
      insight = global.PmCalc.analyzeScenario({ scenarioId, project, question });
    } catch (err) {
      body.innerHTML = `<div class="calc-ai-degrade"><span class="tag warning">解读降级</span><span>${esc(err.message || "本地解读失败")}。测算数字仍可在上方查看。</span></div>`;
      return;
    }

    let remoteText = "";
    let remoteError = "";
    try {
      const scenario = global.PmCalc.getScenario(scenarioId);
      if (!scenario?.results) {
        body.innerHTML = renderAiBody(insight, "", "尚无测算结果，跳过远端润色");
        return;
      }
      const payload = global.PmCalc.buildAiPayload({
        scenario,
        project,
        question,
        localInsight: insight,
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("/api/demo-ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.text) {
        remoteText = data.text;
        insight = { ...insight, source: "remote_llm" };
      } else {
        remoteError = data.message || `服务返回 ${res.status}`;
      }
    } catch (err) {
      remoteError = err?.name === "AbortError" ? "AI 请求超时" : "无法连接 AI 代理";
    }

    body.innerHTML = renderAiBody(insight, remoteText, remoteError);
  }

  function isStaleScenario(scenario) {
    if (!scenario?.results?.inputFingerprint) return false;
    try {
      const current = global.PmCalc.fingerprintInputs
        ? global.PmCalc.fingerprintInputs(scenario.inputs)
        : readFormFingerprint();
      return current !== scenario.results.inputFingerprint;
    } catch {
      return false;
    }
  }

  function scenarioWorkspacePage(projectId, scenarioId) {
    const blocked = requireCalc();
    if (blocked) return shell(blocked);
    const p = projects.find((x) => x.id === projectId);
    if (!p) return errorPage("404");
    if (!permittedProjects().includes(p)) return errorPage("403");
    global.PmCalc.syncProjectFromShell(p);
    const scenario = global.PmCalc.getScenario(scenarioId);
    if (!scenario || scenario.projectId !== projectId) return errorPage("404");
    const ctx = global.PmCalc.buildProjectContext(p);
    const m = scenario.results?.metrics;
    const stale = isStaleScenario(scenario);
    const needFirstCalc = !scenario.results;
    const actionLabel = needFirstCalc ? "开始测算" : "重新测算并保存";
    const costRows = (scenario.results?.full?.costBreakdown || [])
      .map(
        (row) =>
          `<tr><td>${esc(row.name || row.code)}</td><td class="num">${money(row.amount)}</td><td class="num">${row.share != null ? pct(row.share) : "—"}</td></tr>`,
      )
      .join("");

    return shell(`<div class="calc-page calc-workspace" data-calc-workspace="${esc(scenarioId)}" data-has-results="${scenario.results ? "1" : "0"}" data-calc-fingerprint="${esc(scenario.results?.inputFingerprint || "")}">
      ${breadcrumb([
        { label: "项目管理", href: "/projects" },
        { label: p.name, href: `/projects/${projectId}` },
        { label: "项目测算", href: `/projects/${projectId}/calculation` },
        { label: scenario.name },
      ])}
      <div class="object-header project-object-header calc-object-header">
        <div class="object-header-top">
          <div>
            <button class="btn ghost small" data-go="/projects/${esc(projectId)}/calculation">${icons.back}<span>返回方案列表</span></button>
            <h1 style="margin-top:12px">${esc(scenario.name)}</h1>
            <div class="object-id project-identity">
              <span>${statusTag(scenario.status)}</span>
              <span>${esc(scenario.id)}</span>
              <span>引擎 ${esc(scenario.calculationVersion)}</span>
              ${scenario.inputsSource === "demo_baseline" ? '<span class="tag warning">演示基准参数</span>' : ""}
            </div>
          </div>
          <div class="head-actions">
            ${canEdit() ? `<button class="btn primary" id="calc-rerun">${esc(actionLabel)}</button><button class="btn" data-calc-dup="${esc(scenario.id)}">复制方案</button>` : '<span class="tag">只读视图</span>'}
            <button class="btn" data-go="/projects/${esc(projectId)}">返回项目详情</button>
          </div>
        </div>
        ${contextFacts(ctx)}
      </div>

      <section class="panel calc-workspace-section calc-result-hero">
        <div class="section-title"><div><h2>核心测算结果</h2><p>真实计算 · 显示层与计算层精度分离 · 禁止页面自算 KPI</p></div></div>
        <div id="calc-stale-slot">${stale ? `<div class="calc-stale-banner" role="status">参数已变更，请重新测算</div>` : ""}</div>
        ${metricStrip(m, { calculatedAt: scenario.results?.calculatedAt, stale: false })}
      </section>

      <div class="calc-workspace-grid">
        <section class="panel calc-workspace-section">
          <div class="section-title"><div><h2>测算方案参数</h2><p>与上方「项目自动带入」分离；项目名称/客户/区域/负责人只读</p></div></div>
          <div class="field" style="margin-bottom:14px"><label for="calc-name">方案名称</label><input class="input" id="calc-name" value="${esc(scenario.name)}" ${canEdit() ? "" : "disabled"}></div>
          ${editableFields(scenario.inputs, scenario.inputsSource)}
        </section>
        <section class="panel calc-workspace-section">
          <div class="section-title"><div><h2>成本构成</h2><p>与引擎 costBreakdown 一致</p></div></div>
          <div class="table-wrap"><table>
            <thead><tr><th>科目</th><th class="num">金额（元）</th><th class="num">占比</th></tr></thead>
            <tbody>${costRows || '<tr class="empty-row"><td colspan="3">暂无成本明细（待测算）</td></tr>'}</tbody>
          </table></div>
        </section>
      </div>
      ${aiPanelMarkup(scenario.id)}
    </div>`);
  }

  function createScenarioForProject(projectId) {
    const p = projects.find((x) => x.id === projectId);
    if (!p || !canEdit() || !permittedProjects().includes(p)) {
      toast("无权新建测算方案", "error");
      return;
    }
    global.PmCalc.syncProjectFromShell(p);
    const inputs = global.PmCalc.createDefaultInput();
    if (typeof p.tractor === "number" && p.tractor > 0) {
      inputs.fleetSize = p.tractor;
      inputs.vehicle.fleetSize = p.tractor;
    }
    const saved = global.PmCalc.saveScenario(
      {
        projectId,
        name: `方案 ${new Date().toLocaleString("zh-CN", { hour12: false })}`,
        version: "V1",
        status: "draft",
        inputs,
        results: null,
        notes: "新建方案：已加载演示基准参数，待确认后开始测算",
        inputsSource: "demo_baseline",
      },
      { recalculate: false },
    );
    toast("已新建方案并加载演示基准参数，请确认后开始测算");
    go(`/projects/${projectId}/calculation/${saved.id}`);
  }

  function runCalculateCurrent() {
    const match = /^\/projects\/([^/]+)\/calculation\/([^/]+)$/.exec(currentRoute());
    if (!match || !canEdit()) return;
    const [, projectId, scenarioId] = match;
    const origin = global.PmCalc.getScenario(scenarioId);
    if (!origin) return toast("方案不存在", "error");

    showFieldError("");
    const formError = validateEditableForm();
    if (formError) {
      showFieldError(formError);
      toast(formError, "error");
      return;
    }

    try {
      const inputs = applyEditableFields(origin.inputs);
      const name = $("#calc-name")?.value.trim() || origin.name;
      const validation = global.PmCalc.validateSchemeInput(inputs);
      if (validation.errors?.length) {
        const msg = validation.errors[0].message || "参数校验失败";
        showFieldError(msg);
        toast(msg, "error");
        return;
      }
      // 先试算，捕获除零 / IRR 等引擎异常，避免白屏
      try {
        global.PmCalc.calculateProject(inputs);
      } catch (engineErr) {
        const msg = engineErr?.message || "测算引擎执行失败";
        showFieldError(msg);
        toast(msg, "error");
        return;
      }
      global.PmCalc.saveScenario({
        id: scenarioId,
        projectId,
        name,
        version: origin.version,
        status: origin.status === "baseline" ? "baseline" : "calculated",
        inputs,
        notes: origin.notes,
        inputsSource: "user",
      });
      toast(origin.results ? "已重新测算并保存" : "测算完成并已保存");
      render();
    } catch (err) {
      const msg = err?.message || "测算失败";
      showFieldError(msg);
      toast(msg, "error");
    }
  }

  function bindDirtyWatchers() {
    const workspace = $("[data-calc-workspace]");
    if (!workspace || !canEdit()) return;
    const baseline = workspace.dataset.calcFingerprint || "";
    const hasResults = workspace.dataset.hasResults === "1";
    const slot = $("#calc-stale-slot");
    const update = () => {
      if (!slot) return;
      const current = readFormFingerprint();
      const dirty = hasResults && Boolean(baseline) && current !== baseline;
      if (dirty) {
        slot.innerHTML = `<div class="calc-stale-banner" role="status">参数已变更，请重新测算</div>`;
      } else if (!hasResults) {
        slot.innerHTML = `<div class="calc-stale-banner is-pending" role="status">演示基准参数待确认，请点击「开始测算」</div>`;
      } else {
        slot.innerHTML = "";
      }
      showFieldError("");
    };
    $$("[data-calc-field], #calc-name").forEach((el) => {
      el.addEventListener("input", update);
      el.addEventListener("change", update);
    });
    update();
  }

  function bindResetSeed() {
    $("#calc-reset-seed")?.addEventListener("click", () => {
      modal(
        "一键恢复演示数据",
        "将清除本机测算相关 LocalStorage，并重新写入演示种子方案（含基准与对比方案）。项目管理列表中的会话修改不受影响。",
        "确认恢复",
        () => {
          try {
            global.PmCalc.resetDemoData();
            toast("演示测算数据已恢复");
            render();
          } catch (err) {
            toast(err?.message || "恢复失败", "error");
          }
        },
      );
    });
  }

  function bindCalculationActions() {
    bindResetSeed();
    $$("[data-calc-new]").forEach((btn) => {
      btn.onclick = () => createScenarioForProject(btn.dataset.calcNew);
    });
    $$("[data-calc-dup]").forEach((btn) => {
      btn.onclick = () => {
        if (!canEdit()) return toast("只读视图不可复制", "error");
        try {
          const copy = global.PmCalc.duplicateScenario(btn.dataset.calcDup);
          toast("方案已复制（已用引擎重算）");
          go(`/projects/${copy.projectId}/calculation/${copy.id}`);
        } catch (err) {
          toast(err.message || "复制失败", "error");
        }
      };
    });
    $$("[data-calc-del]").forEach((btn) => {
      btn.onclick = () => {
        if (!canEdit()) return;
        modal("删除测算方案", "删除后不可恢复。方案数据仅存在于本机演示存储中。", "确认删除", () => {
          global.PmCalc.deleteScenario(btn.dataset.calcDel);
          toast("方案已删除");
          render();
        });
      };
    });
    $("#calc-rerun")?.addEventListener("click", runCalculateCurrent);
    bindDirtyWatchers();

    const aiMatch = /^\/projects\/([^/]+)\/calculation\/([^/]+)$/.exec(currentRoute());
    if (aiMatch && $("#calc-ai-refresh")) {
      const projectId = aiMatch[1];
      const scenarioId = aiMatch[2];
      const p = projects.find((x) => x.id === projectId);
      const ctx = p && global.PmCalc ? global.PmCalc.buildProjectContext(p) : null;
      $("#calc-ai-refresh").onclick = () => runAiAnalysis(scenarioId, ctx);
      const scenario = global.PmCalc.getScenario(scenarioId);
      if (scenario?.results) {
        runAiAnalysis(scenarioId, ctx);
      }
    }
  }

  function matchCalculationRoute(route) {
    if (route === "/calculation") return { type: "center" };
    let m = /^\/projects\/([^/]+)\/calculation\/new$/.exec(route);
    if (m) return { type: "new", projectId: m[1] };
    m = /^\/projects\/([^/]+)\/calculation\/([^/]+)$/.exec(route);
    if (m) return { type: "workspace", projectId: m[1], scenarioId: m[2] };
    m = /^\/projects\/([^/]+)\/calculation$/.exec(route);
    if (m) return { type: "project", projectId: m[1] };
    return null;
  }

  function renderCalculationRoute(route) {
    const hit = matchCalculationRoute(route);
    if (!hit) return null;
    if (hit.type === "center") return calcCenterPage();
    if (hit.type === "new") {
      createScenarioForProject(hit.projectId);
      return null;
    }
    if (hit.type === "workspace") return scenarioWorkspacePage(hit.projectId, hit.scenarioId);
    if (hit.type === "project") return projectCalculationPage(hit.projectId);
    return null;
  }

  global.CalculationApp = {
    calcIcon,
    matchCalculationRoute,
    renderCalculationRoute,
    bindCalculationActions,
    calcCenterPage,
    projectCalculationPage,
    scenarioWorkspacePage,
  };
})(window);
