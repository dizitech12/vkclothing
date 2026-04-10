// ============================================

// ---------- Auth Guard ----------
// Only protect dashboard.html — running this on index.html causes an infinite redirect loop
function protectAdminPage() {
  if (!window.location.pathname.endsWith('dashboard.html')) return;

  const token = sessionStorage.getItem('vk_admin_token');
  if (!token) {
    alert('Please login first');
    window.location.href = 'index.html';
    return;
  }
  const emailEl = document.getElementById('admin-email');
  if (emailEl) {
    emailEl.textContent = sessionStorage.getItem('vk_admin_email') || '';
  }
}
protectAdminPage();

// ---------- State ----------
let allProducts = [];
let allVariants = [];
let allImages = [];
let editingProductId = null;
let pendingDeleteId = null;
let uploadedImageUrl = ''; // Main fallback image
let currentVariantGrid = []; // Array of {size, colorName, stock}
let galleryImages = []; // Array of {colorName, imageUrl}
let allOrders = []; // Array of fetched orders for filtering
let ordersPromise = null; // Step 2: Background preloader for orders
let analyticsPromise = null; // Step 2: Background preloader for analytics
let isAnalyticsLoaded = false; // Flag to prevent multiple chart reloads

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('dashboard.html')) return;
  initDashboard(); // Optimized Step 1 & 2
  document.getElementById('product-form').addEventListener('submit', handleSaveProduct);
});

async function initDashboard() {
  // Step 1: Load Products immediately (Priority 1)
  await loadProducts();
  
  // Step 2: Start background preloading for Orders and Analytics simultaneously
  preloadBackgroundData();
}

function preloadBackgroundData() {
  console.log('Admin: Starting background preloading...');
  // These fire in parallel without blocking the UI
  if (!ordersPromise) {
    ordersPromise = fetchOrdersData();
  }
  if (!analyticsPromise) {
    analyticsPromise = fetchAnalyticsData();
  }
}

// ---------- Analytics Helpers ----------
async function fetchAnalyticsData() {
  try {
    const [summary, weekly, daily, growth] = await Promise.all([
      API.getAnalyticsSummary(),
      API.getWeeklySales(),
      API.getOrdersPerDay(),
      API.getCustomerGrowth()
    ]);
    return { summary, weekly, daily, growth };
  } catch (err) {
    console.error('Background analytics preload failed:', err);
    return null;
  }
}

// ---------- Analytics ----------
async function loadAnalyticsDashboard(refresh = false) {
  if (isAnalyticsLoaded && !refresh) return;

  const content = document.getElementById('analytics-content');
  const loader = document.getElementById('analytics-loading');

  // Show loading state if data not ready
  if (content && loader) {
    content.style.display = 'none';
    loader.style.display = 'block';
  }

  try {
    let data;
    if (refresh || !analyticsPromise) {
      analyticsPromise = fetchAnalyticsData();
    }
    data = await analyticsPromise;

    if (data) {
      // Summary cards
      const s = data.summary;
      if (s && s.success) {
        document.getElementById('stat-total-orders').textContent = s.totalOrders.toLocaleString();
        document.getElementById('stat-total-revenue').textContent = '₹' + s.totalRevenue.toLocaleString();
        document.getElementById('stat-total-customers').textContent = s.totalCustomers.toLocaleString();
        document.getElementById('stat-total-products').textContent = s.totalProducts.toLocaleString();
        document.getElementById('stat-best-selling').textContent = s.bestProduct || '-';
        document.getElementById('stat-best-selling').title = s.bestProduct || 'No sales yet';
      }

      // Render Charts
      renderWeeklySalesChart(data.weekly);
      renderOrdersPerDayChart(data.daily);
      renderCustomerGrowthChart(data.growth);
      
      isAnalyticsLoaded = true;
    }
  } catch (err) {
    console.error('Failed to load analytics dashboard:', err);
  }

  // Hide loading state
  if (content && loader) {
    content.style.display = 'block';
    loader.style.display = 'none';
    if (refresh && typeof showToast === 'function') showToast('Analytics data refreshed!', 'success');
  }
}

// ---------- Weekly Sales Chart ----------
let weeklySalesChartInstance = null;

