let commandHistory = [];
let historyIndex = -1;

// This will be initialized in setupTerminal
let terminalBody;

const commands = {
    help: () => `<div class="help-output">
Available commands:
<div class="command-links">
- <span class="clickable-command" data-command="whoami">whoami</span>       Show information about me
- <span class="clickable-command" data-command="partner">partner</span>      Information about partnering with me
- <span class="clickable-command" data-command="clear">clear</span>        Clear the terminal
- <span class="clickable-command" data-command="books">books</span>        Reading list and recommendations
- <span class="clickable-command" data-command="highlights">highlights</span>   See a random book highlight
- <span class="clickable-command" data-command="stack">stack</span>        Tools and apps I use
- <span class="clickable-command" data-command="travel">travel</span>       Places I've been
- <span class="clickable-command" data-command="weather">weather</span>      Current conditions in Saigon
- <span class="clickable-command" data-command="uptime">uptime</span>       How long I've been doing this
- <span class="clickable-command" data-command="projects">projects</span>     Side projects and experiments
- <span class="clickable-command" data-command="history">history</span>      Show command history
- <span class="clickable-command" data-command="ls">ls</span>           List files
- <span class="clickable-command" data-command="pwd">pwd</span>          Show current directory
- <span class="clickable-command" data-command="date">date</span>         Show current date
- <span class="clickable-command" data-command="cat">cat</span>          Read file contents
</div>
</div>`,

    clear: () => {
        setTimeout(() => {
            if (terminalBody) terminalBody.innerHTML = '';
        }, 10);
        return '';
    },
    
    highlights: () => {
        const highlights = [
            "\"Every time we hire someone, he or she should raise the bar for the next hire, so that the overall talent pool is always improving.\" - The Everything Store: Jeff Bezos and the Age of Amazon",
            "\"Just remember, when they say, 'No,' you hear 'Yes,' and act accordingly. Someone says to you, 'We can't do this movie,' you hug him and say, 'Thank you for believing in me.'\" - Total Recall: My Unbelievably True Life Story",
            "\"If it flies, floats or fornicates, always rent it - it's cheaper in the long run\" - How To Get Rich",
            "\"The cowards never started and the weak died along the way—that leaves us.\" - Shoe Dog: A Memoir by the Creator of Nike",
            "\"What upsets people is not things themselves but their judgements about these things.\" - Happy: Why More or Less Everything is Absolutely Fine",
            "\"If we happen to err (which is human) and hire someone with bad values, we better hope they also have a bad mind and work ethic. The worst employee is an energetic evil genius.\" - Good Profit: How Creating Value for Others Built One of the World's Most Successful Companies",
            "\"Work with the best people. If you have the best writers, the best actors, and the best director and fail, okay, fine, there is even something noble in it; but if you fail with garbage, then you are left with nothing to hang your spirits on. Besides, life is too short to be spent in the company of morons.\" - When I Stop Talking, You'll Know I'm Dead",
            "\"Fear is the little death, death by a thousand cuts\" - How To Get Rich",
            "\"The safest way to try to get what you want is to try to deserve what you want. It's such a simple idea. It's the golden rule. You want to deliver to the world what you would buy if you were on the other end.\" - Poor Charlie's Almanack",
            "\"So many people have become rich despite never having had a single great idea in their lives. As it happens, I count myself among them.\" - How To Get Rich",
            "\"Past events will always look less random than they were (it is called the hindsight bias)\" - Fooled by Randomness",
        ];
        return highlights[Math.floor(Math.random() * highlights.length)];
    },
    
    books: () => `Current reads and recommendations:
- The Skeptic's Guide to the Universe (Steven Novella, MD)
- How To Get Rich (Felix Dennis)
- Poor Charlie's Almanack (Charles Munger)
- Never Enough (Andrew Wilkinson)
- Against the Odds (James Dyson)
- The Invisible Billionaire: Daniel Ludwig (Jerry Shields)

Not in any particular order, nor my favourites, just recent reads I've enjoyed.`,
    
    stack: () => `Tools and apps I actually use:
- CleanShot X (screenshots)
- ScreenMemory (searchable history of everything you've done)
- Qbserve (time tracking)
- Cursor (AI code editor)
- Mimestream (email)
- Logeix Lab (our browser extension)
- Ahrefs (SEO tools)
- NotePlan (note-taking with calendar integration)
- Claude & Gemini Pro (my fav LLMs)
- Slack Business (team comms)
- Google Workspace (email, docs, sheets, etc)
- Kit (email marketing)
- Lunar (sync laptop with display brightness)
- Arc Browser (chromium browser but better)`,
    
    travel: () => `ls ~/memories/
hcmc/          hanoi/         bangkok/      singapore/
kuala-lumpur/  bali/          perth/        sydney/
paris/         edinburgh/     osaka/        nyc/
...and a few more directories`,
    
    weather: () => "Hot... always hot. Welcome to Saigon. 🌡️",
    
    uptime: () => `SEO: 10+ years
Vietnam: ${new Date().getFullYear() - 2016} years
Building things: Still going...`,
    
    projects: () => `Recent and past projects:
- Rosser Brothers (current) - Holdco
- Logeix (current) - Shopify SEO agency
- Blindstyle (current) - DTC brand
- Previous: SEO podcast (720,000+ views/downloads)
- Ancient history: Facebook Gaming sites, Viral Social Sites (8M+ fans), Lead Generation Network`,
    
    whoami: () => `Daryl Hensman-Rosser
Currently based in Ho Chi Minh City, Vietnam`,
    
    partner: () => `If you'd like a small active investor (local service businesses, DTC brands, etc), please use the contact link in the dock below.<br><br>If you're interested in hiring me as a fractional CMO (from $5,000/mo), please use the contact link in the dock below.<br><br>If you'd like SEO consulting, try my agency at <a href="https://logeix.com" target="_blank">Logeix.com</a>.`,
    
    history: () => commandHistory.join('\n'),
    
    ls: (args) => {
        if (args === '-la work/' || args === '-la work') {
            return `total 4
drwxr-xr-x  2 dhr  dhr   512 Jun 20 15:30 .
drwxr-xr-x  3 dhr  dhr   512 Jun 20 15:30 ..
-rw-r--r--  1 dhr  dhr   1.2K Jun 20 15:30 logeix.md
-rw-r--r--  1 dhr  dhr   0.8K Jun 20 15:30 rosser.md
-rw-r--r--  1 dhr  dhr   2.1K Jun 15 09:15 consulting_history.log`;
        } else if (args === '-la' || args === '-l') {
            return `total 8
drwxr-xr-x  3 dhr  dhr   512 Jun 20 15:30 .
drwxr-xr-x  3 dhr  dhr   512 Jun 20 15:30 ..
-rw-r--r--  1 dhr  dhr   2.1K Jun 20 15:30 about.txt
drwxr-xr-x  2 dhr  dhr   512 Jun 20 15:30 work
-rw-r--r--  1 dhr  dhr   0.8K Jun 20 15:30 README.md`;
        } else if (args === 'work/' || args === 'work') {
            return `logeix.md  rosser.md  consulting_history.log`;
        } else {
            return `about.txt  work/  contact.disabled  README.md`;
        }
    },
    
    pwd: () => "/home/dhr",
    
    date: () => {
        const now = new Date();
        const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
        return vietnamTime.toString().replace(/GMT.*/, 'ICT (Indochina Time)');
    },
    
    cat: (args) => {
        if (args === 'about.txt') {
            return "I've spent the last decade in the SEO world, consulting with fast growing e-commerce brands and marketing agencies.\n\nEntered the business world in 2009, growing a viral Facebook Page up to 8 million \"fans\" organically, and driving millions of visitors to my affiliate sites.\n\nThese days I run a few small digital marketing ventures remotely from Vietnam. Entirely self-funded, simple cashflowing businesses. Fully remote team in 5 countries. Lots and lots of AI use.";
        } else if (args === 'work/logeix.md') {
            return "# Logeix\n\nLogeix (logeix.com) is my Shopify SEO agency focused on helping e-commerce brands grow through organic search. We work with established stores looking to scale their revenue through technical SEO, content strategy, and search optimization.";
        } else if (args === 'work/rosser.md') {
            return "# Rosser Brothers\n\nRosser Brothers (rosser.com) is my holding company for various marketing ventures. Currently includes an agency, an e-commerce brand, and other projects I'm building.";
        } else if (args === 'work/consulting_history.log') {
            return "[2024-06-15] 8-figure fashion brand - technical SEO audit complete\n[2024-05-28] 7-figure supplements brand - content strategy implementation\n[2024-04-12] Major Shopify Plus store - site migration SEO\n[2024-03-20] International beauty brand - multi-region SEO setup\n[2023-12-10] Large electronics retailer - Core Web Vitals optimization\n...\n[2015-01-20] First major e-commerce client - the beginning";
        } else if (args === 'README.md') {
            return "# DHR\n\nPersonal site of Daryl Hensman-Rosser\n\n## About\nBritish guy based in Ho Chi Minh City, Vietnam. Working remotely on Rosser Brothers (holdco) and Logeix (Shopify SEO agency).\n\n## Commands\nThis site works like a terminal. Try typing 'help' to see available commands.\n\n## Contact\nTry the contact form in the dock.";
        }
        return `cat: ${args}: No such file or directory`;
    },
    
    sudo: () => "Nice try, but you're not root here 😉",
    
    'rm -rf': () => "A bit drastic, don't you think? Let's just pretend that didn't happen.",

    exit: () => "Thanks for stopping by!",
    
    logout: () => "You can check out any time you like...",
    
    'ps aux': () => `USER       PID  %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
dhr        1854  2.1  1.2  98234 12456 pts/0    S+   09:15   0:42 logeix_seo_engine
dhr        2901  0.8  0.5  45123  5234 pts/1    S    10:30   0:12 rosser_bros_admin
dhr        3456  1.5  0.8  67890  8123 pts/2    R    11:45   0:05 tech_seo_strategy
dhr        4021  0.3  0.2  23456  2345 pts/3    S    12:00   0:01 email_thinking
dhr        4892  0.0  0.1  12345  1234 pts/4    S    14:30   0:00 terminal_browsing`,
    
    ps: () => `  PID TTY          TIME CMD
 1854 pts/0    00:00:42 logeix_seo_engine
 2901 pts/1    00:00:12 rosser_bros_admin
 3456 pts/2    00:00:05 tech_seo_strategy
 4021 pts/3    00:00:01 email_thinking
 4892 pts/4    00:00:00 terminal_browsing`
};

