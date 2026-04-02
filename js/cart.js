// ============================================
// VKclothing — Cart Page Logic
// Stock-aware quantity validation (Variants)
// ============================================

// Store fetched variant stock data
let variantStockMap = {};

document.addEventListener('DOMContentLoaded', async () => {
  const cartContent = document.getElementById('cart-content');
  if (!cartContent) return;

  // Fetch fresh variant data to validate stock
  try {
    API.clearLocalCache();
    const variants = await API.getProductVariants();
    variants.forEach(v => {
      variantStockMap[`${v.productId}_${v.size}_${v.color}`] = v.stock;
    });
  } catch (e) {
    // If fetch fails, allow cart to work without stock limits
    console.warn("Failed to load variants for cart stock check");
    if (typeof showToast === 'function') showToast('Offline mode: Stock info temporarily unavailable.', 'info');
  }

  renderCart();

  const checkoutBtn = document.getElementById('checkout-confirm');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', openCheckout);
  }
});

function renderCart() {
  const cartContent = document.getElementById('cart-content');
  const cart = getCart();

  if (cart.length === 0) {
    cartContent.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <h2>Your cart is empty</h2>
        <p>Looks like you haven't added anything yet.</p>
        <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
      </div>
    `;
    return;
  }

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  cartContent.innerHTML = `
    <div class="cart-layout">
      <div class="cart-left">
        <div class="cart-items">
          ${cart.map((item, index) => {
            const vKey = `${item.id}_${item.size}_${item.color}`;
            const availableStock = variantStockMap[vKey] !== undefined ? variantStockMap[vKey] : (item.stock || 99);
            const overStock = item.quantity > availableStock;
            
            return `
            <div class="cart-item">
              <div class="cart-item-img">
                <img src="${item.imageUrl}" alt="${item.name}"
                     onerror="this.src='https://placehold.co/200x240/f0f0f0/999?text=No+Image'">
              </div>
              <div class="cart-item-info">
                <h3>${item.name}</h3>
                <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:4px;">
                  Size: ${item.size || 'N/A'} | Color: ${item.color || 'N/A'}
                </p>
                <p class="item-price">₹${item.price.toLocaleString()}</p>
                <div class="qty-selector" style="margin-bottom:8px;">
                  <button onclick="updateCartQty(${index}, -1)">−</button>
                  <input type="number" value="${item.quantity}" readonly>
                  <button onclick="updateCartQty(${index}, 1)">+</button>
                </div>
                ${overStock ? `<p class="cart-stock-msg">Only ${availableStock} items left in stock</p>` : ''}
                <span class="cart-item-remove" onclick="removeCartItem(${index})">✕ Remove</span>
              </div>
            </div>
          `;}).join('')}
        </div>
      </div>

      <div class="cart-right">
        <div class="cart-summary-card">
          <div class="price-row">
            <span>Subtotal</span>
            <span id="cart-subtotal">₹${total.toLocaleString()}</span>
          </div>
          <div class="price-row">
            <span>Delivery Fee</span>
            <span class="free-line">
              <span class="free-text">FREE</span>
              <span class="strike">₹49</span>
            </span>
          </div>
          <div class="price-row">
            <span>Platform Fee</span>
            <span class="free-text">FREE</span>
          </div>
          <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--color-border);">
          <div class="price-row total-row" style="margin-bottom:24px;">
            <span>Total</span>
            <span id="cart-total">₹${total.toLocaleString()}</span>
          </div>
          
          <div class="cart-actions" style="display:flex; flex-direction:column; gap:12px;">
            <button class="btn btn-primary checkout-btn" onclick="openCheckout()" style="width:100%; padding:14px; font-size:1.05rem;">Checkout</button>
            <a href="shop.html" class="btn btn-outline" style="width:100%;">Continue Shopping</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateCartQty(index, delta) {
  const cart = getCart();
  if (!cart[index]) return;

  const item = cart[index];
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    cart.splice(index, 1);
  } else {
    // Check stock limit for specific variant
    const vKey = `${item.id}_${item.size}_${item.color}`;
    const availableStock = variantStockMap[vKey] !== undefined ? variantStockMap[vKey] : (item.stock || 99);
    
    if (newQty > availableStock) {
      showToast(`Only ${availableStock} items left in stock for this variant`);
      return;
    }
    item.quantity = newQty;
  }

  saveCart(cart);
  updateCartCount();
  renderCart();
}

function removeCartItem(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  updateCartCount();
  renderCart();
  showToast('Item removed from cart');
}

function openCheckout() {
  const cart = getCart();
  if (cart.length === 0) return;
  window.location.href = 'checkout.html';
}
