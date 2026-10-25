export function setupMailApp() {
    const form = document.getElementById('email-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const fromEmail = document.getElementById('email-from').value;
        const subject = document.getElementById('email-subject').value;
        const message = document.getElementById('email-body-content').value;
        const submitBtn = form.querySelector('.send-btn');
        const originalText = submitBtn.textContent;
        
        // Show loading state
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
        
        // Create form data for Netlify
        const formData = new FormData();
        formData.append('form-name', 'contact');
        formData.append('email', fromEmail);
        formData.append('subject', subject);
        formData.append('message', message);
        formData.append('name', 'Website Visitor'); // Default name since we don't have a name field
        
        // Submit to Netlify
        fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formData).toString()
        })
        .then(response => {
            if (response.ok) {
                // Show success message
                alert('Message sent successfully! I\'ll get back to you soon.');
                form.reset();
                document.getElementById('email-to').value = 'Daryl Hensman-Rosser'; // Reset the "to" field
            } else {
                throw new Error('Network response was not ok');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Sorry, there was an error sending your message. Please try again.');
        })
        .finally(() => {
            // Reset button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    });
}