function executeCommand(input) {
    const trimmedInput = input.trim();
    const [command, ...args] = trimmedInput.split(' ');
    commandHistory.push(input);
    
    if (commands[trimmedInput]) return commands[trimmedInput]();
    if (commands[command]) return commands[command](args.join(' '));
    if (trimmedInput === '') return '';
    return `Command not found: ${command}. Type 'help' for available commands.`;
}

function addCommandToTerminal(command, output) {
    const commandLine = document.createElement('div');
    commandLine.className = 'line visible';
    commandLine.innerHTML = `<span class="prompt">dhr@vietnam:~$</span> <span class="command">${command}</span>`;
    terminalBody.appendChild(commandLine);
    
    if (output) {
        const outputLine = document.createElement('div');
        outputLine.className = 'line output visible';
        if (output.includes('\n')) {
            outputLine.classList.add('preformatted');
        }
        outputLine.innerHTML = output;
        terminalBody.appendChild(outputLine);
        
        // Add event listeners for clickable commands if this is help output
        if (output.includes('clickable-command')) {
            outputLine.querySelectorAll('.clickable-command').forEach(clickableCommand => {
                clickableCommand.addEventListener('click', () => {
                    const commandToExecute = clickableCommand.dataset.command;
                    
                    // Special handling for cat command - put it in input with space
                    if (commandToExecute === 'cat') {
                        const input = document.getElementById('commandInput');
                        if (input) {
                            input.value = 'cat ';
                            input.focus();
                            // Position cursor at the end
                            input.setSelectionRange(4, 4);
                        }
                    } else {
                        executeAndDisplayCommand(commandToExecute);
                    }
                });
            });
        }
    }
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

function handleKeydown(e) {
    const input = e.target;
    if (e.key === 'Enter') {
        e.preventDefault();
        executeAndDisplayCommand(input.value);
        input.value = '';
        historyIndex = -1;
    } else if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        addCommandToTerminal(input.value + '^C', '');
        input.value = '';
        historyIndex = -1;
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            input.value = commandHistory[commandHistory.length - 1 - historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            input.value = commandHistory[commandHistory.length - 1 - historyIndex];
        } else if (historyIndex === 0) {
            historyIndex = -1;
            input.value = '';
        }
    }
}

