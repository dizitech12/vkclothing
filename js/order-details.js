document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }
  
  loadOrderDetails();
});

async function loadOrderDetails() {
  const container = document.getElementById('order-details-content');
  const userId = Auth.getUserId();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  if (!userId || !orderId) {
    container.innerHTML = `<div style="padding:20px; text-align:center;">Order not found.</div>`;
    return;
  }

  try {
    const res = await API.getUserOrders(userId);
    if (!res.success) throw new Error(res.error || 'Failed to fetch');
    
    // Filter rows for the requested order ID
    const orderRows = res.orders.filter(row => row.orderId === orderId);
    
    if (orderRows.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 60px 20px; background:#fff; border-radius:8px; border:1px dashed #ccc;">
          <h3 style="margin-bottom:12px; color:#555;">Order Not Found</h3>
          <p style="color:#888; margin-bottom: 24px;">We couldn't find an order with this ID.</p>
          <a href="orders.html" class="btn btn-primary">Back to Orders</a>
        </div>
      `;
      return;
    }

    // Since the backend stores items flatly, we combine them
    const orderObj = {
      orderId: orderRows[0].orderId,
      date: new Date(orderRows[0].date),
      status: orderRows[0].status,
      paymentMethod: orderRows[0].paymentMethod,
      paymentStatus: orderRows[0].paymentStatus,
      shippingSnapshot: orderRows[0].shippingAddressLine1 ? `${orderRows[0].shippingName}, ${orderRows[0].shippingAddressLine1}, ${orderRows[0].shippingCity}, ${orderRows[0].shippingState} - ${orderRows[0].shippingZip}` : (orderRows[0].shippingSnapshot || 'Address details not available.'),
      totalAmount: 0,
      items: []
    };

    orderRows.forEach(row => {
      orderObj.items.push({
        id: row.productId,
        name: row.productName,
        size: row.size,
        color: row.color,
        qty: row.quantity,
        price: row.price
      });
      orderObj.totalAmount += row.total;
    });

    const itemsHtml = orderObj.items.map(item => `
      <div class="order-item" style="border-bottom:1px solid #eee; padding-bottom:16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:flex-start;">
        <div class="order-item-left">
          <div>
            <h4 style="margin-bottom:4px; font-weight:600;">${item.name}</h4>
            <p style="font-size:0.85rem; color:#666; margin-bottom:0;">Size: ${item.size} | Color: ${item.color} | Qty: ${item.qty}</p>
          </div>
        </div>
        <div class="order-item-right" style="text-align:right;">
          <div style="font-weight:600; margin-bottom:8px;">₹${(item.price * item.qty).toLocaleString()}</div>
          <button onclick="buyAgain('${item.id}', '${item.name.replace(/'/g, "\\'")}', '${item.size}', '${item.color}', ${item.price})" class="btn btn-outline" style="padding:4px 12px; font-size:0.75rem;">Buy Again</button>
        </div>
      </div>
    `).join('');

    // Timeline Logic
    let timelineHtml = '';
    if (orderObj.status === 'Cancelled') {
      timelineHtml = `<div class="timeline-cancelled">Order Cancelled</div>`;
    } else {
      const states = ['Pending', 'Processed', 'Shipped', 'Delivered'];
      const currentIndex = states.indexOf(orderObj.status) !== -1 ? states.indexOf(orderObj.status) : 0;
      
      timelineHtml = `<div class="order-timeline">
        ${states.map((state, idx) => {
          let cls = '';
          if (idx < currentIndex) cls = 'completed';
          else if (idx === currentIndex) cls = 'active';
          return `<div class="timeline-step ${cls}">
             <div class="timeline-icon"></div>
             <div class="timeline-label">${state === 'Pending' ? 'Placed' : state}</div>
          </div>`;
        }).join('')}
      </div>`;
    }

    // Cancel Button Logic
    let cancelBtnHtml = '';
    if (orderObj.status === 'Pending' || orderObj.status === 'Processed') {
      cancelBtnHtml = `<button onclick="cancelOrder('${orderObj.orderId}')" class="btn btn-outline" style="padding:6px 16px; font-size:0.8rem; color:var(--color-error); border-color:var(--color-error); width:100%;">Cancel Order</button>`;
    }

    container.innerHTML = `
      <h1 style="margin-bottom: 8px;">Order Details</h1>
      <p style="color:var(--color-text-secondary); margin-bottom: 32px;">Detailed view for ${orderObj.orderId}</p>

      <div class="order-card" style="box-shadow:var(--shadow-sm); border:1px solid #eee; padding:20px; border-radius:var(--radius-md); background:#fff;">
        <div class="order-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
          <div class="order-header-info" style="display:flex; gap:24px; flex-wrap:wrap;">
            <div>
              <span style="display:block; font-size:0.75rem; color:#888; text-transform:uppercase;">Order Placed</span>
              <span style="font-weight:600;">${orderObj.date.toLocaleDateString()}</span>
            </div>
            <div>
              <span style="display:block; font-size:0.75rem; color:#888; text-transform:uppercase;">Total</span>
              <span style="font-weight:600;">₹${orderObj.totalAmount.toLocaleString()}</span>
            </div>
            <div>
              <span style="display:block; font-size:0.75rem; color:#888; text-transform:uppercase;">Order ID</span>
              <span style="font-weight:600;">${orderObj.orderId}</span>
            </div>
          </div>
          <div class="order-status-badge ${orderObj.status.toLowerCase()}" style="padding:6px 12px; font-weight:600; border-radius:20px; background:#f0f0f0;">
             ${orderObj.status}
          </div>
        </div>
        
        ${timelineHtml}
        
        <div class="order-items" style="margin-top:24px;">
          <h3 style="margin-bottom: 16px; font-size:1.1rem; border-bottom:1px solid #eee; padding-bottom:8px;">Items Ordered</h3>
          ${itemsHtml}
          
          <div style="margin-top:24px; padding-top:16px; border-top:1px dashed #ccc; font-size:0.95rem; line-height:1.6; color:#444; background:#f9f9f9; padding: 16px; border-radius:8px;">
            <strong style="display:block; margin-bottom:4px;">Delivery details:</strong>
            ${orderObj.shippingSnapshot || 'Address details not available.'}
             <br><br>
            <strong style="display:block; margin-bottom:4px;">Payment Method:</strong>
            ${
              orderObj.paymentMethod === 'Cashfree' ? 'Online Payment (Cashfree)' :
              orderObj.paymentMethod === 'UPI'      ? 'UPI' :
              orderObj.paymentMethod === 'COD'      ? 'Cash on Delivery' :
              (orderObj.paymentMethod || 'Online')
            }
            &nbsp;<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;
              background:${orderObj.paymentStatus === 'Paid' ? '#dcfce7' : '#fef9c3'};
              color:${orderObj.paymentStatus === 'Paid' ? '#15803d' : '#92400e'};">
              ${orderObj.paymentStatus || 'Pending'}
            </span>
          </div>
          
          ${cancelBtnHtml ? `<div style="margin-top:24px; text-align:right;">${cancelBtnHtml}</div>` : ''}
        </div>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `
      <div style="color:var(--color-error); padding:20px; border:1px solid var(--color-error); border-radius:4px; text-align:center;">
        Failed to load order details. Please try refreshing the page.
      </div>
    `;
  }
}

window.cancelOrder = async function(orderId) {
  if (!confirm('Are you sure you want to cancel this order?')) return;
  try {
    const res = await API.updateOrderStatus(orderId, 'Cancelled');
    if (!res.success) {
      throw new Error(res.error || 'Failed to cancel order');
    }
    if (typeof showToast !== 'undefined') showToast('Order cancelled successfully');
    setTimeout(() => window.location.reload(), 1000);
  } catch (err) {
    if (typeof showToast !== 'undefined') showToast('Cancellation failed. Please open site via localhost or hosted link.');
    else alert('Cancellation failed. Please open site via localhost or hosted link.');
  }
};
