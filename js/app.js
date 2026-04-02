// ============================================
// VKclothing — Main App Logic
// Navbar, featured products, cart count, toast
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  updateCartCount();

  // Load featured products on home page
  const featuredGrid = document.getElementById('featured-grid');
  if (featuredGrid) {
    loadFeaturedProducts(featuredGrid);
  }
});

// ---------- Navbar ----------
function initNavbar() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.nav-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('open');
      toggle.classList.toggle('active');
    });

    // Close menu on link click
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('open');
        toggle.classList.remove('active');
      });
    });
  }

  // Highlight active nav link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-menu a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

// ---------- Featured Products ----------
async function loadFeaturedProducts(container) {
  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const products = await API.getProducts();
    // Show first 4 products as featured
    const featured = products.slice(0, 4);

    if (featured.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);grid-column:1/-1;padding:40px;">No products available yet.</p>';
      return;
    }

    container.innerHTML = featured.map(product => createProductCard(product)).join('');
  } catch (err) {
    console.error('Featured products error:', err);
    container.innerHTML = '<p style="text-align:center;color:var(--color-error);grid-column:1/-1;">Failed to load products.</p>';
    if (typeof showToast === 'function') showToast('Failed to load featured products.', 'error');
  }
}

// ---------- Product Card ----------
function createProductCard(product) {
  // We no longer have global stock. We'll let users see stock on product page.
  // Fallback image SVG when no imageUrl
  const imgHtml = product.imageUrl
    ? `<img src="${product.imageUrl}" alt="${product.name}" loading="lazy"
           onerror="this.outerHTML='<div class=\\'fallback-img\\'><svg viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\' fill=\\'none\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><path d=\\'M21 15l-5-5L5 21\\'/></svg><span>No Image</span></div>'">`
    : `<div class="fallback-img">
        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <span>No Image</span>
      </div>`;

  const isWishlisted = window.Wishlist && window.Wishlist.has(product.id);
  const heartFill = isWishlisted ? 'red' : 'none';
  const heartStroke = isWishlisted ? 'red' : 'currentColor';

  return `
    <div class="product-card" onclick="window.location.href='product.html?id=${product.id}'">
      <div class="product-card-img" style="position:relative;">
        <button class="btn btn-outline" 
                style="position:absolute; top:8px; right:8px; z-index:2; padding:6px; background:rgba(255,255,255,0.9); border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.1); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer;"
                onclick="event.stopPropagation(); if(window.toggleWishlist) window.toggleWishlist('${product.id}', this)"
                data-wishlisted="${isWishlisted ? 'true' : 'false'}"
                title="Wishlist">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="${heartFill}" stroke="${heartStroke}" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.501 5.501 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        ${imgHtml}
      </div>
      <div class="product-card-body">
        <h3>${product.name}</h3>
        <p class="product-desc">${product.description || ''}</p>
        <p class="product-price">₹${product.price.toLocaleString()}</p>
        <button class="btn btn-primary btn-sm btn-add-cart" onclick="event.stopPropagation(); window.location.href='product.html?id=${product.id}'">
          Order Now
        </button>
      </div>
    </div>
  `;
}

// ---------- Quick Add to Cart ----------
async function addToCartQuick(productId) {
  const products = await API.getProducts();
  const product = products.find(p => p.id === productId);
  if (!product || product.stock <= 0) return;

  const cart = getCart();
  const existing = cart.find(item => item.id === productId);

  if (existing) {
    // Check stock before increasing
    if (existing.quantity >= product.stock) {
      showToast(`Only ${product.stock} items left in stock`);
      return;
    }
    existing.quantity += 1;
  } else {
    if (cart.length >= 20) {
      showToast('Cart is full (max 20 items).');
      return;
    }
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.stock,
      quantity: 1,
      size: 'M',
    });
  }

  saveCart(cart);
  updateCartCount();
  showToast(`${product.name} added to cart!`);
}

// ---------- Buy Again Helper ----------
window.buyAgain = async function(productId, productName, size, color, price) {
  try {
    const variants = await API.getProductVariants();
    const variant = variants.find(v => v.productId === productId && v.size === size && v.color === color);
    
    if (variant && variant.stock > 0) {
      const products = await API.getProducts();
      const prod = products.find(p => p.id === productId);
      const imageUrl = prod ? prod.imageUrl : '';
      
      const cart = getCart();
      const existing = cart.find(item => item.id === productId && item.size === size && item.color === color);
      
      if (existing) {
        if (existing.quantity >= variant.stock) {
          showToast(`Only ${variant.stock} items left in stock`);
          return;
        }
        existing.quantity += 1;
      } else {
        if (cart.length >= 20) {
          showToast('Cart is full (max 20 items).');
          return;
        }
        cart.push({
          id: productId,
          name: productName,
          price: parseFloat(price) || 0,
          imageUrl: imageUrl,
          stock: variant.stock,
          quantity: 1,
          size: size,
          color: color
        });
      }
      
      saveCart(cart);
      updateCartCount();
      showToast(`${productName} added to cart!`);
      setTimeout(() => { window.location.href = 'cart.html'; }, 500);
    } else {
      showToast('This product variant is currently unavailable or out of stock.');
    }
  } catch (err) {
    showToast('Failed to verify stock. Please try again.');
  }
};

// ---------- Cart Helpers ----------
function getCart() {
  return JSON.parse(localStorage.getItem('vk_cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('vk_cart', JSON.stringify(cart));
  if (window.Auth && Auth.isLoggedIn()) {
    Auth.syncData();
  }
}

function updateCartCount() {
  const cart = getCart();
  const total = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = total;
    el.style.display = total > 0 ? 'flex' : 'none';
  });
}

// updateCartCount is globally used
window.updateCartCount = updateCartCount;

// ==========================================
// Hidden Admin Access Shortcut
// ==========================================
(function initAdminShortcut() {
  let clickCount = 0;
  let clickTimer = null;

  const trigger = document.getElementById("footer-admin-trigger");
  if (!trigger) return;

  trigger.addEventListener("click", function () {
    clickCount++;

    if (clickCount === 1) {
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 2000);
    }

    if (clickCount === 5) {
      console.log("Admin shortcut activated");
      window.location.href = "admin/index.html";
      clickCount = 0;
      clearTimeout(clickTimer);
    }
  });
})();
