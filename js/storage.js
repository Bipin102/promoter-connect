import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { supabaseConfig } from "./supabase-config.js";

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

export const isSupabaseConfigured = supabaseConfig.url !== "YOUR_SUPABASE_PROJECT_URL";

if (!isSupabaseConfigured) {
  window.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.textContent =
      "⚠ Image storage isn't configured yet. Add your Supabase credentials in js/supabase-config.js to enable photo uploads.";
    bar.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:#0a0a12;font-family:sans-serif;font-weight:700;text-align:center;padding:10px;font-size:14px;";
    document.body.prepend(bar);
  });
}

/**
 * Uploads a File/Blob to Supabase Storage and returns its public URL.
 * path examples: `promoters/${uid}/profile.jpg`, `checkins/${bookingId}/${Date.now()}.jpg`
 * (Image storage lives on Supabase rather than Firebase Storage — see
 * js/supabase-config.js for why. Auth/database stay on Firebase.)
 */
export async function uploadImage(path, file) {
  if (!file) throw new Error("No file provided");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be under 8MB");

  const { error } = await supabase.storage.from(supabaseConfig.bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(error.message || "Upload failed. Please try again.");

  const { data } = supabase.storage.from(supabaseConfig.bucket).getPublicUrl(path);
  return data.publicUrl;
}
