/**
 * VKclothing UI Utilities
 * Global Toast System
 */

function showToast(message, type = 'info') {
  // Task 5: Fallback for empty messages
  if (!message || typeof message !== 'string') {
    message = "Action completed";
  }

  let container = document.querySelector('.toast-container');
  
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon based on type
  let icon = '';
  if (type === 'success') icon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="#2ecc71"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
  else if (type === 'error') icon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="#e74c3c"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>';
  else if (type === 'warning') icon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="#f1c40f"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
  else icon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="#3498db"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';

  // Task 3: Ensure message is properly set using textContent for safety
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message"></div>
  `;
  toast.querySelector('.toast-message').textContent = message;

  container.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
      if (container.childNodes.length === 0) {
        container.remove();
      }
    });
  }, 4000); // 4 seconds for better readability
}

// Global error handler for unhandled promise rejections (often network errors)
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  showToast('Connection issue. Please try again.', 'error');
});
