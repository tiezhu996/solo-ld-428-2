/* 哈希路由与导航。页面模块在各 pages/*.js 中注册到 window.Pages。 */
(() => {
  const NAV = [
    { path: "/", label: "仪表盘", ico: "▦", title: "仪表盘" },
    { path: "/reminders", label: "逾期与提醒", ico: "🔔", title: "逾期与提醒" },
    { path: "/loans", label: "借展单", ico: "📋", title: "借展单管理" },
    { path: "/artworks", label: "藏品", ico: "🖼", title: "藏品管理" },
    { path: "/institutions", label: "借展机构", ico: "🏛", title: "借展机构" },
  ];

  const navEl = document.getElementById("nav");
  navEl.innerHTML = NAV.map((n) => `
    <button class="nav-item" data-nav="${n.path}">
      <span class="nav-ico">${n.ico}</span>${n.label}
    </button>`).join("");
  navEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav]");
    if (btn) location.hash = btn.getAttribute("data-nav");
  });
  document.getElementById("nav-reminders").addEventListener("click", () => {
    location.hash = "/reminders";
  });

  function parseHash() {
    const raw = (location.hash || "#/").slice(1);
    const [path, qs] = raw.split("?");
    const query = Object.fromEntries(new URLSearchParams(qs || ""));
    return { path: path || "/", query };
  }

  async function render() {
    const { path, query } = parseHash();
    let pageName, param = null;
    let m = path.match(/^\/loans\/(\d+)$/);
    if (m) { pageName = "loanDetail"; param = m[1]; }
    else if (path === "/loans") pageName = "loans";
    else if (path === "/artworks") pageName = "artworks";
    else if (path === "/institutions") pageName = "institutions";
    else if (path === "/reminders") pageName = "reminders";
    else pageName = "dashboard";

    const navDef = NAV.find((n) => n.path === path)
      || (pageName === "loanDetail" ? NAV.find((n) => n.path === "/loans") : NAV[0]);
    document.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-nav") === navDef.path);
    });
    document.getElementById("page-title").textContent =
      pageName === "loanDetail" ? "借展单详情" : navDef.title;

    const view = document.getElementById("view");
    view.innerHTML = "";
    try {
      await window.Pages[pageName](view, { query, param });
    } catch (err) {
      console.error(err);
      view.innerHTML = `<div class="card empty">页面加载失败：${UI.esc(err.message)}</div>`;
    }
  }

  window.addEventListener("hashchange", render);

  /* 顶部日期与提醒红点 */
  document.getElementById("today-badge").textContent = `今天 ${UI.todayISO()}`;
  async function refreshReminderDot() {
    try {
      const r = await API.get("/api/reminders");
      const total = r.counts.overdue + r.counts.due_soon + r.counts.insurance_expiring;
      document.getElementById("reminder-dot").classList.toggle("hidden", total === 0);
    } catch { /* 忽略 */ }
  }
  window.refreshReminderDot = refreshReminderDot;
  refreshReminderDot();
  render();
})();
