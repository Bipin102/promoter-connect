import { storage } from "./firebase-init.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/**
 * Uploads a File/Blob and returns its public download URL.
 * path examples: `promoters/${uid}/profile.jpg`, `checkins/${bookingId}/${Date.now()}.jpg`
 */
export async function uploadImage(path, file) {
  if (!file) throw new Error("No file provided");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be under 8MB");
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
