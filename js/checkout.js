// ============================================
// VKclothing — Checkout (2-Step Flow)
// Step 1: Address | Step 2: Summary + Pay
// ============================================

let selectedAddressId = null;
let cartTotal = 0;

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.Auth || !Auth.requireAuth('checkout.html')) return;

  const cart = getCart();
  if (cart.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  renderSidebar(cart);
  await loadAddresses();
  setupAddressForm();
});

// ── Sidebar (always visible) ──────────────────

function renderSidebar(cart) {
  cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const container = document.getElementById('sidebar-products');
  container.innerHTML = cart.map(item => `
    <div class="summary-item-row">
      <img class="summary-item-img" src="${item.imageUrl || ''}" alt="${item.name}"
           onerror="this.src='https://placehold.co/56x72/f0f0f0/999?text=IMG'">
      <div class="summary-item-info">
        <h5>${item.name}</h5>
        <p>Size: ${item.size} | Color: ${item.color}</p>
        <p style="font-weight:700; color:#111; margin-top:2px;">₹${item.price.toLocaleString()} × ${item.quantity}</p>
      </div>
    </div>
  `).join('');

  document.getElementById('checkout-subtotal').textContent = `₹${cartTotal.toLocaleString()}`;
  document.getElementById('checkout-total').textContent = `₹${cartTotal.toLocaleString()}`;
}

// ── Addresses ────────────────────────────────

async function loadAddresses() {
  const container = document.getElementById('saved-addresses-container');
  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const res = await API.getAddresses(Auth.getUserId());
    let html = '';

    if (res.success && res.addresses.length > 0) {
      html += res.addresses.map(addr => `
        <div class="address-card" id="addr-${addr.addressId}" onclick="selectAddress('${addr.addressId}')">
          <div class="selected-badge">✓ Selected</div>
          <h4>${addr.firstName} ${addr.lastName}</h4>
          <p>${addr.phone}</p>
          <p>${addr.addressLine1}${addr.addressLine2 ? ', ' + addr.addressLine2 : ''}</p>
          <p>${addr.city}, ${addr.state} — ${addr.zip}</p>
        </div>
      `).join('');

      // Auto-select first address
      selectAddress(res.addresses[0].addressId);
    } else {
      html += `<p style="color:#888; margin-bottom:16px; font-size:0.9rem;">No saved addresses. Add one below.</p>`;
      document.getElementById('new-address-form-container').style.display = 'block';
    }

    html += `
      <button onclick="toggleNewAddressForm()"
        style="width:100%; margin-top:12px; padding:12px; border:2px dashed #ccc; border-radius:10px; background:none; cursor:pointer; font-size:0.9rem; color:#666; font-weight:600;">
        + Add New Address
      </button>
    `;

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p style="color:red; font-size:0.9rem;">Failed to load addresses. Please refresh.</p>';
  }
}

