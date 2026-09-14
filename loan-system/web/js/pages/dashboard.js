/* 仪表盘页。 */
window.Pages = window.Pages || {};

window.Pages.dashboard = async function (root) {
  const [stats, reminders] = await Promise.all([
    API.get("/api/stats"),
    API.get("/api/reminders"),
  ]);

  const stat = (label, value, foot, alert) => `
    <div class="stat ${alert ? "alert" : ""}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-foot">${foot || ""}</div>
    </div>`;

  root.innerHTML = `
    ${reminders.counts.overdue > 0 ? `
      <div class="alert-banner danger">
        <div style="font-size:20px">⚠️</div>
        <div><span class="n">${reminders.counts.overdue}</span> 张借展单已逾期未还，
          <a class="link" href="#/reminders">立即处理 →</a>
        </div>
      </div>` : ""}
    <div class="stat-grid">
      ${stat("藏品总数", stats.artwork_total, `在展/在途 ${stats.artwork_on_loan} · 已预约 ${stats.artwork_reserved} · 在库 ${stats.artwork_available}`)}
      ${stat("进行中借展", stats.loan_active, `已归还累计 ${stats.loan_returned}`)}
      ${stat("逾期未还", stats.loan_overdue, stats.loan_overdue ? "需要立刻跟进" : "一切正常", stats.loan_overdue > 0)}
      ${stat("合作机构", stats.institution_total, `在保借展 ${stats.insured_active} 份`)}
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-title-row"><h3>逾期 / 临期借展</h3>
          <a class="link small" href="#/reminders">全部提醒</a></div>
        ${renderAlertList(reminders)}
      </div>
      <div class="card">
        <div class="card-title-row"><h3>最近交接记录</h3>
          <a class="link small" href="#/loans">全部借展单</a></div>
        ${renderRecent(stats.recent_handovers)}
      </div>
    </div>

    <div class="card">
      <div class="card-title-row"><h3>运输 / 归还中的损伤与缺失</h3></div>
      ${renderIssues(reminders)}
    </div>`;
};

function renderAlertList(r) {
  const rows = [];
  r.overdue_loans.forEach((l) => rows.push(`
    <tr>
      <td><a class="link" href="#/loans/${l.id}">${UI.esc(l.loan_no)}</a><div class="small muted">${UI.esc(l.institution_name)}</div></td>
      <td class="mono">${UI.fmtDate(l.end_date)}</td>
      <td>${UI.badge("overdue", `逾期 ${l.days_overdue} 天`)}</td>
    </tr>`));
  r.due_soon_loans.forEach((l) => rows.push(`
    <tr>
      <td><a class="link" href="#/loans/${l.id}">${UI.esc(l.loan_no)}</a><div class="small muted">${UI.esc(l.institution_name)}</div></td>
      <td class="mono">${UI.fmtDate(l.end_date)}</td>
      <td>${UI.badge("warn", `剩 ${l.days_remaining} 天`)}</td>
    </tr>`));
  if (!rows.length) return `<div class="empty">暂无临期借展</div>`;
  return `<div class="table-wrap"><table class="data">
    <thead><tr><th>借展单</th><th>应还日期</th><th>状态</th></tr></thead>
    <tbody>${rows.join("")}</tbody></table></div>`;
}

function renderRecent(list) {
  if (!list || !list.length) return `<div class="empty">暂无交接记录</div>`;
  return `<div class="timeline">` + list.map((h) => `
    <div class="tl-item">
      <div class="tl-head">${UI.esc(UI.HANDOVER_LABELS[h.type] || h.type)}</div>
      <div class="tl-meta">
        <a class="link" href="#/loans/${h.loan_id}">${UI.esc(h.loan_no)}</a>
        · ${UI.esc(h.institution_name)} · ${UI.fmtDate(h.handover_date)}
        · ${h.receiver ? `签收：${UI.esc(h.receiver)}` : UI.esc(h.shipper || "")}
      </div>
    </div>`).join("") + `</div>`;
}

function renderIssues(r) {
  const issues = [].concat(
    (r.transit_issues || []).map((x) => ({ ...x, phase: UI.HANDOVER_LABELS[x.handover_type] + " " + UI.fmtDate(x.handover_date), open: true })),
    (r.return_issues || []).map((x) => ({ ...x, phase: "归还检查", open: false })),
  );
  if (!issues.length) return `<div class="empty">未发现损伤或缺失记录</div>`;
  return `<div class="table-wrap"><table class="data">
    <thead><tr><th>作品</th><th>借展单</th><th>环节</th><th>状况</th><th>说明 / 处理意见</th></tr></thead>
    <tbody>${issues.map((x) => `
      <tr>
        <td>${UI.esc(x.title)}<div class="small muted">${UI.esc(x.accession_no)}</div></td>
        <td><a class="link" href="#/loans/${x.loan_id}">${UI.esc(x.loan_no)}</a></td>
        <td class="small">${UI.esc(x.phase)}</td>
        <td>${UI.badge(x.condition_status)}</td>
        <td class="small">${UI.esc(x.condition_note || "")}${x.action ? `<br><span class="muted">处理：${UI.esc(x.action)}</span>` : ""}</td>
      </tr>`).join("")}</tbody></table></div>`;
}