function handleKeypress(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        const input = e.target;
        executeAndDisplayCommand(input.value);
        input.value = '';
        historyIndex = -1;
    }
}

export function executeAndDisplayCommand(command) {
    const lowercaseCommand = command.toLowerCase();
    const output = executeCommand(lowercaseCommand);
    addCommandToTerminal(command, output);
}

function setupSuggestionButtons() {
    document.querySelectorAll('.suggestion-btn').forEach(button => {
        button.addEventListener('click', () => {
            executeAndDisplayCommand(button.dataset.command);
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                           ('ontouchstart' in window) || 
                           (window.innerWidth <= 768);
            if (!isMobile) {
                document.getElementById('commandInput').focus();
            }
        });
    });
}

function setupCommandInput() {
    const input = document.getElementById('commandInput');
    if (!input) return;
    
    input.addEventListener('keydown', handleKeydown);
    input.addEventListener('keypress', handleKeypress);
    input.focus();
}

export function setupTerminal(makeWindowDraggable, updateDockVisibility, incrementHighestZ) {
    terminalBody = document.querySelector('.terminal-body');
    setupCommandInput();
    setupSuggestionButtons();

    const terminal = document.querySelector('.terminal');
    const closeBtn = terminal.querySelector('.terminal-button.close');
    const minimizeBtn = terminal.querySelector('.terminal-button.minimize');
    const maximizeBtn = terminal.querySelector('.terminal-button.maximize');
    const terminalDockItem = document.querySelector('.dock-icon-terminal')?.closest('.dock-item');

    if (!terminal || !closeBtn || !minimizeBtn || !maximizeBtn || !terminalDockItem) {
        console.error("Terminal control elements not found");
        return;
    }

    makeWindowDraggable(terminal, '.terminal-header');

    const hideTerminal = e => {
        e.stopPropagation();
        terminal.classList.add('hidden');
        updateDockVisibility();
    };

    closeBtn.addEventListener('click', hideTerminal);
    minimizeBtn.addEventListener('click', hideTerminal);

    maximizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        terminal.classList.toggle('maximized');
        updateDockVisibility();
    });

    terminalDockItem.addEventListener('click', () => {
        terminal.classList.remove('hidden');
        terminal.style.zIndex = incrementHighestZ();
        updateDockVisibility();
    });
}
