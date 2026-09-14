/* 借展单列表页 + 新建/编辑借展单（含展期冲突预检）。 */
window.Pages = window.Pages || {};

window.Pages.loans = async function (root, ctx) {
  let status = ctx.query.status || "";

  const TABS = [
    ["", "全部"], ["pending", "待出库"], ["outgoing", "在途"],
    ["active", "借展中"], ["overdue", "逾期"], ["returned", "已归还"], ["cancelled", "已取消"],
  ];

  async function load() {
    const data = await API.get("/api/loans");
    return status ? { items: data.items.filter((x) => x.derived_status === status) } : data;
  }

  function render(data) {
    root.innerHTML = `
      <div class="section-tabs" style="margin-top:-6px">
        ${TABS.map(([k, label]) => `
          <button class="${status === k ? "active" : ""}" data-tab="${k}">${label}</button>`).join("")}
      </div>
      <div class="card">
        <div class="spread" style="margin-bottom:10px">
          <div class="muted small" style="margin:0">共 ${data.items.length} 张借展单</div>
          <button class="btn btn-primary" id="btn-new">＋ 新建借展单</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr>
              <th>借展单号</th><th>借展机构</th><th>展览/用途</th>
              <th>借展期</th><th>应还日</th><th class="right">件数</th><th>状态</th><th></th>
            </tr></thead>
            <tbody>${data.items.map(row).join("") || `<tr><td colspan="8"><div class="empty">暂无借展单</div></td></tr>`}</tbody>
          </table>
        </div>
      </div>`;

    root.querySelectorAll("[data-tab]").forEach((b) => {
      b.onclick = () => {
        status = b.getAttribute("data-tab");
        reload();
      };
    });
    root.querySelector("#btn-new").onclick = () => loanModal(null, reload);
    root.querySelectorAll("[data-edit]").forEach((el) => {
      el.onclick = async () => {
        const detail = await API.get(`/api/loans/${el.getAttribute("data-edit")}`);
        loanModal(detail, reload);
      };
    });
    root.querySelectorAll("[data-cancel]").forEach((el) => {
      el.onclick = async () => {
        const no = el.getAttribute("data-no");
        if (!await UI.confirmDialog(`确认取消借展单 ${no}？取消后作品档期释放，此操作不可撤销。`)) return;
        try {
          await API.post(`/api/loans/${el.getAttribute("data-cancel")}/cancel`);
          UI.toast("借展单已取消", "success");
          reload();
        } catch (err) { UI.showError(err, "取消失败"); }
      };
    });
  }

  function row(l) {
    const overdueTag = l.derived_status === "overdue";
    return `<tr class="clickable" data-go="${l.id}">
      <td class="mono"><strong>${UI.esc(l.loan_no)}</strong></td>
      <td>${UI.esc(l.institution_name)}</td>
      <td class="small">${UI.esc(l.purpose || "—")}<br><span class="muted">${UI.esc(l.venue || "")}</span></td>
      <td class="mono small">${UI.fmtDate(l.start_date)}<br>~ ${UI.fmtDate(l.end_date)}</td>
      <td class="mono">${UI.fmtDate(l.end_date)}${overdueTag ? `<div>${UI.badge("overdue", "已逾期")}</div>` : ""}</td>
      <td class="right mono">${l.artwork_count}</td>
      <td>${UI.badge(l.derived_status)}</td>
      <td class="right" style="white-space:nowrap">
        <a class="btn btn-sm" href="#/loans/${l.id}">打开</a>
        ${l.status === "pending" ? `
          <button class="btn btn-sm" data-edit="${l.id}">编辑</button>
          <button class="btn btn-sm btn-danger" data-cancel="${l.id}" data-no="${UI.esc(l.loan_no)}">取消单</button>` : ""}
      </td>
    </tr>`;
  }

  async function reload() { render(await load()); window.refreshReminderDot && window.refreshReminderDot(); }
  await reload();

  root.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-go]");
    const inActions = e.target.closest("a,button");
    if (tr && !inActions) location.hash = `/loans/${tr.getAttribute("data-go")}`;
  });
};

