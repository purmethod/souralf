// ÂLF: scroll story, reveals, floating adopt button. Vanilla, no dependencies.
(() => {
  const doc = document.documentElement;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  if (!("IntersectionObserver" in window)) {
    doc.classList.remove("js");
    return;
  }

  /* ---------- the transformation: one line per scroll step ---------- */

  function initStory() {
    const section = document.querySelector(".transform");
    if (!section) return;
    const stage = section.querySelector(".transform-stage");
    const steps = [...section.querySelectorAll(".step")];
    let active = -1;
    let raf = 0;

    function update() {
      raf = 0;
      const r = section.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
      stage.style.setProperty("--p", p.toFixed(4));
      const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
      if (idx === active) return;
      if (active >= 0) steps[active].classList.remove("is-active");
      steps[idx].classList.add("is-active");
      steps.forEach((el, k) => el.setAttribute("aria-current", k === idx ? "step" : "false"));
      active = idx;
    }

    const kick = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    update();
  }

  /* ---------- reveals ---------- */

  function initReveals() {
    if (motion.matches) return;
    const els = document.querySelectorAll(".litany li, .section-head, .contents li, .ritual li, .statement .mono-lg");
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
    const blockers = document.querySelectorAll(".hero, .transform, .box-cta, .adopt, .foot");
    if (!dock) return;
    const showing = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? showing.add(e.target) : showing.delete(e.target)));
      dock.classList.toggle("is-visible", showing.size === 0);
    });
    blockers.forEach((el) => io.observe(el));
  }

  initStory();
  initReveals();
  initDock();
})();
