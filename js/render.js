import { fmtDate, escapeHTML } from "./ui.js";

/** Shared job/event card markup used on the promoter jobs page and dashboard. */
export function jobCardHTML(ev, { showActions = true } = {}) {
  const isUrgent = ev.hiringType === "urgent";
  const remaining = Math.max(0, ev.positionsRequired - (ev.positionsFilled || 0));
  const full = remaining <= 0;
  return `
  <div class="job-card ${isUrgent ? "urgent" : ""}" data-event-id="${ev.id}">
    <div class="job-card-top">
      <div>
        <div class="job-card-brand">${escapeHTML(ev.brand || ev.category || "Event")}</div>
        <div class="job-card-title">${escapeHTML(ev.eventName)}</div>
      </div>
      ${isUrgent ? `<span class="badge badge-urgent">🔥 URGENT · 1-HR</span>` : `<span class="badge badge-events">Normal</span>`}
    </div>
    <div class="job-card-meta">
      <span>📍 ${escapeHTML(ev.location)}</span>
      <span>📅 ${fmtDate(ev.date)}</span>
      <span>🕐 ${ev.startTime}–${ev.endTime}</span>
    </div>
    ${ev._distanceLabel ? `<div class="job-card-distance">${ev._distanceLabel}${ev._reachable ? " · ✅ Reachable within 1hr" : ""}</div>` : ""}
    ${isUrgent ? `<div class="job-card-countdown" data-deadline="${ev.urgentDeadlineMs || ""}" data-status="${ev.status}">⏱️ calculating...</div>` : ""}
    <div class="job-card-footer">
      <span class="job-card-payment">₹${Number(ev.paymentAmount || 0).toLocaleString("en-IN")}</span>
      <span class="job-card-positions">${full ? "All Positions Filled" : `${remaining} Position${remaining === 1 ? "" : "s"} Remaining`}</span>
    </div>
    ${showActions ? `
    <div class="mt-8">
      ${isUrgent
        ? `<button class="btn ${full ? "btn-ghost" : "btn-urgent"} btn-block" data-action="book" ${full || ev.status !== "open" ? "disabled" : ""}>
             ${full || ev.status !== "open" ? "Positions Filled" : "🔥 BOOK NOW"}
           </button>`
        : `<button class="btn btn-primary btn-block" data-action="apply" ${full ? "disabled" : ""}>
             ${full ? "Positions Filled" : "Apply Now"}
           </button>`}
    </div>` : ""}
  </div>`;
}

/** Ticks every urgent card's countdown label + auto-flags visually expired ones. */
export function tickCountdowns(container) {
  container.querySelectorAll(".job-card-countdown").forEach((el) => {
    const deadline = Number(el.dataset.deadline);
    if (!deadline) { el.textContent = ""; return; }
    const ms = deadline - Date.now();
    if (ms <= 0 || el.dataset.status !== "open") {
      el.textContent = el.dataset.status === "fulfilled" ? "✅ Fulfilled" : "⏱️ 1-Hour Window Ended";
    } else {
      const m = String(Math.floor(ms / 60000)).padStart(2, "0");
      const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
      el.textContent = `⏱️ ${m}:${s} Remaining for Priority Fulfillment`;
    }
  });
}
