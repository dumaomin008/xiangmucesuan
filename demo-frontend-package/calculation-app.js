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

  function calcBizStatus(scenarios) {
    const hasDraft = scenarios.some((s) => s.status === "draft" || !s.results);
    const risky = scenarios.some((s) => {
      const p = s.results?.metrics?.monthlyProfit;
      return p != null && Number(p) < 0;
    });
    if (risky) return { label: "存在风险", cls: "danger" };
    if (hasDraft && !scenarios.some((s) => s.results)) return { label: "待完善", cls: "warning" };
    if (scenarios.some((s) => s.results)) return { label: "已测算", cls: "success" };
    return { label: "待完善", cls: "warning" };
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

    const incomplete = [...byProject.values()].filter((list) => list.some((s) => !s.results || s.status === "draft")).length;
    const risky = [...byProject.values()].filter((list) =>
      list.some((s) => s.results && Number(s.results.metrics.monthlyProfit) < 0),
    ).length;

    const recent = [...all]
      .filter((s) => s.results?.calculatedAt)
      .sort((a, b) => String(b.results.calculatedAt).localeCompare(String(a.results.calculatedAt)))
      .slice(0, 6);

    const recentRows = recent
      .map((s) => {
        const p = projects.find((x) => x.id === s.projectId);
        const m = s.results?.metrics;
        const profit = m ? Number(m.monthlyProfit) : null;
        return `<tr>
          <td class="object-cell"><div class="object-name">${esc(p?.name || s.projectId)}</div><div class="object-meta">${esc(p?.customer || "")}</div></td>
          <td>${esc(s.name)}</td>
          <td class="num">${m ? money(m.monthlyRevenue) : "—"}</td>
          <td class="num">${m ? money(m.monthlyTotalCost) : "—"}</td>
          <td class="num ${profit != null && profit < 0 ? "is-negative" : "is-positive"}">${m ? money(m.monthlyProfit) : "—"}</td>
          <td class="num">${m ? pct(m.profitMargin) : "—"}</td>
          <td>${esc((s.results?.calculatedAt || s.updatedAt || "").replace("T", " ").slice(0, 16))}</td>
          <td>${statusTag(s.status)}</td>
          <td><div class="table-actions">
            <button class="btn ghost small text-action" data-go="/projects/${esc(s.projectId)}/calculation/${esc(s.id)}">继续测算</button>
            <button class="btn ghost small text-action" data-go="/projects/${esc(s.projectId)}/calculation/${esc(s.id)}">查看结果</button>
          </div></td>
        </tr>`;
      })
      .join("");

    const tableBody = [...byProject.entries()]
      .map(([projectId, scenarios]) => {
        const p = projects.find((x) => x.id === projectId);
        const latest =
          [...scenarios]
            .filter((s) => s.results?.calculatedAt)
            .sort((a, b) => String(b.results.calculatedAt).localeCompare(String(a.results.calculatedAt)))[0] || null;
        const m = latest?.results?.metrics;
        const profit = m ? Number(m.monthlyProfit) : null;
        const st = calcBizStatus(scenarios);
        return `<tr>
          <td class="object-cell"><div class="object-name" data-go="/projects/${esc(projectId)}/calculation">${esc(p?.name || projectId)}</div><div class="object-meta">${esc(projectId)}</div></td>
          <td>${esc(p?.customer || "—")}</td>
          <td class="num">${scenarios.length}</td>
          <td>${esc(latest?.name || "待测算")}</td>
          <td class="num">${m ? money(m.monthlyRevenue) : "—"}</td>
          <td class="num ${profit === null || !Number.isFinite(profit) ? "" : profit >= 0 ? "is-positive" : "is-negative"}">${m ? money(m.monthlyProfit) : "—"}</td>
          <td class="num">${m ? pct(m.profitMargin) : "—"}</td>
          <td><span class="tag ${st.cls}">${st.label}</span></td>
          <td>${latest?.results?.calculatedAt ? esc(String(latest.results.calculatedAt).replace("T", " ").slice(0, 16)) : "待测算"}</td>
          <td><button class="btn ghost small text-action" data-go="/projects/${esc(projectId)}/calculation">进入测算</button></td>
        </tr>`;
      })
      .join("");

    const empty = byProject.size === 0;
    const emptyBlock = empty
      ? `<section class="panel calc-empty-state">
          <h2>暂无项目测算</h2>
          <p>上传项目资料，让 AI 自动识别经营参数，快速生成第一份项目测算。</p>
          <div class="calc-empty-actions">
            <button type="button" class="btn primary" id="calc-center-ai-import" data-go="/calculation/import">AI导入资料测算</button>
            <button type="button" class="btn" data-go="/calculation/link">关联已有项目</button>
            <button type="button" class="btn" data-go="/calculation/manual">手动创建</button>
          </div>
        </section>`
      : "";

    return shell(`${breadcrumb([{ label: "业务管理" }, { label: "项目测算中心" }])}
    ${pageHead(
      "项目测算中心",
      "跨项目管理测算方案、经营结果与方案决策",
      `${canEdit() ? `<button class="btn primary" id="calc-center-new">${icons.plus}<span>新建测算</span></button><button class="btn" id="calc-center-ai-import" data-go="/calculation/import">AI辅助测算</button>` : ""}
       <details class="calc-demo-tools"><summary>演示状态 / Demo Tools</summary>
         <div class="calc-demo-tools-body">${stateControl()}${resetDemoButton()}
         <p class="help">引擎 ${esc(global.PmCalc.engineVersion)} · LocalStorage · 不作为业务 KPI</p></div>
       </details>`,
    )}
    <section class="metric-section calc-center-metrics" aria-label="测算中心经营摘要">
      <div class="vehicle-metrics compact-inventory-metrics calc-center-metric-row">
        <article class="metric-card"><div class="metric-main"><div class="metric-label">测算项目</div><div class="metric-value">${byProject.size}<span class="metric-unit">个</span></div></div></article>
        <article class="metric-card"><div class="metric-main"><div class="metric-label">测算方案</div><div class="metric-value">${all.length}<span class="metric-unit">个</span></div></div></article>
        <article class="metric-card"><div class="metric-main"><div class="metric-label">待完善测算</div><div class="metric-value">${incomplete}<span class="metric-unit">个</span></div></div></article>
        <article class="metric-card"><div class="metric-main"><div class="metric-label">风险方案</div><div class="metric-value">${risky}<span class="metric-unit">个</span></div></div></article>
      </div>
    </section>
    ${emptyBlock}
    ${
      empty
        ? ""
        : `<section class="panel project-list-panel calc-center-panel">
      <div class="section-title" style="padding:14px 0 0"><div><h2>最近测算</h2><p>核心 KPI 来自已保存 Calculation Result</p></div></div>
      <div class="table-wrap responsive"><table>
        <thead><tr><th>项目/客户</th><th>方案</th><th class="num">月收入</th><th class="num">月总成本</th><th class="num">月利润</th><th class="num">利润率</th><th>最后测算</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${recentRows || `<tr class="empty-row"><td colspan="9">暂无已测算方案</td></tr>`}</tbody>
      </table></div>
    </section>
    <section class="panel project-list-panel calc-center-panel">
      <div class="section-title" style="padding:14px 0 0"><div><h2>项目测算列表</h2><p>跨项目查看测算任务与经营结果</p></div>
        <div class="toolbar"><input class="input" id="calc-center-filter" placeholder="搜索项目/客户" style="max-width:220px"></div>
      </div>
      <div class="table-wrap responsive"><table id="calc-center-table">
        <thead><tr><th>项目名称</th><th>客户</th><th class="num">方案数</th><th>最新方案</th><th class="num">月收入</th><th class="num">月利润</th><th class="num">利润率</th><th>测算状态</th><th>最后测算</th><th>操作</th></tr></thead>
        <tbody>${tableBody}</tbody>
      </table></div>
    </section>`
    }`);
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

  /** 助手会话（页面内保持，刷新后重置） */
  let assistantSession = null;
  let assistantHistory = [];

  function ensureAssistantSession() {
    if (!assistantSession && global.PmCalc?.createAssistantSession) {
      assistantSession = global.PmCalc.createAssistantSession();
    }
    return assistantSession;
  }

  function pageContextForAssistant(hasResults) {
    if (/\/calculation\/compare|方案对比/.test(currentRoute())) return "compare";
    if (hasResults) return "results";
    return "input";
  }

  function assistantShortcuts(page) {
    const map = global.PmCalc?.assistantShortcuts || {
      project: ["当前项目情况怎么样？", "当前项目有哪些核心参数？", "这个项目有什么风险？"],
      input: ["哪些参数最影响利润？", "当前参数是否存在明显异常？", "帮我检查一下测算参数。"],
      results: [
        "为什么这个项目利润这么低？",
        "帮我分析成本结构。",
        "哪些参数最影响利润？",
        "帮我找出项目风险。",
        "如果电价下降0.1元会怎么样？",
        "帮我生成项目汇报结论。",
      ],
      compare: ["两个方案有什么区别？", "哪些指标变化最大？", "帮我解释方案差异。"],
    };
    return map[page] || map.results;
  }

  function aiPanelMarkup(scenarioId, hasResults) {
    const page = pageContextForAssistant(hasResults);
    const chips = assistantShortcuts(page)
      .map((q) => `<button type="button" class="calc-ai-chip" data-ai-ask="${esc(q)}">${esc(q)}</button>`)
      .join("");
    return `<section class="panel calc-workspace-section calc-ai-panel" data-calc-ai-panel="${esc(scenarioId)}">
      <div class="section-title">
        <div>
          <h2>AI 项目测算助手</h2>
          <p>懂项目、懂参数、能调用真实计算引擎 · 数字只来自引擎 · AI 故障不阻塞测算</p>
        </div>
        <div class="head-actions">
          <button type="button" class="btn small primary" id="calc-ai-open">打开助手</button>
          <button type="button" class="btn small" id="calc-ai-refresh">刷新解读</button>
        </div>
      </div>
      <div class="calc-ai-chips" id="calc-ai-chips">${chips}</div>
      <div id="calc-ai-body" class="calc-ai-body" aria-live="polite">
        <div class="help">可直接点快捷问题，或打开右侧助手用自然语言查询、改参、重算、对比与汇报。</div>
      </div>
      <aside id="calc-ai-drawer" class="calc-ai-drawer" hidden>
        <div class="calc-ai-drawer-head">
          <div>
            <strong>AI 项目测算助手</strong>
            <p>修改参数需确认后才会调用 Calculation Engine</p>
          </div>
          <button type="button" class="btn ghost small" id="calc-ai-close">关闭</button>
        </div>
        <div id="calc-ai-chat" class="calc-ai-chat" aria-live="polite"></div>
        <div id="calc-ai-confirm" class="calc-ai-confirm" hidden></div>
        <div class="calc-ai-compose">
          <textarea id="calc-ai-input" class="textarea" rows="3" placeholder="例如：如果电价从0.8元降到0.65元呢？"></textarea>
          <button type="button" class="btn primary" id="calc-ai-send">发送</button>
        </div>
        <p class="calc-ai-disclaimer">API Key 仅存在服务端；未配置时自动使用本地洞察引擎。</p>
      </aside>
      <button type="button" class="calc-ai-fab" id="calc-ai-fab" aria-label="打开 AI 项目测算助手">AI 助手</button>
    </section>`;
  }

  const AI_CHAT_TIMEOUT_MS = 9000;

  function aiMoney(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "待确认";
    return global.PmCalc?.formatMoney ? global.PmCalc.formatMoney(value) : Number(value).toLocaleString("zh-CN");
  }

  function aiRatio(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "待确认";
    return global.PmCalc?.formatPercent ? global.PmCalc.formatPercent(value) : `${(Number(value) * 100).toFixed(2)}%`;
  }

  function displayNarrative(text) {
    const raw = String(text || "").trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fenced ? fenced[1] : raw;
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(body.slice(start, end + 1));
        const conclusion = parsed?.summary?.conclusion;
        const highlights = Array.isArray(parsed?.summary?.highlights) ? parsed.summary.highlights.filter((item) => typeof item === "string") : [];
        if (conclusion) return [conclusion, ...highlights].join("\n");
      } catch {
        return "";
      }
    }
    return raw;
  }

  function renderVisualReport(report) {
    if (!report) return "";
    const metrics = (report.keyMetrics || [])
      .map((metric) => {
        let value = "待确认";
        if (metric.value !== null && metric.value !== undefined && Number.isFinite(Number(metric.value))) {
          if (metric.unit === "ratio") value = aiRatio(metric.value);
          else if (metric.unit === "月") value = Number(metric.value) === 0 ? "无需回收" : Number(metric.value) >= 12 ? `${(Number(metric.value) / 12).toFixed(1)}年` : `第 ${metric.value} 月`;
          else value = aiMoney(metric.value);
        }
        return `<article class="calc-ai-kpi"><span>${esc(metric.name)}</span><strong>${esc(value)}</strong><em>${esc(metric.statusLabel || "")}</em></article>`;
      })
      .join("");
    const costs = (report.costStructure || []).filter((item) => Number(item.value) > 0);
    const colors = ["#667EEA", "#82C0A8", "#F0B46A", "#E07A7A", "#8E8EA8", "#5B9BF5", "#C4B5FD", "#94A3B8"];
    let cursor = 0;
    const stops = costs.map((item, index) => {
      const start = cursor;
      cursor += Number(item.percentage) || 0;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    });
    const maxCost = Math.max(...costs.map((item) => Number(item.value) || 0), 1);
    const bars = costs
      .map(
        (item, index) =>
          `<div class="calc-ai-bar-row"><span>${esc(item.name)}</span><div class="calc-ai-bar-track"><i style="width:${Math.max(4, (Number(item.value) / maxCost) * 100)}%;background:${colors[index % colors.length]}"></i></div><b>${esc(aiMoney(item.value))}</b></div>`,
      )
      .join("");
    const scenarios = report.scenarios || [];
    const maxScene = Math.max(...scenarios.flatMap((item) => [Math.abs(Number(item.revenue) || 0), Math.abs(Number(item.cost) || 0), Math.abs(Number(item.profit) || 0)]), 1);
    const sceneHtml = scenarios
      .map((item) => {
        const col = (val, cls, label) =>
          `<div class="calc-ai-scene-col"><i class="${cls}" style="height:${Math.max(6, (Math.abs(Number(val) || 0) / maxScene) * 100)}%"></i><span>${esc(label)} ${esc(aiMoney(val))}</span></div>`;
        return `<div class="calc-ai-scene"><strong>${esc(item.name)}</strong><div class="calc-ai-scene-bars">${col(item.revenue, "rev", "收入")}${col(item.cost, "cost", "成本")}${col(item.profit, "profit", "利润")}</div><p>${esc(item.scenarioSource === "demo_rule" ? "演示规则" : "当前参数")} · 利润率 ${esc(item.roi == null ? "待确认" : aiRatio(item.roi))} · 回收期 ${esc(item.paybackPeriod == null ? "待确认" : `${item.paybackPeriod}月`)}</p></div>`;
      })
      .join("");
    const points = report.trend?.points || [];
    const maxFlow = Math.max(...points.map((item) => Math.abs(Number(item.cumulativeCashFlow) || 0)), 1);
    const trend = report.trend?.available
      ? `<div class="calc-ai-trend">${points.slice(0, 24).map((item) => `<span title="第${esc(String(item.monthIndex))}月 ${esc(aiMoney(item.cumulativeCashFlow))}" style="height:${Math.max(8, (Math.abs(Number(item.cumulativeCashFlow) || 0) / maxFlow) * 100)}%"></span>`).join("")}</div><p class="calc-ai-source-quiet">柱高表示累计现金流。盈亏平衡：${esc(report.trend.breakevenMonth == null ? "待确认" : `第 ${report.trend.breakevenMonth} 月`)}</p>`
      : `<p class="help">${esc(report.trend?.message || "当前测算结果未提供分期现金流数据，暂无法生成趋势分析。")}</p>`;
    const names = [...new Set((report.sensitivity || []).map((item) => item.parameter))];
    const tornado = names.map((name) => {
      const down = (report.sensitivity || []).find((item) => item.parameter === name && Number(item.change) === -10);
      const up = (report.sensitivity || []).find((item) => item.parameter === name && Number(item.change) === 10);
      return { name, down: Number(down?.profitChange) || 0, up: Number(up?.profitChange) || 0 };
    });
    const maxSwing = Math.max(...tornado.flatMap((item) => [Math.abs(item.down), Math.abs(item.up)]), 1);
    const tornadoHtml = tornado
      .map(
        (item) =>
          `<div class="calc-ai-bar-row"><span>${esc(item.name)}</span><div class="calc-ai-tornado"><i class="down" style="width:${(Math.abs(item.down) / maxSwing) * 48}%"></i><i class="up" style="width:${(Math.abs(item.up) / maxSwing) * 48}%"></i></div><b>-10% ${esc(aiMoney(item.down))} / +10% ${esc(aiMoney(item.up))}</b></div>`,
      )
      .join("");
    const levelText = { high: "高", medium: "中", low: "低" };
    const risks = (report.risks || [])
      .map(
        (item) =>
          `<article class="calc-ai-risk"><div class="calc-ai-risk-head"><strong>${esc(item.name)}</strong><span class="tag ${item.level === "high" ? "danger" : item.level === "medium" ? "warning" : "success"}">${esc(levelText[item.level] || item.level)}</span></div><p>${esc(item.description || "")}</p><p>依据：${esc(item.evidence || "")}</p><p>影响：${esc((item.affectedMetrics || []).join("、"))}</p><p class="calc-ai-reco">建议：${esc(item.suggestion || "")}</p></article>`,
      )
      .join("");
    const recs = (report.recommendations || [])
      .map(
        (item) =>
          `<li><strong>${esc(String(item.priority).padStart(2, "0"))} ${esc(item.action)}</strong><p>${esc(item.reason)}</p><p class="calc-ai-source-quiet">影响指标：${esc(item.affectedMetric || "")}</p></li>`,
      )
      .join("");
    const assumptionBlock = (title, items) =>
      `<div><h3>${title}</h3><ul>${(items || []).map((item) => `<li>${esc(item.label)}</li>`).join("") || "<li>暂无</li>"}</ul></div>`;
    return `<article class="calc-ai-report">
      <header><p class="calc-ai-report-kicker">AI已完成项目分析</p><p class="calc-ai-source-quiet">正式分析报告与对话分开。金额、比率和回收期只来自测算引擎。</p>${report.notice ? `<p class="calc-ai-notice">${esc(report.notice)}</p>` : ""}</header>
      <section class="calc-ai-report-block"><h3>AI综合结论</h3><p>${esc(report.summary?.conclusion || "")}</p><ul>${(report.summary?.highlights || []).map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>
      <section class="calc-ai-report-block"><h3>核心KPI</h3><div class="calc-ai-kpi-grid">${metrics}</div></section>
      <section class="calc-ai-report-block"><h3>成本结构</h3><div class="calc-ai-cost">${costs.length ? `<div class="calc-ai-donut" style="background:conic-gradient(${stops.join(",")})"></div>` : `<p class="help">成本结构暂无可用金额。</p>`}<div class="calc-ai-bars">${bars}</div></div><p>${esc([report.costInsight?.largest ? `最大成本项：${report.costInsight.largest}` : "", report.costInsight?.anomaly || "", report.costInsight?.optimize ? `优先核对：${report.costInsight.optimize}` : ""].filter(Boolean).join(" · "))}</p></section>
      <section class="calc-ai-report-block"><h3>方案对比</h3><p class="calc-ai-source-quiet">${esc(report.scenarioNote || "")}</p><div class="calc-ai-scenes">${sceneHtml}</div></section>
      <section class="calc-ai-report-block"><h3>收益与现金流</h3>${trend}</section>
      <section class="calc-ai-report-block"><h3>敏感性分析</h3><p class="calc-ai-source-quiet">${esc(report.sensitivityHighlight?.reason || "参数变化由测算引擎重算。")}</p>${tornadoHtml || `<p class="help">敏感性重算暂不可用，基准结果不受影响。</p>`}</section>
      <section class="calc-ai-report-block"><h3>风险</h3><div class="calc-ai-risk-grid">${risks || `<div class="help">按当前规则，没有达到中高风险阈值的项目。</div>`}</div></section>
      <section class="calc-ai-report-block"><h3>关键假设</h3><div class="calc-ai-columns">${assumptionBlock("已确认", report.assumptions?.confirmed)}${assumptionBlock("系统计算", report.assumptions?.calculated)}${assumptionBlock("AI推断", report.assumptions?.aiInferred)}${assumptionBlock("缺失", report.assumptions?.missing)}</div></section>
      <section class="calc-ai-report-block"><h3>AI建议</h3><ol class="calc-ai-recs">${recs}</ol></section>
    </article>`;
  }

  function renderAiBody(insight, remoteText, mode) {
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
    const safeRemote = remoteText && insight.visual && global.PmCalc?.narrativeIsGrounded && !global.PmCalc.narrativeIsGrounded(remoteText, insight.visual) ? "" : remoteText;
    const shownRemote = safeRemote ? displayNarrative(safeRemote) : "";
    const remoteBlock =
      mode === "remote" && shownRemote
        ? `<div class="calc-ai-remote"><div class="calc-ai-remote-label">AI智能分析</div><div class="calc-ai-remote-text">${esc(shownRemote)}</div></div>`
        : `<p class="calc-ai-source-quiet">${insight.visual?.notice ? esc(insight.visual.notice) : "本地智能分析"}</p>`;
    const label = mode === "remote" && shownRemote ? "AI智能分析" : "本地智能分析";

    return `${renderVisualReport(insight.visual)}
      ${remoteBlock}
      <div class="calc-ai-summary"><strong>${esc(insight.title)}</strong><p>${esc(insight.summary)}</p></div>
      <div class="calc-ai-columns">
        <div><h3>要点</h3><ul>${highlights || "<li>暂无</li>"}</ul></div>
        <div><h3>建议</h3><ul>${suggestions || "<li>暂无</li>"}</ul></div>
      </div>
      <div class="calc-ai-risks"><h3>风险清单（敏感性由引擎重算）</h3><div class="calc-ai-risk-grid">${riskHtml || '<div class="help">暂无风险项</div>'}</div></div>
      <p class="calc-ai-disclaimer">${esc(insight.disclaimer)} · ${label}</p>`;
  }

  function renderChat() {
    const box = $("#calc-ai-chat");
    if (!box) return;
    if (!assistantHistory.length) {
      box.innerHTML = `<div class="calc-ai-msg assistant"><div class="calc-ai-bubble">你好，我是 AI 项目测算助手。可以帮你查询结果、修改参数（需确认）、调用真实引擎重算、对比方案并生成汇报结论。数字一律来自 Calculation Engine。</div></div>`;
      return;
    }
    box.innerHTML = assistantHistory
      .map((m) => {
        const compare =
          m.compareRows?.length
            ? `<div class="table-wrap calc-ai-compare"><table><thead><tr><th>指标</th><th class="num">方案A</th><th class="num">方案B</th><th class="num">差值</th><th class="num">变化率</th></tr></thead><tbody>${m.compareRows
                .map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${esc(r.a)}</td><td class="num">${esc(r.b)}</td><td class="num">${esc(r.delta)}</td><td class="num">${esc(r.changeRate || "—")}</td></tr>`)
                .join("")}</tbody></table></div>`
            : "";
        return `<div class="calc-ai-msg ${esc(m.role)}"><div class="calc-ai-bubble">${esc(m.content).replace(/\n/g, "<br>")}${compare}</div></div>`;
      })
      .join("");
    box.scrollTop = box.scrollHeight;
  }

  function renderConfirmCard(pending) {
    const slot = $("#calc-ai-confirm");
    if (!slot) return;
    if (!pending) {
      slot.hidden = true;
      slot.innerHTML = "";
      return;
    }
    const rows = (pending.changes || [])
      .map(
        (c) =>
          `<li><strong>${esc(c.label)}</strong>：${esc(c.from)} → ${esc(c.to)}${c.unit ? ` ${esc(c.unit)}` : ""}${
            c.scopeLabel ? ` <span class="tag info">${esc(c.scopeLabel)}</span>` : ""
          }</li>`,
      )
      .join("");
    const scopeLine = pending.scopeLabel
      ? `<p>作用范围：<strong>${esc(pending.scopeLabel)}</strong>${pending.willRecalculate ? " · 确认后重新调用 Calculation Engine" : ""}${
          pending.createNewScenario ? " · 将创建新方案" : " · 修改当前方案"
        }</p>`
      : "";
    const scopeActions =
      pending.type === "await_scope"
        ? `<div class="calc-ai-confirm-actions">
            <button type="button" class="btn primary" data-ai-scope="全部路段">全部路段统一修改</button>
            <button type="button" class="btn" data-ai-scope="指定线路">指定线路</button>
            <button type="button" class="btn" data-ai-scope="指定路段">指定路段</button>
            <button type="button" class="btn" id="calc-ai-cancel-btn">取消</button>
          </div>`
        : `<div class="calc-ai-confirm-actions">
            <button type="button" class="btn primary" id="calc-ai-confirm-btn">确认并测算</button>
            <button type="button" class="btn" id="calc-ai-cancel-btn">取消</button>
          </div>`;
    slot.hidden = false;
    slot.innerHTML = `<div class="calc-ai-confirm-card">
      <strong>待确认操作</strong>
      <p>${esc(pending.previewText)}</p>
      ${scopeLine}
      <ul>${rows || (pending.type === "await_scope" ? "<li>请先选择作用范围</li>" : "<li>无参数变更</li>")}</ul>
      ${scopeActions}
    </div>`;
    if (pending.type === "await_scope") {
      slot.querySelectorAll("[data-ai-scope]").forEach((btn) => {
        btn.onclick = () => {
          const mode = btn.getAttribute("data-ai-scope");
          if (mode === "指定线路" || mode === "指定路段") {
            const hint = window.prompt(mode === "指定线路" ? "请输入线路名称" : "请输入路段名称");
            if (!hint) return;
            void runAssistantMessage(`${mode}：${hint}`);
            return;
          }
          void runAssistantMessage(mode);
        };
      });
    } else {
      $("#calc-ai-confirm-btn").onclick = () => void runAssistantMessage("确认并测算");
    }
    $("#calc-ai-cancel-btn").onclick = () => void runAssistantMessage("取消");
  }

  function openAssistantDrawer(open) {
    const drawer = $("#calc-ai-drawer");
    if (!drawer) return;
    drawer.hidden = !open;
    document.body.classList.toggle("calc-ai-drawer-open", open);
    if (open) {
      renderChat();
      renderConfirmCard(ensureAssistantSession()?.pending || null);
      $("#calc-ai-input")?.focus();
    }
  }

  async function tryRemoteIntent(projectId, scenarioId, message) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_CHAT_TIMEOUT_MS);
      const res = await fetch("/api/demo-ai/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: message, projectId, scenarioId }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.intent || data.fallback === true) return null;
      if (!global.PmCalc?.validateLlmIntent) return null;
      return global.PmCalc.validateLlmIntent(data.intent);
    } catch (err) {
      console.error("[ai] intent", err?.name || "error");
      return null;
    }
  }

  async function runAssistantMessage(text, opts = {}) {
    const message = (text || "").trim();
    if (!message || !global.PmCalc?.runAssistant) return;
    const match = /^\/projects\/([^/]+)\/calculation\/([^/]+)$/.exec(currentRoute());
    if (!match) return;
    const [, projectId, scenarioId] = match;
    const p = projects.find((x) => x.id === projectId);
    const project = p && global.PmCalc ? global.PmCalc.buildProjectContext(p) : null;

    if (!opts.silentUser) {
      assistantHistory.push({ role: "user", content: message });
      renderChat();
    }

    let result;
    try {
      result = global.PmCalc.runAssistant({
        projectId,
        scenarioId,
        message,
        session: ensureAssistantSession(),
        project,
      });
      // 规则未命中时，尝试远端 LLM 结构化意图（失败则保持本地 fallback）
      if (result.intent?.kind === "unmatched" && !result.confirmRequired) {
        const llmIntent = await tryRemoteIntent(projectId, scenarioId, message);
        if (llmIntent && llmIntent.kind !== "unmatched") {
          result = global.PmCalc.runAssistant({
            projectId,
            scenarioId,
            message,
            session: ensureAssistantSession(),
            project,
            parsedIntent: llmIntent,
          });
        }
      }
      assistantSession = result.session;
    } catch (err) {
      assistantHistory.push({
        role: "assistant",
        content: "已切换本地智能分析。测算页面与引擎结果不受影响。",
      });
      console.error("[ai] assistant", err?.name || "error");
      renderChat();
      return;
    }

    assistantHistory.push({
      role: "assistant",
      content: result.reply,
      compareRows: result.compareRows,
    });
    renderChat();
    renderConfirmCard(result.pending);

    if (!result.confirmRequired && result.reply && result.source === "local_engine") {
      tryPolishAssistantReply(scenarioId, project, message, result.reply);
    }

    if (result.refreshedScenarioIds?.length && !result.confirmRequired) {
      toast("已按引擎结果更新方案");
      render();
      openAssistantDrawer(true);
    }
  }

  async function tryPolishAssistantReply(scenarioId, project, question, localReply) {
    try {
      const scenario = global.PmCalc.getScenario(scenarioId);
      if (!scenario?.results || !global.PmCalc.buildAiPayload) return;
      const localInsight = global.PmCalc.analyzeScenario({ scenarioId, project, question });
      const payload = global.PmCalc.buildAiPayload({
        scenario,
        project,
        question,
        localInsight: { ...localInsight, summary: localReply },
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_CHAT_TIMEOUT_MS);
      const res = await fetch("/api/demo-ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.text && data.fallback !== true) {
        const last = assistantHistory[assistantHistory.length - 1];
        if (last?.role === "assistant") {
          last.content = `${localReply}\n\n——\nAI智能分析：\n${data.text}`;
          renderChat();
        }
      }
    } catch (err) {
      console.error("[ai] polish", err?.name || "error");
    }
  }

  async function runAiAnalysis(scenarioId, project) {
    const body = $("#calc-ai-body");
    if (!body || !global.PmCalc?.analyzeScenario) return;
    body.innerHTML = `<div class="help">正在基于引擎结果生成解读…</div>`;
    let insight;
    try {
      insight = global.PmCalc.analyzeScenario({
        scenarioId,
        project,
        question: "请解释当前测算结果、主要风险与下一步建议",
      });
    } catch (err) {
      console.error("[ai] local-analysis", err?.name || "error");
      body.innerHTML = `<p class="calc-ai-source-quiet">本地智能分析</p><div class="help">测算数字仍可在上方查看。</div>`;
      return;
    }

    let remoteText = "";
    let mode = "local";
    try {
      const scenario = global.PmCalc.getScenario(scenarioId);
      if (!scenario?.results) {
        body.innerHTML = renderAiBody(insight, "", "local");
        return;
      }
      const payload = global.PmCalc.buildAiPayload({
        scenario,
        project,
        question: "请解释当前测算结果、主要风险与下一步建议",
        localInsight: insight,
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_CHAT_TIMEOUT_MS);
      const res = await fetch("/api/demo-ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.text && data.fallback !== true) {
        remoteText = data.text;
        mode = "remote";
        insight = { ...insight, source: "remote_llm" };
      } else {
        console.error("[ai] explain fallback");
      }
    } catch (err) {
      console.error("[ai] explain", err?.name || "error");
    }

    body.innerHTML = renderAiBody(insight, remoteText, mode);
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
    global.PmCalc.ensureRepos();
    let p = projects.find((x) => x.id === projectId);
    if (!p) {
      const rec = global.PmCalc.listAllProjects?.().find((item) => item.projectId === projectId);
      if (rec) {
        p = {
          id: rec.projectId,
          name: rec.projectName,
          customer: rec.customer,
          region: rec.region,
          owner: rec.owner,
          members: rec.members || [],
          stage: rec.stage || "方案测算",
          status: rec.status || "进行中",
          type: rec.projectType || "临时测算",
          place: rec.place || "",
          tractor: rec.tractorDemand || 0,
          trailer: rec.trailerDemand || 0,
          source: rec.source || "AI导入",
        };
        projects.push(p);
      }
    }
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
      ${aiPanelMarkup(scenario.id, Boolean(scenario.results))}
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
    global.ImportApp?.bindImportActions?.();
    $("#calc-center-new")?.addEventListener("click", () => global.ImportApp?.openCreateCalcModal?.());
    $$("#calc-center-ai-import").forEach((btn) => {
      btn.onclick = () => go("/calculation/import");
    });
    $("#calc-center-filter")?.addEventListener("input", (e) => {
      const q = (e.target.value || "").trim().toLowerCase();
      $$("#calc-center-table tbody tr").forEach((tr) => {
        tr.hidden = q ? !tr.textContent.toLowerCase().includes(q) : false;
      });
    });
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
    if (aiMatch && ($("#calc-ai-refresh") || $("#calc-ai-open"))) {
      const projectId = aiMatch[1];
      const scenarioId = aiMatch[2];
      const p = projects.find((x) => x.id === projectId);
      const ctx = p && global.PmCalc ? global.PmCalc.buildProjectContext(p) : null;
      $("#calc-ai-refresh")?.addEventListener("click", () => runAiAnalysis(scenarioId, ctx));
      $("#calc-ai-open")?.addEventListener("click", () => openAssistantDrawer(true));
      $("#calc-ai-fab")?.addEventListener("click", () => openAssistantDrawer(true));
      $("#calc-ai-close")?.addEventListener("click", () => openAssistantDrawer(false));
      $("#calc-ai-send")?.addEventListener("click", () => {
        const input = $("#calc-ai-input");
        const text = input?.value || "";
        if (input) input.value = "";
        void runAssistantMessage(text);
      });
      $("#calc-ai-input")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          $("#calc-ai-send")?.click();
        }
      });
      $$("[data-ai-ask]").forEach((btn) => {
        btn.onclick = () => {
          openAssistantDrawer(true);
          void runAssistantMessage(btn.dataset.aiAsk);
        };
      });
      const scenario = global.PmCalc.getScenario(scenarioId);
      if (scenario?.results) {
        runAiAnalysis(scenarioId, ctx);
      }
      try {
        const pendingAsk = sessionStorage.getItem("pm-ai-pending-ask");
        if (pendingAsk) {
          sessionStorage.removeItem("pm-ai-pending-ask");
          openAssistantDrawer(true);
          void runAssistantMessage(pendingAsk);
        }
      } catch {
        /* ignore */
      }
    }
  }

  function matchCalculationRoute(route) {
    if (route === "/calculation") return { type: "center" };
    if (route === "/calculation/import") return { type: "import_upload" };
    if (route === "/calculation/link") return { type: "import_link" };
    if (route === "/calculation/manual") return { type: "import_manual" };
    let m = /^\/calculation\/import\/([^/]+)$/.exec(route);
    if (m) return { type: "import_review", sessionId: m[1] };
    m = /^\/projects\/([^/]+)\/calculation\/new$/.exec(route);
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
    if (hit.type === "import_upload") {
      return shell(global.ImportApp ? global.ImportApp.importUploadPage() : "<p>ImportApp 未加载</p>");
    }
    if (hit.type === "import_review") {
      return shell(global.ImportApp ? global.ImportApp.importReviewPage(hit.sessionId) : "<p>ImportApp 未加载</p>");
    }
    if (hit.type === "import_link") {
      return shell(global.ImportApp ? global.ImportApp.linkProjectPage() : "<p>ImportApp 未加载</p>");
    }
    if (hit.type === "import_manual") {
      return shell(global.ImportApp ? global.ImportApp.manualCreatePage() : "<p>ImportApp 未加载</p>");
    }
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
    createScenarioForProject,
    openCreateCalcModal: () => global.ImportApp?.openCreateCalcModal?.(),
  };
})(window);
