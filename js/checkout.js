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
  
  // Set UPI Amount early just in case (safely check if exists)
  const upiAmountEl = document.getElementById('upi-amount');
  if (upiAmountEl) {
    upiAmountEl.textContent = cartTotal.toLocaleString();
  }
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
  const btn = document.getElementById('place-order-btn');
  const errorMsg = document.getElementById('checkout-error');
  
  btn.disabled = true;
  btn.textContent = 'Creating Order...';
  if(errorMsg) errorMsg.style.display = 'none';

  const cart = getCart();
  const user = Auth.getUser();
  const orderData = {
    userId: user?.id || 'CUST_GU',
    customerPhone: Auth.getUserPhone(),
    addressId: selectedAddressId,
    shippingSnapshot: document.getElementById('confirm-address')?.textContent || '',
    paymentMethod: 'Cashfree',
    paymentStatus: 'Pending',
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
    // 1. Initial save to log the pending order into Google Sheets
    const result = await API.createOrder(orderData);
    
    if (result.success) {
      console.log("Order stored locally:", result.orderId);
      btn.textContent = 'Redirecting to Payment...';
      
      // 2. Proxied Call to Cashfree
      const createResponse = await fetch(CASHFREE_CONFIG.API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: result.orderId,
          order_amount: cartTotal,
          customer_details: {
            customer_id: orderData.userId,
            customer_name: user?.name || "Customer",
            customer_email: user?.email || "customer@vkclothing.com",
            customer_phone: orderData.customerPhone 
          },
          order_meta: {
            return_url: window.location.origin + CASHFREE_CONFIG.RETURN_URL + "?order_id={order_id}"
          }
        })
      });

      const cfData = await createResponse.json();
      
      if (cfData.success && cfData.payment_link) {
         window.location.href = cfData.payment_link;
      } else {
         throw new Error(cfData.error || 'Failed to load Payment Gateway');
      }

    } else {
      throw new Error(result.error || 'Failed to request order.');
    }
  } catch (err) {
    console.error("Checkout crash:", err);
    if(errorMsg) {
      errorMsg.textContent = err.message || 'An error occurred during checkout.';
      errorMsg.style.display = 'block';
    } else {
      alert(err.message || 'Failed to place order');
    }
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
}
