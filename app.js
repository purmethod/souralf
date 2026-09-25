// ÂLF: the original photographs, one real moment at a time.
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const shortScreen = window.matchMedia('(max-height: 650px)');
  const story = document.querySelector('.story');
  const frames = [...document.querySelectorAll('.story-frame')];
  const controls = [...document.querySelectorAll('[data-moment]')];
  let active = -1;
  let enhanced = false;
  let storyVisible = false;

  function syncVideo() {
    story?.querySelectorAll('video').forEach(video => {
      const visible = !enhanced || video.closest('.story-frame').classList.contains('is-active');
      if (storyVisible && visible && !reducedMotion.matches) video.play().catch(() => {});
      else video.pause();
    });
  }

  function selectMoment(index) {
    if (active === index) return;
    frames.forEach((frame, i) => {
      frame.classList.toggle('is-active', i === index);
      if (enhanced) frame.setAttribute('aria-hidden', String(i !== index));
      else frame.removeAttribute('aria-hidden');
    });
    controls.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    active = index;
    syncVideo();
  }

  function configureStory() {
    if (!story || !frames.length) return;
    enhanced = !reducedMotion.matches && !shortScreen.matches;
    story.classList.toggle('story-ready', enhanced);
    active = -1;
    if (enhanced) selectMoment(0);
    else {
      frames.forEach(frame => frame.removeAttribute('aria-hidden'));
      selectMoment(0);
    }
  }

  controls.forEach((button, index) => {
    button.addEventListener('click', () => {
      if (!enhanced) return;
      selectMoment(index);
    });
  });
  reducedMotion.addEventListener('change', configureStory);
  shortScreen.addEventListener('change', configureStory);
  configureStory();

  if (story && 'IntersectionObserver' in window) {
    const videoVisibility = new IntersectionObserver(entries => {
      storyVisible = entries.some(entry => entry.isIntersecting);
      syncVideo();
    }, {threshold: 0.15});
    videoVisibility.observe(story);
  }

  // Preserve the product page's quantity in the existing adoption email.
  const quantity = document.querySelector('.qty-value');
  const adoption = document.querySelector('.adopt-link');
  if (quantity && adoption) {
    const base = adoption.getAttribute('href');
    let amount = 1;
    document.querySelectorAll('.qty-btn').forEach(button => {
      button.addEventListener('click', () => {
        amount = Math.min(9, Math.max(1, amount + Number(button.dataset.step)));
        quantity.textContent = String(amount);
        adoption.setAttribute('href', base.replace('Quantity%3A%201', `Quantity%3A%20${amount}`));
      });
    });
  }

  // Fetch the remaining moments before they enter the photo stage.
  if (story && 'IntersectionObserver' in window) {
    const preload = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      story.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
      preload.disconnect();
    }, {rootMargin: '100% 0px'});
    preload.observe(story);
  }

  // The floating action is keyboard accessible only while it is visible.
  const dock = document.querySelector('.dock');
  if (dock && 'IntersectionObserver' in window) {
    const visibleSections = new Set();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? visibleSections.add(entry.target) : visibleSections.delete(entry.target));
      const visible = visibleSections.size === 0;
      dock.classList.toggle('is-visible', visible);
      dock.setAttribute('aria-hidden', String(!visible));
      dock.tabIndex = visible ? 0 : -1;
    });
    document.querySelectorAll('.hero, .story, .box, .product, .foot').forEach(section => observer.observe(section));
  }
})();
