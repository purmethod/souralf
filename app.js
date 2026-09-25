// ÂLF: reveals, floating adopt button, video, quantity. Vanilla, no dependencies.
(() => {
  const doc = document.documentElement;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const hasIO = "IntersectionObserver" in window;
  if (!hasIO) doc.classList.remove("js");

  /* ---------- reveals ---------- */

  function initReveals() {
    if (!hasIO || motion.matches) return;
    const els = document.querySelectorAll(".shot, .statement .mono-lg, .box-block");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = `${(i % 5) * 70}ms`;
      io.observe(el);
    });
  }

  /* ---------- floating adopt button: hidden where a CTA is already in view ---------- */

  function initDock() {
    const dock = document.querySelector(".dock");
    const blockers = document.querySelectorAll(".hero, .statement, .box, .product, .foot");
    if (!dock || !hasIO) return;
    const showing = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? showing.add(e.target) : showing.delete(e.target)));
      dock.classList.toggle("is-visible", showing.size === 0);
    });
    blockers.forEach((el) => io.observe(el));
  }

  /* ---------- videos: play when visible, tap to pause/play ---------- */
  // iPhones in Low Power Mode block autoplay: then a play mark shows and one tap starts it.

  function initVideo() {
    const vids = [...document.querySelectorAll("video.loop")];
    if (!vids.length) return;
    // The play mark shows only when the phone blocked autoplay or the viewer paused by tap,
    // never for our own off-screen pause.
    const mark = (v, on) => v.parentElement.classList.toggle("is-paused", on);
    const tryPlay = (v) => {
      v.muted = true;
      const p = v.play();
      if (p && p.catch) p.catch(() => mark(v, true));
    };
    vids.forEach((v) => {
      v.addEventListener("play", () => mark(v, false));
      v.parentElement.addEventListener("click", () => {
        if (v.paused) {
          v.dataset.held = "";
          tryPlay(v);
        } else {
          v.dataset.held = "1";
          v.pause();
          mark(v, true);
        }
      });
    });
    if (!hasIO) return vids.forEach(tryPlay);
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) e.target.pause();
          else if (!e.target.dataset.held) tryPlay(e.target);
        }),
      { threshold: 0.2 }
    );
    vids.forEach((v) => io.observe(v));
  }

  /* ---------- product page: quantity goes into the adoption email ---------- */

  function initQuantity() {
    const out = document.querySelector(".qty-value");
    const link = document.querySelector(".adopt-link");
    if (!out || !link) return;
    const mail = link.getAttribute("href");
    let n = 1;
    document.querySelectorAll(".qty-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        n = Math.min(9, Math.max(1, n + Number(btn.dataset.step)));
        out.textContent = String(n);
        link.setAttribute("href", mail.replace("Quantity%3A%201", `Quantity%3A%20${n}`));
      })
    );
    initCheckout(link, () => n);
  }

  /* ---------- Stripe Embedded Checkout: payment stays on souralf.com ---------- */
  // If Stripe is not reachable or not configured yet, the button keeps its email fallback.

  function loadStripe() {
    if (window.Stripe) return Promise.resolve(window.Stripe);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://js.stripe.com/v3/";
      s.onload = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error("Stripe unavailable")));
      s.onerror = () => reject(new Error("Stripe unavailable"));
      document.head.appendChild(s);
    });
  }

  function initCheckout(link, quantity) {
    const key = link.dataset.stripeKey;
    const box = document.getElementById("checkout");
    if (!key || !box || !window.fetch) return;
    let busy = false;
    link.addEventListener("click", async (event) => {
      if (busy) return event.preventDefault();
      event.preventDefault();
      busy = true;
      link.textContent = "One moment";
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: quantity() }),
        });
        if (!res.ok) throw new Error("checkout " + res.status);
        const { clientSecret } = await res.json();
        const Stripe = await loadStripe();
        const checkout = await Stripe(key).initEmbeddedCheckout({ fetchClientSecret: async () => clientSecret });
        document.querySelectorAll(".qty, .adopt-link").forEach((el) => (el.hidden = true));
        box.hidden = false;
        checkout.mount(box);
        box.scrollIntoView({ behavior: motion.matches ? "auto" : "smooth", block: "start" });
      } catch (err) {
        window.location.href = link.getAttribute("href"); // email fallback
      } finally {
        busy = false;
        link.textContent = "Adopt ÂLF";
      }
    });
  }

  initVideo();
  initQuantity();
  initReveals();
  initDock();
})();
