// ============================================
// VKclothing — Checkout System
// Multi-step funnel with UPI QR and Validation
// ============================================

let currentStep = 1;
let selectedAddressId = null;
let selectedPaymentMethod = 'COD';
let cartTotal = 0;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Enforce Authentication
  if (!window.Auth || !Auth.requireAuth('checkout.html')) return;

  const cart = getCart();
  if (cart.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  // 2. Initialize Order Summary Sidebar
  renderCheckoutSummary(cart);

  // 3. Load user addresses
  await loadAddresses();

  // 4. Setup Address Form Toggle & Submit
  setupAddressForm();
});

function renderCheckoutSummary(cart) {
  const container = document.getElementById('sidebar-products');
  cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  container.innerHTML = cart.map(item => `
    <div class="summary-product">
      <img src="${item.imageUrl}" alt="${item.name}" onerror="this.src='https://placehold.co/60x80/f0f0f0/999?text=No+Image'">
      <div class="summary-product-info">
        <h5>${item.name}</h5>
        <p>Size: ${item.size} | Color: ${item.color}</p>
        <p style="margin-top:4px; font-weight:600; color:var(--color-text);">₹${item.price.toLocaleString()} × ${item.quantity}</p>
      </div>
    </div>
  `).join('');

  document.getElementById('checkout-subtotal').textContent = `₹${cartTotal.toLocaleString()}`;
  document.getElementById('checkout-total').textContent = `₹${cartTotal.toLocaleString()}`;
  
  // Set UPI Amount early just in case
  document.getElementById('upi-amount').textContent = cartTotal.toLocaleString();
}

async function loadAddresses() {
  const container = document.getElementById('saved-addresses-container');
  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const res = await API.getAddresses(Auth.getUserId());
    
    // Always show new address form option
    let html = '';
    
    if (res.success && res.addresses.length > 0) {
      html += res.addresses.map(addr => `
        <div class="address-card" id="addr-${addr.addressId}" onclick="selectAddress('${addr.addressId}')">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h4>${addr.firstName} ${addr.lastName}</h4>
            <div class="addr-badge" style="display:none; background:var(--color-primary); color:white; font-size:0.7rem; padding:2px 8px; border-radius:10px; font-weight:600;">Selected</div>
          </div>
          <p>${addr.phone}</p>
          <p>${addr.addressLine1}</p>
          ${addr.addressLine2 ? `<p>${addr.addressLine2}</p>` : ''}
          <p>${addr.city}, ${addr.state} ${addr.zip}</p>
        </div>
      `).join('');
    } else {
      html += `<p style="color:var(--color-text-secondary); margin-bottom:16px;">You don't have any saved addresses.</p>`;
    }

    html += `
      <button class="btn btn-outline" style="width:100%; border-style:dashed;" onclick="toggleNewAddressForm()">
        + Add New Address
      </button>
    `;

    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = '<p class="form-message error">Failed to load addresses.</p>';
  }
}

function selectAddress(id) {
  selectedAddressId = id;
  // Update UI
  document.querySelectorAll('.address-card').forEach(card => {
    card.classList.remove('selected');
    card.querySelector('.addr-badge').style.display = 'none';
  });
  const selected = document.getElementById('addr-' + id);
  if (selected) {
    selected.classList.add('selected');
    selected.querySelector('.addr-badge').style.display = 'block';
  }
}

