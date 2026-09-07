import { watchAuth, logout } from "./auth.js";
import { mountNotificationBell } from "./notifications.js";
import { initMobileNav } from "./ui.js";

function ensureFavicon() {
  document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((el) => el.remove());

  [["32x32", "/assets/icon-32.png"], ["64x64", "/assets/icon-64.png"]].forEach(([sizes, href]) => {
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/png";
    icon.sizes = sizes;
    icon.href = href;
    document.head.appendChild(icon);
  });

  const apple = document.createElement("link");
  apple.rel = "apple-touch-icon";
  apple.href = "/assets/icon-180.png";
  document.head.appendChild(apple);
}

const NAV_LINKS = `
  <a href="/index.html#how-it-works">How It Works</a>
  <a href="/index.html#features">Features</a>
  <a href="/promoter/jobs.html">Browse Jobs</a>
  <a href="/company/find-promoters.html">Find Promoters</a>`;

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("pc-theme", theme); } catch (e) {}
  const btn = document.getElementById("pc-theme-toggle");
  if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
}

function mountThemeToggle() {
  const btn = document.getElementById("pc-theme-toggle");
  if (!btn) return;
  const current = document.documentElement.getAttribute("data-theme") || "light";
  btn.textContent = current === "dark" ? "☀️" : "🌙";
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}

function mountNavSearch() {
  const form = document.getElementById("pc-nav-search-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("pc-nav-search-input").value.trim();
    window.location.href = `/promoter/jobs.html${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  });
}

/**
 * Renders the shared navbar + footer into #pc-navbar / #pc-footer (present on every page)
 * and reacts to auth state (guest links vs. dashboard/logout + notification bell).
 */
export function mountLayout({ role = null } = {}) {
  ensureFavicon();
  const navHost = document.getElementById("pc-navbar");
  const footHost = document.getElementById("pc-footer");

  if (navHost) {
    navHost.innerHTML = `
      <nav class="pc-navbar">
        <div class="pc-navbar-inner">
          <a href="/index.html" class="pc-logo">
            <img src="/assets/icon-64.png" class="pc-logo-mark" alt="" /> Promoter Connect
          </a>
          <div class="pc-nav-links">${NAV_LINKS}</div>
          <form class="pc-nav-search" id="pc-nav-search-form">
            <input type="text" id="pc-nav-search-input" placeholder="Search events..." />
            <button type="submit" aria-label="Search">🔍</button>
          </form>
          <div class="pc-nav-actions" id="pc-nav-actions">
            <button class="pc-theme-toggle" id="pc-theme-toggle" aria-label="Toggle dark mode">🌙</button>
            <a href="/auth/login.html" class="btn btn-ghost btn-sm">Log In</a>
            <a href="/auth/signup.html" class="btn btn-primary btn-sm">Get Started</a>
          </div>
          <button class="pc-nav-toggle" id="pc-nav-toggle" aria-label="Menu">☰</button>
        </div>
        <div class="pc-nav-mobile" id="pc-nav-mobile">
          <div class="pc-nav-mobile-links">${NAV_LINKS}</div>
        </div>
      </nav>`;

    mountThemeToggle();
    mountNavSearch();

    const toggle = document.getElementById("pc-nav-toggle");
    const mobilePanel = document.getElementById("pc-nav-mobile");
    toggle.addEventListener("click", () => {
      const open = mobilePanel.classList.toggle("open");
      toggle.textContent = open ? "✕" : "☰";
    });
    mobilePanel.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      mobilePanel.classList.remove("open");
      toggle.textContent = "☰";
    }));
  }

  if (footHost) {
    footHost.innerHTML = `
      <footer class="pc-footer">
        <div class="container">
          <div class="pc-footer-inner">
            <div>
              <div class="pc-logo mb-8"><img src="/assets/icon-64.png" class="pc-logo-mark" alt="" /> Promoter Connect</div>
              <p class="text-dim" style="max-width:260px;font-size:13px;">Built by a Promoter, for a Promoter. Events × People, smart matching.</p>
            </div>
            <div class="pc-footer-links">
              <a href="/index.html#how-it-works">How It Works</a>
              <a href="/index.html#features">Features</a>
              <a href="/index.html#why">Why Promoter Connect</a>
              <a href="/promoter/jobs.html">For Promoters</a>
              <a href="/company/dashboard.html">For Companies</a>
            </div>
          </div>
          <p class="pc-footer-bottom">© ${new Date().getFullYear()} Promoter Connect. All rights reserved.</p>
        </div>
      </footer>`;
  }

  watchAuth((user, profile) => {
    const actions = document.getElementById("pc-nav-actions");
    if (!actions) return;
    if (!user || !profile) {
      actions.innerHTML = `
        <button class="pc-theme-toggle" id="pc-theme-toggle" aria-label="Toggle dark mode">🌙</button>
        <a href="/auth/login.html" class="btn btn-ghost btn-sm">Log In</a>
        <a href="/auth/signup.html" class="btn btn-primary btn-sm">Get Started</a>`;
      mountThemeToggle();
      return;
    }
    const dashHref = profile.role === "company" ? "/company/dashboard.html" : "/promoter/dashboard.html";
    actions.innerHTML = `
      <button class="pc-theme-toggle" id="pc-theme-toggle" aria-label="Toggle dark mode">🌙</button>
      <div id="pc-notif-slot" style="position:relative;"></div>
      <a href="${dashHref}" class="btn btn-secondary btn-sm">Dashboard</a>
      <button id="pc-logout-btn" class="btn btn-ghost btn-sm">Log Out</button>`;
    mountThemeToggle();
    mountNotificationBell(user.uid);
    document.getElementById("pc-logout-btn")?.addEventListener("click", logout);
    if (role) initMobileNav(role);
  });
}
