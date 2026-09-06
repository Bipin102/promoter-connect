import { watchAuth, logout } from "./auth.js";
import { mountNotificationBell } from "./notifications.js";
import { initMobileNav } from "./ui.js";

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="%23ff2e93"/><stop offset="1" stop-color="%238b5cf6"/>
  </linearGradient></defs>
  <circle cx="32" cy="32" r="32" fill="url(%23g)"/>
  <text x="32" y="41" font-family="Arial, sans-serif" font-weight="800" font-size="26" fill="%230a0a12" text-anchor="middle">PC</text>
</svg>`;

function ensureFavicon() {
  document.querySelectorAll('link[rel="icon"]').forEach((el) => el.remove());
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = `data:image/svg+xml,${FAVICON_SVG.replace(/\s+/g, " ")}`;
  document.head.appendChild(link);
}

const NAV_LINKS = `
  <a href="/index.html#how-it-works">How It Works</a>
  <a href="/index.html#features">Features</a>
  <a href="/promoter/jobs.html">Browse Jobs</a>
  <a href="/company/find-promoters.html">Find Promoters</a>`;

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
            <span class="pc-logo-mark">PC</span> Promoter Connect
          </a>
          <div class="pc-nav-links">${NAV_LINKS}</div>
          <div class="pc-nav-actions" id="pc-nav-actions">
            <a href="/auth/login.html" class="btn btn-ghost btn-sm">Log In</a>
            <a href="/auth/signup.html" class="btn btn-primary btn-sm">Get Started</a>
          </div>
          <button class="pc-nav-toggle" id="pc-nav-toggle" aria-label="Menu">☰</button>
        </div>
        <div class="pc-nav-mobile" id="pc-nav-mobile">
          <div class="pc-nav-mobile-links">${NAV_LINKS}</div>
        </div>
      </nav>`;

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
              <div class="pc-logo mb-8"><span class="pc-logo-mark">PC</span> Promoter Connect</div>
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
        <a href="/auth/login.html" class="btn btn-ghost btn-sm">Log In</a>
        <a href="/auth/signup.html" class="btn btn-primary btn-sm">Get Started</a>`;
      return;
    }
    const dashHref = profile.role === "company" ? "/company/dashboard.html" : "/promoter/dashboard.html";
    actions.innerHTML = `
      <div id="pc-notif-slot" style="position:relative;"></div>
      <a href="${dashHref}" class="btn btn-secondary btn-sm">Dashboard</a>
      <button id="pc-logout-btn" class="btn btn-ghost btn-sm">Log Out</button>`;
    mountNotificationBell(user.uid);
    document.getElementById("pc-logout-btn")?.addEventListener("click", logout);
    if (role) initMobileNav(role);
  });
}