async function renderWeeklySalesChart(data) {
  try {
    if (!data || !data.success) return;

    const ctx = document.getElementById('weekly-sales-chart').getContext('2d');
    if (weeklySalesChartInstance) {
      weeklySalesChartInstance.destroy();
    }

    weeklySalesChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Revenue (₹)',
          data: data.data,
          borderColor: '#000',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₹' + value;
              }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Failed to render weekly sales chart:', err);
  }
}
async function loadWeeklySalesChart(refresh = false) { 
  const data = await API.getWeeklySales(refresh);
  renderWeeklySalesChart(data);
}

// ---------- Orders per Day Chart ----------
let ordersPerDayChartInstance = null;

async function renderOrdersPerDayChart(data) {
  try {
    if (!data || !data.success) return;

    const ctx = document.getElementById('orders-per-day-chart').getContext('2d');
    if (ordersPerDayChartInstance) {
      ordersPerDayChartInstance.destroy();
    }

    ordersPerDayChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Orders',
          data: data.data,
          backgroundColor: '#000',
          borderColor: '#000',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Failed to render orders per day chart:', err);
  }
}
async function loadOrdersPerDayChart(refresh = false) {
  const data = await API.getOrdersPerDay(refresh);
  renderOrdersPerDayChart(data);
}

// ---------- Customer Growth Chart ----------
let customerGrowthChartInstance = null;

async function renderCustomerGrowthChart(data) {
  try {
    if (!data || !data.success) return;

    const ctx = document.getElementById('customer-growth-chart').getContext('2d');
    if (customerGrowthChartInstance) {
      customerGrowthChartInstance.destroy();
    }

    customerGrowthChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'New Customers',
          data: data.data,
          borderColor: '#000',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Failed to render customer growth chart:', err);
  }
}
async function loadCustomerGrowthChart(refresh = false) {
  const data = await API.getCustomerGrowth(refresh);
  renderCustomerGrowthChart(data);
}

