import { watchAuth, logout, isAdmin } from "./auth.js";
import { mountNotificationBell } from "./notifications.js";
import { icon } from "./icons.js";

const NAV = {
  guest: [
    ["Find gigs", "/promoter/jobs"],
    ["For companies", "/auth/signup?role=company"],
  ],
  promoter: [
    ["Dashboard", "/promoter/dashboard", "home"],
    ["Find gigs", "/promoter/jobs", "search"],
    ["Bookings", "/promoter/bookings", "ticket"],
    ["Ratings", "/promoter/ratings"],
    ["Profile", "/promoter/profile", "user"],
  ],
  company: [
    ["Dashboard", "/company/dashboard", "home"],
    ["Events", "/company/manage-events", "list"],
    ["Find promoters", "/company/find-promoters", "users"],
    ["Profile", "/company/profile", "user"],
  ],
};

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function themeButtonHTML() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  return `<button class="pc-icon-btn" id="pc-theme-toggle" aria-label="Switch to ${next} mode">${icon(next === "light" ? "sun" : "moon", 17)}</button>`;
}

function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("pc-theme", next); } catch {}
  document.getElementById("pc-theme-toggle").outerHTML = themeButtonHTML();
  document.getElementById("pc-theme-toggle").addEventListener("click", toggleTheme);
  document.querySelectorAll("[data-theme-toggle]").forEach((el) => { el.textContent = `Switch to ${next === "dark" ? "light" : "dark"} mode`; });
}

function bindThemeToggle() {
  document.getElementById("pc-theme-toggle")?.addEventListener("click", toggleTheme);
  document.querySelectorAll("[data-theme-toggle]").forEach((el) => el.addEventListener("click", toggleTheme));
}

function linksHTML(links) {
  return links.map(([label, href]) => {
    const active = !href.includes("#") && !href.includes("?") && new URL(href, location.origin).pathname === location.pathname;
    return `<a href="${href}" ${active ? `class="active" aria-current="page"` : ""}>${label}</a>`;
  }).join("");
}

function renderNav(host, links, actionsHTML, { search = false, menuExtra = "" } = {}) {
  host.innerHTML = `
    <a href="#main" class="skip-link">Skip to content</a>
    <nav class="pc-navbar" aria-label="Main">
      <div class="pc-navbar-inner">
        <a href="/" class="pc-logo"><img src="/assets/icon-64.png" class="pc-logo-mark" alt="" width="28" height="28" />Promoter Connect</a>
        <div class="pc-nav-links">${linksHTML(links)}</div>
        <div class="pc-nav-actions">
          ${search ? `
          <form class="pc-nav-search" id="pc-nav-search-form" role="search">
            ${icon("search", 14)}
            <input type="search" id="pc-nav-search-input" placeholder="Search gigs" aria-label="Search gigs" />
          </form>` : ""}
          ${themeButtonHTML()}
          ${actionsHTML}
          <button class="pc-icon-btn pc-nav-toggle" id="pc-nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="pc-nav-mobile">${icon("menu", 18)}</button>
        </div>
      </div>
      <div class="pc-nav-mobile" id="pc-nav-mobile">${linksHTML(links)}${menuExtra}<button class="pc-nav-mobile-extra" data-theme-toggle>Switch to ${currentTheme() === "dark" ? "light" : "dark"} mode</button></div>
    </nav>`;

  bindThemeToggle();
  host.querySelectorAll("[data-logout]").forEach((el) => el.addEventListener("click", logout));

  const toggle = document.getElementById("pc-nav-toggle");
  const panel = document.getElementById("pc-nav-mobile");
  toggle.addEventListener("click", () => {
    const open = panel.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    toggle.innerHTML = icon(open ? "x" : "menu", 18);
  });

  document.getElementById("pc-nav-search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("pc-nav-search-input").value.trim();
    location.href = `/promoter/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  });
}

function mountBottomNav(role) {
  const items = NAV[role].filter(([, , iconName]) => iconName);
  document.querySelector(".pc-bottom-nav")?.remove();
  const nav = document.createElement("nav");
  nav.className = "pc-bottom-nav";
  nav.setAttribute("aria-label", "Sections");
  nav.innerHTML = items.map(([label, href, iconName]) => {
    const active = location.pathname === href;
    return `<a href="${href}" ${active ? `class="active" aria-current="page"` : ""}>${icon(iconName, 20)}<span>${label}</span></a>`;
  }).join("");
  document.body.appendChild(nav);
  document.body.classList.add("has-bottom-nav");
}

function renderFooter(host, signedIn) {
  if (signedIn) {
    host.innerHTML = `
      <footer class="pc-footer pc-footer--slim">
        <div class="container"><p class="pc-footer-bottom">© ${new Date().getFullYear()} Promoter Connect · Built by a promoter, for promoters.</p></div>
      </footer>`;
    return;
  }
  host.innerHTML = `
    <footer class="pc-footer">
      <div class="container">
        <div class="pc-footer-inner">
          <div>
            <div class="pc-logo"><img src="/assets/icon-64.png" class="pc-logo-mark" alt="" width="28" height="28" />Promoter Connect</div>
            <p class="pc-footer-tagline">Built by a promoter, for promoters. Event staffing without the WhatsApp chase.</p>
          </div>
          <div class="pc-footer-links">
            <a href="/promoter/jobs">Find gigs</a>
            <a href="/auth/signup?role=company">Hire promoters</a>
            <a href="/auth/login">Log in</a>
          </div>
        </div>
        <p class="pc-footer-bottom">© ${new Date().getFullYear()} Promoter Connect</p>
      </div>
    </footer>`;
}

/**
 * Renders the navbar and footer. Pages behind a login pass their role so the
 * right links show immediately instead of flashing the guest nav first.
 */
export function mountLayout({ role = null } = {}) {
  const navHost = document.getElementById("pc-navbar");
  const footHost = document.getElementById("pc-footer");
  if (footHost) renderFooter(footHost, Boolean(role));
  if (!navHost) return;

  const guestActions = `
    <a href="/auth/login" class="btn btn-ghost btn-sm pc-login">Log in</a>
    <a href="/auth/signup" class="btn btn-primary btn-sm">Sign up</a>`;
  const showSearch = (r) => r === "promoter" && location.pathname !== "/promoter/jobs";
  renderNav(navHost, NAV[role] || NAV.guest, role ? "" : guestActions, {
    search: showSearch(role),
    menuExtra: role ? "" : `<a href="/auth/login" class="pc-nav-mobile-extra">Log in</a>`,
  });
  if (role) mountBottomNav(role);

  watchAuth(async (user, profile) => {
    if (!user || !profile) return;
    const links = [...NAV[profile.role]];
    if (await isAdmin(user.uid)) links.push(["Admin", "/admin/dashboard"]);
    renderNav(navHost, links, `
      <div id="pc-notif-slot" style="position:relative"></div>
      <button class="btn btn-ghost btn-sm pc-logout" data-logout>Log out</button>`, {
      search: showSearch(profile.role),
      menuExtra: `<button class="pc-nav-mobile-extra pc-nav-mobile-logout" data-logout>Log out</button>`,
    });
    if (!role) {
      if (footHost) renderFooter(footHost, true);
      mountBottomNav(profile.role);
    }
    mountNotificationBell(user.uid);
  });
}
