/* 借展单详情：概览 / 保单 / 装箱清单 / 交接记录 / 归还检查。 */
window.Pages = window.Pages || {};

window.Pages.loanDetail = async function (root, ctx) {
  const loanId = ctx.param;
  let loan = null;
  let tab = ctx.query.tab || "overview";

  async function reload(keepTab) {
    loan = await API.get(`/api/loans/${loanId}`);
    render();
    if (keepTab) switchTab(keepTab);
    window.refreshReminderDot && window.refreshReminderDot();
  }

  const TABS = [
    ["overview", "概览"],
    ["insurance", "保单信息"],
    ["packing", "装箱清单"],
    ["handovers", "交接记录"],
    ["return", "归还检查"],
  ];

  function render() {
    const l = loan;
    const overdue = l.derived_status === "overdue";
    root.innerHTML = `
      <div class="card">
        <div class="spread">
          <div>
            <div style="margin-bottom:6px">
              <a class="link small" href="#/loans">← 返回借展单列表</a>
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <h2 style="margin:0;font-size:19px">${UI.esc(l.loan_no)}</h2>
              ${UI.badge(l.derived_status)}
              ${overdue ? UI.badge("overdue", `已逾期 ${-l.days_remaining} 天`) : ""}
              ${l.status === "returned" ? `<span class="small muted">归还日期 ${UI.fmtDate(l.returned_at)}</span>` : ""}
            </div>
            <div class="small muted" style="margin-top:4px">
              ${UI.esc(l.institution_name)} · ${UI.esc(l.purpose || "—")}${l.venue ? " · " + UI.esc(l.venue) : ""}
            </div>
          </div>
          <div class="row">
            ${l.status === "pending" ? `<a class="btn" href="#/loans">编辑/取消（列表页操作）</a>` : ""}
          </div>
        </div>
      </div>

      <div class="section-tabs">
        ${TABS.map(([k, label]) => `
          <button class="${tab === k ? "active" : ""}" data-tab="${k}">${label}${tabBadge(k)}</button>`).join("")}
      </div>
      <div id="tab-body"></div>`;

    root.querySelectorAll("[data-tab]").forEach((b) => {
      b.onclick = () => switchTab(b.getAttribute("data-tab"));
    });
    renderTab();
  }

  function tabBadge(k) {
    if (k === "insurance" && !loan.insurance) return ` <span class="dot" style="background:var(--amber)">!</span>`;
    if (k === "return" && loan.status === "active") return ` <span class="dot" style="background:var(--amber)">!</span>`;
    return "";
  }

  function switchTab(k) {
    tab = k;
    root.querySelectorAll("[data-tab]").forEach((b) =>
      b.classList.toggle("active", b.getAttribute("data-tab") === k));
    renderTab();
  }

  function renderTab() {
    const body = root.querySelector("#tab-body");
    ({
      overview: renderOverview,
      insurance: renderInsurance,
      packing: renderPacking,
      handovers: renderHandovers,
      return: renderReturn,
    })[tab](body);
  }

  /* ---------------- 概览 ---------------- */
  function renderOverview(body) {
    const l = loan;
    body.innerHTML = `
      <div class="two-col">
        <div class="card">
          <h3>借展信息</h3>
          <dl class="kv">
            <dt>借展机构</dt><dd>${UI.esc(l.institution_name)}<div class="small muted">${UI.esc(l.institution_contact || "")} ${UI.esc(l.institution_phone || "")}</div></dd>
            <dt>借展期</dt><dd class="mono">${UI.fmtDate(l.start_date)} ~ ${UI.fmtDate(l.end_date)}（${dayCount(l)}天）</dd>
            <dt>展厅</dt><dd>${UI.esc(l.venue || "—")}</dd>
            <dt>展览/用途</dt><dd>${UI.esc(l.purpose || "—")}</dd>
            <dt>备注</dt><dd>${UI.esc(l.notes || "—")}</dd>
          </dl>
        </div>
        <div class="card">
          <h3>流程进度</h3>
          ${progressHtml(l)}
          <h3 style="margin-top:16px">保单</h3>
          ${l.insurance
            ? `<div class="small">${UI.esc(l.insurance.insurer)} · <span class="mono">${UI.esc(l.insurance.policy_no)}</span><br>
               保额 <strong>${UI.money(l.insurance.coverage_amount, l.insurance.currency)}</strong>
               · 保期 <span class="mono">${UI.fmtDate(l.insurance.start_date)} ~ ${UI.fmtDate(l.insurance.end_date)}</span></div>`
            : `<div class="small" style="color:var(--amber)">⚠ 尚未登记保单</div>`}
        </div>
      </div>
      <div class="card">
        <h3>借出作品（${l.artworks.length} 件）</h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>馆藏编号</th><th>标题</th><th>艺术家</th><th>尺寸</th><th>出库前状况记录</th></tr></thead>
          <tbody>${l.artworks.map((a) => `
            <tr>
              <td class="mono">${UI.esc(a.accession_no)}</td>
              <td><strong>${UI.esc(a.title)}</strong></td>
              <td>${UI.esc(a.artist || "—")}</td>
              <td class="small">${UI.esc(a.dimensions || "—")}</td>
              <td class="small">${UI.esc(a.condition_note || "无记录")}</td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>`;
  }

  function dayCount(l) {
    const s = new Date(l.start_date), e = new Date(l.end_date);
    return Math.round((e - s) / 86400000) + 1;
  }

  function progressHtml(l) {
    const types = ["outbound", "arrived", "return_outbound", "return_inbound"];
    const labels = { outbound: "出库交接", arrived: "到馆交接", return_outbound: "还回出库", return_inbound: "回库结项" };
    const done = new Set(l.handovers.map((h) => h.type));
    if (l.status === "returned") done.add("return_inbound");
    if (l.status === "cancelled") return `<div class="small muted">借展单已取消</div>`;
    return `<div style="display:flex;gap:6px;flex-wrap:wrap">` + types.map((t, i) => {
      const ok = done.has(t);
      const prev = i === 0 || done.has(types[i - 1]);
      const color = ok ? "var(--green)" : prev ? "var(--accent)" : "var(--ink-3)";
      return `<span style="font-size:12px;padding:3px 10px;border-radius:20px;background:${ok ? "var(--green-soft)" : "var(--gray-soft)"};color:${color};font-weight:600">
        ${ok ? "✓" : i + 1} ${labels[t]}</span>`;
    }).join("<span style='color:var(--ink-3);align-self:center'>→</span>") + `</div>`;
  }

  /* ---------------- 保单 ---------------- */
  function renderInsurance(body) {
    const p = loan.insurance;
    body.innerHTML = `
      <div class="card">
        <div class="card-title-row">
          <h3>墙到墙保单（Wall-to-Wall）</h3>
          <button class="btn btn-primary btn-sm" id="btn-edit-ins">${p ? "编辑保单" : "＋ 登记保单"}</button>
        </div>
        ${p ? `
          <dl class="kv">
            <dt>保单号</dt><dd class="mono">${UI.esc(p.policy_no)}</dd>
            <dt>承保公司</dt><dd>${UI.esc(p.insurer)}</dd>
            <dt>保额</dt><dd><strong style="font-size:16px">${UI.money(p.coverage_amount, p.currency)}</strong></dd>
            <dt>保期</dt><dd class="mono">${UI.fmtDate(p.start_date)} ~ ${UI.fmtDate(p.end_date)}</dd>
            <dt>状态</dt><dd>${UI.badge(p.status === "active" ? "active" : "returned", p.status === "active" ? "有效" : p.status === "expired" ? "已过期" : p.status)}</dd>
          </dl>
          ${insuranceGapHint(p)}` :
          `<div class="empty">尚未登记保单。保单应覆盖自出库至回库的全程（建议前后各预留 2–3 天）。</div>`}
      </div>`;
    body.querySelector("#btn-edit-ins").onclick = () => insuranceModal(p, () => reload("insurance"));
  }

  function insuranceGapHint(p) {
    const l = loan;
    const warns = [];
    if (p.start_date > l.start_date) warns.push("保险起期晚于借展开始日，出库运输段可能脱保");
    if (p.end_date < l.end_date) warns.push("保险止期早于借展结束日，还回运输段可能脱保");
    if (!warns.length) return `<div class="small" style="color:var(--green);margin-top:8px">✓ 保期完整覆盖借展期</div>`;
    return warns.map((w) => `<div class="small" style="color:var(--red);margin-top:6px">⚠ ${UI.esc(w)}</div>`).join("");
  }

  function insuranceModal(p, onSaved) {
    const m = UI.modal({
      title: p ? "编辑保单" : "登记保单",
      body: `
        <div class="form-grid">
          <label class="field"><span>保单号 *</span><input id="f-pno" value="${UI.esc(p?.policy_no || "")}"/></label>
          <label class="field"><span>承保公司 *</span><input id="f-ins" value="${UI.esc(p?.insurer || "")}"/></label>
          <label class="field"><span>保额 *</span><input type="number" min="0" step="0.01" id="f-amt" value="${p?.coverage_amount ?? ""}"/></label>
          <label class="field"><span>币种</span>
            <select id="f-cur">${["CNY", "JPY", "USD", "EUR"].map((c) =>
              `<option ${p?.currency === c ? "selected" : ""}>${c}</option>`).join("")}</select>
          </label>
          <label class="field"><span>保险起期 *</span><input type="date" id="f-ps" value="${p?.start_date || loan.start_date}"/></label>
          <label class="field"><span>保险止期 *</span><input type="date" id="f-pe" value="${p?.end_date || loan.end_date}"/></label>
          <label class="field full"><span>保单状态</span>
            <select id="f-pst">${[["active", "有效"], ["expired", "已过期"], ["claimed", "已理赔"]].map(([v, t]) =>
              `<option value="${v}" ${p?.status === v ? "selected" : ""}>${t}</option>`).join("")}</select>
          </label>
        </div>`,
    });
    const save = m.btn("保存");
    m.foot.prepend(Object.assign(document.createElement("button"), { className: "btn", textContent: "取消", onclick: m.close }));
    save.onclick = async () => {
      const body = {
        policy_no: m.root.querySelector("#f-pno").value.trim(),
        insurer: m.root.querySelector("#f-ins").value.trim(),
        coverage_amount: Number(m.root.querySelector("#f-amt").value || 0),
        currency: m.root.querySelector("#f-cur").value,
        start_date: m.root.querySelector("#f-ps").value,
        end_date: m.root.querySelector("#f-pe").value,
        status: m.root.querySelector("#f-pst").value,
      };
      try {
        await API.put(`/api/loans/${loanId}/insurance`, body);
        UI.toast("保单已保存", "success");
        m.close();
        onSaved && onSaved();
      } catch (err) { UI.showError(err, "保存失败"); }
    };
  }

  /* ---------------- 装箱清单 ---------------- */
  function renderPacking(body) {
    const crates = loan.crates;
    const packedIds = new Set();
    crates.forEach((c) => c.items.forEach((it) => packedIds.add(it.artwork_id)));
    const unpacked = loan.artworks.filter((a) => !packedIds.has(a.id));
    body.innerHTML = `
      <div class="card">
        <div class="card-title-row">
          <h3>包装箱（${crates.length} 只）</h3>
          <button class="btn btn-primary btn-sm" id="btn-add-crate" ${loan.status !== "pending" ? "disabled title='仅待出库状态可编辑装箱'" : ""}>＋ 新增包装箱</button>
        </div>
        ${crates.length ? crates.map((c) => `
          <div style="border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin-bottom:12px">
            <div class="spread">
              <div><strong>${UI.esc(c.crate_no)}</strong>
                <span class="small muted"> · ${UI.esc(c.crate_type || "未注明箱型")} · ${c.weight_kg} kg · ${c.items.length} 件</span>
                ${c.note ? `<div class="small muted">${UI.esc(c.note)}</div>` : ""}
              </div>
              ${loan.status === "pending" ? `
                <div class="row">
                  <button class="btn btn-sm" data-add-item="${c.id}">＋ 装入作品</button>
                  <button class="btn btn-sm btn-danger" data-del-crate="${c.id}">删箱</button>
                </div>` : ""}
            </div>
            ${c.items.length ? `
              <table class="data" style="margin-top:8px">
                <thead><tr><th>馆藏编号</th><th>标题</th><th>包装方式</th><th>备注</th><th></th></tr></thead>
                <tbody>${c.items.map((it) => `
                  <tr>
                    <td class="mono">${UI.esc(it.accession_no)}</td>
                    <td>${UI.esc(it.title)}</td>
                    <td class="small">${UI.esc(it.packing || "—")}</td>
                    <td class="small muted">${UI.esc(it.note || "")}</td>
                    <td class="right">${loan.status === "pending" ? `<button class="btn btn-sm btn-danger" data-unpack="${it.id}">取出</button>` : ""}</td>
                  </tr>`).join("")}</tbody>
              </table>` : `<div class="small muted" style="padding:8px 0">空箱</div>`}
          </div>`).join("") : `<div class="empty">还没有包装箱</div>`}
      </div>
      <div class="card">
        <h3>尚未装箱（${unpacked.length} 件）</h3>
        ${unpacked.length ? `<div class="table-wrap"><table class="data">
          <thead><tr><th>馆藏编号</th><th>标题</th><th>尺寸</th></tr></thead>
          <tbody>${unpacked.map((a) => `
            <tr><td class="mono">${UI.esc(a.accession_no)}</td><td>${UI.esc(a.title)}</td><td class="small">${UI.esc(a.dimensions)}</td></tr>`).join("")}
          </tbody></table></div>`
          : `<div class="small" style="color:var(--green)">✓ 全部作品已装箱</div>`}
      </div>`;

    if (loan.status !== "pending") return;
    body.querySelector("#btn-add-crate").onclick = crateModal;
    body.querySelectorAll("[data-del-crate]").forEach((b) => b.onclick = async () => {
      if (!await UI.confirmDialog("删除该包装箱？箱内作品将变为未装箱。")) return;
      await wrap(API.del(`/api/crates/${b.dataset.delCrate}`), "箱子已删除");
    });
    body.querySelectorAll("[data-add-item]").forEach((b) => b.onclick = () =>
      packingItemModal(Number(b.dataset.addItem), unpacked));
    body.querySelectorAll("[data-unpack]").forEach((b) => b.onclick = async () => {
      await wrap(API.del(`/api/packing-items/${b.dataset.unpack}`), "已取出");
    });
  }

  async function wrap(p, okMsg) {
    try { await p; UI.toast(okMsg, "success"); await reload("packing"); }
    catch (err) { UI.showError(err, "操作失败"); }
  }

  function crateModal() {
    const m = UI.modal({
      title: "新增包装箱",
      body: `
        <div class="form-grid">
          <label class="field"><span>箱号 *</span><input id="f-cno" placeholder="CR-03"/></label>
          <label class="field"><span>箱型</span><input id="f-ct" placeholder="恒温木箱 / 飞行箱 / 画筒…"/></label>
          <label class="field"><span>总重 (kg)</span><input type="number" step="0.1" min="0" id="f-cw"/></label>
          <label class="field"></label>
          <label class="field full"><span>备注</span><input id="f-cnote"/></label>
        </div>`,
    });
    const save = m.btn("新增");
    m.foot.prepend(Object.assign(document.createElement("button"), { className: "btn", textContent: "取消", onclick: m.close }));
    save.onclick = async () => {
      try {
        await API.post(`/api/loans/${loanId}/crates`, {
          crate_no: m.root.querySelector("#f-cno").value.trim(),
          crate_type: m.root.querySelector("#f-ct").value.trim(),
          weight_kg: Number(m.root.querySelector("#f-cw").value || 0),
          note: m.root.querySelector("#f-cnote").value.trim(),
        });
        m.close();
        UI.toast("箱子已新增", "success");
        reload("packing");
      } catch (err) { UI.showError(err, "新增失败"); }
    };
  }

  function packingItemModal(crateId, unpacked) {
    if (!unpacked.length) { UI.toast("全部作品已装箱", "info"); return; }
    const crate = loan.crates.find((c) => c.id === crateId);
    const m = UI.modal({
      title: `向 ${crate.crate_no} 装入作品`,
      body: `
        <label class="field"><span>选择作品 *</span>
          <select id="f-art">
            ${unpacked.map((a) => `<option value="${a.id}">${UI.esc(a.accession_no)} · ${UI.esc(a.title)}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>包装方式</span><input id="f-pk" placeholder="无酸纸+Tyvek / 泡沫卡槽…"/></label>
        <label class="field"><span>备注</span><input id="f-pnote"/></label>`,
    });
    const save = m.btn("装入");
    m.foot.prepend(Object.assign(document.createElement("button"), { className: "btn", textContent: "取消", onclick: m.close }));
    save.onclick = async () => {
      try {
        await API.post(`/api/crates/${crateId}/items`, {
          artwork_id: Number(m.root.querySelector("#f-art").value),
          packing: m.root.querySelector("#f-pk").value.trim(),
          note: m.root.querySelector("#f-pnote").value.trim(),
        });
        m.close();
        UI.toast("已装箱", "success");
        reload("packing");
      } catch (err) { UI.showError(err, "装箱失败"); }
    };
  }

  /* ---------------- 交接记录 ---------------- */
  function renderHandovers(body) {
    const l = loan;
    const next = nextHandover(l);
    body.innerHTML = `
      <div class="card">
        <div class="card-title-row">
          <h3>运输交接链</h3>
          ${next ? `<button class="btn btn-primary btn-sm" id="btn-handover">登记${UI.HANDOVER_LABELS[next]}</button>` : ""}
        </div>
        ${l.handovers.length ? `<div class="timeline">${l.handovers.map((h) => `
          <div class="tl-item">
            <div class="tl-head">${UI.esc(UI.HANDOVER_LABELS[h.type])} · ${UI.fmtDate(h.handover_date)}</div>
            <div class="tl-meta">
              ${UI.esc(h.from_party || "—")} → ${UI.esc(h.to_party || "—")}
              ${h.shipper ? ` · 承运：${UI.esc(h.shipper)}` : ""}
              ${h.receiver ? ` · 签收：${UI.esc(h.receiver)}` : ""}
            </div>
            ${h.note ? `<div class="small muted" style="margin-bottom:6px">${UI.esc(h.note)}</div>` : ""}
            <table class="data" style="max-width:680px">
              <thead><tr><th>馆藏编号</th><th>作品</th><th>状况</th><th>状况说明</th></tr></thead>
              <tbody>${h.items.map((it) => `
                <tr>
                  <td class="mono">${UI.esc(it.accession_no)}</td>
                  <td>${UI.esc(it.title)}</td>
                  <td>${UI.badge(it.condition_status)}</td>
                  <td class="small">${UI.esc(it.condition_note || "")}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>`).join("")}</div>` : `<div class="empty">尚无交接记录。出库交接后借展单进入「已出库在途」。</div>`}
      </div>`;
    if (next) body.querySelector("#btn-handover").onclick = () => handoverModal(next);
  }

  /* ---------------- 归还检查 ---------------- */
  function renderReturn(body) {
    const l = loan;
    const rc = l.return_check;
    if (l.status === "pending" || l.status === "outgoing") {
      body.innerHTML = `<div class="card"><div class="empty">
        作品尚未到馆开展，归还检查在借展结束还回时进行。
        <div style="margin-top:8px">当前状态：${UI.badge(l.status)}</div></div></div>`;
      return;
    }
    if (l.status === "cancelled") {
      body.innerHTML = `<div class="card"><div class="empty">借展单已取消。</div></div>`;
      return;
    }
    if (l.status === "returned") {
      body.innerHTML = `
        <div class="card">
          <div class="card-title-row">
            <h3>✓ 归还检查已结项</h3>
            ${UI.badge("returned", "已归还入库")}
          </div>
          ${returnCheckHtml(rc, true)}
        </div>`;
      return;
    }
    // active：进行逐件核对
    const checkedCount = rc ? rc.items.length : 0;
    const issueCount = rc ? rc.items.filter((i) => i.condition_status !== "good").length : 0;
    body.innerHTML = `
      ${issueCount ? `
        <div class="alert-banner warn">
          <div style="font-size:18px">🔎</div>
          <div>已发现 <span class="n">${issueCount}</span> 件作品存在损伤/缺失，请在核对结果中填写处理意见并同步启动理赔/修复流程。</div>
        </div>` : ""}
      <div class="card">
        <div class="card-title-row">
          <h3>逐件归还核对（${checkedCount}/${l.artworks.length} 件已核对）</h3>
          <button class="btn btn-primary btn-sm" id="btn-finalize">核对无误，结项归还</button>
        </div>
        ${returnCheckForm(rc)}
      </div>`;

    bindReturnForm(body, rc, checkedCount);
    body.querySelector("#btn-finalize").onclick = async () => {
      if (!await UI.confirmDialog(
        `确认结项？系统将再次校验 ${l.artworks.length} 件作品是否全部核对，结项后借展单置为「已归还」，记录不可再修改。`)) return;
      try {
        await API.post(`/api/loans/${loanId}/return-check/finalize`);
        UI.toast("归还检查已结项，借展单完成", "success");
        reload("return");
      } catch (err) { UI.showError(err, "结项失败"); }
    };
  }

  function returnCheckForm(rc) {
    const l = loan;
    const map = new Map((rc?.items || []).map((i) => [i.artwork_id, i]));
    return `
      <div class="row" style="margin-bottom:14px">
        <label class="field" style="margin:0;min-width:160px"><span>检查日期</span>
          <input type="date" id="rc-date" value="${rc?.check_date || UI.todayISO()}"/></label>
        <label class="field" style="margin:0;min-width:140px"><span>检查人</span>
          <input id="rc-inspector" value="${UI.esc(rc?.inspector || "")}"/></label>
        <label class="field" style="margin:0;min-width:180px"><span>检查地点</span>
          <input id="rc-location" value="${UI.esc(rc?.location || "")}"/></label>
      </div>
      <div class="table-wrap"><table class="data" id="rc-table">
        <thead><tr>
          <th>馆藏编号 / 作品</th><th>出库前记录</th>
          <th style="min-width:230px">归还状况 *</th><th>状况说明</th><th>处理意见</th>
        </tr></thead>
        <tbody>${l.artworks.map((a) => {
          const cur = map.get(a.id);
          return `
          <tr data-art="${a.id}">
            <td><span class="mono">${UI.esc(a.accession_no)}</span><br><strong>${UI.esc(a.title)}</strong></td>
            <td class="small muted">${UI.esc(a.condition_note || "无")}</td>
            <td>
              <div class="cond-seg">
                ${["good", "damaged", "missing"].map((c) => `
                  <label><input type="radio" name="cond-${a.id}" value="${c}" ${cur?.condition_status === c ? "checked" : ""}/><span>${UI.STATUS_LABELS[c]}</span></label>`).join("")}
              </div>
            </td>
            <td><textarea rows="2" class="rc-note" placeholder="与出库状态比对…">${UI.esc(cur?.condition_note || "")}</textarea></td>
            <td><textarea rows="2" class="rc-action" placeholder="修复/理赔/入库…">${UI.esc(cur?.action || "")}</textarea></td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
      <div style="margin-top:12px">
        <label class="field"><span>总体结论</span><textarea id="rc-summary" rows="2">${UI.esc(rc?.summary || "")}</textarea></label>
      </div>
      <div class="row" style="justify-content:flex-end">
        <span class="small muted">可多次保存草稿；全部核对后方可结项</span>
        <button class="btn" id="btn-save-rc">保存核对结果</button>
      </div>`;
  }

  function bindReturnForm(body, rc) {
    const saveBtn = body.querySelector("#btn-save-rc");
    saveBtn.onclick = async () => {
      const items = [];
      let missing = 0;
      body.querySelectorAll("#rc-table tbody tr").forEach((tr) => {
        const aid = Number(tr.dataset.art);
        const cond = tr.querySelector(`input[name^=cond-]:checked`);
        if (!cond) { missing++; return; }
        items.push({
          artwork_id: aid,
          condition_status: cond.value,
          condition_note: tr.querySelector(".rc-note").value.trim(),
          action: tr.querySelector(".rc-action").value.trim(),
        });
      });
      const payload = {
        check_date: body.querySelector("#rc-date").value || UI.todayISO(),
        inspector: body.querySelector("#rc-inspector").value.trim(),
        location: body.querySelector("#rc-location").value.trim(),
        summary: body.querySelector("#rc-summary").value.trim(),
      };
      saveBtn.disabled = true;
      try {
        await API.put(`/api/loans/${loanId}/return-check`, payload);
        if (items.length) await API.put(`/api/loans/${loanId}/return-check`, { items });
        UI.toast(missing ? `已保存 ${items.length} 件，还有 ${missing} 件未核对` : "核对结果已保存", missing ? "info" : "success");
        reload("return");
      } catch (err) {
        UI.showError(err, "保存失败");
        saveBtn.disabled = false;
      }
    };
  }

  function returnCheckHtml(rc, finalized) {
    const map = new Map(rc.items.map((i) => [i.artwork_id, i]));
    return `
      <dl class="kv" style="margin-bottom:14px">
        <dt>检查日期</dt><dd class="mono">${UI.fmtDate(rc.check_date)}</dd>
        <dt>检查人</dt><dd>${UI.esc(rc.inspector || "—")}</dd>
        <dt>检查地点</dt><dd>${UI.esc(rc.location || "—")}</dd>
        <dt>总体结论</dt><dd>${UI.esc(rc.summary || "—")}</dd>
      </dl>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>馆藏编号</th><th>作品</th><th>归还状况</th><th>状况说明</th><th>处理意见</th></tr></thead>
        <tbody>${loan.artworks.map((a) => {
          const it = map.get(a.id);
          return `<tr>
            <td class="mono">${UI.esc(a.accession_no)}</td>
            <td>${UI.esc(a.title)}</td>
            <td>${it ? UI.badge(it.condition_status) : '<span class="small muted">未记录</span>'}</td>
            <td class="small">${UI.esc(it?.condition_note || "")}</td>
            <td class="small">${UI.esc(it?.action || "—")}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>`;
  }

  function nextHandover(l) {
    if (l.status === "pending") return "outbound";
    if (l.status === "outgoing") return "arrived";
    if (l.status === "active") {
      const types = new Set(l.handovers.map((h) => h.type));
      if (!types.has("return_outbound")) return "return_outbound";
      if (!types.has("return_inbound")) return "return_inbound";
    }
    return null;
  }

  function handoverModal(htype) {
    const l = loan;
    const m = UI.modal({
      title: `登记${UI.HANDOVER_LABELS[htype]}`,
      size: "lg",
      body: `
        <div class="form-grid">
          <label class="field"><span>交接日期 *</span><input type="date" id="h-date" value="${UI.todayISO()}"/></label>
          <label class="field"><span>承运方</span><input id="h-shipper" value=""/></label>
          <label class="field"><span>交出方</span><input id="h-from" value="${defaultFrom(htype)}"/></label>
          <label class="field"><span>接收方</span><input id="h-to" value="${defaultTo(htype)}"/></label>
          <label class="field"><span>签收/经手人</span><input id="h-receiver"/></label>
          <label class="field full"><span>备注（车况、温湿度、开箱情况等）</span><input id="h-note"/></label>
        </div>
        <strong style="font-size:13px;display:block;margin:6px 0">逐件状况登记（必须覆盖全部 ${l.artworks.length} 件作品）</strong>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>馆藏编号 / 作品</th><th>状况 *</th><th>状况说明</th></tr></thead>
          <tbody>${l.artworks.map((a, idx) => `
            <tr data-art="${a.id}">
              <td><span class="mono">${UI.esc(a.accession_no)}</span><br>${UI.esc(a.title)}</td>
              <td>
                <div class="cond-seg">
                  ${["good", "damaged", "missing"].map((c) => `
                    <label><input type="radio" name="hcond-${a.id}" value="${c}" ${c === "good" ? "checked" : ""}/><span>${UI.STATUS_LABELS[c]}</span></label>`).join("")}
                </div>
              </td>
              <td><textarea rows="2" class="h-note" placeholder="${idx === 0 ? "如：与出库档案照片一致" : ""}"></textarea></td>
            </tr>`).join("")}</tbody>
        </table></div>
        <div class="small muted" style="margin-top:8px" id="h-warn"></div>`,
    });
    const save = m.btn("提交交接记录");
    m.foot.prepend(Object.assign(document.createElement("button"), { className: "btn", textContent: "取消", onclick: m.close }));
    save.onclick = async () => {
      const items = [];
      let ok = true;
      m.root.querySelectorAll(".modal-body tbody tr").forEach((tr) => {
        const cond = tr.querySelector("input[name^=hcond-]:checked");
        if (!cond) { ok = false; return; }
        items.push({
          artwork_id: Number(tr.dataset.art),
          condition_status: cond.value,
          condition_note: tr.querySelector(".h-note").value.trim(),
        });
      });
      if (!ok) { UI.toast("每件作品都必须登记状况", "error"); return; }
      const damaged = items.filter((i) => i.condition_status !== "good");
      if (damaged.length && !await UI.confirmDialog(
        `有 ${damaged.length} 件作品登记为损伤/缺失，确认提交？提交后状态不可修改，请确保已拍照存证。`)) return;
      try {
        await API.post(`/api/loans/${loanId}/handovers`, {
          type: htype,
          handover_date: m.root.querySelector("#h-date").value || UI.todayISO(),
          shipper: m.root.querySelector("#h-shipper").value.trim(),
          from_party: m.root.querySelector("#h-from").value.trim(),
          to_party: m.root.querySelector("#h-to").value.trim(),
          receiver: m.root.querySelector("#h-receiver").value.trim(),
          note: m.root.querySelector("#h-note").value.trim(),
          items,
        });
        UI.toast(`${UI.HANDOVER_LABELS[htype]}已登记`, "success");
        m.close();
        reload("handovers");
      } catch (err) { UI.showError(err, "提交失败"); }
    };
  }

  function defaultFrom(t) {
    if (t === "outbound" || t === "return_inbound") return "本馆藏品部";
    if (t === "arrived") return loan.institution_name;
    return loan.institution_name; // return_outbound: 对方交出
  }
  function defaultTo(t) {
    if (t === "outbound") return loan.institution_name;
    if (t === "arrived") return loan.institution_name;
    if (t === "return_outbound") return "本馆藏品部";
    return "本馆藏品部";
  }

  await reload();
};