// ---------- Tab Switching ----------
function switchTab(tab) {
  document.querySelectorAll('.filter-btn[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('products-tab').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('orders-tab').style.display = tab === 'orders' ? 'block' : 'none';
  document.getElementById('analytics-tab').style.display = tab === 'analytics' ? 'block' : 'none';

  if (tab === 'orders') {
    loadOrders();
  } else if (tab === 'analytics') {
    loadAnalyticsDashboard();
  }
}

// ---------- Data Loading ----------
// Step 1: Render products list immediately
async function loadProducts() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"></div></td></tr>';

  try {
    API.clearLocalCache();
    // Fetch all consolidated data in a single request (under 3 seconds)
    const data = await API.getProductsFull();
    if (data.success) {
      allProducts = data.products || [];
      allVariants = data.variants || [];
      allImages = data.images || [];
    } else {
      throw new Error('Failed to fetch full products data');
    }

    renderProductsTable();
  } catch (err) {
    console.error('Failed to load products:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--color-error);">Failed to load products.</td></tr>';
  }
}
async function loadAllData() { await loadProducts(); } // Legacy wrapper

function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (allProducts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--color-text-muted);">No products yet. Click "Add Product" to get started.</td></tr>';
    return;
  }

  tbody.innerHTML = allProducts.map(product => {
    // Calculate total stock from variants
    const pVariants = allVariants.filter(v => v.productId === product.id);
    const totalStock = pVariants.reduce((sum, v) => sum + v.stock, 0);

    return `
      <tr>
        <td>
          <img src="${product.imageUrl}" alt="${product.name}" class="product-thumb"
               onerror="this.src='https://placehold.co/50x50/f0f0f0/999?text=-'">
        </td>
        <td style="font-size:0.8rem;color:var(--color-text-muted);">${product.id}</td>
        <td><strong>${product.name}</strong></td>
        <td>${product.category}</td>
        <td>₹${product.price.toLocaleString()}</td>
        <td>
          <span class="stock-badge ${totalStock > 0 ? 'in-stock' : 'out-of-stock'}">
            ${totalStock > 0 ? totalStock + ' in variants' : 'Out of Stock'}
          </span>
        </td>
        <td>
          <div class="actions">
            <button class="btn-edit" onclick="editProduct('${product.id}')">Edit</button>
            <button class="btn-delete" onclick="confirmDelete('${product.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ---------- Orders Helpers ----------
async function fetchOrdersData() {
  try {
    allOrders = await API.getOrders();
    return allOrders;
  } catch (err) {
    console.error('Background orders preload failed:', err);
    return [];
  }
}

// ---------- Orders ----------
async function loadOrders(refresh = false) {
  const tbody = document.getElementById('orders-table-body');
  
  // If we already have data and no refresh, just render
  if (allOrders.length > 0 && !refresh) {
    renderOrders();
    return;
  }

  tbody.innerHTML = '<tr><td colspan="10"><div class="loading-spinner"></div></td></tr>';
  
  try {
    if (refresh || !ordersPromise) {
      ordersPromise = fetchOrdersData();
    }
    await ordersPromise;
    renderOrders();
  } catch (err) {
    console.error('Orders load error:', err);
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--color-error);">Failed to load orders. <button class="btn btn-outline" onclick="loadOrders(true)">Retry</button></td></tr>';
    if (typeof showToast === 'function') showToast('Failed to load orders.', 'error');
  }
}

function renderOrders() {
  const tbody = document.getElementById('orders-table-body');
  
  if (allOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--color-text-muted);">No orders yet.</td></tr>';
    return;
  }

  // Map filters
  const searchId = document.getElementById('order-search-id')?.value.toLowerCase().trim() || '';
  const searchPhone = document.getElementById('order-search-phone')?.value.toLowerCase().trim() || '';
  const filterStatus = document.getElementById('order-filter-status')?.value || '';
  const filterPayment = document.getElementById('order-filter-payment')?.value || '';

  let filtered = [...allOrders];

  if (searchId) filtered = filtered.filter(o => o.orderId.toLowerCase().includes(searchId));
  if (searchPhone) filtered = filtered.filter(o => o.customerPhone && o.customerPhone.toLowerCase().includes(searchPhone));
  if (filterStatus) filtered = filtered.filter(o => o.status === filterStatus);
  if (filterPayment) filtered = filtered.filter(o => o.paymentMethod === filterPayment);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--color-text-muted);">No orders match the selected filters.</td></tr>';
    return;
  }

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  tbody.innerHTML = filtered.map(order => `
    <tr>
      <td style="font-size:0.8rem;font-weight:600;">${order.orderId}</td>
      <td>${order.customerPhone || '-'}</td>
      <td>${order.productName} <br><small style="color:#666">Size: ${order.size} | Color: ${order.color}</small></td>
      <td>${order.quantity}</td>
      <td><strong>₹${order.total.toLocaleString()}</strong></td>
      <td><span style="font-size:0.8rem; background:#eee; padding:2px 6px; border-radius:4px;">${order.paymentMethod}</span></td>
      <td>
        <span style="
          display:inline-block; padding:3px 10px; border-radius:20px;
          font-size:0.78rem; font-weight:700; letter-spacing:0.3px;
          background:${order.paymentStatus === 'Paid' ? '#dcfce7' : '#fef9c3'};
          color:${order.paymentStatus === 'Paid' ? '#15803d' : '#92400e'};
        ">${order.paymentStatus || 'Pending'}</span>
      </td>
      <td>
        <select class="status-select ${order.status.toLowerCase()}"
                data-order-id="${order.orderId}"
                onchange="handleOrderStatusChange(this)">
          <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Processed" ${order.status === 'Processed' ? 'selected' : ''}>Processed</option>
          <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
          <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
          <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
      <td style="font-size:0.82rem;color:var(--color-text-muted);">${new Date(order.date).toLocaleDateString()}</td>
      <td>
        <div class="actions">
          <button class="btn-edit" onclick="viewAddress('${order.userId}', '${order.addressId}')">Address</button>
          <button class="btn-primary" onclick="window.openReceipt('${order.orderId}')">Print Invoice</button>
          <button class="btn-delete" onclick="deleteAdminOrder('${order.orderId}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ---------- Admin Order Management actions ----------
async function viewAddress(userId, addressId) {
  if (!addressId) {
    if (typeof showToast === 'function') showToast("No address provided for this order.", "warning");
    return;
  }
  try {
    const res = await API.getAddresses(userId);
    if (!res.success) throw new Error("Failed to fetch addresses");
    const addr = res.addresses.find(a => a.addressId === addressId);
    if (!addr) {
      if (typeof showToast === 'function') showToast("Address not found.", "error");
      return;
    }
    const fullAddress = `${addr.firstName} ${addr.lastName}\nPhone: ${addr.phone}\n${addr.addressLine1}\n${addr.addressLine2 ? addr.addressLine2 + '\n' : ''}${addr.city}, ${addr.state} ${addr.zip}\n${addr.country}`;
    alert("Shipping Address:\\n\\n" + fullAddress);
  } catch (err) {
    console.error('Address view error:', err);
    if (typeof showToast === 'function') showToast("Error loading address.", "error");
  }
}

async function deleteAdminOrder(orderId) {
  if (!confirm(`Are you sure you want to delete order ${orderId}? This cannot be undone.`)) return;
  
  try {
    const result = await API.deleteOrder(orderId);
    if (result.success) {
      if (typeof showToast === 'function') showToast('Order deleted successfully.', 'success');
      loadOrders();
    } else {
      if (typeof showToast === 'function') showToast(result.error || 'Failed to delete order.', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Something went wrong.', 'error');
  }
}

// ---------- Product Modal & Variants Logic ----------
function openProductModal() {
  editingProductId = null;
  uploadedImageUrl = '';
  currentVariantGrid = [];
  galleryImages = [];

  document.getElementById('modal-title').textContent = 'Add Product';
  document.getElementById('product-id').value = '';
  document.getElementById('product-name').value = '';
  document.getElementById('product-category').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-description').value = '';
  document.getElementById('product-image-url').value = '';
  document.getElementById('product-sizes').value = '';
  document.getElementById('product-colors').value = '';
  
  document.getElementById('upload-preview').style.display = 'none';
  document.getElementById('upload-placeholder').style.display = 'block';

  document.getElementById('variant-stock-container').style.display = 'none';
  document.getElementById('variant-stock-container').innerHTML = '';
  updateGalleryColorSelect();
  renderGalleryPreviews();
  
  // Clear color picker fields
  document.getElementById('color-name-input').value = '';
  document.getElementById('color-hex-input').value = '#000000';
  renderColorPreviews();

  resetModalMessage();
  document.getElementById('product-modal').classList.add('show');
}

function editProduct(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  editingProductId = id;
  uploadedImageUrl = product.imageUrl;
  currentVariantGrid = allVariants.filter(v => v.productId === id).map(v => ({size: v.size, colorName: v.color, stock: v.stock}));
  galleryImages = allImages.filter(img => img.productId === id).map(img => ({colorName: img.color, imageUrl: img.imageUrl}));

  document.getElementById('modal-title').textContent = 'Edit Product';
  document.getElementById('product-id').value = product.id;
  document.getElementById('product-name').value = product.name;
  document.getElementById('product-category').value = product.category;
  document.getElementById('product-price').value = product.price;
  document.getElementById('product-description').value = product.description || '';
  document.getElementById('product-image-url').value = product.imageUrl;
  document.getElementById('product-sizes').value = product.sizes || '';
  document.getElementById('product-colors').value = product.colors || '';

  // Main Preview
  if (product.imageUrl) {
    const preview = document.getElementById('upload-preview');
    preview.src = product.imageUrl;
    preview.style.display = 'block';
    document.getElementById('upload-placeholder').style.display = 'none';
  }

  // Pre-generate grid
  generateVariantGrid();
  updateGalleryColorSelect();
  renderGalleryPreviews();
  renderColorPreviews();

  resetModalMessage('Update Product');
  document.getElementById('product-modal').classList.add('show');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('show');
}

function resetModalMessage(btnText = 'Save Product') {
  const msgEl = document.getElementById('modal-message');
  msgEl.className = 'form-message';
  msgEl.style.display = 'none';
  const saveBtn = document.getElementById('save-product-btn');
  saveBtn.disabled = false;
  saveBtn.textContent = btnText;
}

// ---------- Color Picker Logic ----------
function addColor() {
  const nameInput = document.getElementById('color-name-input');
  const hexInput = document.getElementById('color-hex-input');
  const colorsInput = document.getElementById('product-colors');

  const name = nameInput.value.trim();
  const hex = hexInput.value.trim();

  if (!name) {
    alert("Please enter a color name.");
    return;
  }

  // Check if name already exists
  const currentColors = colorsInput.value ? colorsInput.value.split(',').map(c => c.trim()) : [];
  const exists = currentColors.some(c => c.split(':')[0].trim().toLowerCase() === name.toLowerCase());
  if (exists) {
    alert("Color already exists.");
    return;
  }

  const newColorStr = `${name}:${hex}`;
  currentColors.push(newColorStr);
  colorsInput.value = currentColors.join(',');

  nameInput.value = '';
  renderColorPreviews();
}

function removeColor(index) {
  const colorsInput = document.getElementById('product-colors');
  let currentColors = colorsInput.value ? colorsInput.value.split(',').map(c => c.trim()).filter(Boolean) : [];
  
  if (index >= 0 && index < currentColors.length) {
    currentColors.splice(index, 1);
    colorsInput.value = currentColors.join(',');
    renderColorPreviews();
    // Auto-update variants/gallery dropdowns if colors changed
    updateGalleryColorSelect();
    generateVariantGrid();
  }
}

function renderColorPreviews() {
  const container = document.getElementById('color-preview-container');
  const colorsInput = document.getElementById('product-colors').value.trim();
  
  if (!colorsInput) {
    container.innerHTML = '<span style="font-size:0.8rem;color:#999;">No colors added yet.</span>';
    return;
  }

  const colors = colorsInput.split(',').map(c => {
    const parts = c.split(':');
    return { name: parts[0].trim(), hex: parts[1] ? parts[1].trim() : '#000000' };
  }).filter(c => c.name);

  container.innerHTML = colors.map((c, idx) => `
    <div style="display:flex; align-items:center; gap:6px; background:#f5f5f5; padding:4px 8px; border-radius:16px; border:1px solid #ddd; font-size:0.8rem;">
      <div style="width:14px; height:14px; border-radius:50%; background-color:${c.hex}; border:1px solid #ccc;"></div>
      <span>${c.name}</span>
      <button type="button" onclick="removeColor(${idx})" style="color:var(--color-error);font-weight:bold;margin-left:4px;" title="Remove Color">✕</button>
    </div>
  `).join('');
}

// Generate Variant Grid Matrix
function generateVariantGrid() {
  const sizesInput = document.getElementById('product-sizes').value.trim();
  const colorsInput = document.getElementById('product-colors').value.trim();
  const container = document.getElementById('variant-stock-container');
  
  updateGalleryColorSelect(); // Keep gallery select synced

  if (!sizesInput || !colorsInput) {
    container.innerHTML = '<p style="font-size:0.8rem;color:#777;">Please enter at least one size and one color.</p>';
    container.style.display = 'block';
    return;
  }

  const sizes = sizesInput.split(',').map(s => s.trim()).filter(Boolean);
  const colors = colorsInput.split(',').map(c => {
    const parts = c.split(':');
    return parts[0].trim();
  }).filter(Boolean);

  let html = `<table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                <tr style="border-bottom:1px solid #ddd;">
                  <th style="padding:4px;text-align:left;">Size</th>
                  <th style="padding:4px;text-align:left;">Color</th>
                  <th style="padding:4px;text-align:left;">Stock</th>
                </tr>`;

  // Retain existing values if typed
  const gridInputs = document.querySelectorAll('.variant-stock-input');
  const tempGridData = {};
  gridInputs.forEach(input => {
    tempGridData[`${input.dataset.size}-${input.dataset.color}`] = parseInt(input.value) || 0;
  });

  sizes.forEach(size => {
    colors.forEach(color => {
      // Look for existing stock across previously saved variants or recently typed values
      const existingDb = currentVariantGrid.find(v => v.size === size && v.colorName === color);
      let stock = existingDb ? existingDb.stock : 0;
      if (tempGridData[`${size}-${color}`] !== undefined) {
          stock = tempGridData[`${size}-${color}`];
      }

      html += `<tr>
                <td style="padding:4px;">${size}</td>
                <td style="padding:4px;">${color}</td>
                <td style="padding:4px;">
                  <input type="number" class="variant-stock-input" data-size="${size}" data-color="${color}" value="${stock}" min="0" style="padding:4px;width:60px;border:1px solid #ccc;border-radius:4px;">
                </td>
               </tr>`;
    });
  });
  html += `</table>`;
  container.innerHTML = html;
  container.style.display = 'block';
}

function updateGalleryColorSelect() {
  const colorsInput = document.getElementById('product-colors').value.trim();
  const select = document.getElementById('gallery-color-select');
  
  const colors = colorsInput.split(',').map(c => {
    const parts = c.split(':');
    return parts[0].trim();
  }).filter(Boolean);

  let options = '<option value="">Select color first...</option>';
  colors.forEach(c => {
    options += `<option value="${c}">${c}</option>`;
  });
  select.innerHTML = options;
}

// ---------- Image Uploads (ImgBB) ----------
async function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const preview = document.getElementById('upload-preview');
  const placeholder = document.getElementById('upload-placeholder');

  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);

  const msgEl = document.getElementById('modal-message');
  msgEl.textContent = 'Uploading main image to ImgBB...';
  msgEl.className = 'form-message success';
  msgEl.style.display = 'block';

  const result = await API.uploadImage(file);
  if (result.success) {
    uploadedImageUrl = result.url;
    document.getElementById('product-image-url').value = result.url;
    msgEl.textContent = 'Main image uploaded successfully.';
    setTimeout(() => msgEl.style.display = 'none', 2000);
  } else {
    msgEl.textContent = 'Main image upload failed.';
    msgEl.className = 'form-message error';
  }
}

// Gallery Uploads
async function handleGalleryImageUpload(event) {
  const colorSelect = document.getElementById('gallery-color-select');
  const colorName = colorSelect.value;
  if (!colorName) {
    alert("Please select a color for this image first.");
    event.target.value = '';
    return;
  }

  const file = event.target.files[0];
  if (!file) return;

  const msgEl = document.getElementById('modal-message');
  msgEl.textContent = `Uploading image for ${colorName}...`;
  msgEl.className = 'form-message success';
  msgEl.style.display = 'block';

  const result = await API.uploadImage(file);
  if (result.success) {
    galleryImages.push({ colorName, imageUrl: result.url });
    renderGalleryPreviews();
    msgEl.textContent = 'Gallery image added.';
    setTimeout(() => msgEl.style.display = 'none', 2000);
  } else {
    msgEl.textContent = 'Gallery image upload failed.';
    msgEl.className = 'form-message error';
  }
  event.target.value = '';
}

function renderGalleryPreviews() {
  const container = document.getElementById('gallery-preview-container');
  if (galleryImages.length === 0) {
    container.innerHTML = '<p style="font-size:0.75rem;color:#999;font-style:italic;">No gallery images yet.</p>';
    return;
  }
  container.innerHTML = galleryImages.map((img, idx) => `
    <div style="position:relative; flex-shrink:0;">
      <span style="position:absolute;top:0;right:0;background:red;color:white;cursor:pointer;width:16px;height:16px;font-size:10px;text-align:center;line-height:16px;border-radius:50%;" onclick="removeGalleryImage(${idx})">✕</span>
      <img src="${img.imageUrl}" style="width:50px;height:50px;object-fit:cover;border:1px solid #ddd;border-radius:4px;">
      <div style="font-size:0.6rem;text-align:center;background:#eee;padding:2px;">${img.colorName}</div>
    </div>
  `).join('');
}

function removeGalleryImage(index) {
  galleryImages.splice(index, 1);
  renderGalleryPreviews();
}

// ---------- Save Product Flow ----------
async function handleSaveProduct(e) {
  e.preventDefault();

  const name = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value;
  const price = document.getElementById('product-price').value;
  const description = document.getElementById('product-description').value.trim();
  const imageUrl = document.getElementById('product-image-url').value || uploadedImageUrl;
  const sizes = document.getElementById('product-sizes').value.trim();
  const colors = document.getElementById('product-colors').value.trim();

  const msgEl = document.getElementById('modal-message');
  const saveBtn = document.getElementById('save-product-btn');

  if (!name || !category || !price || !sizes || !colors) {
    msgEl.textContent = 'Please fill in Name, Category, Price, Sizes and Colors.';
    msgEl.className = 'form-message error';
    msgEl.style.display = 'block';
    return;
  }

  // Gather variants
  const gridInputs = document.querySelectorAll('.variant-stock-input');
  const selectedVariants = [];
  let hasEmptyColor = false;
  gridInputs.forEach(input => {
    const colorName = input.dataset.color;
    if (!colorName || colorName.trim() === '') {
      hasEmptyColor = true;
      return;
    }
    selectedVariants.push({
      size: input.dataset.size,
      color: colorName.trim(),
      stock: parseInt(input.value) || 0
    });
  });

  if (hasEmptyColor) {
    msgEl.textContent = 'One or more variant rows have an empty Color. Please define colors before generating the grid.';
    msgEl.className = 'form-message error';
    msgEl.style.display = 'block';
    return;
  }

  if (selectedVariants.length === 0) {
    msgEl.textContent = 'Please generate the Variant Stock Grid before saving.';
    msgEl.className = 'form-message error';
    msgEl.style.display = 'block';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving Product...';

  const productData = {
    name, category, price: parseFloat(price), description,
    imageUrl: imageUrl || '', sizes, colors
  };

  try {
    // 1. Save Base Product
    let result;
    let finalProductId = editingProductId;
    
    if (editingProductId) {
      productData.id = editingProductId;
      result = await API.updateProduct(productData);
    } else {
      result = await API.addProduct(productData);
      if (result.success) finalProductId = result.id;
    }

    if (!result.success) throw new Error(result.error || 'Failed to save base product');

    // 2. Save Variants
    saveBtn.textContent = 'Saving Variants...';
    const variantRes = await API.saveProductVariants(finalProductId, selectedVariants);
    if (!variantRes.success) throw new Error(variantRes.error || 'Failed to save variants');

    // 3. Save Images
    saveBtn.textContent = 'Saving Images...';
    // Format required by API: { color: ..., imageUrl: ... }
    // Note: galleryImages uses `colorName` internally; backend reads `color` — map explicitly
    const finalGallery = galleryImages.map(img => ({ color: img.colorName, imageUrl: img.imageUrl, productId: finalProductId }));
    const imageRes = await API.saveProductImages(finalProductId, finalGallery);
    if (!imageRes.success) throw new Error(imageRes.error || 'Failed to save gallery images');

    // Success!
    msgEl.textContent = 'Product saved successfully!';
    msgEl.className = 'form-message success';
    msgEl.style.display = 'block';

    setTimeout(() => {
      closeProductModal();
      loadAllData();
    }, 1000);

  } catch (err) {
    msgEl.textContent = err.message || 'Something went wrong.';
    msgEl.className = 'form-message error';
    msgEl.style.display = 'block';
    saveBtn.disabled = false;
    saveBtn.textContent = editingProductId ? 'Update Product' : 'Save Product';
  }
}

// ---------- Delete Product ----------
function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('delete-modal').classList.add('show');
  
  document.getElementById('confirm-delete-btn').onclick = async () => {
    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    try {
      const result = await API.deleteProduct(pendingDeleteId);
      if (result.success) {
        closeDeleteModal();
        loadAllData();
      } else {
        alert(result.error || 'Failed to delete product.');
        btn.disabled = false;
        btn.textContent = 'Delete';
      }
    } catch (err) {
      alert('Something went wrong.');
      btn.disabled = false;
      btn.textContent = 'Delete';
    }
  };
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.remove('show');
  pendingDeleteId = null;
  const btn = document.getElementById('confirm-delete-btn');
  btn.disabled = false;
  btn.textContent = 'Delete';
}

// ---------- Update Order Status ----------
async function handleOrderStatusChange(select) {
  const orderId = select.dataset.orderId;
  const newStatus = select.value;
  select.disabled = true;
  try {
    const res = await API.updateOrderStatus(orderId, newStatus);
    if (res.success) {
      loadOrders(); 
    } else {
      alert(res.error || 'Failed to update order status.');
      select.disabled = false;
    }
  } catch (err) {
    alert('Failed to update order status.');
    select.disabled = false;
  }
}

// Payment status is set automatically by Cashfree verification.
// No manual override needed — removed.

// ---------- Logout ----------
function adminLogout() {
  sessionStorage.removeItem('vk_admin_token');
  sessionStorage.removeItem('vk_admin_email');
  window.location.href = 'index.html';
}

// ---------- Invoicing ----------
window.openReceipt = function(orderId) {
  window.open(`receipt.html?orderId=${orderId}`, '_blank');
};
