const conversations = {
    self: {
        name: 'Daryl (Me)',
        status: 'Active now',
        avatar: '📝',
        messages: [
            { type: 'sent', text: 'Remember to update the website with the new Messages app', time: '7d ago' },
            { type: 'sent', text: 'Also need to check on that new SEO client - they seem happy with the audit results', time: '7d ago' },
            { type: 'sent', text: 'Liam mentioned Blindstyle is doing well this quarter', time: '6d ago' },
            { type: 'sent', text: 'Should probably write that blog post about remote work lessons learned', time: '5d ago' },
            { type: 'sent', text: 'Vietnam weather is still hot as ever 🌡️', time: '4d ago' }
        ]
    },
    liam: {
        name: 'Liam Rosser',
        status: 'Active now',
        avatar: '👨‍💼',
        messages: [
            { type: 'received', text: 'you missed out on some race', time: '3d ago' },
            { type: 'sent', text: 'Nah I stayed up lol', time: '3d ago' },
            { type: 'sent', text: 'Kimi podium, well deserved', time: '3d ago' },
            { type: 'received', text: 'Yeah incredible race', time: '3d ago' },
            { type: 'sent', text: 'George was flawless too', time: '3d ago' },
            { type: 'received', text: 'We are killing it for client X, traffic is up 82% already', time: '1d ago' },
            { type: 'sent', text: 'Love it', time: '1d ago' },
            { type: 'sent', text: 'got 5 mins? had a crazy automation idea', time: '1:36pm' }
        ]
    },
    client: {
        name: 'Client',
        status: 'Active 3 hours ago',
        avatar: '🛍️',
        messages: [
            { type: 'received', text: 'Hi Daryl, just wanted to update you. Revenue is up 37% this month!!', time: '11:15 AM' },
            { type: 'sent', text: 'That\'s great news! More to come..', time: '11:20 AM' },
        ]
    },
    spammer: {
        name: 'Crypto Recovery',
        status: 'Active 7 days ago',
        avatar: '📈',
        messages: [
            { type: 'received', text: 'URGENT: We have identified 14.8 BTC belonging to a D.H. Rosser from the defunct MtGox exchange. Are you this person?', time: '7d ago' },
            { type: 'sent', text: 'Yeah, nice try.', time: '7d ago' },
            { type: 'received', text: 'Sir this is a legitimate alert from the International Blockchain Monetary Fund (IBMF). We are attempting to return your lost assets.', time: '7d ago' },
            { type: 'received', text: 'Your 14.8 BTC is currently valued at over $900,000 USD. This is a life-changing sum.', time: '7d ago' },
            { type: 'received', text: 'To proceed, we require a standard 0.1 BTC verification deposit to release the funds. This is for your security.', time: '7d ago' },
            { type: 'received', text: 'Sir? The transaction window is closing. The BTC will be forfeited to the state if unclaimed.', time: '7d ago' },
            { type: 'received', text: 'Okay, my supervisor has authorized a special discount. We can lower the verification deposit to 0.05 BTC. A 50% reduction. This is a one-time offer.', time: '7d ago' },
            { type: 'received', text: 'This is your final opportunity. Do you want to lose almost one million dollars?', time: '7d ago' },
            { type: 'received', text: 'Our records show you used the handle "daryl_h_r" in 2013. Is this correct? We have your data.', time: '7d ago' },
            { type: 'received', text: 'Sir please respond. People would kill for this opportunity. I am trying to help you.', time: '7d ago' },
            { type: 'received', text: 'The funds are being prepared for liquidation. Last chance.', time: '7d ago' },
            { type: 'received', text: 'Fine. 0.01 BTC. My final offer. I am taking a risk here for you.', time: '7d ago' },
            { type: 'received', text: 'Are you there?', time: '7d ago' },
            { type: 'received', text: 'hello?', time: '7d ago' },
            { type: 'received', text: 'I have a family to feed. Please do not waste my time.', time: '7d ago' },
            { type: 'received', text: 'You will regret this. The blockchain never forgets.', time: '7d ago' },
            { type: 'received', text: 'I am reporting your wallet as inactive. The funds will be seized. Goodbye forever.', time: '7d ago' }
        ]
    },
    mum: {
        name: 'Mum',
        status: 'Active 1 day ago',
        avatar: '👩‍🦳',
        messages: [
            { type: 'received', text: 'Got my dress ready for the wedding', time: 'Yesterday' },
            { type: 'received', text: 'I\'m so excited for the big day', time: 'Yesterday' }
        ]
    },
    fiancee: {
        name: 'Fiancée',
        status: 'Active 2 days ago',
        avatar: '💍',
        messages: [
            { type: 'received', text: 'Dinner tonight?', time: '2 days ago' },
            { type: 'received', text: 'I\'m thinking we could try that new Vietnamese place', time: '2 days ago' }
        ]
    }
};

