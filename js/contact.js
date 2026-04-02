// ============================================
// VKclothing — Contact Form Logic
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', handleContact);

  async function handleContact(e) {
    e.preventDefault();

    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const message = document.getElementById('contact-message-input').value.trim();
    const msgEl = document.getElementById('contact-message');
    const btn = document.getElementById('contact-btn');

    if (!name || !email || !message) {
      msgEl.textContent = 'Please fill in all fields.';
      msgEl.className = 'form-message error';
      msgEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const result = await API.submitContact({ name, email, message });

      if (result.success) {
        msgEl.textContent = 'Message sent successfully! We\'ll get back to you soon.';
        msgEl.className = 'form-message success';
        msgEl.style.display = 'block';
        form.reset();
        btn.textContent = '✓ Sent!';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Send Message';
        }, 3000);
      } else {
        msgEl.textContent = result.error || 'Failed to send message. Please try again.';
        msgEl.className = 'form-message error';
        msgEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Send Message';
      }
    } catch (err) {
      msgEl.textContent = 'Something went wrong. Please try again.';
      msgEl.className = 'form-message error';
      msgEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  }
});
