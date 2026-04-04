document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId');

  if (!orderId) {
    showError("No Order ID provided.");
    return;
  }

  const adminSecret = sessionStorage.getItem('vk_admin_secret') || '';
  if (!adminSecret) {
    showError("Admin session expired. Please log in again.");
    return;
  }

  try {
    const orders = await API.getOrders(adminSecret);
    const orderItems = orders.filter(o => o.orderId === orderId);

    if (orderItems.length === 0) {
      showError("Order not found or you don't have permission.");
      return;
    }

    const products = await API.getProducts();
    renderInvoice(orderItems, orderId, products);
  } catch (err) {
    console.error(err);
    showError("Failed to load invoice data.");
  }
});

function renderInvoice(orderItems, orderId, products = []) {
  // Use first item for common details (customer info, status, etc.)
  const order = orderItems[0];
  
  // Set Brand Info from CONFIG
  if (CONFIG.STORE_LOGO) {
    const logoEl = document.getElementById('b-logo');
    if (logoEl) logoEl.src = CONFIG.STORE_LOGO;
  }
  document.getElementById('b-name').textContent = CONFIG.STORE_NAME || 'Brand Name';
  document.getElementById('b-address').textContent = CONFIG.STORE_ADDRESS || 'Online Store Only';
  document.getElementById('b-phone').textContent = CONFIG.STORE_PHONE || '';
  document.getElementById('b-email').textContent = CONFIG.STORE_EMAIL || '';
  
  // Set Invoice Meta
  document.getElementById('inv-no').textContent = orderId;
  const oDate = new Date(order.date);
  document.getElementById('inv-date').textContent = isNaN(oDate) ? '-' : oDate.toLocaleDateString();

  // Set Customer Info
  document.getElementById('c-name').textContent = order.shippingName || order.userId || 'Guest';
  document.getElementById('c-phone').textContent = order.shippingPhone || order.customerPhone || '-';
  
  let addrStr = order.shippingSnapshot || 'No address provided';
  document.getElementById('c-address').textContent = addrStr;
  
  document.getElementById('c-city-state').textContent = '';
  document.getElementById('c-country').textContent = '';

  // Render Table
  const tbody = document.getElementById('items-tbody');
  let subtotal = 0;
  
  tbody.innerHTML = orderItems.map((item, index) => {
    const qty = parseInt(item.quantity) || 1;
    const price = parseFloat(item.price) || 0;
    const amount = qty * price;
    subtotal += amount;

    // Fallback for missing imageUrl (especially for older orders)
    let imgUrl = item.imageUrl;
    if (!imgUrl && products.length > 0) {
      const p = products.find(prod => String(prod.id) === String(item.productId));
      if (p) imgUrl = p.imageUrl;
    }
    
    if (!imgUrl) imgUrl = 'https://placehold.co/50x60?text=No+Image';

    return `
      <tr>
        <td>${index + 1}</td>
        <td>
          <div class="product-cell">
            <img src="${imgUrl}" class="product-img" onerror="this.src='https://placehold.co/50x60?text=No+Image'">
            <div>
              <strong>${item.productName || item.productId}</strong>
              <div style="font-size:12px; color:#666; margin-top:4px;">${item.size || '-'} | ${item.color || '-'}</div>
              <div style="font-size:12px; margin-top:2px;">₹${price.toLocaleString()} × ${qty}</div>
            </div>
          </div>
        </td>
        <td class="num">${qty}</td>
        <td class="num">₹${price.toLocaleString()}</td>
        <td class="num">₹${amount.toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  // Render Summary
  document.getElementById('s-subtotal').textContent = `₹${subtotal.toLocaleString()}`;
  document.getElementById('s-total').textContent = `₹${subtotal.toLocaleString()}`;

  // Custom Footer
  document.getElementById('f-msg').textContent = `Thank you for shopping with ${CONFIG.STORE_NAME || 'us'}!`;

  // Hide loader and show content
  document.getElementById('loading').style.display = 'none';
  document.getElementById('receipt-content').style.display = 'block';
}

function showError(msg) {
  document.getElementById('loading').innerHTML = `<span style="color:red; font-weight:600;">${msg}</span>`;
}