// Available emoji reactions
const emojiReactions = ['❤️', '😂', '👍', '👎', '😮', '😢', '😡', '🔥', '👏', '✨', '💯', '🙌'];

export function setupMessagesApp() {
    const messagesApp = document.getElementById('messages-app');
    const conversationItems = document.querySelectorAll('.conversation-item');
    const messagesList = document.getElementById('messages-list');
    const currentConversationName = document.querySelector('.current-conversation-name');
    const currentConversationStatus = document.querySelector('.current-conversation-status');
    const messagesInput = document.getElementById('messages-input');
    const sendMessageBtn = document.querySelector('.send-message-btn');
    const searchInput = document.getElementById('messages-search-input');
    const messagesInputArea = document.querySelector('.messages-input-area');
    const backButton = messagesApp.querySelector('.messages-back-btn');
    const conversationsList = document.querySelector('.conversations-list');
    
    // Track if user has sent their first message
    let hasUserSentFirstMessage = false;
    
    // Store timestamps for conversations that have been updated
    const conversationTimestamps = {};
    
    // Initialize timestamps for default conversations based on their last message times
    function initializeConversationTimestamps() {
        const now = Date.now();
        
        // Convert relative times to actual timestamps and update message times
        conversationTimestamps.liam = now - (90 * 60 * 1000); // 90 minutes ago
        conversationTimestamps.client = now - (3 * 60 * 60 * 1000); // 3 hours ago  
        conversationTimestamps.spammer = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago
        conversationTimestamps.mum = now - (1 * 24 * 60 * 60 * 1000); // 1 day ago
        conversationTimestamps.fiancee = now - (26 * 60 * 1000); // 26 minutes ago
        conversationTimestamps.self = now - (4 * 24 * 60 * 60 * 1000); // 4 days ago
        
        // Update the actual message timestamps to match these relative times
        updateMessageTimestamps();
    }
    
    function updateMessageTimestamps() {
        // Update Liam's last message to show actual time from 90 minutes ago
        const liamTime = new Date(conversationTimestamps.liam);
        const liamHours = liamTime.getHours();
        const liamMinutes = liamTime.getMinutes().toString().padStart(2, '0');
        const liamAmpm = liamHours >= 12 ? 'pm' : 'am';
        const liamDisplayHours = liamHours % 12 || 12;
        conversations.liam.messages[conversations.liam.messages.length - 1].time = `${liamDisplayHours}:${liamMinutes}${liamAmpm}`;
        
        // Update Client's messages to maintain proper chronological order
        const clientBaseTime = conversationTimestamps.client;
        const clientMsg1Time = new Date(clientBaseTime - (5 * 60 * 1000)); // First message 5 minutes before
        const clientMsg2Time = new Date(clientBaseTime); // Response at the base time
        
        [clientMsg1Time, clientMsg2Time].forEach((time, index) => {
            const hours = time.getHours();
            const minutes = time.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            conversations.client.messages[index].time = `${displayHours}:${minutes} ${ampm}`;
        });
        
        // Update Fiancée's messages to show actual time from 26 minutes ago and a bit earlier
        const fianceeTime1 = new Date(conversationTimestamps.fiancee - (5 * 60 * 1000)); // 5 minutes before the last one
        const fianceeTime2 = new Date(conversationTimestamps.fiancee);
        
        [fianceeTime1, fianceeTime2].forEach((time, index) => {
            const hours = time.getHours();
            const minutes = time.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'pm' : 'am';
            const displayHours = hours % 12 || 12;
            conversations.fiancee.messages[index].time = `${displayHours}:${minutes}${ampm}`;
        });
    }
    
    // Variables for click-and-hold reaction functionality
    let holdTimer = null;
    let isHolding = false;

    function addReactionToMessage(messageElement, emoji) {
        // Check if reactions container already exists on the message bubble
        const messageBubble = messageElement.querySelector('.message-bubble');
        let reactionsContainer = messageBubble.querySelector('.message-reactions');
        if (!reactionsContainer) {
            reactionsContainer = document.createElement('div');
            reactionsContainer.className = 'message-reactions';
            messageBubble.appendChild(reactionsContainer);
        }

        // Check if this emoji already exists
        let existingReaction = reactionsContainer.querySelector(`[data-emoji="${emoji}"]`);
        if (existingReaction) {
            // Increment count
            const countSpan = existingReaction.querySelector('.reaction-count');
            const currentCount = parseInt(countSpan.textContent) || 1;
            countSpan.textContent = currentCount + 1;
        } else {
            // Create new reaction
            const reactionEl = document.createElement('span');
            reactionEl.className = 'message-reaction';
            reactionEl.setAttribute('data-emoji', emoji);
            reactionEl.innerHTML = `${emoji}<span class="reaction-count">1</span>`;
            reactionsContainer.appendChild(reactionEl);
        }

        // Add animation
        const newReaction = reactionsContainer.querySelector(`[data-emoji="${emoji}"]`);
        newReaction.classList.add('reaction-animate');
        setTimeout(() => {
            newReaction.classList.remove('reaction-animate');
        }, 300);
    }

    function getRandomReaction() {
        return emojiReactions[Math.floor(Math.random() * emojiReactions.length)];
    }

    function showEmojiPicker(messageElement, x, y) {
        // Remove any existing picker
        const existingPicker = document.querySelector('.emoji-picker');
        if (existingPicker) existingPicker.remove();

        // Create emoji picker
        const picker = document.createElement('div');
        picker.className = 'emoji-picker';
        picker.style.position = 'fixed';
        picker.style.zIndex = '1000';
        picker.style.background = 'rgba(0, 0, 0, 0.9)';
        picker.style.borderRadius = '16px';
        picker.style.padding = '6px';
        picker.style.display = 'flex';
        picker.style.gap = '2px';
        picker.style.backdropFilter = 'blur(10px)';
        picker.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        picker.style.maxWidth = '300px';
        picker.style.flexWrap = 'wrap';

        // Add emojis to picker (limit to first 6 for size)
        const limitedEmojis = emojiReactions.slice(0, 6);
        limitedEmojis.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.textContent = emoji;
            emojiBtn.style.background = 'transparent';
            emojiBtn.style.border = 'none';
            emojiBtn.style.fontSize = '16px';
            emojiBtn.style.padding = '6px';
            emojiBtn.style.borderRadius = '50%';
            emojiBtn.style.cursor = 'pointer';
            emojiBtn.style.transition = 'all 0.2s ease';
            emojiBtn.style.width = '32px';
            emojiBtn.style.height = '32px';

            emojiBtn.addEventListener('mouseenter', () => {
                emojiBtn.style.transform = 'scale(1.2)';
                emojiBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            });

            emojiBtn.addEventListener('mouseleave', () => {
                emojiBtn.style.transform = 'scale(1)';
                emojiBtn.style.background = 'transparent';
            });

            emojiBtn.addEventListener('click', () => {
                addReactionToMessage(messageElement, emoji);
                
                // Store reaction in conversation data
                const activeConversation = document.querySelector('.conversation-item.active');
                const conversationId = activeConversation.dataset.conversation;
                const conversation = conversations[conversationId];
                
                // Find the message index by counting all message elements up to this one
                const allMessages = messagesList.querySelectorAll('.message:not(.typing-indicator)');
                const messageIndex = Array.from(allMessages).indexOf(messageElement);
                
                if (conversation.messages[messageIndex]) {
                    if (!conversation.messages[messageIndex].reactions) {
                        conversation.messages[messageIndex].reactions = [];
                    }
                    
                    const existingReaction = conversation.messages[messageIndex].reactions.find(r => r.emoji === emoji);
                    if (existingReaction) {
                        existingReaction.count++;
                    } else {
                        conversation.messages[messageIndex].reactions.push({ emoji: emoji, count: 1 });
                    }
                }
                
                picker.remove();
            });

            picker.appendChild(emojiBtn);
        });

        // Position picker within window bounds
        const pickerWidth = 220; // Approximate width
        const pickerHeight = 50; // Approximate height
        
        let finalX = Math.max(10, Math.min(x, window.innerWidth - pickerWidth - 10));
        let finalY = Math.max(10, Math.min(y - 60, window.innerHeight - pickerHeight - 10));
        
        picker.style.left = finalX + 'px';
        picker.style.top = finalY + 'px';

        document.body.appendChild(picker);

        // Remove picker when clicking outside
        setTimeout(() => {
            const clickOutside = (e) => {
                if (!picker.contains(e.target)) {
                    picker.remove();
                    document.removeEventListener('click', clickOutside);
                }
            };
            document.addEventListener('click', clickOutside);
        }, 300);
    }

    function handleMessageHold(messageElement, e) {
        const rect = messageElement.getBoundingClientRect();
        const x = e.clientX || (e.touches && e.touches[0].clientX) || rect.left + rect.width / 2;
        const y = e.clientY || (e.touches && e.touches[0].clientY) || rect.top;
        
        showEmojiPicker(messageElement, x, y);
    }

    function formatElapsedTime(timestamp) {
        const now = Date.now();
        const elapsed = now - timestamp;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(elapsed / (1000 * 60));
        const hours = Math.floor(elapsed / (1000 * 60 * 60));
        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
        
        if (seconds < 30) return 'now';
        if (minutes < 1) return '1m';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        return `${days}d`;
    }

    function getDateSeparator(timeString) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        
        // Parse different time formats
        let messageDate;
        
        if (timeString.includes('now') || timeString.includes('m') || timeString.includes('h')) {
            // Recent messages - treat as today
            return 'Today';
        } else if (timeString.toLowerCase().includes('yesterday')) {
            return 'Yesterday';
        } else if (timeString.includes('d ago')) {
            const days = parseInt(timeString.match(/(\d+)d/)[1]);
            const messageDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
            
            if (days === 1) return 'Yesterday';
            if (days < 7) return messageDate.toLocaleDateString('en-US', { weekday: 'long' });
            return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (timeString.includes('AM') || timeString.includes('PM')) {
            // Assume it's today if it's just a time
            return 'Today';
        }
        
        return null;
    }

    function groupMessagesByDate(messages) {
        const grouped = [];
        let currentDate = null;
        
        messages.forEach((message, index) => {
            const messageDate = getDateSeparator(message.time);
            
            // Check if this is a significant time jump (old messages vs new messages)
            if (index > 0) {
                const prevMessage = messages[index - 1];
                const isCurrentMessageRecent = message.time.includes('now') || message.time.includes('m') || message.time.includes('h');
                const isPrevMessageOld = prevMessage.time.includes('d ago');
                
                // If we're jumping from old messages (days ago) to recent messages (minutes/hours/now)
                if (isPrevMessageOld && isCurrentMessageRecent) {
                    currentDate = null; // Reset so we add a new date separator
                }
            }
            
            if (messageDate && messageDate !== currentDate) {
                grouped.push({
                    type: 'date-separator',
                    date: messageDate
                });
                currentDate = messageDate;
            }
            
            grouped.push(message);
        });
        
        return grouped;
    }

    function updateConversationPreview(conversationId, lastMessage) {
        const conversationItem = document.querySelector(`[data-conversation="${conversationId}"]`);
        if (!conversationItem) return;

        const previewElement = conversationItem.querySelector('.conversation-preview');
        const timeElement = conversationItem.querySelector('.conversation-time');
        
        // Update preview text (truncate if too long)
        const previewText = lastMessage.text.length > 30 
            ? lastMessage.text.substring(0, 30) + '...' 
            : lastMessage.text;
        previewElement.textContent = previewText;
        
        // Store timestamp and update time
        const timestamp = Date.now();
        conversationTimestamps[conversationId] = timestamp;
        timeElement.textContent = 'now';
        
        // Move conversation to top of list
        conversationsList.insertBefore(conversationItem, conversationsList.firstChild);
        
        // Update active state
        conversationItems.forEach(item => item.classList.remove('active'));
        conversationItem.classList.add('active');
    }

    function updateAllConversationTimes() {
        Object.keys(conversationTimestamps).forEach(conversationId => {
            const conversationItem = document.querySelector(`[data-conversation="${conversationId}"]`);
            if (conversationItem) {
                const timeElement = conversationItem.querySelector('.conversation-time');
                const timestamp = conversationTimestamps[conversationId];
                timeElement.textContent = formatElapsedTime(timestamp);
            }
        });
    }

    function loadConversation(conversationId) {
        const conversation = conversations[conversationId];
        if (!conversation) return;

        // Set theme based on conversation
        if (conversationId === 'self' || conversationId === 'liam') {
            messagesApp.classList.add('imessage-theme');
        } else {
            messagesApp.classList.remove('imessage-theme');
        }

        const isLocked = document.querySelector(`[data-conversation="${conversationId}"]`).classList.contains('locked');

        // Update active conversation in sidebar
        conversationItems.forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-conversation="${conversationId}"]`).classList.add('active');
        
        // Update header
        currentConversationName.textContent = conversation.name;
        currentConversationStatus.textContent = conversation.status;

        // Hide typing indicator if it exists from a previous conversation
        const typingIndicator = messagesList.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }

        if (isLocked) {
            messagesList.innerHTML = `
                <div class="locked-messages-view">
                    <div class="lock-icon-large">🔒</div>
                    <h3>Enter Password to View Messages</h3>
                    <div class="password-entry">
                        <input type="password" id="password-input" placeholder="Password">
                        <button id="password-submit">Unlock</button>
                    </div>
                    <p class="password-error"></p>
                </div>
            `;
            messagesList.classList.add('locked-view-active');
            messagesInputArea.style.display = 'none';

            const passwordInput = document.getElementById('password-input');
            const passwordSubmit = document.getElementById('password-submit');
            const passwordError = document.querySelector('.password-error');
            const lockedView = document.querySelector('.locked-messages-view');

            const handleSubmit = () => {
                if (lockedView) lockedView.classList.add('shake');
                if (passwordError) passwordError.textContent = 'Incorrect password.';
                if (passwordInput) passwordInput.value = '';
                setTimeout(() => {
                    if (lockedView) lockedView.classList.remove('shake');
                }, 500);
            };

            if (passwordSubmit) passwordSubmit.addEventListener('click', handleSubmit);
            if (passwordInput) passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSubmit();
            });
        } else {
            messagesList.classList.remove('locked-view-active');
            messagesInputArea.style.display = 'block';

            // Clear and populate messages
            messagesList.innerHTML = '';
            const groupedMessages = groupMessagesByDate(conversation.messages);
            
            groupedMessages.forEach(item => {
                if (item.type === 'date-separator') {
                    // Create date separator
                    const separatorEl = document.createElement('div');
                    separatorEl.className = 'date-separator';
                    separatorEl.innerHTML = `<span class="date-separator-text">${item.date}</span>`;
                    messagesList.appendChild(separatorEl);
                } else {
                    // Create message
                    const messageEl = document.createElement('div');
                    messageEl.className = `message ${item.type}`;
                    messageEl.innerHTML = `
                        <div class="message-bubble">${item.text}</div>
                        <div class="message-time">${item.time}</div>
                    `;
                    
                    // Add click-and-hold event listeners for reactions
                    let holdTimer = null;
                    let isHolding = false;
                    let pickerShown = false;

                    const startHold = (e) => {
                        e.preventDefault();
                        isHolding = true;
                        pickerShown = false;
                        holdTimer = setTimeout(() => {
                            if (isHolding) {
                                handleMessageHold(messageEl, e);
                                pickerShown = true;
                            }
                        }, 500); // Hold for 500ms to trigger
                    };

                    const endHold = (e) => {
                        isHolding = false;
                        if (holdTimer) {
                            clearTimeout(holdTimer);
                            holdTimer = null;
                        }
                        // Don't prevent normal click if picker wasn't shown
                        if (!pickerShown && e.type === 'mouseup') {
                            // This was just a normal click, not a hold
                        }
                    };

                    // Mouse events
                    messageEl.addEventListener('mousedown', startHold);
                    messageEl.addEventListener('mouseup', endHold);
                    messageEl.addEventListener('mouseleave', endHold);

                    // Touch events for mobile  
                    messageEl.addEventListener('touchstart', startHold);
                    messageEl.addEventListener('touchend', endHold);
                    messageEl.addEventListener('touchcancel', endHold);
                    
                    // Add existing reactions if any
                    if (item.reactions && item.reactions.length > 0) {
                        const messageBubble = messageEl.querySelector('.message-bubble');
                        const reactionsContainer = document.createElement('div');
                        reactionsContainer.className = 'message-reactions';
                        item.reactions.forEach(reaction => {
                            const reactionEl = document.createElement('span');
                            reactionEl.className = 'message-reaction';
                            reactionEl.setAttribute('data-emoji', reaction.emoji);
                            reactionEl.innerHTML = `${reaction.emoji}<span class="reaction-count">${reaction.count}</span>`;
                            reactionsContainer.appendChild(reactionEl);
                        });
                        messageBubble.appendChild(reactionsContainer);
                    }
                    
                    messagesList.appendChild(messageEl);
                }
            });

            // Use a timeout to ensure scrolling happens after the view is visible on mobile
            setTimeout(() => {
                messagesList.scrollTop = messagesList.scrollHeight;
            }, 10);

            messagesInput.disabled = false;
            sendMessageBtn.disabled = false;
        }
    }

    // Handle conversation clicks
    conversationItems.forEach(item => {
        item.addEventListener('click', () => {
            const conversationId = item.dataset.conversation;
            loadConversation(conversationId);
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                messagesApp.classList.add('mobile-chat-active');
            }
        });
    });

    // Handle back button on mobile
    if (backButton) {
        backButton.addEventListener('click', () => {
            messagesApp.classList.remove('mobile-chat-active');
        });
    }

    // Handle search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            conversationItems.forEach(item => {
                const name = item.querySelector('.conversation-name').textContent.toLowerCase();
                const preview = item.querySelector('.conversation-preview').textContent.toLowerCase();
                const matches = name.includes(searchTerm) || preview.includes(searchTerm);
                item.style.display = matches ? 'flex' : 'none';
            });
        });
    }

    // Handle send message (for demo purposes, just add a sent message)
    if (sendMessageBtn && messagesInput) {
        sendMessageBtn.addEventListener('click', () => {
            const text = messagesInput.value.trim();
            if (text && !messagesInput.disabled) {
                const activeConversation = document.querySelector('.conversation-item.active');
                const conversationId = activeConversation.dataset.conversation;
                
                // Add message to the conversation
                const now = new Date();
                const hours = now.getHours();
                const minutes = now.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'pm' : 'am';
                const displayHours = hours % 12 || 12;
                const currentTime = `${displayHours}:${minutes}${ampm}`;
                const newMessage = {
                    type: 'sent',
                    text: text,
                    time: currentTime
                };
                conversations[conversationId].messages.push(newMessage);
                
                // Update conversation preview and reorder
                updateConversationPreview(conversationId, newMessage);
                
                // Reload conversation to show new message
                loadConversation(conversationId);
                messagesInput.value = '';
                
                // Show typing indicator and add random reaction after a short delay (but not for self-notes)
                if (conversationId !== 'self') {
                    // Always add reaction to first user message, then 30% chance for others
                    const shouldAddReaction = !hasUserSentFirstMessage || Math.random() < 0.3;
                    
                    setTimeout(() => {
                        const typingDuration = 2000 + Math.random() * 2000; // 2-4 seconds
                        showTypingIndicator(conversationId, typingDuration);
                        
                        if (shouldAddReaction) {
                            // Add reaction after typing indicator disappears
                            setTimeout(() => {
                                addRandomReaction(conversationId);
                                hasUserSentFirstMessage = true; // Mark that user has sent their first message
                            }, typingDuration + 300); // Small delay after typing stops
                        }
                    }, 1000);
                }
            }
        });

        messagesInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !messagesInput.disabled) {
                sendMessageBtn.click();
            }
        });
    }

    function addRandomReaction(conversationId) {
        // Get all messages but exclude typing indicators
        const messageElements = messagesList.querySelectorAll('.message:not(.typing-indicator)');
        
        if (messageElements.length === 0) return;
        
        // Get the latest actual message (not typing indicator)
        const latestMessage = messageElements[messageElements.length - 1];
        
        const randomEmoji = getRandomReaction();
        
        addReactionToMessage(latestMessage, randomEmoji);
        
        // Store reaction in conversation data
        const conversation = conversations[conversationId];
        const messageIndex = messageElements.length - 1;
        if (conversation.messages[messageIndex]) {
            if (!conversation.messages[messageIndex].reactions) {
                conversation.messages[messageIndex].reactions = [];
            }
            
            const existingReaction = conversation.messages[messageIndex].reactions.find(r => r.emoji === randomEmoji);
            if (existingReaction) {
                existingReaction.count++;
            } else {
                conversation.messages[messageIndex].reactions.push({ emoji: randomEmoji, count: 1 });
            }
        }
    }

    function showTypingIndicator(conversationId, duration = 2000 + Math.random() * 2000) {
        // Create typing indicator
        const typingEl = document.createElement('div');
        typingEl.className = 'message received typing-indicator';
        typingEl.innerHTML = `
            <div class="message-bubble typing-bubble">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        messagesList.appendChild(typingEl);
        messagesList.scrollTop = messagesList.scrollHeight;

        // Remove typing indicator after specified duration
        setTimeout(() => {
            if (typingEl.parentNode) {
                typingEl.remove();
            }
        }, duration);
    }

    // Initialize all conversation timestamps
    initializeConversationTimestamps();
    
    // Load initial conversation
    loadConversation('liam');
    
    // Update conversation times every 10 seconds for more responsive timestamps
    setInterval(updateAllConversationTimes, 10000); // 10 seconds
    
    // Initial update of conversation times
    updateAllConversationTimes();
}
