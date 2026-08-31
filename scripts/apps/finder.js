export function setupFinderApp(executeAndDisplayCommand, updateDockVisibility, getHighestZ, incrementHighestZ) {
    const finderContent = document.querySelector('.finder-content');
    const backButton = document.getElementById('finder-back-button');
    const homeButton = document.querySelector('.finder-sidebar li:not(#finder-back-button)');
    const appTitle = document.querySelector('#finder-app .app-title');
    let currentDir = 'home';

    const homeItems = { 'work': 'folder', 'about.txt': 'file', 'README.md': 'file' };
    const workItems = { 'logeix.md': 'file', 'rosser.md': 'file', 'consulting_history.log': 'file' };

    function render(dir) {
        currentDir = dir;
        finderContent.innerHTML = '';
        appTitle.textContent = dir;
        backButton.style.display = dir === 'home' ? 'none' : 'flex';

        const items = dir === 'home' ? homeItems : workItems;

        Object.entries(items).forEach(([name, type]) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'finder-item';
            itemEl.dataset.name = name;
            itemEl.dataset.type = type;
            itemEl.innerHTML = `<div class="finder-icon ${type}"></div><span>${name}</span>`;
            finderContent.appendChild(itemEl);
        });
    }

    finderContent.addEventListener('click', e => {
        const item = e.target.closest('.finder-item');
        if (!item) return;

        const itemName = item.dataset.name;
        const itemType = item.dataset.type;

        if (itemType === 'folder') {
            render(itemName);
        } else {
            const pathPrefix = currentDir === 'home' ? '' : currentDir + '/';
            const command = `cat ${pathPrefix}${itemName}`;

            const terminalWindow = document.querySelector('.terminal');
            terminalWindow.classList.remove('hidden');
            terminalWindow.style.zIndex = incrementHighestZ();
            executeAndDisplayCommand(command);

            const finderWindow = document.getElementById('finder-app');
            finderWindow.classList.add('hidden');
            updateDockVisibility();
        }
    });

    backButton.addEventListener('click', () => render('home'));
    homeButton.addEventListener('click', () => {
        if (currentDir !== 'home') {
            render('home');
        }
    });

    // Initial render
    render('home');
}
