import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { supabaseConfig } from "./supabase-config.js";

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

const isSupabaseConfigured = supabaseConfig.url !== "YOUR_SUPABASE_PROJECT_URL";

if (!isSupabaseConfigured) {
  window.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.textContent =
      "Image storage isn't configured. Add Supabase credentials in js/supabase-config.js.";
    bar.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:#0a0a12;font-family:sans-serif;font-weight:700;text-align:center;padding:10px;font-size:14px;";
    document.body.prepend(bar);
  });
}

/**
 * Scales a photo down to at most maxSize px on its longest side and re-encodes
 * it as JPEG, so a 6 MB phone photo uploads as roughly 200 KB. Falls back to
 * the original if the browser can't decode it (some HEIC files, for example).
 */
export async function shrinkImage(file, maxSize = 1600) {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 500 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Uploads an image to Supabase Storage and returns its public URL. */
export async function uploadImage(path, file, { maxSize = 1600 } = {}) {
  if (!file) throw new Error("No file provided");
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 25 * 1024 * 1024) throw new Error("That image is over 25 MB. Please pick a smaller one.");

  const upload = await shrinkImage(file, maxSize);
  if (upload.size > 8 * 1024 * 1024) throw new Error("That image is too large. Please pick a smaller one.");
  const { error } = await supabase.storage.from(supabaseConfig.bucket).upload(path, upload, {
    upsert: false,
    contentType: upload.type || file.type,
  });
  if (error) throw new Error("The upload didn't go through. Please try again.");

  const { data } = supabase.storage.from(supabaseConfig.bucket).getPublicUrl(path);
  return data.publicUrl;
}
