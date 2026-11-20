// Brands Promoter Connect has run events for. To add one, put its logo in
// assets/brands/ (about 120px tall), pick an accent colour from the logo, and
// add a line here. A brand without a logo file shows its name instead.
export const BRANDS = [
  { name: "Aditya Birla Group", logo: "/assets/brands/aditya-birla.png", color: "#c8102e" },
  { name: "Flipkart Minutes", logo: "/assets/brands/flipkart-minutes.png", color: "#f5c400" },
  { name: "Birla Opus", logo: "/assets/brands/birla-opus.png", color: "#6a4fa3" },
  { name: "Maaza", logo: "/assets/brands/maaza.png", color: "#3a9d23" },
  { name: "Palmonas", logo: "/assets/brands/palmonas.png", color: "#b8912f" },
  { name: "Xpress Advert", logo: "/assets/brands/xpress-advert.jpg", color: "#1e6fe8" },
  { name: "XTO Media", logo: "/assets/brands/xto-media.jpg", color: "#f28c28" },
];

export function mountBrands(host) {
  host.innerHTML = BRANDS.map((b) => `
    <li class="brand-tile" title="${b.name}" style="--brand: ${b.color || "var(--border-strong)"}">
      ${b.logo ? `<img src="${b.logo}" alt="${b.name}" loading="lazy" />` : `<span class="brand-name">${b.name}</span>`}
    </li>`).join("");
  host.querySelectorAll("img").forEach((img) => img.addEventListener("error", () => {
    img.replaceWith(Object.assign(document.createElement("span"), { className: "brand-name", textContent: img.alt }));
  }));
}
