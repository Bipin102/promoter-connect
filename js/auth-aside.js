// The brand panel beside the login and signup forms (wide screens only).
import { BRANDS } from "./brands.js";
import { icon } from "./icons.js";
import { escapeHTML } from "./ui.js";

const COPY = {
  any: {
    eyebrow: "Event staffing, simplified",
    title: "Where event companies and promoters find each other.",
    points: [
      "Regular gigs and urgent, same-hour bookings",
      "Verified profiles, photos and ratings",
      "Live check-ins on the day of the event",
    ],
  },
  promoter: {
    eyebrow: "For promoters",
    title: "Paid event work, close to home.",
    points: [
      "Sampling, store launches, exhibitions and more",
      "Apply in one tap, or grab an urgent spot",
      "Good ratings help you get picked again",
    ],
  },
  company: {
    eyebrow: "For companies",
    title: "Staff your next activation in hours, not days.",
    points: [
      "Post a gig in under two minutes",
      "Fill last-minute spots within the hour",
      "See who checked in, with photo and location",
    ],
  },
};

export function mountAuthAside(host, role = "any") {
  host.innerHTML = `
    <a href="/" class="pc-logo auth-aside-logo"><img src="/assets/icon-64.png" class="pc-logo-mark" alt="" width="32" height="32" />Promoter Connect</a>
    <div class="auth-aside-body">
      <p class="auth-aside-eyebrow" data-k="eyebrow"></p>
      <h2 class="auth-aside-title" data-k="title"></h2>
      <ul class="auth-aside-points" data-k="points"></ul>
    </div>
    <div class="auth-aside-foot">
      <p class="auth-aside-label">Brands we've worked with</p>
      <ul class="auth-aside-brands">
        ${BRANDS.slice(0, 6).map((b) => `<li style="--brand:${escapeHTML(b.color)}" title="${escapeHTML(b.name)}"><img src="${escapeHTML(b.logo)}" alt="${escapeHTML(b.name)}" loading="lazy" /></li>`).join("")}
      </ul>
    </div>`;
  setAuthAsideRole(host, role);
}

export function setAuthAsideRole(host, role) {
  const copy = COPY[role] || COPY.any;
  host.querySelector('[data-k="eyebrow"]').textContent = copy.eyebrow;
  host.querySelector('[data-k="title"]').textContent = copy.title;
  host.querySelector('[data-k="points"]').innerHTML = copy.points
    .map((p) => `<li><span class="auth-aside-check">${icon("check", 14)}</span>${escapeHTML(p)}</li>`).join("");
}
