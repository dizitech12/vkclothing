// ============================================
// VKclothing — Authentication System
// Handles Login, Registration, and Data Sync
// ============================================

let currentAuthMode = 'login'; // 'login' or 'register'

// ---- UI Toggles ----
function switchAuthTab(mode) {
  currentAuthMode = mode;
  document.getElementById('btn-tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('btn-tab-register').classList.toggle('active', mode === 'register');
  
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const btn = document.getElementById('auth-submit-btn');
  const msg = document.getElementById('auth-message');
  
  msg.style.display = 'none';

  if (mode === 'login') {
    title.textContent = 'Welcome Back';
    subtitle.textContent = 'Enter your details to sign in.';
    btn.textContent = 'Sign In';
  } else {
    title.textContent = 'Create Account';
    subtitle.textContent = 'Sign up with your phone number.';
    btn.textContent = 'Sign Up';
  }
}

function togglePasswordVisibility() {
  const input = document.getElementById('password-input');
  const btn = document.querySelector('.toggle-password');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

// ---- Form Submit Handler ----
async function handleAuthSubmit(e) {
  e.preventDefault();
  
  const phone = document.getElementById('phone-input').value;
  const password = document.getElementById('password-input').value;
  const btn = document.getElementById('auth-submit-btn');
  const msg = document.getElementById('auth-message');
  
  if (btn) btn.disabled = true;
  if (btn) btn.textContent = 'Please wait...';
  if (msg) msg.style.display = 'none';

  try {
    if (currentAuthMode === 'login') {
      const res = await API.loginUser(phone, password);
      if (res.success) {
        if (typeof showToast === 'function') showToast('Signed in successfully!', 'success');
        completeLogin(res.userId, res.phone, res.cart, res.wishlist);
      } else {
        showError(res.error || 'Invalid phone or password.');
        if (typeof showToast === 'function') showToast(res.error || 'Invalid phone or password.', 'error');
      }
    } else {
      const res = await API.registerUser(phone, password);
      if (res.success) {
        if (typeof showToast === 'function') showToast('Account created! Welcome.', 'success');
        // Auto login after register
        completeLogin(res.userId, phone, '[]', '[]');
      } else {
        showError(res.error || 'Failed to create account.');
        if (typeof showToast === 'function') showToast(res.error || 'Failed to create account.', 'error');
      }
    }
  } catch (err) {
    console.error('Auth error:', err);
    showError('Connection error. Please try again.');
    if (typeof showToast === 'function') showToast('Connection error. Please try again.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = currentAuthMode === 'login' ? 'Sign In' : 'Sign Up';
    }
  }
}

function showError(text) {
  const msg = document.getElementById('auth-message');
  if (msg) {
    msg.textContent = text;
    msg.className = 'form-message error';
    msg.style.display = 'block';
  }
}

// ---- Login Success Handler ----
function completeLogin(userId, phone, cartJSON, wishlistJSON) {
  localStorage.setItem('vk_user_id', userId);
  localStorage.setItem('vk_user_token', userId + '_token'); // As requested
  localStorage.setItem('vk_user_phone', phone);
  
  // Merge remote cart into local cart
  try {
    const remoteCart = JSON.parse(cartJSON || '[]');
    let localCart = JSON.parse(localStorage.getItem('vk_cart') || '[]');
    
    // Smart merge: Add local items to remote. If variant exists, sum quantities.
    let mergedCart = [...remoteCart];
    localCart.forEach(localItem => {
      const existing = mergedCart.find(r => 
        r.id === localItem.id && 
        r.size === localItem.size && 
        r.color === localItem.color
      );
      if (existing) {
        existing.quantity += localItem.quantity;
      } else {
        mergedCart.push(localItem);
      }
    });
    
    // Limit to max 20 unique cart entries to prevent payload explosion
    if (mergedCart.length > 20) {
      mergedCart = mergedCart.slice(0, 20);
    }
    
    localStorage.setItem('vk_cart', JSON.stringify(mergedCart));
    
    // Set remote wishlist
    const remoteWishlist = JSON.parse(wishlistJSON || '[]');
    if (remoteWishlist.length > 0) {
      localStorage.setItem('vk_wishlist', JSON.stringify(remoteWishlist));
    }
  } catch(e) {
    console.error('Error parsing user data syncing', e);
  }

  // Redirect to original destination or shop
  const returnUrl = sessionStorage.getItem('vk_auth_return_url') || 'shop.html';
  sessionStorage.removeItem('vk_auth_return_url');
  
  // Minimal delay to let toast be seen
  setTimeout(() => {
    window.location.href = returnUrl;
  }, 800);
}

// ---- Global Auth Helpers ----
const Auth = {
  isLoggedIn() {
    return !!localStorage.getItem('vk_user_id');
  },
  
  getUserId() {
    return localStorage.getItem('vk_user_id');
  },
  
  getUserPhone() {
    return localStorage.getItem('vk_user_phone');
  },

  logout() {
    localStorage.removeItem('vk_user_id');
    localStorage.removeItem('vk_user_phone');
    localStorage.removeItem('vk_cart');
    localStorage.removeItem('vk_wishlist');
    
    // Route protection enforcement on logout
    const protectedRoutes = ['checkout.html', 'orders.html', 'wishlist.html'];
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    
    if (protectedRoutes.includes(currentPath)) {
      window.location.href = 'index.html';
    } else {
      if (typeof showToast === 'function') showToast('You have been logged out.', 'info');
      // Update UI without full page refresh
      const navAuthLink = document.getElementById('nav-auth-link');
      if (navAuthLink) {
        // Destroy the wrapper dropdown if it exists
        const wrapper = navAuthLink.closest('.profile-dropdown-wrapper');
        if (wrapper) {
          navAuthLink.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
          navAuthLink.href = 'login.html';
          navAuthLink.title = 'Sign In';
          navAuthLink.onclick = null;
          wrapper.parentNode.insertBefore(navAuthLink, wrapper);
          wrapper.remove();
        }
      }
      
      const footerAuthLink = document.getElementById('footer-auth-link');
      if (footerAuthLink) {
        footerAuthLink.textContent = 'Sign In';
        footerAuthLink.href = 'login.html';
        footerAuthLink.onclick = null;
      }
      
      // Update cart state locally
      if (typeof updateCartCount === 'function') updateCartCount();
      if (typeof renderCart === 'function') renderCart();
    }
  },

  requireAuth(returnUrl) {
    if (!this.isLoggedIn()) {
      sessionStorage.setItem('vk_auth_return_url', returnUrl || window.location.pathname);
      window.location.replace('login.html');
      return false;
    }
    return true;
  },

  // Calls backend to silently sync cart/wishlist
  async syncData() {
    if (!this.isLoggedIn()) return;
    const cart = localStorage.getItem('vk_cart') || '[]';
    const wishlist = localStorage.getItem('vk_wishlist') || '[]';
    // Fire and forget
    API.syncUserData(this.getUserId(), cart, wishlist).catch(() => {});
  },

  // Validates if the user's account still exists in Google Sheets
  async validateSession() {
    if (!this.isLoggedIn()) return;
    try {
      const res = await API.verifyUser(this.getUserId());
      if (res && res.success === false) {
        // Account has been deleted by Admin
        this.logout();
        if (typeof showToast === 'function') showToast('Your account session has expired. please login again.', 'warning');
      }
    } catch (e) {
      console.warn('Silent session validation failed', e);
    }
  }
};
window.Auth = Auth;

// Auto update header UI if navbar exists on page
document.addEventListener('DOMContentLoaded', () => {
  // 0. Validate User Session against backend if logged in
  Auth.validateSession();

  // 1. Route Protections
  const protectedRoutes = ['wishlist.html', 'orders.html', 'checkout.html'];
  const currentPath = window.location.pathname.split('/').pop();
  
  if (protectedRoutes.includes(currentPath)) {
    if (!Auth.isLoggedIn()) {
      Auth.requireAuth(currentPath);
      return;
    }
  }

  // 2. Auth UI
  if (Auth.isLoggedIn()) {
    const navAuthLink = document.getElementById('nav-auth-link');
    const footerAuthLink = document.getElementById('footer-auth-link');
    
    if (navAuthLink) {
      // Build Profile Dropdown
      const wrapper = document.createElement('div');
      wrapper.className = 'profile-dropdown-wrapper';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      
      navAuthLink.parentNode.insertBefore(wrapper, navAuthLink);
      wrapper.appendChild(navAuthLink);

      const dropdown = document.createElement('div');
      dropdown.className = 'profile-dropdown';
      dropdown.style.cssText = 'position:absolute; top:calc(100% + 10px); right:0; background:#ffffff; border:1px solid var(--color-border); border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1); width:180px; display:none; flex-direction:column; z-index:9999; overflow:hidden; opacity:0; transform:translateY(-10px); transition: opacity 0.2s ease, transform 0.2s ease;';
      
      dropdown.innerHTML = `
        <div style="padding:12px 16px; border-bottom:1px solid var(--color-border); background:#fafafa;">
          <small style="color:var(--color-text-muted); font-size:0.75rem;">Signed in as</small>
          <div style="font-weight:600; font-size:0.9rem; color:var(--color-text); margin-top:2px;">${Auth.getUserPhone()}</div>
        </div>
        <a href="orders.html" style="padding:12px 16px; text-decoration:none; color:var(--color-text); font-size:0.95rem; display:block; border-bottom:1px solid var(--color-border); transition: background 0.15s ease;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='none'">My Orders</a>
        <a href="wishlist.html" style="padding:12px 16px; text-decoration:none; color:var(--color-text); font-size:0.95rem; display:block; border-bottom:1px solid var(--color-border); transition: background 0.15s ease;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='none'">Wishlist</a>
        <button id="logout-btn" style="padding:12px 16px; text-align:left; background:none; border:none; color:var(--color-error); font-size:0.95rem; cursor:pointer; width:100%; display:flex; align-items:center; gap:8px; transition: background 0.15s ease;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='none'">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Log Out
        </button>
      `;
      wrapper.appendChild(dropdown);

      navAuthLink.innerHTML += `<span style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;background:var(--color-primary);border-radius:50%;"></span>`;
      navAuthLink.style.position = 'relative';
      navAuthLink.href = '#';
      navAuthLink.removeAttribute('title');
      
      // Dropdown Toggle
      navAuthLink.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isVisible = dropdown.style.display === 'flex';
        if (isVisible) {
          dropdown.style.opacity = '0';
          dropdown.style.transform = 'translateY(-10px)';
          setTimeout(() => dropdown.style.display = 'none', 200);
        } else {
          dropdown.style.display = 'flex';
          // trigger reflow
          void dropdown.offsetWidth;
          dropdown.style.opacity = '1';
          dropdown.style.transform = 'translateY(0)';
        }
      };

      // Close on Outside Click
      document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target) && dropdown.style.display === 'flex') {
          dropdown.style.opacity = '0';
          dropdown.style.transform = 'translateY(-10px)';
          setTimeout(() => dropdown.style.display = 'none', 200);
        }
      });

      // Handle Log Out click
      dropdown.querySelector('#logout-btn').onclick = () => {
        if (confirm('Are you sure you want to log out?')) {
          Auth.logout();
        }
      };

      // Proactively hydrate user data (Wishlist/Cart) on page load to persist states
      setTimeout(async () => {
        try {
          const res = await API.getUserData(Auth.getUserId());
          if (res && res.success) {
            // Update local wishlist mirror
            const remoteWishlist = JSON.parse(res.wishlist || '[]');
            localStorage.setItem('vk_wishlist', JSON.stringify(remoteWishlist));
            
            // Re-render heart buttons on the current page to match hydrated state
            document.querySelectorAll('[data-wishlisted]').forEach(btn => {
              // btn format could be on product card or product detail page
              // Use an onclick regex hack or a generic class if possible, 
              // but we can just dynamically scan for product IDs
              const clickStr = btn.getAttribute('onclick') || '';
              const match = clickStr.match(/['"](P\d+)['"]/);
              if (match && match[1]) {
                const isWishlisted = remoteWishlist.includes(match[1]);
                btn.dataset.wishlisted = isWishlisted ? 'true' : 'false';
                const svg = btn.querySelector('svg');
                if (svg) {
                  svg.setAttribute('fill', isWishlisted ? 'red' : 'none');
                  svg.setAttribute('stroke', isWishlisted ? 'red' : 'currentColor');
                }
              }
            });
          }
        } catch (e) {
          console.warn('Silent user data hydration failed', e);
        }
      }, 500); // Slight delay so main UI renders first
    }

    if (footerAuthLink) {
      footerAuthLink.textContent = 'Logout';
      footerAuthLink.href = '#';
      footerAuthLink.onclick = (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to log out?')) Auth.logout();
      }
    }
  }
});
