/* 通用 UI 组件：Toast、Modal、徽标、转义、日期。 */
const UI = (() => {
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function fmtDate(s) { return s || "—"; }

  function money(n, currency) {
    if (n === null || n === undefined) return "—";
    const sym = { CNY: "¥", JPY: "JP¥", USD: "$", EUR: "€" }[currency] || "";
    return sym + Number(n).toLocaleString("zh-CN");
  }

  const STATUS_LABELS = {
    pending: "待出库", outgoing: "已出库在途", active: "借展中",
    returned: "已归还", cancelled: "已取消", overdue: "逾期未还",
    available: "在库可借", reserved: "已预约", on_loan: "在展/在途",
    good: "完好", damaged: "损伤", missing: "缺失",
  };
  const HANDOVER_LABELS = {
    outbound: "出库交接", arrived: "到馆交接",
    return_outbound: "还回出库", return_inbound: "回库交接",
  };

  function badge(status, label) {
    const cls = status || "";
    const text = label || STATUS_LABELS[status] || status || "";
    return `<span class="badge badge-${esc(cls)}">${esc(text)}</span>`;
  }

  /* ---------------- Toast ---------------- */
  function ensureToastRoot() {
    let root = document.getElementById("toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "toast-root";
      root.className = "toast-wrap";
      document.body.appendChild(root);
    }
    return root;
  }
  function toast(msg, kind = "info", ms = 3200) {
    const root = ensureToastRoot();
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .25s"; }, ms - 300);
    setTimeout(() => el.remove(), ms);
  }

  /* ---------------- Modal ---------------- */
  function modal({ title, body, footer, size }) {
    const root = document.getElementById("modal-root");
    root.innerHTML = "";
    const mask = document.createElement("div");
    mask.className = "modal-mask";
    mask.innerHTML = `
      <div class="modal ${size === "lg" ? "modal-lg" : ""}">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-x">✕</button></div>
        <div class="modal-body"></div>
        <div class="modal-foot"></div>
      </div>`;
    const mbody = mask.querySelector(".modal-body");
    const mfoot = mask.querySelector(".modal-foot");
    if (typeof body === "string") mbody.innerHTML = body;
    else if (body instanceof Node) mbody.appendChild(body);
    if (typeof footer === "string") mfoot.innerHTML = footer;
    else if (footer instanceof Node) mfoot.appendChild(footer);
    else mfoot.style.display = "none";

    const close = () => { root.innerHTML = ""; document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    mask.addEventListener("mousedown", (e) => { if (e.target === mask) close(); });
    mask.querySelector(".modal-x").addEventListener("click", close);
    root.appendChild(mask);
    document.addEventListener("keydown", onKey);
    return {
      root: mbody,
      foot: mfoot,
      close,
      btn: (text, cls = "btn-primary") => {
        const b = document.createElement("button");
        b.className = `btn ${cls}`;
        b.textContent = text;
        mfoot.appendChild(b);
        return b;
      },
    };
  }

  function confirmDialog(message) {
    return new Promise((resolve) => {
      const m = modal({
        title: "请确认",
        body: `<div style="padding:6px 0;font-size:13.5px">${esc(message)}</div>`,
      });
      const cancel = m.btn("取消", "");
      const ok = m.btn("确认");
      cancel.onclick = () => { m.close(); resolve(false); };
      ok.onclick = () => { m.close(); resolve(true); };
    });
  }

  /* 处理接口错误：409 冲突展示 details（如冲突列表），其余 toast。 */
  function showError(err, context = "操作失败") {
    if (!err) return;
    if (err.status === 409 && err.data && err.data.conflicts) {
      conflictModal(err.data.conflicts, err.message);
      return;
    }
    toast(`${context}：${err.message}`, "error", 4500);
  }

  function conflictModal(conflicts, title) {
    const rows = conflicts.map((c) => `
      <tr>
        <td>${esc(c.artwork_title)}<div class="small muted">${esc("作品 #" + c.artwork_id)}</div></td>
        <td><span class="mono">${esc(c.loan_no)}</span><br><span class="small muted">${esc(c.institution_name)}</span></td>
        <td class="mono">${fmtDate(c.start_date)} ~ ${fmtDate(c.end_date)}</td>
      </tr>`).join("");
    const m = modal({
      title: title || "展期冲突，提交已阻止",
      body: `
        <div class="alert-banner danger" style="margin-bottom:12px">
          以下作品在所选时间段内已有未结束的借展安排，按规定不得重复出借。请调整作品或展期后重试。
        </div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>冲突作品</th><th>已占用借展单</th><th>占用时段</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`,
      footer: `<button class="btn btn-primary" data-close>知道了</button>`,
      size: "lg",
    });
    m.foot.querySelector("[data-close]").onclick = m.close;
  }

  return {
    esc, todayISO, fmtDate, money, badge, toast, modal, confirmDialog,
    showError, conflictModal, STATUS_LABELS, HANDOVER_LABELS,
  };
})();
