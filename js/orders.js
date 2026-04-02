// ============================================
// VKclothing — Customer Order History
// Loads and groups user orders
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Enforce auth
  if (!window.Auth || !Auth.requireAuth('orders.html')) return;
  loadUserOrders();
});

async function loadUserOrders() {
  const container = document.getElementById('orders-list');
  const userId = Auth.getUserId();
  
  if (!userId) return;

  try {
    const res = await API.getUserOrders(userId);
    if (!res.success) throw new Error(res.error || 'Failed to fetch');
    
    if (res.orders.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 60px 20px; background:#fff; border-radius:8px; border:1px dashed #ccc;">
          <h3 style="margin-bottom:12px; color:#555;">No Orders Found</h3>
          <p style="color:#888; margin-bottom: 24px;">You haven't placed any orders yet.</p>
          <a href="shop.html" class="btn btn-primary">Start Shopping</a>
        </div>
      `;
      return;
    }

    const groupedOrders = {};
    res.orders.forEach(row => {
      if(!groupedOrders[row.orderId]) {
         groupedOrders[row.orderId] = {
          orderId: row.orderId,
          date: new Date(row.date),
          status: row.status,
          paymentMethod: row.paymentMethod,
          paymentStatus: row.paymentStatus,
          shippingSnapshot: row.shippingAddressLine1 ? `${row.shippingName}, ${row.shippingAddressLine1}, ${row.shippingCity}, ${row.shippingState} - ${row.shippingZip}` : (row.shippingSnapshot || 'Address details not available.'),
          totalAmount: 0,
          items: []
        };
      }
      groupedOrders[row.orderId].items.push({
        id: row.productId,
        name: row.productName,
        size: row.size,
        color: row.color,
        qty: row.quantity,
        price: row.price
      });
      groupedOrders[row.orderId].totalAmount += row.total;
    });

    const ordersArray = Object.values(groupedOrders).sort((a,b) => b.date - a.date);

    container.innerHTML = ordersArray.map(order => {
      
      const itemsHtml = order.items.map(item => `
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
      if (order.status === 'Cancelled') {
        timelineHtml = `<div class="timeline-cancelled">Order Cancelled</div>`;
      } else {
        const states = ['Pending', 'Processed', 'Shipped', 'Delivered'];
        const currentIndex = states.indexOf(order.status) !== -1 ? states.indexOf(order.status) : 0;
        
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
      if (order.status === 'Pending' || order.status === 'Processed') {
        cancelBtnHtml = `<button onclick="cancelOrder('${order.orderId}')" class="btn btn-outline" style="padding:6px 16px; font-size:0.8rem; color:var(--color-error); border-color:var(--color-error);">Cancel Order</button>`;
      }

      return `
        <div class="order-card" style="margin-bottom:24px; box-shadow:var(--shadow-sm); border:1px solid #eee; padding:20px; border-radius:var(--radius-md);">
          <div class="order-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div class="order-header-info" style="display:flex; gap:24px; flex-wrap:wrap;">
              <div>
                <span style="display:block; font-size:0.75rem; color:#888; text-transform:uppercase;">Order Placed</span>
                <span style="font-weight:600;">${order.date.toLocaleDateString()}</span>
              </div>
              <div>
                <span style="display:block; font-size:0.75rem; color:#888; text-transform:uppercase;">Total</span>
                <span style="font-weight:600;">₹${order.totalAmount.toLocaleString()}</span>
              </div>
              <div>
                <span style="display:block; font-size:0.75rem; color:#888; text-transform:uppercase;">Order ID</span>
                <span style="font-weight:600;">${order.orderId}</span>
              </div>
            </div>
            <div class="order-actions" style="display:flex; gap:8px;">
              ${cancelBtnHtml}
              <a href="order-details.html?id=${order.orderId}" class="btn btn-outline" style="padding:6px 16px; font-size:0.8rem;">View Details</a>
            </div>
          </div>
          
          ${timelineHtml}
          
          <div class="order-items" style="margin-top:16px;">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Orders load error:', err);
    container.innerHTML = `
      <div style="text-align:center; padding: 40px 20px; border:1px solid var(--color-border); border-radius:var(--radius-md);">
        <p style="color:var(--color-text-secondary); margin-bottom:16px;">Failed to load your orders. This might be a connection issue.</p>
        <button class="btn btn-primary" onclick="loadUserOrders()">Retry</button>
      </div>
    `;
    if (typeof showToast === 'function') showToast('Failed to load orders.', 'error');
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
    if (typeof showToast !== 'undefined') showToast('Cancellation failed. Please open site via localhost or hosted link.', 'error');
    else alert('Cancellation failed. Please open site via localhost or hosted link.');
  }
};
