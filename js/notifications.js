import { db, serverTimestamp } from "./firebase-init.js";
import {
  collection, addDoc, query, where, onSnapshot, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { escapeHTML } from "./ui.js";
import { icon } from "./icons.js";

export async function pushNotification(userId, { type, title, message, link = "" }) {
  await addDoc(collection(db, "notifications"), {
    userId, type, title, message, link, read: false, createdAt: serverTimestamp(),
  });
}

export function watchNotifications(userId, cb) {
  // Sorted client-side: where(userId) + orderBy(createdAt) would need a composite index.
  const q = query(collection(db, "notifications"), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, 30);
    cb(items);
  });
}

export async function markNotificationRead(id) {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

// Notifications are written by other users' clients, so only same-site paths are followed.
function safeLink(link) {
  return typeof link === "string" && link.startsWith("/") && !link.startsWith("//") ? link : "";
}

export function mountNotificationBell(userId) {
  const slot = document.getElementById("pc-notif-slot");
  if (!slot) return;
  slot.innerHTML = `
    <button class="pc-icon-btn" id="pc-bell-btn" aria-label="Notifications" aria-expanded="false" aria-controls="pc-bell-panel">
      ${icon("bell", 17)}<span class="pc-bell-dot" id="pc-bell-dot" hidden></span>
    </button>
    <div class="pc-bell-panel" id="pc-bell-panel" hidden></div>`;
  const btn = slot.querySelector("#pc-bell-btn");
  const panel = slot.querySelector("#pc-bell-panel");
  const dot = slot.querySelector("#pc-bell-dot");

  const setOpen = (open) => {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  };
  btn.addEventListener("click", () => setOpen(panel.hidden));
  document.addEventListener("click", (e) => { if (!slot.contains(e.target)) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { setOpen(false); btn.focus(); } });

  watchNotifications(userId, (items) => {
    const unread = items.filter((n) => !n.read).length;
    dot.hidden = unread === 0;
    btn.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications");
    panel.innerHTML = `<div class="pc-bell-panel-head">Notifications</div>` + (items.length
      ? items.map((n) => `
        <button class="pc-notif-item ${n.read ? "" : "unread"}" data-id="${escapeHTML(n.id)}" data-link="${escapeHTML(safeLink(n.link))}">
          <strong>${escapeHTML(n.title)}</strong>
          <span>${escapeHTML(n.message)}</span>
        </button>`).join("")
      : `<div class="pc-notif-empty">You're all caught up.</div>`);

    panel.querySelectorAll(".pc-notif-item").forEach((el) => {
      el.addEventListener("click", async () => {
        await markNotificationRead(el.dataset.id).catch(() => {});
        if (el.dataset.link) location.href = el.dataset.link;
      });
    });
  });
}
