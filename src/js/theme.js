// Reader theme toggle: auto (follow the system) → paper → night → auto.
(function () {
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');
  if (!button) return;
  const label = button.querySelector('.theme-toggle-label');
  const order = ['auto', 'paper', 'night'];

  const current = () => root.dataset.theme || 'auto';
  const render = () => {
    label.textContent = current();
    button.setAttribute('aria-label', `Colour theme: ${current()}. Click to change.`);
  };

  button.addEventListener('click', () => {
    const next = order[(order.indexOf(current()) + 1) % order.length];
    if (next === 'auto') delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === 'auto') localStorage.removeItem('dhr-theme');
      else localStorage.setItem('dhr-theme', next);
    } catch (e) { /* private mode etc: theme just won't persist */ }
    render();
  });

  render();
})();
