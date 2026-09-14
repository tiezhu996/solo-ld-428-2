/* 藏品管理页。 */
window.Pages = window.Pages || {};

window.Pages.artworks = async function (root) {
  let state = { q: "", status: "" };

  async function load() {
    const qs = new URLSearchParams();
    if (state.q) qs.set("q", state.q);
    if (state.status) qs.set("status", state.status);
    return API.get(`/api/artworks?${qs}`);
  }

  function render(data) {
    root.innerHTML = `
      <div class="card">
        <div class="spread" style="margin-bottom:14px">
          <div class="filter-bar" style="margin:0">
            <input id="f-q" placeholder="搜索标题 / 编号 / 艺术家" value="${UI.esc(state.q)}" style="min-width:240px"/>
            <select id="f-status">
              <option value="">全部状态</option>
              <option value="available" ${state.status === "available" ? "selected" : ""}>在库可借</option>
              <option value="reserved" ${state.status === "reserved" ? "selected" : ""}>已预约</option>
              <option value="on_loan" ${state.status === "on_loan" ? "selected" : ""}>在展/在途</option>
            </select>
          </div>
          <button class="btn btn-primary" id="btn-new">＋ 登记藏品</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr>
              <th>馆藏编号</th><th>标题</th><th>艺术家</th><th>媒介 / 尺寸</th>
              <th>库位</th><th>状态</th><th>当前借展</th><th></th>
            </tr></thead>
            <tbody>${data.items.map(row).join("") || `<tr><td colspan="8"><div class="empty">没有符合条件的藏品</div></td></tr>`}</tbody>
          </table>
        </div>
      </div>`;

    root.querySelector("#btn-new").onclick = () => editModal(null, reload);
    root.querySelector("#f-q").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { state.q = e.target.value.trim(); reload(); }
    });
    root.querySelector("#f-status").onchange = (e) => { state.status = e.target.value; reload(); };
    root.querySelectorAll("[data-edit]").forEach((el) => {
      el.onclick = async () => {
        const detail = await API.get(`/api/artworks/${el.getAttribute("data-edit")}`);
        editModal(detail, reload);
      };
    });
    root.querySelectorAll("[data-del]").forEach((el) => {
      el.onclick = async () => {
        const id = el.getAttribute("data-del");
        const name = el.getAttribute("data-name");
        if (!await UI.confirmDialog(`确认删除藏品「${name}」？此操作不可恢复。`)) return;
        try {
          await API.del(`/api/artworks/${id}`);
          UI.toast("已删除", "success");
          reload();
        } catch (err) { UI.showError(err, "删除失败"); }
      };
    });
  }

  function row(a) {
    return `<tr>
      <td class="mono">${UI.esc(a.accession_no)}</td>
      <td><strong>${UI.esc(a.title)}</strong>${a.condition_note ? `<div class="small muted" title="${UI.esc(a.condition_note)}">状况备注：${UI.esc(a.condition_note.slice(0, 20))}${a.condition_note.length > 20 ? "…" : ""}</div>` : ""}</td>
      <td>${UI.esc(a.artist)}${a.year ? `<div class="small muted">${UI.esc(a.year)}</div>` : ""}</td>
      <td class="small">${UI.esc(a.medium)}<br><span class="muted">${UI.esc(a.dimensions)}</span></td>
      <td class="small">${UI.esc(a.location)}</td>
      <td>${UI.badge(a.status)}</td>
      <td class="small">${a.current_loan_no
        ? `<span class="mono">${UI.esc(a.current_loan_no)}</span><div class="muted">${UI.fmtDate(a.current_start)} ~ ${UI.fmtDate(a.current_end)}</div>`
        : "—"}</td>
      <td class="right" style="white-space:nowrap">
        <button class="btn btn-sm" data-edit="${a.id}">编辑</button>
        <button class="btn btn-sm btn-danger" data-del="${a.id}" data-name="${UI.esc(a.title)}">删除</button>
      </td>
    </tr>`;
  }

  async function reload() { render(await load()); }
  await reload();
};

function editModal(item, onSaved) {
  const isNew = !item;
  const m = UI.modal({
    title: isNew ? "登记藏品" : `编辑藏品 · ${item.accession_no}`,
    body: `
      <div class="form-grid">
        <label class="field"><span>馆藏编号 *</span><input id="f-acc" value="${UI.esc(item?.accession_no || "")}"/></label>
        <label class="field"><span>标题 *</span><input id="f-title" value="${UI.esc(item?.title || "")}"/></label>
        <label class="field"><span>艺术家</span><input id="f-artist" value="${UI.esc(item?.artist || "")}"/></label>
        <label class="field"><span>创作年份</span><input id="f-year" value="${UI.esc(item?.year || "")}"/></label>
        <label class="field"><span>媒介</span><input id="f-medium" value="${UI.esc(item?.medium || "")}" placeholder="布面油画 / 青铜 / 银盐摄影…"/></label>
        <label class="field"><span>尺寸</span><input id="f-dim" value="${UI.esc(item?.dimensions || "")}" placeholder="60×80 cm"/></label>
        <label class="field"><span>库位</span><input id="f-loc" value="${UI.esc(item?.location || "")}"/></label>
        <label class="field"></label>
        <label class="field full"><span>原始状况记录</span>
          <textarea id="f-cond" rows="3" placeholder="已知旧伤、修复痕迹等，将作为出库/归还核对基准">${UI.esc(item?.condition_note || "")}</textarea>
        </label>
      </div>`,
  });
  const save = m.btn(isNew ? "登记" : "保存");
  m.foot.prepend(Object.assign(document.createElement("button"), { className: "btn", textContent: "取消", onclick: m.close }));
  save.onclick = async () => {
    const body = {
      accession_no: m.root.querySelector("#f-acc").value.trim(),
      title: m.root.querySelector("#f-title").value.trim(),
      artist: m.root.querySelector("#f-artist").value.trim(),
      year: m.root.querySelector("#f-year").value.trim(),
      medium: m.root.querySelector("#f-medium").value.trim(),
      dimensions: m.root.querySelector("#f-dim").value.trim(),
      location: m.root.querySelector("#f-loc").value.trim(),
      condition_note: m.root.querySelector("#f-cond").value.trim(),
    };
    try {
      if (isNew) await API.post("/api/artworks", body);
      else await API.put(`/api/artworks/${item.id}`, body);
      UI.toast(isNew ? "藏品已登记" : "已保存", "success");
      m.close();
      onSaved && onSaved();
    } catch (err) { UI.showError(err, "保存失败"); }
  };
}
