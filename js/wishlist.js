// ============================================
// VKclothing — Wishlist System
// Handles local storage and syncing of wishlist
// ============================================

const Wishlist = {
  get() {
    return JSON.parse(localStorage.getItem('vk_wishlist') || '[]');
  },
  
  save(items) {
    localStorage.setItem('vk_wishlist', JSON.stringify(items));
    if (window.Auth && Auth.isLoggedIn()) {
      Auth.syncData();
    }
  },
  
  add(productId) {
    // Require login to use wishlist
    if (window.Auth && !Auth.isLoggedIn()) {
      if (window.showToast) showToast('Please sign in to save items to your wishlist.');
      else alert('Please sign in to save items to your wishlist.');
      return false;
    }
    const items = this.get();
    if (!items.includes(productId)) {
      items.push(productId);
      this.save(items);
      if (window.showToast) showToast('\u2665 Added to wishlist!');
      return true; // added
    }
    return false; // already exists
  },
  
  remove(productId) {
    const items = this.get();
    const newItems = items.filter(id => id !== productId);
    this.save(newItems);
    return true;
  },
  
  has(productId) {
    return this.get().includes(productId);
  }
};

// Expose globally for buttons
window.addToWishlist = (productId) => Wishlist.add(productId);
window.removeFromWishlist = (productId) => Wishlist.remove(productId);

// Toggle wishlist and update button UI
window.toggleWishlist = (productId, btn) => {
  const wasWishlisted = Wishlist.has(productId);
  let nowWishlisted;
  if (wasWishlisted) {
    Wishlist.remove(productId);
    nowWishlisted = false;
    if (window.showToast) showToast('Removed from wishlist.');
  } else {
    nowWishlisted = Wishlist.add(productId);
  }
  
  if (btn) {
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.setAttribute('fill', nowWishlisted ? 'red' : 'none');
      svg.setAttribute('stroke', nowWishlisted ? 'red' : 'currentColor');
    }
    btn.dataset.wishlisted = nowWishlisted ? 'true' : 'false';
  }
};

// ---- UI Rendering on wishlist.html ----
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('wishlist-container');
  if (!container) return; // Only run on wishlist page

  const wItems = Wishlist.get();
  if (wItems.length === 0) {
    container.innerHTML = `
      <div class="wishlist-empty">
        <p>Your wishlist is empty.</p>
        <a href="shop.html" class="btn btn-primary">Discover Products</a>
      </div>
    `;
    return;
  }

  try {
    const products = await API.getProducts();
    const images = await API.getProductImages();
    
    // Filter out unknown products just in case they were deleted
    const validItems = wItems.filter(id => products.some(p => p.id === id));
    
    if (validItems.length !== wItems.length) {
      Wishlist.save(validItems);
    }

    if (validItems.length === 0) {
      container.innerHTML = `<div class="wishlist-empty"><p>Your wishlist is empty.</p><a href="shop.html" class="btn btn-primary">Discover Products</a></div>`;
      return;
    }

    container.innerHTML = `<div class="wishlist-grid">
      ${validItems.map(id => {
        const prod = products.find(p => p.id === id);
        // Display image logic
        const pImgs = images.filter(img => img.productId === id);
        const displayImg = pImgs.length > 0 ? pImgs[0].imageUrl : prod.imageUrl;

        return `
          <div class="wishlist-item">
            <button class="remove-wishlist" onclick="removeAndReload('${id}')" title="Remove">✕</button>
            <div class="product-card">
              <a href="product.html?id=${prod.id}" class="product-image">
                ${displayImg ? `<img src="${displayImg}" alt="${prod.name}">` : '<div class="no-image">No Image</div>'}
              </a>
              <div class="product-info">
                <span class="product-category">${prod.category}</span>
                <a href="product.html?id=${prod.id}" class="product-title">${prod.name}</a>
                <div class="product-price">₹${prod.price.toLocaleString()}</div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;

  } catch (err) {
    container.innerHTML = '<div class="alert alert-error">Failed to load wishlist products.</div>';
  }
});

// Helper for UI
window.removeAndReload = (id) => {
  Wishlist.remove(id);
  window.location.reload();
};