/* ---------------- 新建 / 编辑借展单弹窗 ---------------- */
async function loanModal(detail, onSaved) {
  const isNew = !detail;
  const [institutions, artworks] = await Promise.all([
    API.get("/api/institutions"),
    API.get("/api/artworks"),
  ]);
  if (!institutions.items.length) {
    UI.toast("请先在「借展机构」中新增至少一家机构", "error", 4000);
    return;
  }
  const picked = new Set((detail?.artworks || []).map((a) => a.id));

  const m = UI.modal({
    title: isNew ? "新建借展单" : `编辑借展单 · ${detail.loan_no}`,
    size: "lg",
    body: `
      <div class="form-grid">
        <label class="field"><span>借展机构 *</span>
          <select id="f-inst">
            <option value="">请选择…</option>
            ${institutions.items.map((i) => `
              <option value="${i.id}" ${String(detail?.institution_id) === String(i.id) ? "selected" : ""}>${UI.esc(i.name)}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>展厅</span><input id="f-venue" value="${UI.esc(detail?.venue || "")}"/></label>
        <label class="field"><span>借展开始 *</span><input type="date" id="f-start" value="${detail?.start_date || ""}"/></label>
        <label class="field"><span>借展结束（应归还日）*</span><input type="date" id="f-end" value="${detail?.end_date || ""}"/></label>
        <label class="field full"><span>展览名称 / 用途</span><input id="f-purpose" value="${UI.esc(detail?.purpose || "")}"/></label>
        <label class="field full"><span>备注（温湿度、照度要求等）</span><textarea id="f-notes" rows="2">${UI.esc(detail?.notes || "")}</textarea></label>
      </div>
      <div style="margin:4px 0 6px;display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:13px">借出作品 *（已选 <span id="pick-count">${picked.size}</span> 件）</strong>
        <span class="small muted">勾选作品后将自动检查档期冲突</span>
      </div>
      <div id="conflict-box"></div>
      <div class="pick-list" id="pick-list">
        ${artworks.items.map((a) => `
          <label class="pick-row">
            <input type="checkbox" data-id="${a.id}" ${picked.has(a.id) ? "checked" : ""}/>
            <div>
              <strong>${UI.esc(a.title)}</strong>
              <span class="small muted"> · ${UI.esc(a.accession_no)} · ${UI.esc(a.artist || "")}</span>
            </div>
            <span class="pick-sub">${UI.badge(a.status)}</span>
          </label>`).join("")}
      </div>`,
  });

  const $ = (sel) => m.root.querySelector(sel);
  const startEl = $("#f-start"), endEl = $("#f-end"), instEl = $("#f-inst");
  const conflictBox = $("#conflict-box");
  let conflictState = []; // 预检结果

  async function precheck() {
    picked.clear();
    m.root.querySelectorAll("#pick-list input:checked").forEach((c) => picked.add(Number(c.dataset.id)));
    $("#pick-count").textContent = picked.size;
    conflictBox.innerHTML = "";
    conflictState = [];
    if (!startEl.value || !endEl.value || !picked.size) return;
    try {
      const payload = {
        institution_id: Number(instEl.value) || institutions.items[0].id,
        start_date: startEl.value, end_date: endEl.value,
        artwork_ids: [...picked], dry_run: true,
      };
      if (isNew) await API.post("/api/loans", payload);
      else await API.put(`/api/loans/${detail.id}`, payload);
      conflictBox.innerHTML = `<div class="alert-banner" style="background:var(--green-soft);border:1px solid #bfdcc8;color:var(--green);margin:8px 0">✓ 档期检查通过，所选 ${picked.size} 件作品在该时段均可借展</div>`;
    } catch (err) {
      if (err.status === 409 && err.data.conflicts) {
        conflictState = err.data.conflicts;
        conflictBox.innerHTML = `
          <div class="alert-banner danger" style="margin:8px 0">
            <div style="font-size:16px">⛔</div>
            <div><strong>检测到 ${conflictState.length} 处展期冲突，将无法提交：</strong>
              <ul style="margin:6px 0 0 18px;padding:0">
                ${conflictState.map((c) => `<li>《${UI.esc(c.artwork_title)}》与 <strong>${UI.esc(c.loan_no)}</strong>（${UI.esc(c.institution_name)}，${UI.fmtDate(c.start_date)} ~ ${UI.fmtDate(c.end_date)}）档期重叠</li>`).join("")}
              </ul>
            </div>
          </div>`;
      } else if (err.status === 400) {
        conflictBox.innerHTML = `<div class="alert-banner warn" style="margin:8px 0">${UI.esc(err.message)}</div>`;
      }
    }
  }

  m.root.querySelectorAll("#pick-list input").forEach((c) => c.addEventListener("change", precheck));
  startEl.addEventListener("change", precheck);
  endEl.addEventListener("change", precheck);

  const save = m.btn(isNew ? "创建借展单" : "保存修改");
  m.foot.prepend(Object.assign(document.createElement("button"), { className: "btn", textContent: "取消", onclick: m.close }));
  save.onclick = async () => {
    if (!instEl.value) { UI.toast("请选择借展机构", "error"); return; }
    if (!startEl.value || !endEl.value) { UI.toast("请填写借展起止日期", "error"); return; }
    if (!picked.size) { UI.toast("请至少选择一件作品", "error"); return; }
    if (conflictState.length) { UI.toast("存在展期冲突，已阻止提交", "error"); return; }
    const body = {
      institution_id: Number(instEl.value),
      start_date: startEl.value, end_date: endEl.value,
      venue: $("#f-venue").value.trim(),
      purpose: $("#f-purpose").value.trim(),
      notes: $("#f-notes").value.trim(),
      artwork_ids: [...picked],
    };
    save.disabled = true;
    try {
      if (isNew) {
        const r = await API.post("/api/loans", body);
        UI.toast("借展单已创建", "success");
        m.close();
        location.hash = `/loans/${r.id}`;
        return;
      } else {
        await API.put(`/api/loans/${detail.id}`, body);
        UI.toast("已保存", "success");
      }
      m.close();
      onSaved && onSaved();
    } catch (err) {
      UI.showError(err, "保存失败");
      save.disabled = false;
    }
  };
}
