import { db, serverTimestamp } from "./firebase-init.js";
import {
  collection, addDoc, query, where, onSnapshot, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function pushNotification(userId, { type, title, message, link = "" }) {
  await addDoc(collection(db, "notifications"), {
    userId, type, title, message, link, read: false, createdAt: serverTimestamp(),
  });
}

export function watchNotifications(userId, cb) {
  // No orderBy/limit in the query itself — where(userId) + orderBy(createdAt) on a
  // different field would need a manually-created composite index otherwise. Sorted
  // and capped client-side instead once the snapshot arrives.
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

/** Mounts a bell icon + dropdown into the element with id="pc-notif-slot" (added by layout.js). */
export function mountNotificationBell(userId) {
  const slot = document.getElementById("pc-notif-slot");
  if (!slot) return;
  slot.innerHTML = `
    <button class="pc-bell" id="pc-bell-btn">🔔<span class="pc-bell-dot" id="pc-bell-dot" hidden></span></button>
    <div class="pc-bell-panel" id="pc-bell-panel" hidden></div>`;
  const btn = slot.querySelector("#pc-bell-btn");
  const panel = slot.querySelector("#pc-bell-panel");
  const dot = slot.querySelector("#pc-bell-dot");

  btn.addEventListener("click", () => { panel.hidden = !panel.hidden; });
  document.addEventListener("click", (e) => {
    if (!slot.contains(e.target)) panel.hidden = true;
  });

  watchNotifications(userId, (items) => {
    dot.hidden = !items.some((n) => !n.read);
    panel.innerHTML = items.length
      ? items.map((n) => `
        <div class="pc-notif-item ${n.read ? "" : "unread"}" data-id="${n.id}" data-link="${n.link || ""}">
          <strong>${n.title}</strong>
          <p>${n.message}</p>
        </div>`).join("")
      : `<div class="pc-notif-empty">No notifications yet.</div>`;

    panel.querySelectorAll(".pc-notif-item").forEach((el) => {
      el.addEventListener("click", () => {
        markNotificationRead(el.dataset.id);
        if (el.dataset.link) window.location.href = el.dataset.link;
      });
    });
  });
}
