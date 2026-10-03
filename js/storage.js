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

/** Uploads an image to Supabase Storage and returns its public URL. */
export async function uploadImage(path, file) {
  if (!file) throw new Error("No file provided");
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("That image is over 8 MB. Please pick a smaller one.");

  const { error } = await supabase.storage.from(supabaseConfig.bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error("The upload didn't go through. Please try again.");

  const { data } = supabase.storage.from(supabaseConfig.bucket).getPublicUrl(path);
  return data.publicUrl;
}
