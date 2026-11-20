import { escapeHTML, fmtDate, fmtTimeRange, fmtMoney, fmtPaymentType, openModal, toast } from "./ui.js";
import { icon } from "./icons.js";

/** A link that opens this gig straight away on the public Find gigs page. */
export function eventShareLink(event) {
  return `${location.origin}/promoter/jobs?event=${encodeURIComponent(event.id)}`;
}

function shareText(event) {
  const when = [fmtDate(event.date), fmtTimeRange(event.startTime, event.endTime)].filter(Boolean).join(", ");
  const pay = `${fmtMoney(event.paymentAmount)} ${fmtPaymentType(event.paymentType)}`.trim();
  const spots = Math.max(0, (event.positionsRequired || 0) - (event.positionsFilled || 0));
  return [
    `${event.hiringType === "urgent" ? "Urgent: " : ""}${event.eventName}${event.brand ? ` (${event.brand})` : ""}`,
    `${when} at ${event.location}`,
    `Pay: ${pay}${spots ? ` · ${spots} ${spots === 1 ? "spot" : "spots"} open` : ""}`,
    "Apply on Promoter Connect:",
  ].join("\n");
}

/**
 * Shares a gig. Phones get the system share sheet (WhatsApp, Instagram,
 * Telegram and every other installed app); elsewhere a small menu of
 * common apps plus copy link.
 */
export async function shareEvent(event) {
  const url = eventShareLink(event);
  const text = shareText(event);
  const isTouch = matchMedia("(pointer: coarse)").matches;
  if (navigator.share && isTouch) {
    try {
      await navigator.share({ title: event.eventName, text, url });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }

  const message = `${text} ${url}`;
  const enc = encodeURIComponent;
  const targets = [
    ["WhatsApp", "whatsapp", `https://wa.me/?text=${enc(message)}`],
    ["Facebook", "facebook", `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ["X", "xBrand", `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`],
    ["LinkedIn", "linkedin", `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
    ["Telegram", "telegram", `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`],
    ["Email", "mail", `mailto:?subject=${enc(event.eventName)}&body=${enc(message)}`],
  ];
  const modal = openModal(`
    <h2>Share this gig</h2>
    <p class="text-dim text-sm">${escapeHTML(event.eventName)}</p>
    <div class="share-grid">
      ${targets.map(([name, iconName, href]) => `
        <a class="share-target" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${icon(iconName, 20)}<span>${name}</span></a>`).join("")}
    </div>
    <div class="share-copy">
      <input class="input" readonly value="${escapeHTML(url)}" aria-label="Link to this gig" />
      <button type="button" class="btn btn-primary" data-copy>${icon("link", 15)}Copy link</button>
    </div>
    <p class="field-hint">For Instagram, copy the link and paste it into your story or bio.</p>
    <div class="pc-modal-actions"><button class="btn btn-secondary" data-close>Done</button></div>`, { wide: false });

  modal.querySelector("[data-copy]").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      btn.innerHTML = `${icon("link", 15)}Copied`;
      toast("Link copied. Paste it anywhere.", "success");
    } catch {
      modal.querySelector("input").select();
      toast("Press Ctrl+C (or long-press) to copy the link.");
    }
  });
}
