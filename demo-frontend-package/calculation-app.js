/**
 * 项目测算模块 UI（Demo 壳层内，Phase 4 视觉对齐 Design Spec）
 * 依赖 window.PmCalc；不改业务公式。
 */
(function (global) {
  const money = (v) => (global.PmCalc ? global.PmCalc.formatMoney(v) : String(v ?? "—"));
  const pct = (v) => (global.PmCalc ? global.PmCalc.formatPercent(v) : String(v ?? "—"));
  const statusLabel = (s) => (global.PmCalc ? global.PmCalc.scenarioStatusLabel(s) : s);

  function requireCalc() {
    if (!global.PmCalc) {
      return `<div class="state-page"><div><h1>测算引擎未加载</h1><p>请确认已引入 lib/pm-calc.bundle.js。核心测算不可 Mock。</p><button class="btn primary" data-go="/projects">返回项目管理</button></div></div>`;
    }
    return null;
  }

  function calcIcon() {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h5M8 15h3M14 14l2 2 3-3"/></svg>';
  }

  /** 面包屑：Header / Sidebar 外的路径上下文，不使用独立 Card */
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
    const tone = status === "baseline" ? "success" : status === "calculated" ? "info" : status === "archived" ? "warning" : "";
    return `<span class="tag ${tone} calc-status">${esc(statusLabel(status))}</span>`;
  }

  /** 复用项目详情车辆统计的扁平指标样式，避免指标再套边框 Card */
  function metricStrip(metrics) {
    if (!metrics) {
      return `<div class="help" style="padding:12px 0">尚未执行测算</div>`;
    }
    const profit = Number(metrics.monthlyProfit);
    const profitTone = profit > 0 ? "positive" : profit < 0 ? "negative" : "";
    const items = [
      ["月营收", money(metrics.monthlyRevenue), "元", ""],
      ["月总成本", money(metrics.monthlyTotalCost), "元", ""],
      ["月利润", money(metrics.monthlyProfit), "元", profitTone],
      ["利润率", pct(metrics.profitMargin), "", profitTone],
      ["月运量", money(metrics.monthlyVolume), "吨", ""],
      ["月里程", money(metrics.monthlyMileage), "km", ""],
    ];
    return `<div class="vehicle-metrics calc-result-metrics" aria-label="测算结果摘要">${items
      .map(
        ([label, value, unit, tone]) =>
          `<article class="metric-card calc-result-metric ${tone}"><div class="metric-main"><div class="metric-label">${label}</div><div class="metric-value">${value}${unit ? `<span class="metric-unit">${unit}</span>` : ""}</div></div></article>`,
      )
      .join("")}</div>`;
  }

  function contextFacts(ctx) {
    if (!ctx) return "";
    const cells = [
      ["关联项目", `${esc(ctx.projectName)}<div class="object-meta">${esc(ctx.projectId)}</div>`],
      ["客户", esc(ctx.customer || "—")],
      ["大区", esc(ctx.region || "—")],
      ["负责人", esc(ctx.owner || "—")],
      ["项目类型", esc(ctx.projectType || "—")],
      ["项目地点", esc(ctx.place || "—")],
      ["需求车辆", ctx.tractorDemand ?? "—"],
      ["需求挂车", ctx.trailerDemand ?? "—"],
    ];
    return `<div class="facts calc-context-facts">${cells
      .map(([label, value]) => `<div><div class="fact-label">${label}</div><div class="fact-value">${value}</div></div>`)
      .join("")}</div>
      <p class="calc-context-note">项目基础信息按项目编号自动带入；测算专属参数在方案中维护。引擎 ${esc(global.PmCalc.engineVersion)} · LocalStorage</p>`;
  }

  function compareStrip(list) {
    if (list.length < 2) return "";
    const baseline = list.find((s) => s.status === "baseline") || list[0];
    const peer = list.find((s) => s.id !== baseline.id) || list[1];
    const a = baseline.results?.metrics;
    const b = peer.results?.metrics;
    if (!a || !b) return "";
    const rows = [
      ["月营收（元）", money(a.monthlyRevenue), money(b.monthlyRevenue)],
      ["月利润（元）", money(a.monthlyProfit), money(b.monthlyProfit)],
      ["利润率", pct(a.profitMargin), pct(b.profitMargin)],
      ["月总成本（元）", money(a.monthlyTotalCost), money(b.monthlyTotalCost)],
    ];
    return `<section class="panel calc-compare-panel">
      <div class="section-title"><div><h2>方案对比</h2><p>基准方案与最近对比方案 · 数字来自真实引擎结果快照</p></div></div>
      <div class="table-wrap"><table class="calc-compare-table">
        <thead><tr><th>指标</th><th class="num">${esc(baseline.name)}</th><th class="num">${esc(peer.name)}</th><th class="num">差额</th></tr></thead>
        <tbody>${rows
          .map(([label, left, right], index) => {
            const keys = ["monthlyRevenue", "monthlyProfit", "profitMargin", "monthlyTotalCost"];
            const lv = Number(a[keys[index]]);
            const rv = Number(b[keys[index]]);
            const diff = Number.isFinite(lv) && Number.isFinite(rv) ? rv - lv : null;
            const diffText =
              diff === null
                ? "—"
                : keys[index] === "profitMargin"
                  ? pct(String(diff))
                  : money(String(diff));
            const diffClass = diff === null ? "" : diff > 0 ? "is-positive" : diff < 0 ? "is-negative" : "";
            return `<tr><td>${label}</td><td class="num">${left}</td><td class="num">${right}</td><td class="num ${diffClass}">${diffText}</td></tr>`;
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
        const profitClass = profit === null ? "" : profit >= 0 ? "is-positive" : "is-negative";
        return `<tr>
          <td class="object-cell"><div class="object-name" data-go="/projects/${esc(s.projectId)}/calculation/${esc(s.id)}">${esc(s.name)}</div><div class="object-meta">${esc(s.id)} · ${esc(s.version)}</div></td>
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
        const baseline = scenarios.find((s) => s.status === "baseline") || scenarios[0];
        const m = baseline?.results?.metrics;
        const profit = m ? Number(m.monthlyProfit) : null;
        return `<tr>
          <td class="object-cell"><div class="object-name" data-go="/projects/${esc(projectId)}/calculation">${esc(p?.name || projectId)}</div><div class="object-meta">${esc(projectId)} · ${esc(p?.customer || "")}</div></td>
          <td class="num">${scenarios.length}</td>
          <td>${baseline ? statusTag(baseline.status) : "—"}</td>
          <td class="num">${m ? money(m.monthlyRevenue) : "—"}</td>
          <td class="num ${profit === null ? "" : profit >= 0 ? "is-positive" : "is-negative"}">${m ? money(m.monthlyProfit) : "—"}</td>
          <td class="num">${m ? pct(m.profitMargin) : "—"}</td>
          <td><button class="btn ghost small text-action" data-go="/projects/${esc(projectId)}/calculation">进入测算</button></td>
        </tr>`;
      })
      .join("");

    return shell(`${breadcrumb([
      { label: "业务管理" },
      { label: "项目测算中心" },
    ])}
    ${pageHead("项目测算中心", "跨项目查看测算方案 · 核心数字由浏览器真实计算引擎产出", stateControl())}
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
            <button class="btn" data-go="/calculation">测算中心</button>
          </div>
        </div>
        ${contextFacts(ctx)}
      </div>
      ${compareStrip(list)}
      <section class="panel project-list-panel calc-scenario-panel">
        <div class="section-title" style="padding:14px 0 0"><div><h2>测算方案</h2><p>一个项目可保存多个方案；复制仅复制输入并重新计算</p></div></div>
        <div class="table-wrap responsive"><table>
          <thead><tr><th>方案</th><th>状态</th><th class="num">月营收</th><th class="num">月利润</th><th class="num">利润率</th><th>更新时间</th><th>引擎版本</th><th>操作</th></tr></thead>
          <tbody>${scenarioRows(list, projectId)}</tbody>
        </table></div>
      </section>
    </div>`);
  }

  function editableFields(inputs) {
    const seg = inputs.routes?.[0]?.segments?.[0];
    if (!seg) return "";
    const fleet = inputs.fleetSize ?? inputs.vehicle?.fleetSize ?? 1;
    return `<div class="form-grid calc-param-grid">
      <div class="field"><label for="calc-fleet">车辆数</label><input class="input" id="calc-fleet" type="number" min="1" step="1" value="${esc(fleet)}"></div>
      <div class="field"><label for="calc-rent">单车月租（元）</label><input class="input" id="calc-rent" type="number" step="0.01" value="${esc(inputs.vehicle?.monthlyRentPerVehicle || "")}"></div>
      <div class="field"><label for="calc-distance">路段1里程（km）</label><input class="input" id="calc-distance" type="number" step="0.01" value="${esc(seg.distanceKm)}"></div>
      <div class="field"><label for="calc-load">载重（吨）</label><input class="input" id="calc-load" type="number" step="0.01" value="${esc(seg.loadTon)}"></div>
      <div class="field"><label for="calc-price">运价</label><input class="input" id="calc-price" type="number" step="0.01" value="${esc(seg.freightPrice)}"></div>
      <div class="field"><label for="calc-trips">单车月趟数</label><input class="input" id="calc-trips" type="number" step="0.01" value="${esc(seg.tripsPerVehicleMonth)}"></div>
      <div class="field"><label for="calc-elec">电价（元/kWh）</label><input class="input" id="calc-elec" type="number" step="0.01" value="${esc(seg.electricityPrice)}"></div>
      <div class="field"><label for="calc-energy">满载能耗（kWh/km）</label><input class="input" id="calc-energy" type="number" step="0.01" value="${esc(seg.loadedEnergyConsumption)}"></div>
      <div class="field span-2"><label for="calc-driver">司机成本（元/趟，路段覆盖）</label><input class="input" id="calc-driver" type="number" step="0.01" value="${esc(seg.driverCostPerTrip || "0")}"></div>
    </div>
    <p class="help">演示页开放关键经营参数；「重新测算」调用浏览器引擎完整重算，非前端估算。</p>`;
  }

  function applyEditableFields(inputs) {
    const next = JSON.parse(JSON.stringify(inputs));
    const fleet = Math.max(1, Math.round(Number($("#calc-fleet")?.value || next.fleetSize || 1)));
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
      const payload = global.PmCalc.buildAiPayload({
        scenario,
        project,
        question,
        localInsight: insight,
      });
      const res = await fetch("/api/demo-ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.text) {
        remoteText = data.text;
        insight = { ...insight, source: "remote_llm" };
      } else {
        remoteError = data.message || `服务返回 ${res.status}`;
      }
    } catch {
      remoteError = "无法连接 AI 代理";
    }

    body.innerHTML = renderAiBody(insight, remoteText, remoteError);
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
    const costRows = (scenario.results?.full?.costBreakdown || [])
      .map(
        (row) =>
          `<tr><td>${esc(row.name || row.code)}</td><td class="num">${money(row.amount)}</td><td class="num">${row.share != null ? pct(row.share) : "—"}</td></tr>`,
      )
      .join("");

    return shell(`<div class="calc-page calc-workspace">
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
            </div>
          </div>
          <div class="head-actions">
            ${canEdit() ? `<button class="btn primary" id="calc-rerun">重新测算并保存</button><button class="btn" data-calc-dup="${esc(scenario.id)}">复制方案</button>` : '<span class="tag">只读视图</span>'}
            <button class="btn" data-go="/projects/${esc(projectId)}">返回项目详情</button>
          </div>
        </div>
        ${contextFacts(ctx)}
      </div>

      <section class="panel calc-workspace-section">
        <div class="section-title"><div><h2>测算结果</h2><p>真实计算 · 显示层与计算层精度分离</p></div></div>
        ${metricStrip(m)}
        <div class="calc-result-meta">
          <span>IRR：${m?.irr != null ? pct(m.irr) : esc(m?.irrReason || "—")}</span>
          <span>累计现金流：${m ? money(m.cumulativeCashFlow) : "—"}</span>
          <span>转正月：${m?.firstPositiveMonth ?? "—"}</span>
        </div>
      </section>

      <div class="calc-workspace-grid">
        <section class="panel calc-workspace-section">
          <div class="section-title"><div><h2>测算参数</h2><p>项目上下文只读；以下为测算专属参数</p></div></div>
          <div class="field" style="margin-bottom:14px"><label for="calc-name">方案名称</label><input class="input" id="calc-name" value="${esc(scenario.name)}" ${canEdit() ? "" : "disabled"}></div>
          ${editableFields(scenario.inputs)}
        </section>
        <section class="panel calc-workspace-section">
          <div class="section-title"><div><h2>成本构成</h2><p>与引擎 costBreakdown 一致</p></div></div>
          <div class="table-wrap"><table>
            <thead><tr><th>科目</th><th class="num">金额（元）</th><th class="num">占比</th></tr></thead>
            <tbody>${costRows || '<tr class="empty-row"><td colspan="3">暂无成本明细</td></tr>'}</tbody>
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
    const saved = global.PmCalc.saveScenario({
      projectId,
      name: `方案 ${new Date().toLocaleString("zh-CN", { hour12: false })}`,
      version: "V1",
      status: "calculated",
      inputs,
      notes: "从项目测算新建",
    });
    toast("方案已创建并完成测算");
    go(`/projects/${projectId}/calculation/${saved.id}`);
  }

  function bindCalculationActions() {
    $$("[data-calc-new]").forEach((btn) => {
      btn.onclick = () => createScenarioForProject(btn.dataset.calcNew);
    });
    $$("[data-calc-dup]").forEach((btn) => {
      btn.onclick = () => {
        if (!canEdit()) return toast("只读视图不可复制", "error");
        try {
          const copy = global.PmCalc.duplicateScenario(btn.dataset.calcDup);
          toast("方案已复制");
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
    $("#calc-rerun")?.addEventListener("click", () => {
      const match = /^\/projects\/([^/]+)\/calculation\/([^/]+)$/.exec(currentRoute());
      if (!match || !canEdit()) return;
      const [, projectId, scenarioId] = match;
      const origin = global.PmCalc.getScenario(scenarioId);
      if (!origin) return toast("方案不存在", "error");
      try {
        const inputs = applyEditableFields(origin.inputs);
        const name = $("#calc-name")?.value.trim() || origin.name;
        const validation = global.PmCalc.validateSchemeInput(inputs);
        if (validation.errors?.length) {
          toast(validation.errors[0].message || "参数校验失败", "error");
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
        });
        toast("已重新测算并保存");
        render();
      } catch (err) {
        toast(err.message || "测算失败", "error");
      }
    });

    const aiMatch = /^\/projects\/([^/]+)\/calculation\/([^/]+)$/.exec(currentRoute());
    if (aiMatch && $("#calc-ai-refresh")) {
      const projectId = aiMatch[1];
      const scenarioId = aiMatch[2];
      const p = projects.find((x) => x.id === projectId);
      const ctx = p && global.PmCalc ? global.PmCalc.buildProjectContext(p) : null;
      $("#calc-ai-refresh").onclick = () => runAiAnalysis(scenarioId, ctx);
      // 进入工作区后自动生成本地解读（不阻塞；远端失败自动降级）
      runAiAnalysis(scenarioId, ctx);
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
