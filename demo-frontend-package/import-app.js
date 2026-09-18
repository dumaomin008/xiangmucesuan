/**
 * V2.0 AI 资料导入测算 UI（Demo）
 * 解析结果来自 PmCalc.importApi / DocumentParserAdapter，禁止在 UI 硬编码参数。
 */
(function (global) {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const goTo = (path) => {
    const next = path.startsWith("#") ? path.slice(1) : path;
    const cur = (location.hash.slice(1) || "").split("?")[0];
    if (cur === next && typeof global.render === "function") {
      global.render();
      return;
    }
    if (typeof global.go === "function") global.go(next);
    else location.hash = `#${next}`;
  };
  const notify = (msg, type) => {
    if (typeof global.toast === "function") global.toast(msg, type);
  };
  const refreshView = () => {
    if (typeof global.render === "function") global.render();
  };

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusBadge(status) {
    const map = {
      EXTRACTED: ["已识别", "success"],
      MISSING: ["缺失", "warning"],
      CONFLICT: ["冲突", "danger"],
      INFERRED: ["AI推断", "info"],
      MANUAL: ["人工", "info"],
      CONFIRMED: ["已确认", "success"],
      UPLOADED: ["已上传", "info"],
      PARSING: ["解析中", "warning"],
      PARSED: ["已解析", "success"],
      FAILED: ["失败", "danger"],
    };
    const [label, cls] = map[status] || [status, "info"];
    return `<span class="tag ${cls}">${esc(label)}</span>`;
  }

  function groupTitle(g) {
    return (
      {
        project: "项目基础",
        vehicle: "车辆参数",
        transport: "运输参数",
        revenue: "收入参数",
        energy: "能源参数",
        cost: "司机及成本",
        finance: "财务参数",
      }[g] || g
    );
  }

  function openCreateCalcModal() {
    if (typeof global.modal !== "function") {
      goTo("/calculation/import");
      return;
    }
    global.modal(
      "新建测算",
      `<div class="calc-create-options">
        <button type="button" class="calc-create-card" data-create-mode="ai">
          <strong>AI 导入资料测算 <span class="tag success">推荐</span></strong>
          <p>上传项目资料，AI 自动识别经营参数，确认后生成测算方案。</p>
        </button>
        <button type="button" class="calc-create-card" data-create-mode="link">
          <strong>关联已有项目</strong>
          <p>从项目管理选择已有项目，自动带入 ProjectContext 后创建测算。</p>
        </button>
        <button type="button" class="calc-create-card" data-create-mode="manual">
          <strong>手动创建测算</strong>
          <p>手动录入项目与经营参数，适用于资料不足或快速试算。</p>
        </button>
      </div>`,
      "关闭",
      () => true,
    );
    setTimeout(() => {
      const wrap = document.querySelector(".modal-backdrop");
      if (!wrap) return;
      $$("[data-create-mode]", wrap).forEach((btn) => {
        btn.onclick = () => {
          const mode = btn.dataset.createMode;
          wrap.remove();
          if (mode === "ai") goTo("/calculation/import");
          else if (mode === "link") goTo("/calculation/link");
          else goTo("/calculation/manual");
        };
      });
      const confirm = $("[data-confirm]", wrap);
      if (confirm) confirm.textContent = "关闭";
    }, 0);
  }

  function importUploadPage() {
    if (!global.PmCalc?.importApi) {
      return `<div class="state-page"><div><h1>导入能力未加载</h1><p>请确认 pm-calc.bundle.js 已更新。</p><button class="btn" data-go="/calculation">返回测算中心</button></div></div>`;
    }
    const session = global.PmCalc.importApi.createSession({ createMode: "ai_import" });
    try {
      sessionStorage.setItem("pm-import-session", session.id);
    } catch {}

    return `${typeof breadcrumb === "function" ? breadcrumb([{ label: "项目测算中心", href: "/calculation" }, { label: "AI导入资料" }]) : ""}
    <div class="calc-import-page">
      ${typeof pageHead === "function" ? pageHead("AI 导入资料测算", "上传资料 → AI解析 → 参数确认 → Calculation Engine", `<button class="btn" data-go="/calculation">返回</button>`) : "<h1>AI 导入资料测算</h1>"}
      <ol class="calc-import-steps">
        <li class="active">① 上传资料</li>
        <li>② AI解析</li>
        <li>③ 参数确认</li>
        <li>④ 开始测算</li>
      </ol>
      <section class="panel calc-import-upload" data-import-session="${esc(session.id)}">
        <div class="calc-dropzone" id="calc-import-dropzone" tabindex="0">
          <strong>拖拽项目资料到这里</strong>
          <p>Excel / PDF / Word / 图片 · 支持多文件</p>
          <button type="button" class="btn primary" id="calc-import-pick">选择文件</button>
          <input type="file" id="calc-import-file" multiple accept=".xlsx,.xls,.pdf,.doc,.docx,.png,.jpg,.jpeg" hidden>
        </div>
        <div class="calc-import-toolbar">
          <button type="button" class="btn" id="calc-import-demo">加载演示资料</button>
          <button type="button" class="btn" id="calc-import-add-more">继续添加</button>
          <button type="button" class="btn primary" id="calc-import-parse" disabled>开始AI解析</button>
        </div>
        <ul class="calc-import-files" id="calc-import-files"><li class="help">尚未添加文件。建议先「加载演示资料」。</li></ul>
        <p class="help">解析由 DocumentParserAdapter（mode=demo）完成；API Key 不进浏览器。AI 失败时可改用关联项目 / 手动创建。</p>
      </section>
    </div>`;
  }

  function renderFileList(session) {
    if (!session?.files?.length) return `<li class="help">尚未添加文件。</li>`;
    return session.files
      .map(
        (f) => `<li data-file-id="${esc(f.id)}">
          <span>${esc(f.name)}</span>
          ${statusBadge(f.status)}
          ${f.errorMessage ? `<small class="calc-import-err">${esc(f.errorMessage)}</small>` : ""}
          ${f.status === "FAILED" ? `<button type="button" class="btn ghost small" data-import-retry="${esc(f.id)}">重试</button>` : ""}
        </li>`,
      )
      .join("");
  }

  function importReviewPage(sessionId) {
    const api = global.PmCalc?.importApi;
    if (!api) return `<div class="state-page"><div><h1>导入能力未加载</h1></div></div>`;
    const session = api.getSession(sessionId);
    if (!session) {
      return `<div class="state-page"><div><h1>导入会话不存在</h1><button class="btn primary" data-go="/calculation/import">重新开始</button></div></div>`;
    }
    const summary = api.summarize(sessionId)?.summary || { extracted: 0, missing: 0, conflict: 0, inferred: 0, total: 0 };
    const gate = api.canStart(sessionId);
    const groups = {};
    for (const p of session.parameters) {
      (groups[p.group] ||= []).push(p);
    }

    const paramHtml = Object.entries(groups)
      .map(([g, list]) => {
        const rows = list
          .map((p) => {
            const val =
              p.status === "MISSING" || p.normalizedValue == null || p.normalizedValue === ""
                ? "—"
                : `${esc(p.normalizedValue)}${p.unit ? ` ${esc(p.unit)}` : ""}`;
            let actions = "";
            if (p.status === "CONFLICT" && p.alternatives?.length) {
              actions = `<div class="calc-conflict-box">${p.alternatives
                .map(
                  (a, i) =>
                    `<label><input type="radio" name="conflict-${esc(p.field)}" value="${i}"> ${esc(a.value)}${a.unit ? esc(a.unit) : ""} <small>（${esc(a.source?.fileName || "")}）</small></label>`,
                )
                .join("")}
                <label><input type="radio" name="conflict-${esc(p.field)}" value="manual"> 手动填写 <input class="input" data-conflict-manual="${esc(p.field)}" placeholder="输入值" style="width:120px;display:inline-block"></label>
                <button type="button" class="btn small primary" data-resolve-conflict="${esc(p.field)}">确认选择</button>
              </div>`;
            }
            if (p.status === "INFERRED") {
              actions = `<div class="calc-infer-box"><p>${esc(p.inferReason || "AI 推断，需人工确认")}</p>
                <button type="button" class="btn small primary" data-confirm-infer="${esc(p.field)}">确认</button>
                <button type="button" class="btn small" data-reject-infer="${esc(p.field)}">改为缺失</button></div>`;
            }
            if (p.status === "MISSING") {
              actions = `<div class="calc-missing-box"><input class="input" data-manual-field="${esc(p.field)}" placeholder="补充${esc(p.label)}">
                <button type="button" class="btn small" data-manual-save="${esc(p.field)}">保存</button></div>`;
            }
            const sourceBtn =
              p.sources?.length && p.status !== "MISSING"
                ? `<button type="button" class="btn ghost small" data-show-source="${esc(p.field)}">查看来源</button>`
                : "";
            return `<tr data-param-field="${esc(p.field)}" data-param-status="${esc(p.status)}">
              <td>${esc(p.label)}${p.required ? ' <span class="tag danger">必填</span>' : ""}</td>
              <td>${val}</td>
              <td>${statusBadge(p.status)}</td>
              <td>${sourceBtn}${actions}</td>
            </tr>`;
          })
          .join("");
        return `<section class="panel calc-param-group"><h3>${esc(groupTitle(g))}</h3>
          <div class="table-wrap"><table><thead><tr><th>参数</th><th>值</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>
        </section>`;
      })
      .join("");

    const projectHint = session.suggestedProjectName
      ? `<div class="calc-project-link-hint panel">
          <p>识别到资料可能属于：「${esc(session.suggestedProjectName)}」${session.suggestedProjectId ? `（${esc(session.suggestedProjectId)}）` : ""}</p>
          <label><input type="radio" name="import-project-mode" value="link" ${session.suggestedProjectId ? "checked" : ""}> 关联该项目</label>
          <label><input type="radio" name="import-project-mode" value="temp" ${!session.suggestedProjectId ? "checked" : ""}> 创建临时测算</label>
        </div>`
      : `<div class="calc-project-link-hint panel"><label><input type="radio" name="import-project-mode" value="temp" checked> 创建临时测算</label></div>`;

    return `${typeof breadcrumb === "function" ? breadcrumb([{ label: "项目测算中心", href: "/calculation" }, { label: "参数确认" }]) : ""}
    <div class="calc-import-page" data-import-review="${esc(sessionId)}">
      ${typeof pageHead === "function" ? pageHead("AI 已完成资料解析", "请处理缺失 / 冲突 / 推断后再测算。数字最终由 Calculation Engine 计算。", `<button class="btn" data-go="/calculation/import">重新上传</button>`) : ""}
      <ol class="calc-import-steps">
        <li>① 上传资料</li>
        <li>② AI解析</li>
        <li class="active">③ 参数确认</li>
        <li>④ 开始测算</li>
      </ol>
      <section class="metric-section">
        <div class="vehicle-metrics compact-inventory-metrics calc-center-metric-row">
          <article class="metric-card"><div class="metric-main"><div class="metric-label">已识别</div><div class="metric-value">${summary.extracted}<span class="metric-unit">项</span></div></div></article>
          <article class="metric-card"><div class="metric-main"><div class="metric-label">缺失</div><div class="metric-value">${summary.missing}<span class="metric-unit">项</span></div></div></article>
          <article class="metric-card"><div class="metric-main"><div class="metric-label">冲突</div><div class="metric-value">${summary.conflict}<span class="metric-unit">项</span></div></div></article>
          <article class="metric-card"><div class="metric-main"><div class="metric-label">AI推断</div><div class="metric-value">${summary.inferred}<span class="metric-unit">项</span></div></div></article>
        </div>
      </section>
      <div class="calc-import-review-layout">
        <div class="calc-import-params">
          <div class="toolbar"><label><input type="checkbox" id="calc-import-only-pending"> 仅看待处理项</label></div>
          ${paramHtml}
          ${projectHint}
          <div class="calc-import-start-bar">
            <p id="calc-import-gate">${gate.ok ? "核心参数已就绪，可开始测算。" : `尚不可测算：${esc(gate.reasons.slice(0, 3).join("；"))}`}</p>
            <button type="button" class="btn primary" id="calc-import-start" ${gate.ok ? "" : "disabled"}>确认参数并开始测算</button>
          </div>
        </div>
        <aside class="panel calc-import-assistant">
          <h3>AI 项目测算助手 · 补参</h3>
          <p class="help">例：月租9800，重载能耗1.45，司机单趟120</p>
          <div id="calc-import-chat" class="calc-ai-chat" style="min-height:160px"></div>
          <div id="calc-import-pending" class="calc-ai-confirm" hidden></div>
          <textarea id="calc-import-ask" class="textarea" rows="3" placeholder="补充缺失参数…"></textarea>
          <button type="button" class="btn primary" id="calc-import-ask-send">发送</button>
        </aside>
      </div>
    </div>`;
  }

  function linkProjectPage() {
    const list = (typeof visibleProjects === "function" ? visibleProjects() : projects || [])
      .map(
        (p) =>
          `<tr><td>${esc(p.name)}</td><td>${esc(p.customer)}</td><td>${esc(p.region)}</td>
          <td><button class="btn primary small" data-link-project="${esc(p.id)}">选择并创建测算</button></td></tr>`,
      )
      .join("");
    return `${typeof breadcrumb === "function" ? breadcrumb([{ label: "项目测算中心", href: "/calculation" }, { label: "关联已有项目" }]) : ""}
      ${typeof pageHead === "function" ? pageHead("关联已有项目测算", "自动带入 ProjectContext，创建新方案后进入参数页", `<button class="btn" data-go="/calculation">返回</button>`) : ""}
      <section class="panel"><div class="table-wrap"><table>
        <thead><tr><th>项目</th><th>客户</th><th>区域</th><th>操作</th></tr></thead>
        <tbody>${list || `<tr class="empty-row"><td colspan="4">暂无可见项目</td></tr>`}</tbody>
      </table></div></section>`;
  }

  function manualCreatePage() {
    return linkProjectPage().replace("关联已有项目测算", "手动创建测算").replace("自动带入 ProjectContext，创建新方案后进入参数页", "选择项目后进入手动参数录入");
  }

  let pendingSupplement = null;

  function bindImportActions() {
    const api = global.PmCalc?.importApi;
    if (!api) return;

    // upload page
    const sessionEl = $("[data-import-session]");
    if (sessionEl) {
      const sessionId = sessionEl.dataset.importSession;
      const fileInput = $("#calc-import-file");
      const list = $("#calc-import-files");
      const parseBtn = $("#calc-import-parse");

      const refresh = () => {
        const s = api.getSession(sessionId);
        if (list) list.innerHTML = renderFileList(s);
        if (parseBtn) parseBtn.disabled = !(s?.files?.length);
      };

      const addFiles = (fileList) => {
        const files = [...fileList].map((f) => ({ name: f.name, mimeType: f.type, size: f.size }));
        api.addFiles(sessionId, files);
        refresh();
      };

      $("#calc-import-pick")?.addEventListener("click", () => fileInput?.click());
      $("#calc-import-add-more")?.addEventListener("click", () => fileInput?.click());
      fileInput?.addEventListener("change", () => {
        if (fileInput.files?.length) addFiles(fileInput.files);
        fileInput.value = "";
      });
      const drop = $("#calc-import-dropzone");
      drop?.addEventListener("dragover", (e) => {
        e.preventDefault();
        drop.classList.add("is-drag");
      });
      drop?.addEventListener("dragleave", () => drop.classList.remove("is-drag"));
      drop?.addEventListener("drop", (e) => {
        e.preventDefault();
        drop.classList.remove("is-drag");
        if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
      });
      $("#calc-import-demo")?.addEventListener("click", () => {
        api.loadDemoSamples(sessionId);
        refresh();
        notify("已加载演示资料（解析仍走 Adapter）");
      });
      parseBtn?.addEventListener("click", () => {
        parseBtn.disabled = true;
        parseBtn.textContent = "AI解析中…";
        setTimeout(() => {
          const result = api.parseFiles(sessionId);
          if (!result.session) {
            notify("解析失败", "error");
            parseBtn.disabled = false;
            parseBtn.textContent = "开始AI解析";
            return;
          }
          goTo(`/calculation/import/${sessionId}`);
        }, 600);
      });
      list?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-import-retry]");
        if (!btn) return;
        api.retryFile(sessionId, btn.dataset.importRetry);
        refresh();
      });
      refresh();
    }

    // review page
    const review = $("[data-import-review]");
    if (review) {
      const sessionId = review.dataset.importReview;

      const reload = () => refreshView();

      $$("[data-resolve-conflict]").forEach((btn) => {
        btn.onclick = () => {
          const field = btn.dataset.resolveConflict;
          const checked = $(`input[name="conflict-${field}"]:checked`);
          if (!checked) {
            notify("请先选择一个来源或手动值", "error");
            return;
          }
          if (checked.value === "manual") {
            const v = $(`[data-conflict-manual="${field}"]`)?.value;
            if (!v) {
              notify("请填写手动值", "error");
              return;
            }
            api.resolveConflict(sessionId, field, { manualValue: Number.isFinite(Number(v)) ? Number(v) : v });
          } else {
            api.resolveConflict(sessionId, field, { alternativeIndex: Number(checked.value) });
          }
          reload();
        };
      });

      $$("[data-confirm-infer]").forEach((btn) => {
        btn.onclick = () => {
          api.confirmInferred(sessionId, btn.dataset.confirmInfer, true);
          reload();
        };
      });
      $$("[data-reject-infer]").forEach((btn) => {
        btn.onclick = () => {
          api.confirmInferred(sessionId, btn.dataset.rejectInfer, false);
          reload();
        };
      });
      $$("[data-manual-save]").forEach((btn) => {
        btn.onclick = () => {
          const field = btn.dataset.manualSave;
          const raw = $(`[data-manual-field="${field}"]`)?.value;
          if (raw == null || raw === "") {
            notify("请输入值", "error");
            return;
          }
          const value = Number.isFinite(Number(raw)) ? Number(raw) : raw;
          api.confirmParameter(sessionId, field, value);
          reload();
        };
      });
      $$("[data-show-source]").forEach((btn) => {
        btn.onclick = () => {
          const session = api.getSession(sessionId);
          const p = session?.parameters.find((x) => x.field === btn.dataset.showSource);
          if (!p?.sources?.length) return;
          const text = p.sources
            .map(
              (s) =>
                `${s.fileName}${s.sheetName ? ` / Sheet:${s.sheetName}` : ""}${s.page ? ` / 第${s.page}页` : ""}${s.cellRange ? ` / ${s.cellRange}` : ""}\n原文：${s.originalText || "—"}`,
            )
            .join("\n\n");
          alert(`${p.label} 来源：\n\n${text}`);
        };
      });

      $("#calc-import-only-pending")?.addEventListener("change", (e) => {
        const only = e.target.checked;
        $$("[data-param-status]").forEach((tr) => {
          const st = tr.dataset.paramStatus;
          const pending = st === "MISSING" || st === "CONFLICT" || st === "INFERRED";
          tr.hidden = only && !pending;
        });
      });

      const chat = $("#calc-import-chat");
      if (chat && !chat.dataset.ready) {
        chat.dataset.ready = "1";
        const session = api.getSession(sessionId);
        const miss = session?.parameters.filter((p) => p.status === "MISSING").map((p) => p.label) || [];
        chat.innerHTML = `<div class="calc-ai-msg assistant"><div class="calc-ai-bubble">当前资料已解析。建议优先补充：${esc(miss.slice(0, 4).join("、") || "无")}。补参需确认后才会写入。</div></div>`;
      }

      $("#calc-import-ask-send")?.addEventListener("click", () => {
        const text = ($("#calc-import-ask")?.value || "").trim();
        if (!text) return;
        const preview = api.previewSupplement(sessionId, text);
        const chatBox = $("#calc-import-chat");
        if (chatBox) {
          chatBox.innerHTML += `<div class="calc-ai-msg user"><div class="calc-ai-bubble">${esc(text)}</div></div>`;
        }
        $("#calc-import-ask").value = "";
        if (!preview.patches.length) {
          chatBox.innerHTML += `<div class="calc-ai-msg assistant"><div class="calc-ai-bubble">未识别到可补充参数。可说「月租9800，重载能耗1.45」。</div></div>`;
          return;
        }
        pendingSupplement = preview.patches;
        const slot = $("#calc-import-pending");
        slot.hidden = false;
        slot.innerHTML = `<div class="calc-ai-confirm-card"><strong>待确认写入</strong>
          <ul>${preview.changes.map((c) => `<li>${esc(c.label)}：${esc(c.from)} → ${esc(c.to)} ${esc(c.unit)}</li>`).join("")}</ul>
          <button type="button" class="btn primary" id="calc-import-apply-sup">确认写入</button>
          <button type="button" class="btn" id="calc-import-cancel-sup">取消</button>
        </div>`;
        $("#calc-import-apply-sup").onclick = () => {
          api.applySupplement(sessionId, pendingSupplement || []);
          pendingSupplement = null;
          notify("已写入参数（待测算）");
          reload();
        };
        $("#calc-import-cancel-sup").onclick = () => {
          pendingSupplement = null;
          slot.hidden = true;
          slot.innerHTML = "";
        };
      });

      $("#calc-import-start")?.addEventListener("click", () => {
        const mode = $('input[name="import-project-mode"]:checked')?.value || "temp";
        const session = api.getSession(sessionId);
        const result = api.createScenario(sessionId, {
          linkSuggested: mode === "link",
          createTempProject: mode === "temp",
          projectId: mode === "link" ? session?.suggestedProjectId : undefined,
          tempName: session?.suggestedProjectName || "临时测算项目",
        });
        if (!result.scenario) {
          notify(result.errors?.[0] || "无法开始测算", "error");
          return;
        }
        notify("已调用 Calculation Engine 完成测算");
        goTo(`/projects/${result.scenario.projectId}/calculation/${result.scenario.id}`);
      });
    }

    $$("[data-link-project]").forEach((btn) => {
      btn.onclick = () => {
        const projectId = btn.dataset.linkProject;
        if (global.CalculationApp?.createScenarioForProject) {
          global.CalculationApp.createScenarioForProject(projectId);
        } else {
          goTo(`/projects/${projectId}/calculation/new`);
        }
      };
    });
  }

  global.ImportApp = {
    openCreateCalcModal,
    importUploadPage,
    importReviewPage,
    linkProjectPage,
    manualCreatePage,
    bindImportActions,
  };
})(window);
