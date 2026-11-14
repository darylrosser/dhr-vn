// Theme button: the site follows your system (auto) until you click. A click
// flips to the opposite of what you're seeing (dark → paper, paper → dark).
// Flipping back to what your system wants returns to auto.
(function () {
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');
  if (!button) return;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  const system = () => (systemDark.matches ? 'night' : 'paper');
  const showing = () => root.dataset.theme || system();

  const render = () => {
    const next = showing() === 'night' ? 'light' : 'dark';
    button.setAttribute('aria-label', `Switch to ${next} mode`);
    button.title = `Switch to ${next} mode`;
  };

  button.addEventListener('click', () => {
    const next = showing() === 'night' ? 'paper' : 'night';
    const auto = next === system();
    if (auto) delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (auto) localStorage.removeItem('dhr-theme');
      else localStorage.setItem('dhr-theme', next);
    } catch (e) { /* private mode etc: theme just won't persist */ }
    render();
  });

  systemDark.addEventListener('change', render);
  render();
})();
