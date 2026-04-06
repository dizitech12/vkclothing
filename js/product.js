// ============================================
// VKclothing — Product Detail Page
// Variants (Sizes, Colors, Image Gallery)
// ============================================

let currentProduct = null;
let currentVariants = [];
let currentImages = [];
let parsedColors = []; // [{name, hex}]
let parsedSizes = [];  // [sizeName]

let selectedColor = null;
let selectedSize = null;

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('product-detail');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    container.innerHTML = '<p style="text-align:center;grid-column:1/-1;padding:60px;color:var(--color-text-muted);">Product not found. <a href="shop.html" style="color:var(--color-accent);text-decoration:underline;">Back to Shop</a></p>';
    return;
  }

  loadProductData(container, productId);
});

async function loadProductData(container, productId) {
  try {
    // Fetch independently so a single slow/failed call doesn't crash the whole page
    const [products, variantsList, imagesList] = await Promise.all([
      API.getProducts().catch(() => []),
      API.getProductVariants().catch(() => []),
      API.getProductImages().catch(() => [])
    ]);

    currentProduct = products.find(p => p.id === productId);

    if (!currentProduct) {
      container.innerHTML = '<p style="text-align:center;grid-column:1/-1;padding:60px;color:var(--color-text-muted);">Product not found.</p>';
      return;
    }

    currentVariants = variantsList.filter(v => v.productId === productId);
    currentImages = imagesList.filter(img => img.productId === productId);

    // Parse definitions
    if (currentProduct.colors) {
      parsedColors = currentProduct.colors.split(',').map(c => {
        const parts = c.split(':');
        let cName = parts[0].trim();
        let cHex = parts.length > 1 ? parts[1].trim() : '';
        
        if (!cHex) {
          // If no colon was used, check if the name itself is a hex code
          if (cName.startsWith('#') || /^[0-9A-Fa-f]{3,6}$/.test(cName)) {
            cHex = cName.startsWith('#') ? cName : '#' + cName;
          } else {
            // Otherwise, just use the word as the CSS color literal (e.g. "White")
            cHex = cName.toLowerCase();
          }
        } else {
          // If hex was provided, optionally format it
          if (!cHex.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(cHex)) {
            cHex = '#' + cHex;
          }
        }

        return { name: cName, hex: cHex };
      }).filter(c => c.name);
    }
    
    if (currentProduct.sizes) {
      parsedSizes = currentProduct.sizes.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Default Selection Logic
    if (parsedColors.length > 0 && parsedSizes.length > 0) {
      // Find first color with any stock
      for (const colorObj of parsedColors) {
        const hasStock = currentVariants.some(v => v.color === colorObj.name && v.stock > 0);
        if (hasStock) {
          selectedColor = colorObj.name;
          break;
        }
      }
      if (!selectedColor) selectedColor = parsedColors[0].name; // Fallback if all out of stock

      // Find first size for this color with stock
      const availableSize = parsedSizes.find(size => {
        const variant = currentVariants.find(v => v.color === selectedColor && v.size === size);
        return variant && variant.stock > 0;
      });
      selectedSize = availableSize || parsedSizes[0];
    } else {
       // Fallback for older products with no variants defined properly
       selectedColor = parsedColors.length ? parsedColors[0].name : 'Default';
       selectedSize = parsedSizes.length ? parsedSizes[0] : 'O/S';
    }

    document.title = `${currentProduct.name} — VKclothing`;
    renderProductUI(container);
  } catch (err) {
    console.error('Product data load error:', err);
    container.innerHTML = '<div style="text-align:center;grid-column:1/-1;padding:60px;"><p style="color:var(--color-text-muted);margin-bottom:20px;">Failed to load product details.</p><button class="btn btn-outline" onclick="location.reload()">Retry</button></div>';
    if (typeof showToast === 'function') showToast('Failed to load product details. Please try again.', 'error');
  }
}

function renderProductUI(container) {
  // Get variant stock
  const variant = currentVariants.find(v => v.color === selectedColor && v.size === selectedSize);
  const variantStock = variant ? variant.stock : 0;
  const outOfStock = variantStock <= 0;
  const lowStock = variantStock > 0 && variantStock <= 4;

  let stockWarningHtml = '';
  if (outOfStock) {
    stockWarningHtml = '<div class="out-of-stock-badge" style="margin-bottom:16px;">Out of Stock in this Size/Color</div>';
  } else if (lowStock) {
    stockWarningHtml = `
      <div class="stock-warning">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
        </svg>
        Only ${variantStock} left in stock
      </div>`;
  }

  // Gallery — case-insensitive color match
  const colorImages = currentImages.filter(img =>
    img.color.trim().toLowerCase() === (selectedColor || '').trim().toLowerCase()
  );
  const mainImageUrl = colorImages.length > 0 ? colorImages[0].imageUrl : (currentProduct.imageUrl || '');
  
  let galleryHtml = `
    <div class="product-gallery">
      <div class="product-detail-main-img" style="margin-bottom:16px;">
        ${mainImageUrl 
          ? `<img id="main-product-img" src="${mainImageUrl}" alt="${currentProduct.name}">` 
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f5f5f5;color:#999;aspect-ratio:3/4;">No Image</div>`
        }
      </div>
      <div class="thumbnails" style="display:flex; gap:12px; overflow-x:auto;">
        ${colorImages.map((img, idx) => `
          <img src="${img.imageUrl}" class="thumbnail ${idx === 0 ? 'active' : ''}" data-url="${img.imageUrl}" style="width:70px;height:90px;object-fit:cover;cursor:pointer;border:2px solid ${idx === 0 ? 'var(--color-primary)' : 'transparent'};">
        `).join('')}
      </div>
    </div>
  `;

  // Colors UI
  let colorsHtml = '';
  if (parsedColors.length > 0) {
    colorsHtml = `
      <div class="product-option" style="margin-top:24px;">
        <label>Color: <strong>${selectedColor}</strong></label>
        <div class="color-options" style="display:flex; gap:12px; margin-top:8px;">
          ${parsedColors.map(c => `
            <button class="color-circle ${c.name === selectedColor ? 'active' : ''}" 
                    data-color="${c.name}" 
                    style="background-color: ${c.hex} !important; width:32px; height:32px; border-radius:50%; border:2px solid ${c.name === selectedColor ? '#000' : '#ddd'}; outline: ${c.name === selectedColor ? '2px solid #fff' : 'none'}; outline-offset:-4px; cursor:pointer;"
                    title="${c.name}"></button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Sizes UI
  let sizesHtml = '';
  if (parsedSizes.length > 0) {
    sizesHtml = `
      <div class="product-option" style="margin-top:16px;">
        <label>Size</label>
        <div class="size-options" id="size-options" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
          ${parsedSizes.map(size => {
            const v = currentVariants.find(v =>
              v.color.trim().toLowerCase() === selectedColor.trim().toLowerCase() &&
              v.size.trim() === size.trim()
            );
            const isOos = !v || v.stock <= 0;
            return `
              <button class="size-btn ${size === selectedSize ? 'active' : ''} ${isOos ? 'oos' : ''}" 
                      data-size="${size}" 
                      ${isOos ? 'disabled title="Out of stock"' : ''}
                      style="padding:10px 16px; border:1px solid #ddd; background:${size === selectedSize ? '#000' : '#fff'}; color:${size === selectedSize ? '#fff' : (isOos ? '#bbb' : '#000')}; cursor:${isOos ? 'not-allowed' : 'pointer'};">
                ${size}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="product-detail-images">
      ${galleryHtml}
    </div>

    <div class="product-detail-info">
      <h1>${currentProduct.name}</h1>
      <p class="price">₹${currentProduct.price.toLocaleString()}</p>
      
      ${colorsHtml}
      ${sizesHtml}

      <div style="margin-top: 24px;">
        ${stockWarningHtml}
      </div>

      ${!outOfStock ? `
      <div class="product-option" style="margin-top:16px;">
        <label>Quantity</label>
        <div class="qty-selector">
          <button id="qty-minus">−</button>
          <input type="number" id="qty-input" value="1" min="1" max="${variantStock}" readonly>
          <button id="qty-plus">+</button>
        </div>
        <p id="qty-stock-msg" class="cart-stock-msg" style="display:none;"></p>
      </div>
      ` : ''}

      <div class="product-actions">
        <button class="btn btn-primary btn-add-cart" id="add-to-cart-btn" style="flex:1;"
                ${outOfStock ? 'disabled' : ''}>
          ${outOfStock ? 'Out of Stock' : 'Add to Cart'}
        </button>
        <button class="btn btn-outline" id="wishlist-btn"
                onclick="window.toggleWishlist('${currentProduct.id}', this)" 
                title="Wishlist" 
                style="padding:0 16px; display:flex; align-items:center;"
                data-wishlisted="${window.Wishlist && window.Wishlist.has(currentProduct.id) ? 'true' : 'false'}">
          <svg viewBox="0 0 24 24" width="20" height="20" 
               fill="${window.Wishlist && window.Wishlist.has(currentProduct.id) ? 'red' : 'none'}" 
               stroke="${window.Wishlist && window.Wishlist.has(currentProduct.id) ? 'red' : 'currentColor'}" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.501 5.501 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
      </div>

      <div style="margin-top:40px;">
        <h3 style="font-size:1.1rem;margin-bottom:12px;">Description</h3>
        <p class="description" style="line-height:1.6;color:#555;">${currentProduct.description || 'No description available.'}</p>
      </div>
    </div>
  `;

  attachEventListeners();
}

function attachEventListeners() {
  const container = document.getElementById('product-detail');

  // Thumbnails click
  container.querySelectorAll('.thumbnail').forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      container.querySelectorAll('.thumbnail').forEach(t => t.style.borderColor = 'transparent');
      e.target.style.borderColor = 'var(--color-primary)';
      document.getElementById('main-product-img').src = e.target.dataset.url;
    });
  });

  // Color selection
  container.querySelectorAll('.color-circle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedColor = e.target.dataset.color;
      
      // Auto-select first available size for this new color (case-insensitive)
      const availableSize = parsedSizes.find(size => {
        const variant = currentVariants.find(v =>
          v.color.trim().toLowerCase() === selectedColor.trim().toLowerCase() &&
          v.size.trim() === size.trim() &&
          v.stock > 0
        );
        return !!variant;
      });
      selectedSize = availableSize || parsedSizes[0];
      
      // Re-render — gallery will automatically show correct color images
      renderProductUI(container);
    });
  });

  // Size selection
  container.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.disabled) return;
      selectedSize = e.target.dataset.size;
      renderProductUI(container); // Re-render
    });
  });

  // Quantity and Add to Cart
  const variant = currentVariants.find(v =>
    v.color.trim().toLowerCase() === (selectedColor || '').trim().toLowerCase() &&
    v.size.trim() === (selectedSize || '').trim()
  );
  const variantStock = variant ? variant.stock : 0;
  const outOfStock = variantStock <= 0;

  if (!outOfStock) {
    const qtyInput = document.getElementById('qty-input');
    const stockMsg = document.getElementById('qty-stock-msg');

    document.getElementById('qty-minus').addEventListener('click', () => {
      let val = parseInt(qtyInput.value);
      if (val > 1) {
        qtyInput.value = val - 1;
        stockMsg.style.display = 'none';
      }
    });

    document.getElementById('qty-plus').addEventListener('click', () => {
      let val = parseInt(qtyInput.value);
      if (val < variantStock) {
        qtyInput.value = val + 1;
        stockMsg.style.display = 'none';
      } else {
        stockMsg.textContent = `Only ${variantStock} items available for this size and color`;
        stockMsg.style.display = 'block';
      }
    });

    document.getElementById('add-to-cart-btn').addEventListener('click', () => {
      const quantity = parseInt(document.getElementById('qty-input').value);
      const cart = getCart();
      
      // Look for exact variant in cart
      const existing = cart.find(item => item.id === currentProduct.id && item.size === selectedSize && item.color === selectedColor);

      if (existing) {
        const newTotal = existing.quantity + quantity;
        if (newTotal > variantStock) {
          showToast(`Cannot add. Only ${variantStock} items available for this size and color.`);
          return;
        }
        existing.quantity = newTotal;
      } else {
        if (cart.length >= 20) {
          showToast('Cart is full (max 20 items). Please remove some items.');
          return;
        }
        cart.push({
          id: currentProduct.id,
          name: currentProduct.name,
          price: currentProduct.price,
          imageUrl: document.getElementById('main-product-img')?.src || currentProduct.imageUrl,
          quantity: quantity,
          size: selectedSize,
          color: selectedColor
        });
      }

      saveCart(cart);
      updateCartCount();
      showToast('Added to cart!');
    });
  }
}
