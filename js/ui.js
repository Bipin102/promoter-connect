export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Only lets http(s) image URLs through, so a stored value can't become a javascript: or attribute-breaking string. */
export function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? escapeHTML(parsed.href) : "";
  } catch {
    return "";
  }
}

export function toast(message, type = "info", ms = 4000) {
  let host = document.getElementById("pc-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "pc-toast-host";
    host.className = "pc-toast-host";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `pc-toast pc-toast--${type}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
  }, ms);
}

export function openModal(innerHTML, { wide = true, persistent = false, onClose } = {}) {
  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "pc-overlay";
  overlay.innerHTML = `<div class="pc-modal ${wide ? "pc-modal--wide" : ""}" role="dialog" aria-modal="true">${innerHTML}</div>`;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    previousFocus?.focus?.();
    onClose?.();
  };
  const onKey = (e) => { if (e.key === "Escape" && !persistent) close(); };
  document.addEventListener("keydown", onKey);
  if (!persistent) overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", close));

  overlay.querySelector("input, textarea, select, button")?.focus();
  overlay.close = close;
  return overlay;
}

export function confirmDialog(message, { confirmLabel = "Confirm", danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const overlay = openModal(`
      <p class="pc-modal-text">${escapeHTML(message)}</p>
      <div class="pc-modal-actions">
        <button class="btn btn-secondary" data-answer="no">Go back</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-answer="yes">${escapeHTML(confirmLabel)}</button>
      </div>`, { wide: false, onClose: () => { if (!answered) resolve(false); } });
    overlay.querySelector('[data-answer="yes"]').focus();
    overlay.querySelectorAll("[data-answer]").forEach((btn) => btn.addEventListener("click", () => {
      answered = true;
      overlay.close();
      resolve(btn.dataset.answer === "yes");
    }));
  });
}

export function stars(avg = 0, count = null) {
  const full = Math.round(avg);
  const glyphs = "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
  const label = avg ? `${avg.toFixed(1)} out of 5` : "No ratings yet";
  return `<span class="pc-stars" title="${label}"><span class="pc-stars-glyphs" aria-hidden="true">${glyphs}</span>`
    + `<span class="pc-stars-num">${avg ? avg.toFixed(1) : "New"}</span>`
    + `${count ? `<span class="pc-stars-count">(${count})</span>` : ""}<span class="sr-only">${label}</span></span>`;
}

export function badgeList(entity, kind) {
  const badges = [];
  if (entity.verified) badges.push(["Verified", "badge-accent"]);
  if ((entity.ratingAvg || 0) >= 4.5 && (entity.ratingCount || 0) >= 5) badges.push(["Highly rated", "badge-success"]);
  if (kind === "promoter") {
    if ((entity.ratingAvg || 0) >= 4.8 && (entity.eventsCompleted || 0) >= 20) badges.push(["Top promoter", "badge-success"]);
    if (entity.quickResponder) badges.push(["Quick responder", ""]);
    if ((entity.eventsCompleted || 0) >= 50) badges.push(["50+ events", ""]);
    else if ((entity.eventsCompleted || 0) >= 20) badges.push(["20+ events", ""]);
  }
  return badges.map(([label, cls]) => `<span class="badge ${cls}">${label}</span>`).join("");
}

const STATUS_LABELS = {
  open: "Open",
  fulfilled: "Fully staffed",
  window_ended: "Hour ended",
  completed: "Completed",
  cancelled: "Cancelled",
  booked: "Booked",
  on_the_way: "On the way",
  checked_in: "Checked in",
  active: "Active",
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  paid: "Paid",
  available: "Available",
  busy: "Busy",
};

export function statusPill(status) {
  const known = Object.hasOwn(STATUS_LABELS, status);
  return `<span class="status-pill ${known ? `status-${status}` : ""}">${known ? STATUS_LABELS[status] : escapeHTML(status)}</span>`;
}

export function avatarHTML(url, name, size = "") {
  const src = safeUrl(url);
  const initial = escapeHTML((name || "?").trim().charAt(0).toUpperCase() || "?");
  return `<div class="avatar ${size}">${src ? `<img src="${src}" alt="" loading="lazy" />` : initial}</div>`;
}

export function fmtMoney(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

const PAYMENT_TYPES = { per_event: "per event", per_hour: "per hour", per_day: "per day" };
export function fmtPaymentType(type) {
  return PAYMENT_TYPES[type] || "";
}

export function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return escapeHTML(dateStr);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function fmtTime(timeStr) {
  const [h, m] = String(timeStr || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return escapeHTML(timeStr);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function fmtTimeRange(start, end) {
  return start ? `${fmtTime(start)} – ${fmtTime(end)}` : "";
}

export function fmtTimestamp(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
}

export function fmtCountdown(ms) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** "2d 4h 12m" / "4h 12m" / "12m 34s", or null once the time has passed. */
export function fmtEventCountdown(ms) {
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function eventStartDate(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return isNaN(d) ? null : d;
}

/** Wires a .pc-tabs row of buttons; calls onChange(key) with each button's data-tab. */
export function initTabs(container, onChange) {
  const tabs = [...container.querySelectorAll(".pc-tab")];
  container.setAttribute("role", "tablist");
  tabs.forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      onChange(tab.dataset.tab);
    });
  });
  const initial = tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0];
  initial.click();
}

export function skeletonCards(count, lines = 4) {
  const widths = ["40%", "70%", "85%", "55%", "65%"];
  return Array.from({ length: count }, () => `
    <div class="skeleton" aria-hidden="true">
      ${widths.slice(0, lines).map((w) => `<div class="skeleton-line" style="width:${w}"></div>`).join("")}
    </div>`).join("");
}
