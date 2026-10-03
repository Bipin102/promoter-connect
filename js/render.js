import { escapeHTML, fmtDate, fmtTimeRange, fmtMoney, fmtPaymentType, fmtEventCountdown, eventStartDate, statusPill } from "./ui.js";
import { icon } from "./icons.js";

export const ACTIVE_BOOKING_STATUSES = ["booked", "on_the_way", "checked_in", "active"];

export function eventMetaHTML(ev) {
  return `
    <div class="meta">
      <span>${icon("calendar", 14)}${fmtDate(ev.date)}</span>
      ${ev.startTime ? `<span>${icon("clock", 14)}${fmtTimeRange(ev.startTime, ev.endTime)}</span>` : ""}
      <span>${icon("pin", 14)}${escapeHTML(ev.location)}</span>
    </div>`;
}

export function jobCardHTML(ev, { showActions = true } = {}) {
  const isUrgent = ev.hiringType === "urgent";
  const remaining = Math.max(0, ev.positionsRequired - (ev.positionsFilled || 0));
  const closed = remaining <= 0 || ev.status !== "open";
  const subtitle = [ev.brand, ev.category].filter(Boolean).map(escapeHTML).join(" · ");

  return `
  <article class="job-card ${isUrgent ? "urgent" : ""}" data-event-id="${escapeHTML(ev.id)}">
    <div class="job-card-top">
      <div>
        ${subtitle ? `<div class="job-card-brand">${subtitle}</div>` : ""}
        <h3 class="job-card-title">${escapeHTML(ev.eventName)}</h3>
      </div>
      ${isUrgent ? `<span class="badge badge-urgent">Urgent</span>` : ""}
    </div>
    ${eventMetaHTML(ev)}
    ${ev._distanceLabel ? `<div class="job-card-distance">${ev._distanceLabel}${ev._reachable ? ` · <strong>within an hour</strong>` : ""}</div>` : ""}
    ${isUrgent ? `<div class="job-card-countdown" data-deadline="${Number(ev.urgentDeadlineMs) || ""}" data-status="${escapeHTML(ev.status)}"></div>` : ""}
    <div class="job-card-footer">
      <span class="job-card-payment">${fmtMoney(ev.paymentAmount)} <small>${fmtPaymentType(ev.paymentType)}</small></span>
      <span class="job-card-positions">${remaining <= 0 ? "No spots left" : `${remaining} of ${ev.positionsRequired} ${ev.positionsRequired === 1 ? "spot" : "spots"} left`}</span>
    </div>
    ${showActions ? `
    <div class="job-card-actions">
      <button class="btn btn-secondary" data-action="details">Details</button>
      ${isUrgent
        ? `<button class="btn btn-urgent" data-action="book" ${closed ? "disabled" : ""}>${closed ? "Closed" : "Book a spot"}</button>`
        : `<button class="btn btn-primary" data-action="apply" ${closed ? "disabled" : ""}>${closed ? "Closed" : "Apply"}</button>`}
    </div>` : ""}
  </article>`;
}

/** Full event details for the promoter-facing modal and booking page. */
export function eventDetailsHTML(ev) {
  const rows = [
    ["Pay", `${fmtMoney(ev.paymentAmount)} ${fmtPaymentType(ev.paymentType)}`],
    ["Spots", ev.positionsRequired ? `${ev.positionsFilled || 0} of ${ev.positionsRequired} filled` : ""],
    ["Category", ev.category],
    ["Gender", ev.genderReq],
    ["Age", ev.ageReq],
    ["Experience", ev.experienceReq],
    ["Skills", (ev.skillsReq || []).join(", ")],
    ["Dress code", ev.dressCode],
    ["Contact", ev.contactPerson],
  ].filter(([, value]) => value);

  return `
    ${eventMetaHTML(ev)}
    ${ev.description ? `<p class="mt-16" style="white-space:pre-line">${escapeHTML(ev.description)}</p>` : ""}
    <dl class="detail-list mt-16">
      ${rows.map(([label, value]) => `<dt>${label}</dt><dd>${label === "Pay" || label === "Spots" ? value : escapeHTML(value)}</dd>`).join("")}
    </dl>
    ${ev.specialInstructions ? `<p class="field-label mt-16">Instructions</p><p class="text-dim" style="white-space:pre-line">${escapeHTML(ev.specialInstructions)}</p>` : ""}`;
}

export function tickCountdowns(container) {
  container.querySelectorAll(".job-card-countdown").forEach((el) => {
    const deadline = Number(el.dataset.deadline);
    if (!deadline) { el.textContent = ""; return; }
    const ms = deadline - Date.now();
    if (el.dataset.status === "fulfilled") el.textContent = "Fully staffed";
    else if (ms <= 0 || el.dataset.status !== "open") el.textContent = "Booking window closed";
    else el.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")} left to book`;
  });
}

/** A promoter's booking as a list row, with a live "starts in" line for upcoming ones. */
export function bookingRowHTML(b) {
  const upcoming = ["booked", "on_the_way"].includes(b.status);
  const start = eventStartDate(b.date, b.startTime)?.getTime() || "";
  return `
    <a href="/promoter/event?id=${encodeURIComponent(b.id)}" class="list-row">
      <div class="list-row-main">
        <div class="list-row-title">${escapeHTML(b.eventName)}</div>
        <div class="list-row-sub">${fmtDate(b.date)} · ${fmtTimeRange(b.startTime, b.endTime)} · ${escapeHTML(b.location)}</div>
        ${upcoming && start ? `<div class="countdown" data-event-start="${start}"></div>` : ""}
      </div>
      <div class="list-row-side">
        ${statusPill(b.status)}
        <span>${fmtMoney(b.paymentAmount)}</span>
      </div>
    </a>`;
}

export function tickEventStarts(root = document) {
  root.querySelectorAll("[data-event-start]").forEach((el) => {
    const label = fmtEventCountdown(Number(el.dataset.eventStart) - Date.now());
    el.textContent = label ? `Starts in ${label}` : "Started";
  });
}
