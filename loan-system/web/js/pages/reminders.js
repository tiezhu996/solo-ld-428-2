/* 逾期与提醒页。 */
window.Pages = window.Pages || {};

window.Pages.reminders = async function (root) {
  const r = await API.get("/api/reminders");

  root.innerHTML = `
    <div class="stat-grid">
      ${statBox("逾期未还", r.counts.overdue, "超过应还日期", true)}
      ${statBox("7 天内到期", r.counts.due_soon, "需要安排还回运输", false)}
      ${statBox("保单临近到期", r.counts.insurance_expiring, "14 天内止期", false)}
      ${statBox("未结异常", r.counts.transit_issues, "在途损伤/缺失待处理", r.counts.transit_issues > 0)}
    </div>

    <div class="card">
      <h3>⛔ 逾期未还借展（${r.overdue_loans.length}）</h3>
      ${loanTable(r.overdue_loans, (l) => `已逾期 <strong style="color:var(--red)">${l.days_overdue}</strong> 天`, "应还日")}
    </div>

    <div class="card">
      <h3>⏳ 7 天内到期（${r.due_soon_loans.length}）</h3>
      ${loanTable(r.due_soon_loans, (l) => `剩余 <strong>${l.days_remaining}</strong> 天`, "应还日")}
    </div>

    <div class="card">
      <h3>🛡 保单 14 天内到期（${r.insurance_expiring.length}）</h3>
      ${r.insurance_expiring.length ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>借展单</th><th>机构</th><th>保单号 / 承保公司</th><th>保险止期</th><th></th></tr></thead>
        <tbody>${r.insurance_expiring.map((p) => `
          <tr>
            <td><a class="link mono" href="#/loans/${p.loan_id}">${UI.esc(p.loan_no)}</a></td>
            <td>${UI.esc(p.institution_name)}</td>
            <td class="small"><span class="mono">${UI.esc(p.policy_no)}</span><br><span class="muted">${UI.esc(p.insurer)}</span></td>
            <td class="mono">${UI.fmtDate(p.end_date)}<div class="small ${p.days_remaining < 0 ? "" : "muted"}">${p.days_remaining < 0 ? "已过期" : `剩 ${p.days_remaining} 天`}</div></td>
            <td class="right"><a class="btn btn-sm" href="#/loans/${p.loan_id}?tab=insurance">处理</a></td>
          </tr>`).join("")}</tbody></table></div>`
        : `<div class="empty">暂无临期保单</div>`}
    </div>

    <div class="card">
      <h3>🚨 在途 / 归还异常跟踪</h3>
      ${issuesTable(r)}
    </div>`;
};

function statBox(label, n, foot, alert) {
  return `<div class="stat ${alert && n ? "alert" : ""}">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${n}</div>
    <div class="stat-foot">${foot}</div>
  </div>`;
}

function loanTable(list, statusFn, dateLabel) {
  if (!list.length) return `<div class="empty">无</div>`;
  return `<div class="table-wrap"><table class="data">
    <thead><tr><th>借展单号</th><th>机构</th><th>展览/用途</th><th>${dateLabel}</th><th>提醒</th><th></th></tr></thead>
    <tbody>${list.map((l) => `
      <tr class="clickable" onclick="location.hash='#/loans/${l.id}'">
        <td class="mono"><strong>${UI.esc(l.loan_no)}</strong></td>
        <td>${UI.esc(l.institution_name)}</td>
        <td class="small">${UI.esc(l.purpose || "—")}</td>
        <td class="mono">${UI.fmtDate(l.end_date)}</td>
        <td class="small">${statusFn(l)}</td>
        <td class="right"><a class="btn btn-sm" href="#/loans/${l.id}">打开</a></td>
      </tr>`).join("")}</tbody>
  </table></div>`;
}

function issuesTable(r) {
  const transit = r.transit_issues.map((x) => ({ ...x, phase: `${UI.HANDOVER_LABELS[x.handover_type]} · ${UI.fmtDate(x.handover_date)}` }));
  const returned = r.return_issues.map((x) => ({ ...x, phase: "归还检查（已结项）" }));
  const all = transit.concat(returned);
  if (!all.length) return `<div class="empty">当前没有损伤或缺失记录</div>`;
  return `<div class="table-wrap"><table class="data">
    <thead><tr><th>作品</th><th>借展单</th><th>发现环节</th><th>状况</th><th>说明 / 处理意见</th><th></th></tr></thead>
    <tbody>${all.map((x) => `
      <tr>
        <td>${UI.esc(x.title)}<div class="small muted mono">${UI.esc(x.accession_no)}</div></td>
        <td><a class="link mono" href="#/loans/${x.loan_id}">${UI.esc(x.loan_no)}</a></td>
        <td class="small">${UI.esc(x.phase)}</td>
        <td>${UI.badge(x.condition_status)}</td>
        <td class="small">${UI.esc(x.condition_note || "")}${x.action ? `<br><span class="muted">处理意见：${UI.esc(x.action)}</span>` : ""}</td>
        <td class="right"><a class="btn btn-sm" href="#/loans/${x.loan_id}?tab=return">查看</a></td>
      </tr>`).join("")}</tbody>
  </table></div>`;
}
