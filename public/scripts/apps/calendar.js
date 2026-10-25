export function setupCalendarApp() {
    const calendarBody = document.querySelector('#calendar-app .calendar-body');
    if (!calendarBody) {
        console.error('Calendar body not found');
        return;
    }

    let currentView = 'week'; // 'day', 'week', 'month'
    let currentOffset = 0; // For day/week: week offset, for month: month offset
    const today = new Date();
    let f1EventsCache = null;
    let isInitialized = false;
    
    // Color override system - stores custom colors for events by title
    let eventColorOverrides = JSON.parse(localStorage.getItem('calendar-color-overrides') || '{}');

    function saveColorOverride(eventTitle, newColor) {
        // Use a generic key for F1 events so they all share the same color
        const colorKey = eventTitle.includes('🏎️') ? 'F1_EVENTS' : eventTitle;
        eventColorOverrides[colorKey] = newColor;
        localStorage.setItem('calendar-color-overrides', JSON.stringify(eventColorOverrides));
    }

    function getEventColor(event) {
        // Check for F1 events first, then fallback to exact title match
        if (event.title.includes('🏎️')) {
            return eventColorOverrides['F1_EVENTS'] || event.color;
        }
        return eventColorOverrides[event.title] || event.color;
    }

    const fakeEventPool = [
        { title: 'Client Follow-up', duration: 60, color: '#ff9500', category: 'business', description: 'Follow up with recent SEO audit client to discuss implementation progress and answer any questions about the technical recommendations.' },
        { title: 'Product Sync', duration: 90, color: '#007aff', category: 'business', description: 'Weekly sync with the product team to discuss new features, bug fixes, and upcoming releases for our Shopify SEO tools.' },
        { title: 'Marketing Brainstorm', duration: 60, color: '#af52de', category: 'business', description: 'Creative session to brainstorm new marketing campaigns, content ideas, and growth strategies for Logeix.' },
        { title: 'SEO Audit Review', duration: 120, color: '#5856d6', category: 'business', description: 'Deep dive into a comprehensive SEO audit for a 7-figure e-commerce brand. Review technical issues, content gaps, and competitive analysis.' },
        { title: 'Team Stand-up', duration: 30, color: '#34c759', category: 'business', description: 'Daily stand-up with the remote team across 5 countries. Quick updates on progress, blockers, and priorities.' },
        { title: 'Design Huddle', duration: 45, color: '#ff3b30', category: 'business', description: 'Design review session for new website mockups and UI improvements. Discuss user experience and conversion optimization.' },
        { title: 'SGC Update Call', duration: 60, color: '#ffcc00', category: 'business', description: 'Monthly update call with Saigon Coworking Group. Discuss community events, networking opportunities, and business collaborations.' },
        { title: 'Dev Team Meeting', duration: 90, color: '#007aff', category: 'business', description: 'Technical discussion with development team about new features, API integrations, and performance optimizations.' },
        { title: 'Content Strategy Session', duration: 75, color: '#af52de', category: 'business', description: 'Plan content calendar, discuss SEO content opportunities, and review performance of existing content pieces.' },
        { title: 'Budget Planning', duration: 120, color: '#5856d6', category: 'business', description: 'Quarterly budget review and planning session. Analyze revenue, expenses, and plan investments for next quarter.' },
        { title: '❤️ Date Night', duration: 180, color: '#af52de', description: 'Evening out with fiancée. Trying that new Vietnamese restaurant we\'ve been wanting to visit. Time to disconnect from work and enjoy some quality time together.' },
        { title: 'Hiring Interview', duration: 60, color: '#ff9500', category: 'business', description: 'Interview with potential new team member for content marketing role. Discuss experience, culture fit, and remote work preferences.' },
        { title: 'Performance Review', duration: 45, color: '#007aff', category: 'business', description: 'Monthly performance review with team members. Discuss achievements, areas for improvement, and career development goals.' },
        { title: 'New Feature Kick-off', duration: 90, color: '#af52de', category: 'business', description: 'Kick-off meeting for new Shopify SEO tool feature. Define requirements, timeline, and success metrics.' },
        { title: 'Campaign Check-in', duration: 30, color: '#34c759', category: 'business', description: 'Quick check-in on current marketing campaign performance. Review metrics, adjust strategies, and plan next steps.' },
        { title: 'Meet with Accountant', duration: 60, color: '#ffcc00', category: 'business', description: 'Quarterly meeting with accountant to review financial statements, discuss tax planning, and ensure compliance.' },
        { title: 'Hang out with friends', duration: 240, color: '#ff3b30', description: 'Catching up with friends in Saigon. Probably grabbing drinks at a rooftop bar or trying a new restaurant. Good to maintain work-life balance.' },
        { title: 'Doctor Appointment', duration: 60, color: '#5856d6', description: 'Routine health check-up. Annual physical exam and blood work to make sure everything is in order.' },
    ];

    function seededRandom(seed) {
        let x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    async function fetchF1Calendar() {
        if (f1EventsCache) return f1EventsCache;

        const corsProxyUrl = 'https://api.allorigins.win/raw?url=';
        const f1CalendarUrl = 'https://files-f1.motorsportcalendars.com/f1-calendar_p1_p2_p3_qualifying_sprint_gp.ics';
        
        try {
            const response = await fetch(corsProxyUrl + encodeURIComponent(f1CalendarUrl));
            if (!response.ok) throw new Error('Network response was not ok');
            const icsData = await response.text();

            const events = [];
            const eventBlocks = icsData.split('BEGIN:VEVENT');
            eventBlocks.shift(); 

            const summaryRegex = /SUMMARY:(.*)/;
            const dtstartRegex = /DTSTART(?:;.*)?:(.*)/;
            const dtendRegex = /DTEND(?:;.*)?:(.*)/;

            for (const block of eventBlocks) {
                const summaryMatch = block.match(summaryRegex);
                const dtstartMatch = block.match(dtstartRegex);
                const dtendMatch = block.match(dtendRegex);

                if (summaryMatch && dtstartMatch && dtendMatch) {
                    const formatIcsDate = (dateStr) => {
                        const cleanStr = dateStr.trim().replace('Z', '');
                        return new Date(`${cleanStr.slice(0,4)}-${cleanStr.slice(4,6)}-${cleanStr.slice(6,8)}T${cleanStr.slice(9,11)}:${cleanStr.slice(11,13)}:${cleanStr.slice(13,15)}Z`);
                    };
                    
                    events.push({
                        title: "🏎️ " + summaryMatch[1].trim().replace('Formula 1 ', '').replace(/ \d{4}.*/, ''),
                        start: formatIcsDate(dtstartMatch[1]),
                        end: formatIcsDate(dtendMatch[1]),
                        color: '#f85149'
                    });
                }
            }
            f1EventsCache = events;
            return events;
        } catch (error) {
            console.error("Could not fetch or parse F1 calendar:", error);
            f1EventsCache = [];
            return [];
        }
    }

    function getDateRange() {
        const now = new Date();
        let startDate, endDate;

        if (currentView === 'day') {
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() + currentOffset);
            endDate = new Date(startDate);
        } else if (currentView === 'week') {
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - (startDate.getDay() === 0 ? 6 : startDate.getDay() - 1) + (currentOffset * 7));
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
        } else if (currentView === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth() + currentOffset, 1);
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        }

        return { startDate, endDate };
    }

    function generateEventsForDateRange(startDate, endDate, f1Events = []) {
        let allEvents = [];
        const daysInRange = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const bookedSlots = Array.from({ length: daysInRange }, () => []);

        const timeStrToMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const addEventToList = (event) => {
            allEvents.push(event);
            if (event.allDay) return;

            const startMinutes = timeStrToMinutes(event.start);
            const endMinutes = timeStrToMinutes(event.end);
            event.days.forEach(dayIndex => {
                if (dayIndex < bookedSlots.length) {
                    bookedSlots[dayIndex].push({ start: startMinutes, end: endMinutes });
                }
            });
        };

        // Static events - adjust for the date range
        const staticEvents = [
            { days: [0, 1, 2, 3, 4], start: '10:00', end: '13:00', title: '🧘 Deep Work', color: '#5856d6', description: 'Focused work session with no interruptions. Usually working on complex SEO strategies, content creation, or technical implementations.' },
            { days: [0, 1, 2, 3, 4], start: '13:00', end: '14:30', title: '💪 Gym', color: '#34c759', recurring: true, description: 'Daily workout session. Mix of strength training and cardio to stay healthy and maintain energy levels for long work days.' },
            { days: [0], start: '16:00', end: '17:00', title: '👍 Liam 1:1', color: '#34c759', description: 'Weekly one-on-one with Liam to discuss business strategy, team updates, and long-term planning for Rosser Brothers.' },
            { days: [3], start: '21:00', end: '22:00', title: '💡 Logeix Strategy', color: '#007aff', description: 'Evening strategy session for Logeix. Review client performance, plan new service offerings, and discuss team development.' },
            { days: [0], allDay: true, title: 'Plan week', description: 'Weekly planning session. Review last week\'s achievements, set priorities for the coming week, and organize tasks and meetings.' }
        ];

        // Adjust static events for the current date range
        staticEvents.forEach(event => {
            const adjustedEvent = { ...event };
            if (currentView === 'day') {
                // For day view, only show events for day 0
                if (event.days.includes(0)) {
                    adjustedEvent.days = [0];
                    addEventToList(adjustedEvent);
                }
            } else if (currentView === 'week') {
                // For week view, keep as is
                addEventToList(adjustedEvent);
            } else if (currentView === 'month') {
                // For month view, we need to calculate the actual day of month for each event
                const firstDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                const firstDayOfWeek = new Date(firstDayOfMonth);
                firstDayOfWeek.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());
                
                // Map week days to actual calendar days
                const weekDayToCalendarDay = {};
                for (let i = 0; i < 42; i++) {
                    const date = new Date(firstDayOfWeek);
                    date.setDate(firstDayOfWeek.getDate() + i);
                    const dayOfMonth = date.getDate();
                    weekDayToCalendarDay[i] = dayOfMonth;
                }
                
                // Convert week days to calendar days
                adjustedEvent.days = event.days.map(weekDay => {
                    const calendarDay = weekDayToCalendarDay[weekDay];
                    return calendarDay ? calendarDay - 1 : 0; // Convert to 0-based index
                });
                addEventToList(adjustedEvent);
            }
        });

        // Quarterly review logic
        const month = startDate.getMonth();
        const quarterMonths = [0, 3, 6, 9];
        if (quarterMonths.includes(month) && startDate.getDate() <= 7) {
            // Schedule quarterly review after Deep Work and Gym to avoid overlap
            // Deep Work: 10:00-13:00, Gym: 13:00-14:30, so start at 15:00
            if (currentView === 'month') {
                // For month view, place quarterly review on the 3rd day of the month
                addEventToList({ days: [2], start: '15:00', end: '18:00', title: '📈 Quarterly Review', color: '#ff3b30', description: 'Comprehensive quarterly business review. Analyze financial performance, team metrics, client satisfaction, and strategic goals. Plan adjustments for next quarter.' });
            } else {
                addEventToList({ days: [2], start: '15:00', end: '18:00', title: '📈 Quarterly Review', color: '#ff3b30', description: 'Comprehensive quarterly business review. Analyze financial performance, team metrics, client satisfaction, and strategic goals. Plan adjustments for next quarter.' });
            }
        }

        // F1 Events
        f1Events.forEach(f1Event => {
            const eventDay = new Date(f1Event.start);
            if (eventDay >= startDate && eventDay <= endDate) {
                const dayIndex = Math.floor((eventDay - startDate) / (1000 * 60 * 60 * 24));
                addEventToList({
                    days: [dayIndex],
                    start: `${f1Event.start.getHours().toString().padStart(2, '0')}:${f1Event.start.getMinutes().toString().padStart(2, '0')}`,
                    end: `${f1Event.end.getHours().toString().padStart(2, '0')}:${f1Event.end.getMinutes().toString().padStart(2, '0')}`,
                    title: f1Event.title,
                    color: f1Event.color,
                    description: `Formula 1 ${f1Event.title.replace('🏎️ ', '')} race weekend. ${f1Event.title.includes('Practice') ? 'Practice session' : f1Event.title.includes('Qualifying') ? 'Qualifying session' : f1Event.title.includes('Sprint') ? 'Sprint race' : 'Main race'} with all the excitement and drama of F1.`
                });
            }
        });

        // Random events
        const availableEvents = [...fakeEventPool];
        const seed = currentOffset * 10 + (currentView === 'day' ? 1 : currentView === 'week' ? 2 : 3);
        const numRandomEvents = 3 + Math.floor(seededRandom(seed) * 5);
        
        for (let i = 0; i < numRandomEvents && availableEvents.length > 0; i++) {
            const maxAttempts = 25;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const eventSeed = seed * (i + 1) * (attempt + 1);
                
                const eventPoolIndex = Math.floor(seededRandom(eventSeed) * availableEvents.length);
                const randomEventTemplate = availableEvents[eventPoolIndex];

                let dayIndex;
                let dayAttempts = 0;
                do {
                    dayIndex = Math.floor(seededRandom(eventSeed * 1.1 * (dayAttempts + 1)) * daysInRange);
                    dayAttempts++;
                } while (randomEventTemplate.category === 'business' && dayIndex >= 5 && dayAttempts < 10);
                if (randomEventTemplate.category === 'business' && dayIndex >= 5) continue;

                let startHour;
                if (randomEventTemplate.title === '❤️ Date Night') {
                    startHour = 19 + Math.floor(seededRandom(eventSeed * 1.2) * 3);
                } else {
                    startHour = 8 + Math.floor(seededRandom(eventSeed * 1.2) * 10);
                }
                const startMinute = Math.floor(seededRandom(eventSeed * 1.3) * 4) * 15;
                const startMinutes = startHour * 60 + startMinute;
                const endMinutes = startMinutes + randomEventTemplate.duration;

                if (endMinutes > 24 * 60) continue;

                const isOverlapping = bookedSlots[dayIndex] && bookedSlots[dayIndex].some(slot => startMinutes < slot.end && endMinutes > slot.start);

                if (!isOverlapping) {
                    const formatMinutes = (mins) => `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
                    addEventToList({
                        days: [dayIndex],
                        start: formatMinutes(startMinutes),
                        end: formatMinutes(endMinutes),
                        title: randomEventTemplate.title,
                        color: randomEventTemplate.color,
                        description: randomEventTemplate.description
                    });
                    availableEvents.splice(eventPoolIndex, 1);
                    break;
                }
            }
        }

        return allEvents;
    }

    function renderCalendar(onRenderComplete) {
        console.log('Rendering calendar with view:', currentView);
        calendarBody.innerHTML = '';

        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            currentView = 'day';
        }

        const { startDate, endDate } = getDateRange();
        console.log('Date range:', startDate, 'to', endDate);

        let title, navButtons;
        if (currentView === 'day') {
            title = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            navButtons = `
                <button id="cal-prev-day">⟨</button>
                <button class="today-btn">Today</button>
                <button id="cal-next-day">⟩</button>
            `;
        } else if (currentView === 'week') {
            const monthName = startDate.toLocaleString('default', { month: 'long' });
            const year = startDate.getFullYear();
            title = `${monthName} ${year}`;
            navButtons = `
                <button id="cal-prev-week">⟨</button>
                <button class="today-btn">Today</button>
                <button id="cal-next-week">⟩</button>
            `;
        } else if (currentView === 'month') {
            const monthName = startDate.toLocaleString('default', { month: 'long' });
            const year = startDate.getFullYear();
            title = `${monthName} ${year}`;
            navButtons = `
                <button id="cal-prev-month">⟨</button>
                <button class="today-btn">Today</button>
                <button id="cal-next-month">⟩</button>
            `;
        }

        // Create Header
        const header = document.createElement('div');
        header.className = 'calendar-top-header';
        header.innerHTML = `
            <div class="calendar-title">${title}</div>
            <div class="calendar-controls">
                <div class="calendar-nav">
                    ${navButtons}
                </div>
                <div class="calendar-view-switcher ${isMobile ? 'mobile-hidden' : ''}">
                    <button data-view="day" class="${currentView === 'day' ? 'active' : ''}">Day</button>
                    <button data-view="week" class="${currentView === 'week' ? 'active' : ''}">Week</button>
                    <button data-view="month" class="${currentView === 'month' ? 'active' : ''}">Month</button>
                </div>
            </div>`;
        calendarBody.appendChild(header);

        // Create view container
        const viewContainer = document.createElement('div');
        viewContainer.id = `calendar-${currentView}-view`;
        viewContainer.className = `calendar-${currentView}-container`;
        calendarBody.appendChild(viewContainer);

        // Render specific view
        if (currentView === 'day') {
            renderDayView(viewContainer, startDate);
        } else if (currentView === 'week') {
            renderWeekView(viewContainer, startDate);
        } else if (currentView === 'month') {
            renderMonthView(viewContainer, startDate);
        }

        console.log('Calendar rendered, fetching events...');

        // Fetch and render events
        fetchF1Calendar().then(f1Events => {
            const events = generateEventsForDateRange(startDate, endDate, f1Events);
            console.log('Generated events:', events.length);
            renderEventsForView(events, viewContainer);
            if (onRenderComplete) onRenderComplete();
        });
    }

    function renderDayView(container, date) {
        const isMobile = window.innerWidth <= 768;
        container.innerHTML = `
            <div class="calendar-day-view">
                <div class="calendar-day-content">
                    <div class="calendar-day-timeline">
                        <div class="calendar-time-column">
                            ${Array.from({length: 24}, (_, i) => 
                                i > 0 ? `<div class="calendar-time-label"><span>${i}:00</span></div>` : '<div class="calendar-time-label"></div>'
                            ).join('')}
                        </div>
                        <div class="calendar-day-events" id="calendar-day-events"></div>
                        <div class="current-time-indicator" id="current-time-indicator"></div>
                    </div>
                    <div class="calendar-day-sidebar" id="calendar-day-sidebar">
                        <div class="day-sidebar-placeholder">
                            <div class="placeholder-text">Select an event to view details</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderWeekView(container, startDate) {
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(startDate);
            day.setDate(day.getDate() + i);
            weekDays.push(day);
        }

        container.innerHTML = `
            <div class="calendar-week-view">
                <div class="calendar-day-headers">
                    <div class="timezone-label"></div>
                    ${weekDays.map(day => `
                        <div class="calendar-day-header ${day.toDateString() === today.toDateString() ? 'today' : ''}">
                            <div class="day-name">${day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                            <div class="day-number">${day.getDate()}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="all-day-section">
                    <div class="all-day-label">all-day</div>
                    <div class="all-day-events" id="all-day-events-grid"></div>
                </div>
                <div class="calendar-week-scroll-pane">
                    <div class="calendar-week-grid-container">
                        <div class="calendar-time-column">
                            ${Array.from({length: 24}, (_, i) => 
                                i > 0 ? `<div class="calendar-time-label"><span>${i}:00</span></div>` : '<div class="calendar-time-label"></div>'
                            ).join('')}
                        </div>
                        <div class="calendar-week-grid" id="calendar-week-events-grid">
                            ${Array.from({length: 7}, () => '<div class="day-column"></div>').join('')}
                        </div>
                        <div class="current-time-indicator" id="current-time-indicator"></div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderMonthView(container, startDate) {
        const firstDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const lastDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        const firstDayOfWeek = new Date(firstDayOfMonth);
        firstDayOfWeek.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

        container.innerHTML = `
            <div class="calendar-month-view">
                <div class="calendar-month-headers">
                    ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => 
                        `<div class="calendar-month-header">${day}</div>`
                    ).join('')}
                </div>
                <div class="calendar-month-grid" id="calendar-month-grid">
                    ${Array.from({length: 42}, (_, i) => {
                        const date = new Date(firstDayOfWeek);
                        date.setDate(firstDayOfWeek.getDate() + i);
                        const isCurrentMonth = date.getMonth() === startDate.getMonth();
                        const isToday = date.toDateString() === today.toDateString();
                        return `
                            <div class="calendar-month-day ${isCurrentMonth ? 'current-month' : 'other-month'} ${isToday ? 'today' : ''}" data-date="${date.toISOString()}">
                                <div class="day-number">${date.getDate()}</div>
                                <div class="day-events"></div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function renderEventsForView(events, container) {
        if (currentView === 'day') {
            renderDayEvents(events, container);
        } else if (currentView === 'week') {
            renderWeekEvents(events, container);
        } else if (currentView === 'month') {
            renderMonthEvents(events, container);
        }
    }

    function renderDayEvents(events, container) {
        const eventsContainer = container.querySelector('#calendar-day-events');
        const timeStrToMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        // Clear existing events
        if (eventsContainer) eventsContainer.innerHTML = '';
        
        const timedEvents = events.filter(event => !event.allDay);
        
        timedEvents.forEach(event => {
            const eventEl = createDayEventElement(event, timeStrToMinutes, '100%', '0');
            eventsContainer.appendChild(eventEl);
        });
    }

    function createDayEventElement(event, timeStrToMinutes, width, left) {
        const startMinutes = timeStrToMinutes(event.start);
        const endMinutes = timeStrToMinutes(event.end);
        
        const eventEl = document.createElement('div');
        eventEl.className = 'calendar-event';
        eventEl.style.top = `${startMinutes}px`;
        eventEl.style.height = `${endMinutes - startMinutes}px`;
        eventEl.style.left = left;
        eventEl.style.width = width;
        
        const eventColor = getEventColor(event);
        if(eventColor) {
            // Convert hex to RGBA for faded background
            const hex = eventColor.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            eventEl.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
            eventEl.style.borderLeftColor = eventColor; // Full opacity for border
            eventEl.style.setProperty('--original-color', eventColor); // Store for hover effect
        }

        eventEl.innerHTML = `<div class="event-title">${event.title}</div><div class="event-time">${event.start} – ${event.end}</div>`;
        
        // Add click handler for event details
        eventEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentView === 'day' && window.innerWidth > 768) {
                showEventInSidebar(event, eventEl);
            } else {
                showEventDetails(event, eventEl);
            }
        });
        
        return eventEl;
    }

    function renderWeekEvents(events, container) {
        const grid = container.querySelector('#calendar-week-events-grid');
        const allDayGrid = container.querySelector('#all-day-events-grid');
        const timeStrToMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        events.forEach(event => {
            if (event.allDay) {
                const eventEl = document.createElement('div');
                eventEl.className = 'all-day-event';
                eventEl.textContent = event.title;
                eventEl.style.gridColumnStart = event.days[0] + 1;
                
                // Add click handler for all-day events
                eventEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showEventDetails(event, eventEl);
                });
                
                allDayGrid.appendChild(eventEl);
                return;
            }

            const startMinutes = timeStrToMinutes(event.start);
            const endMinutes = timeStrToMinutes(event.end);
            
            event.days.forEach(dayIndex => {
                const eventEl = document.createElement('div');
                eventEl.className = 'calendar-event';
                eventEl.style.top = `${startMinutes}px`;
                eventEl.style.height = `${endMinutes - startMinutes}px`;
                eventEl.style.left = `${(100 / 7) * dayIndex}%`;
                eventEl.style.width = `${100 / 7}%`;
                const eventColor = getEventColor(event);
                if(eventColor) {
                    // Convert hex to RGBA for faded background
                    const hex = eventColor.replace('#', '');
                    const r = parseInt(hex.substr(0, 2), 16);
                    const g = parseInt(hex.substr(2, 2), 16);
                    const b = parseInt(hex.substr(4, 2), 16);
                    eventEl.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
                    eventEl.style.borderLeftColor = eventColor; // Full opacity for border
                    eventEl.style.setProperty('--original-color', eventColor); // Store for hover effect
                }

                eventEl.innerHTML = `<div class="event-title">${event.title}</div><div class="event-time">${event.start} – ${event.end}</div>`;
                
                // Add click handler for event details
                eventEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showEventDetails(event, eventEl);
                });
                
                grid.appendChild(eventEl);
            });
        });
    }

    function renderMonthEvents(events, container) {
        const grid = container.querySelector('#calendar-month-grid');
        const days = grid.querySelectorAll('.calendar-month-day');
        
        // Create a mapping from day of month to grid index and group events by day
        const dayToGridIndex = {};
        const eventsByDay = {};
        
        days.forEach((dayEl, index) => {
            const date = new Date(dayEl.dataset.date);
            const dayOfMonth = date.getDate();
            dayToGridIndex[dayOfMonth] = index;
            eventsByDay[dayOfMonth] = [];
        });

        // Group events by day
        events.forEach(event => {
            event.days.forEach(dayIndex => {
                const dayOfMonth = dayIndex + 1; // Convert from 0-based to 1-based
                if (eventsByDay[dayOfMonth]) {
                    eventsByDay[dayOfMonth].push(event);
                }
            });
        });

        // Render events for each day with overflow handling
        Object.keys(eventsByDay).forEach(dayOfMonth => {
            const dayEvents = eventsByDay[dayOfMonth];
            const gridIndex = dayToGridIndex[dayOfMonth];
            
            if (gridIndex !== undefined && gridIndex < days.length && dayEvents.length > 0) {
                const dayEl = days[gridIndex];
                const eventsContainer = dayEl.querySelector('.day-events');
                
                // Determine how many events we can show based on available space
                const isMobile = window.innerWidth <= 768;
                const maxVisibleEvents = isMobile ? 2 : 3; // Show fewer on mobile
                
                const visibleEvents = dayEvents.slice(0, maxVisibleEvents);
                const hiddenCount = dayEvents.length - maxVisibleEvents;
                
                // Render visible events
                visibleEvents.forEach(event => {
                    const eventEl = document.createElement('div');
                    eventEl.className = 'calendar-month-event';
                    eventEl.textContent = event.title;
                    const eventColor = getEventColor(event);
                    if(eventColor) {
                        // Convert hex to RGBA for faded background
                        const hex = eventColor.replace('#', '');
                        const r = parseInt(hex.substr(0, 2), 16);
                        const g = parseInt(hex.substr(2, 2), 16);
                        const b = parseInt(hex.substr(4, 2), 16);
                        eventEl.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
                        eventEl.style.borderLeftColor = eventColor; // Full opacity for border
                        eventEl.style.setProperty('--original-color', eventColor); // Store for hover effect
                    }
                    
                    // Add click handler for month view events
                    eventEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showEventDetails(event, eventEl);
                    });
                    
                    eventsContainer.appendChild(eventEl);
                });
                
                // Add "more" indicator if there are hidden events
                if (hiddenCount > 0) {
                    const moreEl = document.createElement('div');
                    moreEl.className = 'calendar-month-more';
                    moreEl.textContent = `+${hiddenCount} more`;
                    
                    // Add click handler to show all events for the day
                    moreEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showDayEventsPopover(dayEvents, dayOfMonth, moreEl);
                    });
                    
                    eventsContainer.appendChild(moreEl);
                }
            }
        });
    }

    function showDayEventsPopover(dayEvents, dayOfMonth, moreElement) {
        // Remove existing popover if any
        const existingPopover = document.querySelector('.day-events-popover');
        if (existingPopover) {
            existingPopover.remove();
        }

        const calendarBody = document.querySelector('#calendar-app .calendar-body');
        const appBody = document.querySelector('#calendar-app .app-body');
        const isMobile = window.innerWidth <= 768;

        // Create popover
        const popover = document.createElement('div');
        popover.className = 'day-events-popover';

        const { startDate } = getDateRange();
        const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), dayOfMonth);
        const dateText = currentDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
        });

        popover.innerHTML = `
            <div class="popover-content">
                <div class="popover-header">
                    <span class="popover-title">${dateText}</span>
                    <span class="popover-close">&times;</span>
                </div>
                <div class="popover-events-list">
                    ${dayEvents.map(event => {
                        const eventColor = getEventColor(event);
                        const timeText = event.allDay ? 'All day' : `${event.start} – ${event.end}`;
                        return `
                            <div class="popover-event-item" data-event-title="${event.title}">
                                <div class="event-color-dot" style="background-color: ${eventColor || '#34c759'}"></div>
                                <div class="event-details">
                                    <div class="event-title">${event.title}</div>
                                    <div class="event-time">${timeText}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="popover-arrow"></div>
        `;

        if (isMobile) {
            popover.classList.add('mobile-bottom-sheet');
            appBody.appendChild(popover);
        } else {
            calendarBody.appendChild(popover);
            
            // Desktop positioning logic
            const moreRect = moreElement.getBoundingClientRect();
            const calendarRect = calendarBody.getBoundingClientRect();

            let top = moreRect.top - calendarRect.top - 200; // Position above the more element
            let left = moreRect.left - calendarRect.left;

            popover.classList.add('from-bottom');
            
            // Keep it within bounds
            if (top < 10) {
                top = moreRect.bottom - calendarRect.top + 8;
                popover.classList.remove('from-bottom');
                popover.classList.add('from-top');
            }
            
            if (left + 250 > calendarRect.width) {
                left = calendarRect.width - 250 - 10;
            }
            if (left < 10) left = 10;

            popover.style.top = `${top}px`;
            popover.style.left = `${left}px`;
        }

        // Add event listeners
        const closeBtn = popover.querySelector('.popover-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => popover.remove());
        }

        // Add click handlers for individual events
        const eventItems = popover.querySelectorAll('.popover-event-item');
        eventItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const eventTitle = item.dataset.eventTitle;
                const event = dayEvents.find(ev => ev.title === eventTitle);
                if (event) {
                    popover.remove();
                    showEventDetails(event, item);
                }
            });
        });

        const closePopover = (e) => {
            if (!popover.querySelector('.popover-content').contains(e.target)) {
                popover.remove();
                document.removeEventListener('click', closePopover, true);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closePopover, true);
        }, 10);
    }

    function showEventInSidebar(event, eventElement) {
        const sidebar = document.querySelector('#calendar-day-sidebar');
        if (!sidebar) return;

        const isMobile = window.innerWidth <= 768;
        const { startDate } = getDateRange();
        const dateStr = startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        
        const recurringText = event.recurring ? 'Repeats every weekday' : 'Does not repeat';
        const dateText = startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        const timeText = event.allDay ? 'All day' : `${event.start} to ${event.end}`;

        // Clear existing content
        sidebar.innerHTML = `
            <div class="day-sidebar-content active">
                <div class="sidebar-event-title">${event.title}</div>
                <div class="sidebar-event-time">${timeText}</div>
                <div class="sidebar-event-date">${dateText}</div>
                
                <div class="sidebar-section">
                    <div class="sidebar-detail-item">
                        <span class="detail-icon">🔄</span>
                        <span class="detail-text">${recurringText}</span>
                    </div>
                    <div class="sidebar-detail-item">
                        <span class="detail-icon">🔔</span>
                        <span class="detail-text">Alert 15 minutes before start</span>
                    </div>
                </div>

                <div class="sidebar-section">
                    <div class="sidebar-detail-item">
                        <span class="detail-text">Add Location or Video Call</span>
                    </div>
                    <div class="sidebar-detail-item">
                        <span class="detail-text">Add Invitees</span>
                    </div>
                </div>

                ${event.description ? `
                    <div class="sidebar-section">
                        <div class="sidebar-description">${event.description}</div>
                    </div>
                ` : `
                    <div class="sidebar-section">
                        <div class="sidebar-detail-item">
                            <span class="detail-text">Add Notes or URL</span>
                        </div>
                    </div>
                `}
            </div>
        `;

        // Highlight the selected event
        document.querySelectorAll('.calendar-event').forEach(el => el.classList.remove('selected'));
        eventElement.classList.add('selected');
    }

    function showSidebar() {
        const dayContent = document.querySelector('.calendar-day-content');
        if (dayContent) {
            dayContent.classList.add('mobile-sidebar-visible');
        }
        
        // Replace header with back button on mobile
        const { startDate } = getDateRange();
        const dateStr = startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        const header = document.querySelector('.calendar-top-header');
        if (header) {
            header.innerHTML = `
                <button class="mobile-header-back" onclick="hideSidebar()">< ${dateStr}</button>
            `;
        }
    }

    function hideSidebar() {
        const dayContent = document.querySelector('.calendar-day-content');
        if (dayContent) {
            dayContent.classList.remove('mobile-sidebar-visible');
        }
        
        // Restore original header without re-rendering the whole calendar
        restoreCalendarHeader();
        
        // Clear selected event highlight
        document.querySelectorAll('.calendar-event').forEach(el => el.classList.remove('selected'));
        
        // Reset sidebar to placeholder
        const sidebar = document.querySelector('#calendar-day-sidebar');
        if (sidebar) {
            sidebar.innerHTML = `
                <div class="day-sidebar-placeholder">
                    <div class="placeholder-text">Select an event to view details</div>
                </div>
            `;
        }
    }

    function restoreCalendarHeader() {
        const { startDate } = getDateRange();
        const isMobile = window.innerWidth <= 768;
        
        let title, navButtons;
        if (currentView === 'day') {
            title = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            navButtons = `
                <button id="cal-prev-day">⟨</button>
                <button class="today-btn">Today</button>
                <button id="cal-next-day">⟩</button>
            `;
        } else if (currentView === 'week') {
            const monthName = startDate.toLocaleString('default', { month: 'long' });
            const year = startDate.getFullYear();
            title = `${monthName} ${year}`;
            navButtons = `
                <button id="cal-prev-week">⟨</button>
                <button class="today-btn">Today</button>
                <button id="cal-next-week">⟩</button>
            `;
        } else if (currentView === 'month') {
            const monthName = startDate.toLocaleString('default', { month: 'long' });
            const year = startDate.getFullYear();
            title = `${monthName} ${year}`;
            navButtons = `
                <button id="cal-prev-month">⟨</button>
                <button class="today-btn">Today</button>
                <button id="cal-next-month">⟩</button>
            `;
        }

        const header = document.querySelector('.calendar-top-header');
        if (header) {
            header.innerHTML = `
                <div class="calendar-title">${title}</div>
                <div class="calendar-controls">
                    <div class="calendar-nav">
                        ${navButtons}
                    </div>
                    <div class="calendar-view-switcher ${isMobile ? 'mobile-hidden' : ''}">
                        <button data-view="day" class="${currentView === 'day' ? 'active' : ''}">Day</button>
                        <button data-view="week" class="${currentView === 'week' ? 'active' : ''}">Week</button>
                        <button data-view="month" class="${currentView === 'month' ? 'active' : ''}">Month</button>
                    </div>
                </div>
            `;
        }
    }

    // Make function globally accessible
    window.hideSidebar = hideSidebar;

    function showEventDetails(event, eventElement) {
        const isMobile = window.innerWidth <= 768;
        
        if (currentView === 'day') {
            // Show in sidebar for day view
            showEventInSidebar(event, eventElement);
            if (isMobile) {
                showSidebar();
            }
            return;
        }
        
        // For week/month views, show popover
        // Remove existing popover if any
        const existingPopover = document.querySelector('.event-popover');
        if (existingPopover) {
            existingPopover.remove();
        }

        const calendarBody = document.querySelector('#calendar-app .calendar-body');
        const appBody = document.querySelector('#calendar-app .app-body');

        // Create popover
        const popover = document.createElement('div');
        popover.className = 'event-popover';

        const recurringText = event.recurring ? 'Repeats every weekday' : 'Does not repeat';
        const dateText = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        const timeText = event.allDay ? 'All day' : `${event.start} to ${event.end}`;

        const eventColor = getEventColor(event);
        popover.innerHTML = `
            <div class="popover-content">
                <div class="popover-header">
                    <span class="popover-title">${event.title}</span>
                    <div class="popover-controls">
                        <span class="control-btn color-dot" style="background-color: ${eventColor || '#34c759'}" data-event-title="${event.title}"></span>
                    </div>
                </div>
                <div class="popover-section popover-meta">
                    <div class="meta-item">Add Location or Video Call</div>
                </div>
                <div class="popover-section popover-details">
                    <div class="detail-item">
                        <span class="detail-text">${dateText} ${timeText}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">🔄</span>
                        <span class="detail-text">${recurringText}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">🔔</span>
                        <span class="detail-text">Alert 15 minutes before start</span>
                    </div>
                </div>
                <div class="popover-section popover-actions">
                    <div class="action-item">Add Invitees</div>
                </div>
                <div class="popover-section popover-notes">
                    <div class="action-item">${event.description || 'Add Notes or URL'}</div>
                </div>
            </div>
            <div class="popover-arrow"></div>
        `;

        if (isMobile) {
            popover.classList.add('mobile-bottom-sheet');
            appBody.appendChild(popover);
        } else {
            calendarBody.appendChild(popover);
            
            // Desktop positioning logic
            const popoverRect = popover.getBoundingClientRect();
            const eventRect = eventElement.getBoundingClientRect();
            const calendarRect = calendarBody.getBoundingClientRect();

            let top = eventRect.top - calendarRect.top + (eventRect.height / 2) - (popoverRect.height / 2);
            let left = eventRect.right - calendarRect.left + 12; // Arrow width + gap

            popover.classList.add('from-right');
            // If not enough space on the right, show on the left
            if (left + popoverRect.width > calendarRect.width) {
                left = eventRect.left - calendarRect.left - popoverRect.width - 12;
                popover.classList.remove('from-right');
                popover.classList.add('from-left');
            }

            // Keep it within vertical bounds
            if (top < 10) top = 10;
            if (top + popoverRect.height > calendarRect.height - 10) {
                top = calendarRect.height - popoverRect.height - 10;
            }

            popover.style.top = `${top}px`;
            popover.style.left = `${left}px`;
        }

        const closePopover = (e) => {
             // Don't close if we click inside the popover's content area
            if (popover.querySelector('.popover-content').contains(e.target)) {
                return;
            }

            // Don't close if we click the original event that opened it
            if (!isMobile && e.target === eventElement) {
                return;
            }
            
            // Otherwise, close it.
            popover.remove();
            document.removeEventListener('click', closePopover, true);
        };

        // Add color picker functionality
        const colorDot = popover.querySelector('.color-dot');
        if (colorDot) {
            colorDot.addEventListener('click', (e) => {
                e.stopPropagation();
                showColorPicker(event, eventElement, popover);
            });
        }

        // Use a timeout to avoid the same click closing the popover immediately
        setTimeout(() => {
            document.addEventListener('click', closePopover, true);
        }, 10);
    }

    function showColorPicker(event, eventElement, popover) {
        // Remove existing color picker if any
        const existingPicker = document.querySelector('.color-picker-overlay');
        if (existingPicker) {
            existingPicker.remove();
        }

        const calendarBody = document.querySelector('#calendar-app .calendar-body');
        const appBody = document.querySelector('#calendar-app .app-body');
        const isMobile = window.innerWidth <= 768;

        // Predefined color palette
        const colorPalette = [
            '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', 
            '#5856d6', '#af52de', '#f85149', '#a855f7', '#06b6d4',
            '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'
        ];

        const colorPicker = document.createElement('div');
        colorPicker.className = 'color-picker-overlay';
        
        colorPicker.innerHTML = `
            <div class="color-picker-content">
                <div class="color-picker-header">Choose Color</div>
                <div class="color-picker-palette">
                    ${colorPalette.map(color => 
                        `<div class="color-option" style="background-color: ${color}" data-color="${color}"></div>`
                    ).join('')}
                </div>
                <div class="color-picker-custom">
                    <input type="color" id="custom-color-input" value="${getEventColor(event) || '#34c759'}">
                    <label for="custom-color-input">Custom Color</label>
                </div>
            </div>
        `;

        if (isMobile) {
            colorPicker.classList.add('mobile-bottom-sheet');
            appBody.appendChild(colorPicker);
        } else {
            calendarBody.appendChild(colorPicker);
            
            // Position near the popover
            const popoverRect = popover.getBoundingClientRect();
            const calendarRect = calendarBody.getBoundingClientRect();
            
            colorPicker.style.top = `${popoverRect.top - calendarRect.top + 50}px`;
            colorPicker.style.left = `${popoverRect.left - calendarRect.left}px`;
        }

        // Add event listeners for color selection
        const colorOptions = colorPicker.querySelectorAll('.color-option');
        const customColorInput = colorPicker.querySelector('#custom-color-input');

        colorOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const newColor = e.target.dataset.color;
                applyColorChange(event, eventElement, newColor, popover);
                colorPicker.remove();
            });
        });

        customColorInput.addEventListener('change', (e) => {
            const newColor = e.target.value;
            applyColorChange(event, eventElement, newColor, popover);
            colorPicker.remove();
        });

        // Close on outside click
        const closeColorPicker = (e) => {
            if (!colorPicker.querySelector('.color-picker-content').contains(e.target)) {
                colorPicker.remove();
                document.removeEventListener('click', closeColorPicker, true);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeColorPicker, true);
        }, 10);
    }

    function applyColorChange(event, eventElement, newColor, popover) {
        // Save the color override
        saveColorOverride(event.title, newColor);
        
        // Update the color dot in the popover
        const colorDot = popover.querySelector('.color-dot');
        if (colorDot) {
            colorDot.style.backgroundColor = newColor;
        }
        
        // Update all instances of this event in the current view
        const allEventElements = document.querySelectorAll('.calendar-event, .calendar-month-event, .all-day-event');
        allEventElements.forEach(el => {
            const eventTitle = el.querySelector('.event-title')?.textContent || el.textContent;
            
            // Check if this element should be updated
            let shouldUpdate = false;
            if (event.title.includes('🏎️')) {
                // If the changed event is F1, update all F1 events
                shouldUpdate = eventTitle.includes('🏎️');
            } else {
                // Otherwise, only update events with exact title match
                shouldUpdate = eventTitle === event.title;
            }
            
            if (shouldUpdate) {
                // Convert hex to RGBA for faded background
                const hex = newColor.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                el.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
                el.style.borderLeftColor = newColor;
                el.style.setProperty('--original-color', newColor);
            }
        });
    }

    function updateCurrentTimeIndicator() {
        const indicator = document.getElementById('current-time-indicator');
        if (!indicator) return;
        
        // Only show indicator if we're viewing the current week/day
        if (currentOffset !== 0) {
            indicator.style.display = 'none';
            return;
        }
        
        indicator.style.display = 'block';
        const nowInVietnam = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
        const minutes = nowInVietnam.getHours() * 60 + nowInVietnam.getMinutes();
        indicator.style.top = `${minutes}px`;
    }
    
    // Initialize calendar when app is opened
    function initializeCalendar() {
        console.log('initializeCalendar called, isInitialized:', isInitialized);
        if (!isInitialized) {
            console.log('Initializing calendar...');
            renderCalendar(() => {
                console.log('Calendar initialization complete');
                updateCurrentTimeIndicator();
                // Auto-scroll to current time for day and week views on initial load
                if (currentView === 'day' || currentView === 'week') {
                    // Use longer delay for initial load to ensure elements are fully rendered
                    setTimeout(() => {
                        autoScrollToCurrentTime();
                    }, 100);
                }
            });
            isInitialized = true;
        } else {
            console.log('Calendar already initialized');
        }
    }

    function autoScrollToCurrentTime() {
        let scrollPane;
        if (currentView === 'day') {
            scrollPane = calendarBody.querySelector('.calendar-day-timeline');
        } else if (currentView === 'week') {
            scrollPane = calendarBody.querySelector('.calendar-week-scroll-pane');
        }

        if (scrollPane) {
            const nowInVietnam = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
            const minutes = nowInVietnam.getHours() * 60 + nowInVietnam.getMinutes();
            const scrollPaneHeight = scrollPane.clientHeight;
            const scrollHeight = scrollPane.scrollHeight;
            
            console.log('Auto-scroll dimensions:', {
                view: currentView,
                clientHeight: scrollPaneHeight,
                scrollHeight: scrollHeight,
                hasOverflow: scrollHeight > scrollPaneHeight,
                className: scrollPane.className
            });
            
            if (scrollPaneHeight > 0 && scrollHeight > scrollPaneHeight) {
                const scrollTop = Math.max(0, minutes - (scrollPaneHeight / 2));
                console.log('Auto-scrolling to current time:', {
                    minutes,
                    scrollTop,
                    scrollPaneHeight
                });
                scrollPane.scrollTop = scrollTop;
            } else {
                console.log('No overflow to scroll or scroll pane height is 0');
            }
        }
    }

    // Function to call when calendar app becomes visible
    function onCalendarAppOpened() {
        console.log('Calendar app opened, triggering auto-scroll');
        updateCurrentTimeIndicator();
        if (currentView === 'day' || currentView === 'week') {
            setTimeout(() => {
                autoScrollToCurrentTime();
            }, 100);
        }
    }
    
    // Expose functions globally so they can be called from setupDockApps
    window.initializeCalendar = initializeCalendar;
    window.onCalendarAppOpened = onCalendarAppOpened;
    
    calendarBody.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.dataset.view) {
            // View switcher
            currentView = button.dataset.view;
            currentOffset = 0; // Reset to current period
            document.querySelectorAll('.calendar-view-switcher button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            renderCalendar(() => {
                updateCurrentTimeIndicator();
                // Auto-scroll to current time for day and week views
                if (currentView === 'day' || currentView === 'week') {
                    setTimeout(() => {
                        autoScrollToCurrentTime();
                    }, 100);
                }
            });
        } else if (button.id === 'cal-prev-day' || button.id === 'cal-prev-week' || button.id === 'cal-prev-month') {
            currentOffset--;
            renderCalendar(() => {
                updateCurrentTimeIndicator();
            });
        } else if (button.id === 'cal-next-day' || button.id === 'cal-next-week' || button.id === 'cal-next-month') {
            currentOffset++;
            renderCalendar(() => {
                updateCurrentTimeIndicator();
            });
        } else if (button.classList.contains('today-btn')) {
            if (currentOffset === 0) return;
            currentOffset = 0;
            renderCalendar(() => {
                updateCurrentTimeIndicator();
                // Auto-scroll to current time for day and week views
                if (currentView === 'day' || currentView === 'week') {
                    setTimeout(() => {
                        autoScrollToCurrentTime();
                    }, 100);
                }
            });
        }
    });
    
    // Don't auto-render on setup, wait for app to be opened
    setInterval(updateCurrentTimeIndicator, 60000);
    
    // Initialize calendar immediately so it's ready when opened
    initializeCalendar();
}
