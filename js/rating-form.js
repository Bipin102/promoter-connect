import { CATEGORY_LABELS } from "./ratings.js";
import { toast } from "./ui.js";

/** Star rating form shared by both sides. onSubmit(values, comment) should throw on failure. */
export function mountRatingForm(host, categories, onSubmit) {
  const values = Object.fromEntries(categories.map((c) => [c, 0]));
  host.innerHTML = categories.map((c) => `
    <div class="rating-row">
      <span id="rate-${c}">${CATEGORY_LABELS[c]}</span>
      <div class="stars-input" role="radiogroup" aria-labelledby="rate-${c}" data-cat="${c}">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} out of 5" data-n="${n}">★</button>`).join("")}
      </div>
    </div>`).join("") + `
    <div class="field mt-16">
      <label for="rating-comment">Comment <span class="optional">(optional)</span></label>
      <textarea id="rating-comment" rows="3"></textarea>
    </div>
    <button class="btn btn-primary btn-block" id="submit-rating">Submit rating</button>`;

  host.querySelectorAll(".stars-input").forEach((group) => {
    group.addEventListener("click", (e) => {
      const star = e.target.closest("button");
      if (!star) return;
      const n = Number(star.dataset.n);
      values[group.dataset.cat] = n;
      group.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("active", Number(b.dataset.n) <= n);
        b.setAttribute("aria-checked", String(Number(b.dataset.n) === n));
      });
    });
  });

  const submit = host.querySelector("#submit-rating");
  submit.addEventListener("click", async () => {
    if (Object.values(values).some((v) => v === 0)) return toast("Give a score for each category.", "error");
    submit.disabled = true;
    try {
      await onSubmit(values, host.querySelector("#rating-comment").value.trim());
    } catch (err) {
      toast(err.message === "ALREADY_RATED" ? "You've already rated this one." : "Couldn't save your rating. Please try again.", "error");
      submit.disabled = false;
    }
  });
}