function selectAddress(id) {
  selectedAddressId = id;
  document.querySelectorAll('.address-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('addr-' + id);
  if (card) card.classList.add('selected');
}

function toggleNewAddressForm() {
  const f = document.getElementById('new-address-form-container');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function setupAddressForm() {
  document.getElementById('new-address-form').addEventListener('submit', async (e) => {
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
    if (res.success) {
      if (typeof showToast === 'function') showToast('Address saved!', 'success');
      document.getElementById('new-address-form').reset();
      document.getElementById('new-address-form-container').style.display = 'none';
      await loadAddresses();
      selectAddress(res.addressId);
    } else {
      if (typeof showToast === 'function') showToast(res.error || 'Failed to save address', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Save Address';
  });
}

// ── Navigation ───────────────────────────────

function goToStep(step) {
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const c1 = document.getElementById('prog-1');
  const c2 = document.getElementById('prog-2');
  const l1 = document.getElementById('prog-label-1');
  const l2 = document.getElementById('prog-label-2');
  const conn = document.getElementById('prog-conn-1');

  if (step === 1) {
    c1.className = 'step-circle active'; c1.textContent = '1';
    c2.className = 'step-circle'; c2.textContent = '2';
    l1.className = 'step-label active';
    l2.className = 'step-label';
    conn.className = 'step-connector';
  } else if (step === 2) {
    c1.className = 'step-circle done'; c1.textContent = '✓';
    c2.className = 'step-circle active'; c2.textContent = '2';
    l1.className = 'step-label';
    l2.className = 'step-label active';
    conn.className = 'step-connector done';
  }
}

function goToSummary() {
  if (!selectedAddressId) {
    if (typeof showToast === 'function') showToast('Please select a delivery address first.', 'warning');
    else alert('Please select a delivery address first.');
    return;
  }

  // Populate the summary step
  const card = document.getElementById('addr-' + selectedAddressId);
  const addrText = card ? card.innerText.replace('✓ Selected', '').trim().split('\n').filter(l => l.trim()).join(', ') : 'Selected Address';
  document.getElementById('confirm-address').textContent = addrText;

  // Products
  const cart = getCart();
  document.getElementById('confirm-products').innerHTML = cart.map(item => `
    <div class="summary-item-row">
      <img class="summary-item-img" src="${item.imageUrl || ''}" alt="${item.name}"
           onerror="this.src='https://placehold.co/56x72/f0f0f0/999?text=IMG'">
      <div class="summary-item-info">
        <h5>${item.name}</h5>
        <p>Size: ${item.size} | Color: ${item.color} | Qty: ${item.quantity}</p>
        <p style="font-weight:700; color:#111; margin-top:3px;">₹${(item.price * item.quantity).toLocaleString()}</p>
      </div>
    </div>
  `).join('');

  document.getElementById('confirm-subtotal').textContent = `₹${cartTotal.toLocaleString()}`;
  document.getElementById('confirm-total').textContent = `₹${cartTotal.toLocaleString()}`;
  document.getElementById('pay-total-amount').textContent = cartTotal.toLocaleString();

  goToStep(2);
}

// ── Place Order + Cashfree Redirect ──────────

async function placeOrder() {
  const btn = document.getElementById('place-order-btn');
  const errorMsg = document.getElementById('checkout-error');

  btn.disabled = true;
  btn.textContent = 'Creating Order...';
  errorMsg.style.display = 'none';

  const cart = getCart();
  const userId = Auth.getUserId() || 'GUEST';
  const userPhone = Auth.getUserPhone() || '';

  const orderData = {
    userId: userId,
    customerPhone: userPhone,
    addressId: selectedAddressId,
    shippingSnapshot: document.getElementById('confirm-address').textContent,
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
    // 1. Save order as Pending in Google Sheets
    const result = await API.createOrder(orderData);
    if (!result.success) throw new Error(result.error || 'Failed to create order.');

    btn.textContent = 'Redirecting to Payment...';

    // 2. Create Cashfree payment session via secure proxy
    const cfRes = await fetch(CASHFREE_CONFIG.API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: result.orderId,
        order_amount: cartTotal,
        customer_details: {
          customer_id: userId,
          customer_name: 'Customer',
          customer_email: 'customer@vkclothing.com',
          customer_phone: userPhone
        },
        order_meta: {
          return_url: window.location.origin + CASHFREE_CONFIG.RETURN_URL + '?order_id={order_id}'
        }
      })
    });

    const cfData = await cfRes.json();

    if (cfData.success && cfData.payment_link) {
      window.location.href = cfData.payment_link;
    } else {
      throw new Error(cfData.error || 'Payment gateway error. Please try again.');
    }

  } catch (err) {
    console.error('Checkout error:', err);
    errorMsg.textContent = err.message || 'Something went wrong. Please try again.';
    errorMsg.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = `Pay ₹${cartTotal.toLocaleString()} via Cashfree`;
  }
}
