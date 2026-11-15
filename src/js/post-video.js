// Videos in posts: muted, looping, playing only while on screen.
// Nothing downloads until a video is close to the viewport (they're preload="none").
(function () {
  const vids = document.querySelectorAll('.prose video');
  if (!vids.length) return;
  vids.forEach((v) => { v.muted = true; v.loop = true; v.playsInline = true; });

  // Reduced motion (or no observer): no autoplay, so give every video controls.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    vids.forEach((v) => { v.controls = true; });
    return;
  }

  // Start buffering a little before a video scrolls in.
  const near = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.preload = 'auto';
      near.unobserve(e.target);
    });
  }, { rootMargin: '600px 0px' });

  // Play from the start the first time it's mostly on screen; pause when it leaves.
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) {
        if (!v.dataset.started) { v.dataset.started = '1'; v.currentTime = 0; }
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.5 });

  vids.forEach((v) => { near.observe(v); seen.observe(v); });
})();
