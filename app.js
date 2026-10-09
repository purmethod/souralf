// ÂLF: reveals, floating adopt button, videos, product page + checkout. Vanilla, no dependencies.
(() => {
  const doc = document.documentElement;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const hasIO = "IntersectionObserver" in window;
  if (!hasIO) doc.classList.remove("js");

  /* ---------- reveals ---------- */

  function initReveals() {
    if (!hasIO || motion.matches) return;
    const els = document.querySelectorAll(".story > *, .shot, .statement-line, .box-block");
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

  /* ---------- header: transparent over the hero video, solid once you scroll past ---------- */

  function initBar() {
    const bar = document.querySelector(".bar");
    const hero = document.querySelector(".hero");
    if (!bar || !hero || !hasIO) return;
    bar.classList.add("on-hero");
    new IntersectionObserver(
      ([e]) => bar.classList.toggle("on-hero", e.isIntersecting),
      { rootMargin: `-${bar.offsetHeight}px 0px 0px 0px` }
    ).observe(hero);
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

  /* ---------- videos: load just before they scroll in, play only while really on screen ---------- */
  // Fewer videos decoding at once = smooth playback on phones. Low Power Mode blocks autoplay:
  // then a play mark shows and one tap starts the video. A tap never pauses by accident.

  function initVideo() {
    const vids = [...document.querySelectorAll("video.loop")];
    if (!vids.length) return;
    const mark = (v, on) => v.parentElement.classList.toggle("is-paused", on);
    const tryPlay = (v) => {
      if (!v.paused) return;
      v.muted = true;
      const p = v.play();
      if (p && p.catch) p.catch(() => mark(v, true));
    };
    vids.forEach((v) => {
      v.addEventListener("playing", () => mark(v, false));
      v.parentElement.addEventListener("click", () => tryPlay(v));
    });
    if (!hasIO) return vids.forEach(tryPlay);

    const warm = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const v = e.target;
          if (v.preload !== "auto") {
            v.preload = "auto";
            if (v.readyState < 2) v.load();
          }
          warm.unobserve(v);
        }),
      // warm up a little over half a screen ahead: early enough to be ready, late enough
      // that the first load stays light (the three story videos sit two screens down)
      { rootMargin: "60% 0px" }
    );
    const onScreen = new Set();
    const play = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const v = e.target;
          if (e.intersectionRatio >= 0.5) {
            onScreen.add(v);
            tryPlay(v);
          } else {
            onScreen.delete(v);
            if (!v.paused) v.pause();
          }
        }),
      { threshold: [0, 0.5, 1] }
    );
    vids.forEach((v) => {
      warm.observe(v);
      play.observe(v);
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) onScreen.forEach(tryPlay);
    });
  }

  /* ---------- product page: shipping zone + quantity → live total, email fallback, checkout ---------- */

  const eur = (cents) => "€" + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));

  function initProduct() {
    const out = document.querySelector(".qty-value");
    const link = document.querySelector(".adopt-link");
    const price = document.querySelector(".price[data-unit]");
    if (!out || !link || !price) return;
    const unit = Number(price.dataset.unit);
    const total = document.querySelector(".total-value");
    const mail = link.getAttribute("href");
    const state = { qty: 1, ship: null };
    const zone = () => document.querySelector('input[name="shipping"]:checked');

    function update() {
      const z = zone();
      state.ship = z ? z.value : null;
      const shipCents = z ? Number(z.dataset.amount) : 0;
      out.textContent = String(state.qty);
      if (total) total.textContent = eur(unit * state.qty + shipCents);
      link.setAttribute(
        "href",
        mail
          .replace("Quantity%3A%201", `Quantity%3A%20${state.qty}`)
          .replace("Shipping%3A%20Germany", `Shipping%3A%20${encodeURIComponent(z ? z.dataset.label : "")}`)
      );
    }
    document.querySelectorAll(".qty-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.qty = Math.min(9, Math.max(1, state.qty + Number(btn.dataset.step)));
        update();
      })
    );
    document.querySelectorAll('input[name="shipping"]').forEach((r) => r.addEventListener("change", update));
    update();
    initCheckout(link, state);
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

  function initCheckout(link, state) {
    const key = link.dataset.stripeKey;
    const box = document.getElementById("checkout");
    const note = document.getElementById("checkout-note");
    if (!key || !box || !window.fetch) return;
    const testMode = key.startsWith("pk_test_");
    const chooser = [...document.querySelectorAll(".ship, .buy-row, .adopt-link")];
    const back = document.getElementById("checkout-back");
    let active = null;
    let busy = false;
    if (back)
      back.addEventListener("click", () => {
        if (active) active.destroy();
        active = null;
        box.hidden = true;
        back.hidden = true;
        chooser.forEach((el) => (el.hidden = false));
        link.scrollIntoView({ behavior: motion.matches ? "auto" : "smooth", block: "center" });
      });
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      link.textContent = "One moment";
      if (note) note.hidden = true;
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: state.qty, shipping: state.ship }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.clientSecret) throw new Error(data.error || `Checkout API ${res.status}`);
        const Stripe = await loadStripe();
        const stripe = Stripe(key);
        const init = stripe.initEmbeddedCheckout || stripe.createEmbeddedCheckoutPage;
        if (!init) throw new Error("Stripe.js has no embedded checkout");
        if (active) active.destroy();
        active = await init.call(stripe, { fetchClientSecret: async () => data.clientSecret });
        chooser.forEach((el) => (el.hidden = true));
        if (back) back.hidden = false;
        box.hidden = false;
        active.mount(box);
        box.scrollIntoView({ behavior: motion.matches ? "auto" : "smooth", block: "start" });
      } catch (err) {
        console.error("ÂLF checkout:", err);
        if (testMode && note) {
          // Test mode: show the real reason so it can be fixed. Live mode: quietly use email.
          note.textContent = "Checkout error: " + err.message + " · Check souralf.com/api/health";
          note.hidden = false;
        } else {
          window.location.href = link.getAttribute("href");
        }
      } finally {
        busy = false;
        link.textContent = "Adopt ÂLF";
      }
    });
  }

  initBar();
  initVideo();
  initProduct();
  initReveals();
  initDock();
})();
