// Shared, dependency-free UI helpers used across every page.

export function toast(message, type = "info", ms = 3800) {
  let host = document.getElementById("pc-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "pc-toast-host";
    host.className = "pc-toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `pc-toast pc-toast--${type}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, ms);
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "pc-overlay";
    overlay.innerHTML = `
      <div class="pc-modal">
        <p class="pc-modal-text">${message}</p>
        <div class="pc-modal-actions">
          <button class="btn btn-ghost" data-a="no">Cancel</button>
          <button class="btn btn-primary" data-a="yes">Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
      const a = e.target.dataset.a;
      if (a) { overlay.remove(); resolve(a === "yes"); }
    });
  });
}

export function openModal(innerHTML, opts = {}) {
  const overlay = document.createElement("div");
  overlay.className = "pc-overlay";
  overlay.innerHTML = `<div class="pc-modal pc-modal--wide">${innerHTML}</div>`;
  document.body.appendChild(overlay);
  if (!opts.persistent) {
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }
  return overlay;
}

export function stars(avg = 0, count = null) {
  const full = Math.round(avg);
  let out = "";
  for (let i = 1; i <= 5; i++) out += i <= full ? "★" : "☆";
  return `<span class="pc-stars" title="${avg.toFixed(1)} / 5">${out}</span> <span class="pc-stars-num">${avg ? avg.toFixed(1) : "New"}</span>${count !== null ? `<span class="pc-stars-count">(${count})</span>` : ""}`;
}

export function badgeList(entity, kind) {
  // kind: 'promoter' | 'company'
  const badges = [];
  if (entity.verified) badges.push(["✓ Verified", "badge-verified"]);
  if ((entity.ratingAvg || 0) >= 4.5 && (entity.ratingCount || 0) >= 5) badges.push(["⭐ Highly Rated", "badge-rated"]);
  if (kind === "promoter") {
    if ((entity.ratingAvg || 0) >= 4.8 && (entity.eventsCompleted || 0) >= 20) badges.push(["🔥 Top Promoter", "badge-top"]);
    if (entity.quickResponder) badges.push(["⚡ Quick Responder", "badge-quick"]);
    if ((entity.eventsCompleted || 0) >= 50) badges.push(["🏆 50+ Events", "badge-events"]);
    else if ((entity.eventsCompleted || 0) >= 20) badges.push(["🎯 20+ Events", "badge-events"]);
  } else {
    badges.push(["🏢 Active Event Partner", "badge-partner"]);
  }
  return badges.map(([label, cls]) => `<span class="badge ${cls}">${label}</span>`).join("");
}

export function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtCountdown(ms) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function escapeHTML(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function initMobileNav(role) {
  if (window.innerWidth > 860) return;
  const nav = document.createElement("nav");
  nav.className = "pc-bottom-nav";
  const items = role === "company"
    ? [
        ["🏠", "Home", "/company/dashboard.html"],
        ["📌", "Events", "/company/manage-events.html"],
        ["👥", "Find", "/company/find-promoters.html"],
        ["🔔", "Alerts", "#", "notif"],
        ["🏢", "Profile", "/company/profile.html"],
      ]
    : [
        ["🏠", "Home", "/promoter/dashboard.html"],
        ["🔍", "Jobs", "/promoter/jobs.html"],
        ["📅", "Bookings", "/promoter/bookings.html"],
        ["🔔", "Alerts", "#", "notif"],
        ["👤", "Profile", "/promoter/profile.html"],
      ];
  nav.innerHTML = items
    .map(
      ([icon, label, href, id]) =>
        `<a href="${href}" ${id ? `id="pc-nav-${id}"` : ""} class="${location.pathname === href ? "active" : ""}"><span>${icon}</span><small>${label}</small></a>`
    )
    .join("");
  document.body.appendChild(nav);
  document.body.classList.add("has-bottom-nav");
}
