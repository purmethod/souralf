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

  /* ---------- the ÂLF video: no motion for people who asked for none ---------- */

  function initVideo() {
    document.querySelectorAll("video[autoplay]").forEach((v) => {
      if (motion.matches) {
        v.removeAttribute("autoplay");
        v.pause();
      }
    });
  }

  /* ---------- product page: quantity goes into the adoption email ---------- */

  function initQuantity() {
    const out = document.querySelector(".qty-value");
    const link = document.querySelector(".adopt-link");
    if (!out || !link) return;
    const base = link.getAttribute("href");
    let n = 1;
    document.querySelectorAll(".qty-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        n = Math.min(9, Math.max(1, n + Number(btn.dataset.step)));
        out.textContent = String(n);
        link.setAttribute("href", base.replace("Quantity%3A%201", `Quantity%3A%20${n}`));
      })
    );
  }

  initVideo();
  initQuantity();
  initReveals();
  initDock();
})();
