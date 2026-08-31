import { setupTerminal, executeAndDisplayCommand } from './apps/terminal.js';
import { setupBlogApp } from './apps/blog.js';
import { setupFinderApp } from './apps/finder.js';
import { setupMailApp } from './apps/mail.js';
import { setupMessagesApp } from './apps/messages.js';
import { setupCalendarApp } from './apps/calendar.js';

let highestZ = 101;

function incrementHighestZ() {
    return ++highestZ;
}

function updateCalendarIcon() {
    const now = new Date();
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", 
                       "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const monthName = monthNames[now.getMonth()];
    const dayNumber = now.getDate();
    
    const calendarIcon = document.querySelector('.dock-icon-calendar');
    if (calendarIcon) {
        const svgContent = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="white"/><path d="M0 28C0 12.5 12.5 0 28 0H100C115.5 0 128 12.5 128 28V40H0V28Z" fill="%23f85149"/><text x="64" y="32" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="24" fill="white" text-anchor="middle" font-weight="bold">${monthName}</text><text x="64" y="100" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="70" fill="black" text-anchor="middle" font-weight="300">${dayNumber}</text></svg>`;
        calendarIcon.style.backgroundImage = `url('${svgContent}')`;
    }
}

function updateDockVisibility() {
    const dock = document.querySelector('.dock');
    if (dock) {
        dock.style.opacity = '1';
        dock.style.visibility = 'visible';
    }
}

function makeWindowDraggable(appWindow, handleSelector) {
    const header = appWindow.querySelector(handleSelector);
    if (!header) return;
    let isDragging = false, offsetX, offsetY;

    const bringToFront = () => appWindow.style.zIndex = incrementHighestZ();
    appWindow.addEventListener('mousedown', bringToFront);

    header.addEventListener('mousedown', (e) => {
        if (appWindow.classList.contains('maximized')) return;
        isDragging = true;
        
        const computedStyle = window.getComputedStyle(appWindow);
        if (computedStyle.transform !== 'none') {
            const rect = appWindow.getBoundingClientRect();
            appWindow.style.left = `${rect.left}px`;
            appWindow.style.top = `${rect.top}px`;
            appWindow.style.transform = 'none';
        }

        offsetX = e.clientX - appWindow.offsetLeft;
        offsetY = e.clientY - appWindow.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            appWindow.style.left = `${e.clientX - offsetX}px`;
            appWindow.style.top = `${e.clientY - offsetY}px`;
        }
    });

    document.addEventListener('mouseup', () => isDragging = false);
}

function setupAppWindows() {
    document.querySelectorAll('.app-window').forEach(appWindow => {
        makeWindowDraggable(appWindow, '.app-header');

        const hideWindow = (e) => {
            e.stopPropagation();
            appWindow.classList.add('hidden');
            updateDockVisibility();
        };

        appWindow.querySelector('.app-button.close').addEventListener('click', hideWindow);
        appWindow.querySelector('.app-button.minimize').addEventListener('click', hideWindow);
        
        appWindow.querySelector('.app-button.maximize').addEventListener('click', (e) => {
            e.stopPropagation();
            appWindow.classList.toggle('maximized');
            updateDockVisibility();
        });
    });
}

function setupDockApps() {
    document.querySelectorAll('.dock-item[data-app]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const appId = item.getAttribute('data-app');
            const isTerminal = appId === 'terminal-main';
            const appWindow = isTerminal ? document.querySelector('.terminal') : document.getElementById(appId);
            
            if (appWindow) {
                appWindow.classList.remove('hidden');
                appWindow.style.zIndex = incrementHighestZ();
                updateDockVisibility();

                // If opening messages, ensure it's scrolled to the bottom
                if (appId === 'messages-app') {
                    const messagesList = document.getElementById('messages-list');
                    if (messagesList) {
                        setTimeout(() => {
                            messagesList.scrollTop = messagesList.scrollHeight;
                        }, 10); // Use a tiny delay to allow the DOM to update
                    }
                }

                // If opening calendar, scroll to current time
                if (appId === 'calendar-app') {
                    if (window.onCalendarAppOpened) {
                        window.onCalendarAppOpened();
                    }
                }
            }
        });
    });
}

function revealInitialContent() {
    const terminalBody = document.querySelector('.terminal-body');
    const lines = document.querySelectorAll('.line[class*="delay-"]');
    const delayBetweenLines = 400; 
    let lastDelay = 0;

    lines.forEach((line, index) => {
        const delay = index * delayBetweenLines;
        setTimeout(() => {
            line.classList.add('visible');
            if(terminalBody) terminalBody.scrollTop = terminalBody.scrollHeight;
        }, delay);
        lastDelay = delay;
    });

    setTimeout(() => {
        document.querySelector('.terminal-footer').classList.add('visible');
        document.querySelector('.command-suggestions').classList.add('visible');
        document.querySelector('.interactive-prompt').classList.add('visible');
        
        // Focus command input via terminal module
        const commandInput = document.getElementById('commandInput');
        if (commandInput) {
            commandInput.focus();
        }

        setTimeout(() => {
            if(terminalBody) terminalBody.scrollTop = terminalBody.scrollHeight;
        }, 100);
    }, lastDelay + 500);
}


document.addEventListener('DOMContentLoaded', () => {
    const terminalBody = document.querySelector('.terminal-body');
    if(terminalBody) terminalBody.scrollTop = 0;
    
    // Update calendar icon with current date
    updateCalendarIcon();
    
    // Update calendar icon daily at midnight
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0) - now;
    setTimeout(() => {
        updateCalendarIcon();
        // Set up daily interval after the first midnight update
        setInterval(updateCalendarIcon, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
    
    revealInitialContent();

    // Setup Core OS functionality
    setupAppWindows();
    setupDockApps();

    // Setup Apps
    setupTerminal(makeWindowDraggable, updateDockVisibility, incrementHighestZ);
    setupBlogApp();
    setupFinderApp(executeAndDisplayCommand, updateDockVisibility, () => highestZ, incrementHighestZ);
    setupMailApp();
    setupMessagesApp();
    setupCalendarApp();

    document.addEventListener('click', (e) => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        ('ontouchstart' in window) || 
                        (window.innerWidth <= 768);
        const isSuggestionButton = e.target.closest('.suggestion-btn');
        
        if (!e.target.closest('.app-window') && !e.target.closest('.dock') && !isSuggestionButton && !isMobile) {
            document.getElementById('commandInput')?.focus();
        }
    });

    document.querySelectorAll('.dock-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            const prev = item.previousElementSibling;
            if (prev?.classList.contains('dock-item')) prev.classList.add('prev-hover');
        });
        item.addEventListener('mouseleave', () => {
            const prev = item.previousElementSibling;
            if (prev?.classList.contains('dock-item')) prev.classList.remove('prev-hover');
        });
    });
});