function toggleNewAddressForm() {
  const form = document.getElementById('new-address-form-container');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function setupAddressForm() {
  const form = document.getElementById('new-address-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-address-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const data = {
      userId: Auth.getUserId(),
      firstName: document.getElementById('addr-fname').value,
      lastName: document.getElementById('addr-lname').value,
      phone: document.getElementById('addr-phone').value,
      addressLine1: document.getElementById('addr-line1').value,
      addressLine2: document.getElementById('addr-line2').value,
      city: document.getElementById('addr-city').value,
      state: document.getElementById('addr-state').value,
      zip: document.getElementById('addr-zip').value,
      country: document.getElementById('addr-country').value,
    };

    const res = await API.addAddress(data);
    if(res.success) {
      if (typeof showToast === 'function') showToast('Address saved successfully!', 'success');
      form.reset();
      toggleNewAddressForm();
      await loadAddresses();
      selectAddress(res.addressId);
    } else {
      if (typeof showToast === 'function') showToast(res.error || 'Failed to save address', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Save Address';
  });
}

// ---- Step Navigation ----

function goToStep(step) {
  // Navigation Validation
  if (step === 2) {
    if (!selectedAddressId) {
      if (typeof showToast === 'function') showToast('Please select or add a shipping address.', 'warning');
      return;
    }
  }

  if (step === 3) {
    // Populate confirm details
    const selectedCard = document.getElementById('addr-' + selectedAddressId);
    let addrText = selectedCard ? selectedCard.innerText.replace('Selected', '').trim() : 'Saved Address';
    document.getElementById('confirm-address').textContent = addrText.replace(/\\n/g, ', ');
    document.getElementById('confirm-payment').textContent = selectedPaymentMethod === 'UPI' ? 'UPI Payment (Scan QR)' : 'Pending Online Payment';
    
    // Toggle UPI Confirmation Box
    const upiContainer = document.getElementById('upi-confirm-container');
    if (selectedPaymentMethod === 'UPI') {
      upiContainer.style.display = 'block';
      document.getElementById('upi-confirm-amount').textContent = cartTotal.toLocaleString();
      document.getElementById('upi-confirm-checkbox').checked = false;
    } else {
      upiContainer.style.display = 'none';
    }
  }

  // Hide all steps
  document.querySelectorAll('.step-content').forEach(el => {
    el.classList.remove('active');
  });

  // Show target step
  document.getElementById(`step-${step}`).classList.add('active');
  currentStep = step;
  window.scrollTo(0, 0);
}

// ---- Payment Selection ----

function selectPayment(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
  
  if (method === 'COD') {
    document.getElementById('opt-cod').classList.add('selected');
    document.getElementById('upi-qr-container').style.display = 'none';
  } else if (method === 'UPI') {
    document.getElementById('opt-upi').classList.add('selected');
    const qrContainer = document.getElementById('upi-qr-container');
    const qrImage = document.getElementById('upi-qr-image');
    
    // Generate UPI URI
    // Format: upi://pay?pa={UPI_ID}&pn={NAME}&am={AMOUNT}&cu=INR
    const upiId = typeof CONFIG !== 'undefined' && CONFIG.UPI_ID ? CONFIG.UPI_ID : 'vkclothing@upi';
    const uri = `upi://pay?pa=${upiId}&pn=VKclothing&am=${cartTotal}&cu=INR`;
    
    // Generate QR code via free api.qrserver.com
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(uri)}`;
    qrContainer.style.display = 'block';
  }
}

// ---- Order Placement ----

async function placeOrder() {
  if (selectedPaymentMethod === 'UPI' && !document.getElementById('upi-confirm-checkbox').checked) {
    if (typeof showToast === 'function') showToast("Please confirm your UPI payment first.", "warning");
    return;
  }

  const btn = document.getElementById('place-order-btn');
  const errorMsg = document.getElementById('checkout-error');
  
  btn.disabled = true;
  btn.textContent = 'Processing Order...';
  errorMsg.style.display = 'none';

  const cart = getCart();
  const orderData = {
    userId: Auth.getUserId(),
    customerPhone: Auth.getUserPhone(),
    addressId: selectedAddressId,
    shippingSnapshot: document.getElementById('confirm-address').textContent,
    paymentMethod: selectedPaymentMethod,
    items: cart.map(item => ({
      productId: item.id,
      productName: item.name,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      price: item.price,
      imageUrl: item.imageUrl || ''
    }))
  };

  try {
    const result = await API.createOrder(orderData);
    
    if (result.success) {
      console.log("Order created successfully:", result.orderId);
      localStorage.removeItem('vk_cart');
      
      const step3 = document.getElementById('step-3');
      if (step3) {
        step3.innerHTML = `
          <div style="text-align:center; padding: 40px 20px;">
            <div style="width:64px; height:64px; background:var(--color-success, #4caf50); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; margin: 0 auto 24px;">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h2 style="margin-bottom:16px;">Order Confirmed!</h2>
            <p style="color:var(--color-text-secondary, #666); margin-bottom:8px;">Thank you for your purchase.</p>
            <p style="font-weight:600; margin-bottom: 24px;">Order ID: ${result.orderId}</p>
            <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
          </div>
        `;
      }
      const sidebar = document.querySelector('.order-summary-sidebar');
      if (sidebar) sidebar.style.display = 'none';
      const container = document.querySelector('.checkout-container');
      if (container) container.style.gridTemplateColumns = '1fr';

      try {
        window.location.href = `order-success.html?orderId=${result.orderId}`;
      } catch (e) {
        console.warn("Redirect failed but order created");
      }
    } else {
      if (typeof showToast === 'function') showToast(result.error || 'Failed to place order.', 'error');
      if (errorMsg) {
        errorMsg.textContent = result.error || 'Failed to place order. A product might be out of stock.';
        errorMsg.style.display = 'block';
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Try Again';
      }
    }
  } catch(err) {
    if (typeof showToast === 'function') showToast('Network error during checkout.', 'error');
    errorMsg.textContent = 'A network error occurred. Please try again.';
    errorMsg.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
}
