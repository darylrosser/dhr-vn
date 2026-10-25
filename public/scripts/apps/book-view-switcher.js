document.addEventListener('DOMContentLoaded', () => {
    const viewSwitcher = document.getElementById('view-switcher');
    const bookstoreView = document.getElementById('view-bookstore');
    const dateView = document.getElementById('view-date');
    const bookListItems = document.querySelectorAll('#view-bookstore li');
    const dailyImagesContainer = document.getElementById('daily-images');

    let books = [];
    bookListItems.forEach(item => {
        books.push({
            name: item.dataset.bookName,
            description: item.dataset.description,
            date: item.dataset.date,
            bookstore: item.dataset.bookstore
        });
    });

    let dailyImages = {};
    if (dailyImagesContainer) {
        dailyImagesContainer.querySelectorAll('div').forEach(item => {
            dailyImages[item.dataset.date] = item.dataset.imageSrc;
        });
    }

    const renderDateView = () => {
        const booksByDate = books.reduce((acc, book) => {
            const date = book.date;
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(book);
            return acc;
        }, {});

        const sortedDates = Object.keys(booksByDate).sort((a, b) => new Date(b) - new Date(a));

        let html = '';
        sortedDates.forEach(date => {
            const formattedDate = new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            html += `<h2>${formattedDate}</h2>`;

            if (dailyImages[date]) {
                html += `<img src="${dailyImages[date]}" alt="Book haul for ${formattedDate}" class="daily-haul-image">`;
            }

            html += '<ul>';
            booksByDate[date].forEach(book => {
                let descriptionHtml = '';
                if (book.description) {
                    const capitalizedDescription = book.description.charAt(0).toUpperCase() + book.description.slice(1);
                    descriptionHtml = `<p>${capitalizedDescription}</p>`;
                }
                html += `<li><strong>${book.name}</strong> at <em>${book.bookstore}</em>${descriptionHtml}</li>`;
            });
            html += '</ul>';
        });
        dateView.innerHTML = html;
    };

    renderDateView();

    viewSwitcher.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const view = e.target.dataset.view;

            document.querySelectorAll('#view-switcher button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            if (view === 'bookstore') {
                bookstoreView.style.display = 'block';
                dateView.style.display = 'none';
            } else {
                bookstoreView.style.display = 'none';
                dateView.style.display = 'block';
            }
        }
    });
});
