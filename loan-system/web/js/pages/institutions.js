/* 借展机构管理页。 */
window.Pages = window.Pages || {};

window.Pages.institutions = async function (root) {
  async function load() {
    return API.get("/api/institutions");
  }

  function render(data) {
    root.innerHTML = `
      <div class="card">
        <div class="spread" style="margin-bottom:14px">
          <div class="muted small" style="margin:0">共 ${data.items.length} 家借展机构</div>
          <button class="btn btn-primary" id="btn-new">＋ 新增机构</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr>
              <th>机构名称</th><th>联系人</th><th>电话 / 邮箱</th><th>地址</th>
              <th class="right">借展次数</th><th></th>
            </tr></thead>
            <tbody>${data.items.map(row).join("") || `<tr><td colspan="6"><div class="empty">还没有机构，点击右上角新增</div></td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    root.querySelector("#btn-new").onclick = () => editModal(null, reload);
    root.querySelectorAll("[data-edit]").forEach((el) => {
      el.onclick = () => {
        const item = data.items.find((x) => String(x.id) === el.getAttribute("data-edit"));
        editModal(item, reload);
      };
    });
    root.querySelectorAll("[data-del]").forEach((el) => {
      el.onclick = async () => {
        const item = data.items.find((x) => String(x.id) === el.getAttribute("data-del"));
        if (!await UI.confirmDialog(`确认删除机构「${item.name}」？`)) return;
        try {
          await API.del(`/api/institutions/${item.id}`);
          UI.toast("已删除", "success");
          reload();
        } catch (err) { UI.showError(err, "删除失败"); }
      };
    });
  }

  function row(i) {
    return `<tr>
      <td><strong>${UI.esc(i.name)}</strong>${i.note ? `<div class="small muted">${UI.esc(i.note)}</div>` : ""}</td>
      <td>${UI.esc(i.contact || "—")}</td>
      <td class="small">${UI.esc(i.phone || "—")}<br><span class="muted">${UI.esc(i.email || "")}</span></td>
      <td class="small muted">${UI.esc(i.address || "—")}</td>
      <td class="right mono">${i.loan_count}<div class="small ${i.active_count ? "" : "muted"}">${i.active_count ? `进行中 ${i.active_count}` : "无在途"}</div></td>
      <td class="right" style="white-space:nowrap">
        <button class="btn btn-sm" data-edit="${i.id}">编辑</button>
        <button class="btn btn-sm btn-danger" data-del="${i.id}">删除</button>
      </td>
    </tr>`;
  }

  async function reload() { render(await load()); }
  await reload();
};

function editModal(item, onSaved) {
  const isNew = !item;
  const m = UI.modal({
    title: isNew ? "新增借展机构" : `编辑机构 · ${item.name}`,
    body: `
      <div class="form-grid">
        <label class="field full"><span>机构名称 *</span><input id="f-name" value="${UI.esc(item?.name || "")}"/></label>
        <label class="field"><span>联系人</span><input id="f-contact" value="${UI.esc(item?.contact || "")}"/></label>
        <label class="field"><span>电话</span><input id="f-phone" value="${UI.esc(item?.phone || "")}"/></label>
        <label class="field full"><span>邮箱</span><input id="f-email" value="${UI.esc(item?.email || "")}"/></label>
        <label class="field full"><span>地址</span><input id="f-address" value="${UI.esc(item?.address || "")}"/></label>
        <label class="field full"><span>备注</span><textarea id="f-note" rows="2">${UI.esc(item?.note || "")}</textarea></label>
      </div>`,
  });
  const save = m.btn(isNew ? "新增" : "保存");
  m.foot.prepend(Object.assign(document.createElement("button"), { className: "btn", textContent: "取消", onclick: m.close }));
  save.onclick = async () => {
    const body = {
      name: m.root.querySelector("#f-name").value.trim(),
      contact: m.root.querySelector("#f-contact").value.trim(),
      phone: m.root.querySelector("#f-phone").value.trim(),
      email: m.root.querySelector("#f-email").value.trim(),
      address: m.root.querySelector("#f-address").value.trim(),
      note: m.root.querySelector("#f-note").value.trim(),
    };
    if (!body.name) { UI.toast("机构名称不能为空", "error"); return; }
    try {
      if (isNew) await API.post("/api/institutions", body);
      else await API.put(`/api/institutions/${item.id}`, body);
      UI.toast(isNew ? "机构已新增" : "已保存", "success");
      m.close();
      onSaved && onSaved();
    } catch (err) { UI.showError(err, "保存失败"); }
  };
}
