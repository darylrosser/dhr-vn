const defaultNotes = {
    welcome: { 
        title: "Welcome to My Blog", 
        body: "I have all of ONE post, and it's barely even a blog post, but I may add more later.\n\nClick a post on the left to read an excerpt, then follow the link to read the full article.\n\nFeel free to edit these notes or add your own thoughts." 
    },
    'book-hunting': { 
        title: "Book Hunting in Saigon", 
        body: "My fiancée and I have been having a lot of fun recently hunting for second-hand books in Saigon. So far we've found 8 places, with a few of these having multiple stores on one street. Here's a list of all, along with my personal purchases.",
        url: '/blog/english-books-saigon'
    }
};

let currentNoteId = 'welcome';
let noteCounter = 0;
let currentNotes = { ...defaultNotes }; // Work with in-memory copy
let userNotes = {}; // Track user-created notes separately
let isNewNoteWithDefaultTitle = false; // Track if current note has default title that should be cleared
let isNewNoteWithDefaultBody = false; // Track if current note has default body that should be cleared

export function setupBlogApp() {
    const noteLinks = document.querySelectorAll('.notes-sidebar li');
    const titleEl = document.getElementById('note-title-area');
    const bodyEl = document.getElementById('note-body-area');
    const addNoteBtn = document.getElementById('add-note-btn');
    const deleteNoteBtn = document.getElementById('delete-note-btn');
    const formatBtns = document.querySelectorAll('.format-btn');
    const notesList = document.querySelector('.notes-sidebar ul');
    
    // Make elements editable
    titleEl.contentEditable = true;
    bodyEl.contentEditable = true;
    
    // Load user notes from sessionStorage
    function loadUserNotes() {
        const saved = sessionStorage.getItem('dhr-user-notes');
        if (saved) {
            try {
                const parsedNotes = JSON.parse(saved);
                userNotes = parsedNotes.notes || {};
                noteCounter = parsedNotes.counter || 0;
                
                // Add user notes to current notes and sidebar
                Object.keys(userNotes).forEach(noteId => {
                    currentNotes[noteId] = userNotes[noteId];
                    
                    // Create sidebar item
                    const noteItem = document.createElement('li');
                    noteItem.textContent = userNotes[noteId].title;
                    noteItem.dataset.note = noteId;
                    noteItem.addEventListener('click', () => loadNote(noteId));
                    notesList.appendChild(noteItem);
                });
            } catch (e) {
                console.log('Error loading user notes:', e);
            }
        }
    }
    
    // Save user notes to sessionStorage
    function saveUserNotes() {
        sessionStorage.setItem('dhr-user-notes', JSON.stringify({
            notes: userNotes,
            counter: noteCounter
        }));
    }
    
    // Check if a note is user-created
    function isUserNote(noteId) {
        return userNotes.hasOwnProperty(noteId);
    }
    
    // Load note content
    function loadNote(id) {
        if (currentNotes[id]) {
            currentNoteId = id;
            titleEl.textContent = currentNotes[id].title;
            
            // Clear body content first
            bodyEl.innerHTML = '';
            
            // Reset the new note defaults flags when switching notes
            isNewNoteWithDefaultTitle = false;
            isNewNoteWithDefaultBody = false;
            
            // Check if default note has URL
            const defaultNote = defaultNotes[id];
            const hasUrl = defaultNote && defaultNote.url;
            
            if (hasUrl) {
                // For blog posts with URLs, show the content and add read more link
                bodyEl.innerHTML = currentNotes[id].body.replace(/\n/g, '<br>') + '<br><br>';
                
                const linkElement = document.createElement('a');
                linkElement.href = defaultNote.url;
                linkElement.textContent = 'Read the full post →';
                linkElement.className = 'read-more-link';
                linkElement.target = '_blank';
                linkElement.contentEditable = false;
                
                bodyEl.appendChild(linkElement);
            } else {
                // For user notes, preserve newlines properly
                if (isUserNote(id)) {
                    // Escape HTML and convert newlines to <br> tags
                    const escapedContent = currentNotes[id].body
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/\n/g, '<br>');
                    bodyEl.innerHTML = escapedContent;
                } else {
                    bodyEl.textContent = currentNotes[id].body;
                }
            }
            
            // Update active state
            const allLinks = document.querySelectorAll('.notes-sidebar li');
            allLinks.forEach(link => link.classList.toggle('active-note', link.dataset.note === id));
            
            // Update delete button state
            updateDeleteButton();
        }
    }
    
    // Clear default content when user starts typing
    function clearDefaultTitle() {
        if (isNewNoteWithDefaultTitle) {
            titleEl.textContent = '';
            isNewNoteWithDefaultTitle = false; // Only clear once
        }
    }
    
    function clearDefaultBody() {
        if (isNewNoteWithDefaultBody) {
            // Clear if it's still the default content (be more flexible with comparison)
            const currentText = bodyEl.textContent.trim();
            if (currentText === 'Start writing your note here...' || currentText === '') {
                bodyEl.textContent = '';
                isNewNoteWithDefaultBody = false; // Only clear once
            }
        }
    }

    // Update sidebar title when main title changes
    function updateSidebarTitle() {
        const activeLink = document.querySelector(`.notes-sidebar li[data-note="${currentNoteId}"]`);
        if (activeLink) {
            const newTitle = titleEl.textContent.trim() || 'Untitled';
            activeLink.textContent = newTitle;
            // Update in-memory copy
            if (currentNotes[currentNoteId]) {
                currentNotes[currentNoteId].title = newTitle;
                // Save to sessionStorage if it's a user note
                if (isUserNote(currentNoteId)) {
                    userNotes[currentNoteId].title = newTitle;
                    saveUserNotes();
                }
            }
        }
    }
    
    // Update delete button state
    function updateDeleteButton() {
        // Allow deleting all notes - they don't persist anyway
        deleteNoteBtn.disabled = false;
    }
    
    // Get clean text content preserving newlines
    function getCleanTextContent(element) {
        // Clone the element to avoid modifying the original
        const tempDiv = element.cloneNode(true);
        
        // Remove read more links if they exist
        const readMoreLink = tempDiv.querySelector('.read-more-link');
        if (readMoreLink) {
            readMoreLink.remove();
        }
        
        // Use a more robust method to extract text with proper newlines
        let result = '';
        
        // Walk through all child nodes
        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                result += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'BR') {
                    result += '\n';
                } else if (node.tagName === 'DIV' && result.length > 0 && !result.endsWith('\n')) {
                    // DIV creates a line break if it's not the first element
                    result += '\n';
                    // Process children
                    for (let child of node.childNodes) {
                        processNode(child);
                    }
                } else {
                    // Process children for other elements
                    for (let child of node.childNodes) {
                        processNode(child);
                    }
                }
            }
        }
        
        for (let child of tempDiv.childNodes) {
            processNode(child);
        }
        
        return result;
    }
    
    // Normalize contentEditable content to ensure consistent newline handling
    function normalizeContent() {
        if (currentNotes[currentNoteId] && isUserNote(currentNoteId)) {
            // Get the current content and re-set it to normalize
            const content = getCleanTextContent(bodyEl);
            if (content !== currentNotes[currentNoteId].body) {
                const escapedContent = content
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br>');
                
                // Store cursor position
                const selection = window.getSelection();
                const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
                const cursorOffset = range ? range.startOffset : 0;
                const anchorNode = range ? range.startContainer : null;
                
                // Update content
                bodyEl.innerHTML = escapedContent;
                
                // Restore cursor position (simplified)
                try {
                    if (anchorNode && bodyEl.contains(anchorNode)) {
                        const newRange = document.createRange();
                        newRange.setStart(anchorNode, Math.min(cursorOffset, anchorNode.textContent?.length || 0));
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                } catch (e) {
                    // Cursor restoration failed, place at end
                    const range = document.createRange();
                    range.selectNodeContents(bodyEl);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        }
    }

    // Add event listeners
    titleEl.addEventListener('keydown', (e) => {
        // Clear default title when user starts typing
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
            clearDefaultTitle();
        }
    });
    
    titleEl.addEventListener('input', updateSidebarTitle);
    
    bodyEl.addEventListener('focus', clearDefaultBody);
    bodyEl.addEventListener('click', clearDefaultBody);
    
    bodyEl.addEventListener('input', () => {
        // Update in-memory content
        if (currentNotes[currentNoteId]) {
            const cleanContent = getCleanTextContent(bodyEl);
            currentNotes[currentNoteId].body = cleanContent;
            
            // Save to sessionStorage if it's a user note
            if (isUserNote(currentNoteId)) {
                userNotes[currentNoteId].body = cleanContent;
                saveUserNotes();
            }
        }
    });
    
    // Normalize content on blur to ensure consistency
    bodyEl.addEventListener('blur', normalizeContent);
    
    // Handle note switching
    noteLinks.forEach(link => {
        link.addEventListener('click', () => loadNote(link.dataset.note));
    });
    
    // Handle focus and blur for better UX
    titleEl.addEventListener('focus', () => titleEl.classList.add('editing'));
    titleEl.addEventListener('blur', () => titleEl.classList.remove('editing'));
    bodyEl.addEventListener('focus', () => bodyEl.classList.add('editing'));
    bodyEl.addEventListener('blur', () => bodyEl.classList.remove('editing'));
    
    // Prevent Enter key from creating new lines in title
    titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            bodyEl.focus();
        }
    });
    
    // Create new note function
    function createNewNote() {
        noteCounter++;
        const newNoteId = `new-note-${noteCounter}`;
        const newNoteTitle = `New Note ${noteCounter}`;
        
        const newNote = {
            title: newNoteTitle,
            body: 'Start writing your note here...'
        };
        
        // Add to both in-memory notes and user notes
        currentNotes[newNoteId] = newNote;
        userNotes[newNoteId] = { ...newNote };
        saveUserNotes();
        
        // Create new sidebar item
        const newNoteItem = document.createElement('li');
        newNoteItem.textContent = newNoteTitle;
        newNoteItem.dataset.note = newNoteId;
        newNoteItem.addEventListener('click', () => loadNote(newNoteId));
        notesList.appendChild(newNoteItem);
        
        // Load the new note
        loadNote(newNoteId);
        
        // Mark as new note with defaults
        isNewNoteWithDefaultTitle = true;
        isNewNoteWithDefaultBody = true;
        
        // Focus on title for immediate editing
        setTimeout(() => {
            titleEl.focus();
            titleEl.select();
        }, 100);
    }
    
    // Delete note function
    function deleteNote() {
        // Remove from in-memory notes
        delete currentNotes[currentNoteId];
        
        // Remove from user notes and sessionStorage if it's a user note
        if (isUserNote(currentNoteId)) {
            delete userNotes[currentNoteId];
            saveUserNotes();
        }
        
        // Remove from sidebar
        const noteItem = document.querySelector(`.notes-sidebar li[data-note="${currentNoteId}"]`);
        if (noteItem) {
            noteItem.remove();
        }
        
        // Find the first available note to load
        const remainingNotes = Object.keys(currentNotes);
        if (remainingNotes.length > 0) {
            loadNote(remainingNotes[0]);
        } else {
            // If no notes left, create a default one
            currentNotes['empty'] = {
                title: 'No Notes',
                body: 'All notes have been deleted. Create a new note to get started.'
            };
            
            // Create sidebar item
            const emptyNoteItem = document.createElement('li');
            emptyNoteItem.textContent = 'No Notes';
            emptyNoteItem.dataset.note = 'empty';
            emptyNoteItem.addEventListener('click', () => loadNote('empty'));
            notesList.appendChild(emptyNoteItem);
            
            loadNote('empty');
        }
    }
    
    // Text formatting functions
    function formatText(command, size = null) {
        // Save current selection
        const selection = window.getSelection();
        if (selection.rangeCount === 0 && command !== 'fontSize') return;
        
        if (command === 'fontSize') {
            if (size === 'small') {
                document.execCommand('fontSize', false, '2');
            } else if (size === 'large') {
                document.execCommand('fontSize', false, '5');
            }
        } else {
            document.execCommand(command, false, null);
        }
        
        // Update in-memory content after formatting
        if (currentNotes[currentNoteId]) {
            const cleanContent = getCleanTextContent(bodyEl);
            currentNotes[currentNoteId].body = cleanContent;
            
            // Save to sessionStorage if it's a user note
            if (isUserNote(currentNoteId)) {
                userNotes[currentNoteId].body = cleanContent;
                saveUserNotes();
            }
        }
    }
    
    // Update format button states based on current selection
    function updateFormatButtons() {
        formatBtns.forEach(btn => {
            const command = btn.dataset.command;
            if (command !== 'fontSize') {
                const isActive = document.queryCommandState(command);
                btn.classList.toggle('active', isActive);
            }
        });
    }
    
    // Add event listeners for toolbars
    addNoteBtn.addEventListener('click', createNewNote);
    deleteNoteBtn.addEventListener('click', deleteNote);
    
    formatBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const command = btn.dataset.command;
            const size = btn.dataset.size;
            formatText(command, size);
        });
    });
    
    // Update format buttons on selection change
    document.addEventListener('selectionchange', updateFormatButtons);
    bodyEl.addEventListener('keyup', updateFormatButtons);
    bodyEl.addEventListener('mouseup', updateFormatButtons);
    
    // Initialize the app
    loadUserNotes(); // Load any saved user notes first
    loadNote('welcome'); // Then load the welcome note
}
