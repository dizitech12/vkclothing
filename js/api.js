// ============================================
// VKclothing — API Layer
// All Google Apps Script & ImgBB API calls
// ============================================

const API = {
  // ---------- Helper: Admin secret ----------
  _resolveAdminSecret() {
    try {
      return sessionStorage.getItem('vk_admin_secret') || '';
    } catch (err) {
      return '';
    }
  },

  // ---------- Helper: GET request ----------
  async _get(params) {
    try {
      const url = `/api/proxy?${new URLSearchParams(params).toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.text();
        console.error(`Proxy GET Error Response (${res.status}):`, errorData);
        throw new Error(`HTTP Error: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error('API GET Error:', err);
      if (typeof showToast === 'function') showToast('Something went wrong, please try again.', 'error');
      throw err;
    }
  },

  // ---------- Helper: POST request ----------
  async _post(payload) {
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.text();
        console.error(`Proxy POST Error Response (${res.status}):`, errorData);
        throw new Error(`HTTP Error: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error('API POST Error:', err);
      if (typeof showToast === 'function') showToast('Something went wrong, please try again.', 'error');
      return { success: false, error: "Server connection failed" };
    }
  },

  // Helper: Convert File object to Base64
  _toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.replace(/^data:.+;base64,/, ''));
      reader.onerror = error => reject(error);
    });
  },

  // ---------- ImgBB Upload ----------
  async uploadImage(file) {
    try {
      const base64Image = await this._toBase64(file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Image }),
      });
      const data = await res.json();
      if (data.success) {
        return { success: true, url: data.data.url };
      }
      return { success: false, error: 'Upload failed' };
    } catch (err) {
      console.error('Image upload failed:', err);
      if (typeof showToast === 'function') showToast('Something went wrong, please try again.', 'error');
      return { success: false, error: err.message };
    }
  },

  // ---------- Products ----------
  async getProductsFull() {
    try {
      return await this._get({ action: 'getProductsFull' });
    } catch (err) {
      console.error('Failed to fetch full products data:', err);
      return { success: false, products: [], variants: [], images: [] };
    }
  },

  async getProducts() {
    // Check local cache first
    const cached = localStorage.getItem('vk_products');
    const cachedTime = localStorage.getItem('vk_products_time');
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < CONFIG.LOCAL_CACHE_DURATION) {
      return JSON.parse(cached);
    }

    try {
      const data = await this._get({ action: 'getProducts' });
      // Cache locally
      localStorage.setItem('vk_products', JSON.stringify(data));
      localStorage.setItem('vk_products_time', Date.now().toString());
      return data;
    } catch (err) {
      console.error('Failed to fetch products:', err);
      // Return stale cache if available
      if (cached) return JSON.parse(cached);
      return [];
    }
  },

  async getProduct(id) {
    const products = await this.getProducts();
    return products.find(p => p.id === id) || null;
  },

  async addProduct(product, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      const result = await this._post({ action: 'addProduct', data: product, adminSecret: finalAdminSecret });
      this.clearLocalCache();
      return result;
    } catch (err) {
      console.error('Failed to add product:', err);
      return { success: false, error: err.message };
    }
  },

  async updateProduct(product, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      const result = await this._post({ action: 'updateProduct', data: product, adminSecret: finalAdminSecret });
      this.clearLocalCache();
      return result;
    } catch (err) {
      console.error('Failed to update product:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteProduct(id, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      const result = await this._post({ action: 'deleteProduct', id, adminSecret: finalAdminSecret });
      this.clearLocalCache();
      return result;
    } catch (err) {
      console.error('Failed to delete product:', err);
      return { success: false, error: err.message };
    }
  },

  async updateStock(id, quantity) {
    try {
      const result = await this._post({ action: 'updateStock', id, quantity });
      this.clearLocalCache();
      return result;
    } catch (err) {
      console.error('Failed to update stock:', err);
      return { success: false, error: err.message };
    }
  },

  // ---------- Product Variants ----------
  async getProductVariants() {
    const cached = localStorage.getItem('vk_variants');
    const cachedTime = localStorage.getItem('vk_variants_time');
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < CONFIG.LOCAL_CACHE_DURATION) {
      return JSON.parse(cached);
    }
    try {
      const data = await this._get({ action: 'getProductVariants' });
      localStorage.setItem('vk_variants', JSON.stringify(data));
      localStorage.setItem('vk_variants_time', Date.now().toString());
      return data;
    } catch (err) {
      console.error('Failed to fetch variants:', err);
      if (cached) return JSON.parse(cached);
      return [];
    }
  },

  async saveProductVariants(productId, variants, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      const result = await this._post({ action: 'saveProductVariants', productId, variants, adminSecret: finalAdminSecret });
      this.clearLocalCache();
      return result;
    } catch (err) {
      console.error('Failed to save variants:', err);
      return { success: false, error: err.message };
    }
  },

  // ---------- Product Images ----------
  async getProductImages() {
    const cached = localStorage.getItem('vk_images');
    const cachedTime = localStorage.getItem('vk_images_time');
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < CONFIG.LOCAL_CACHE_DURATION) {
      return JSON.parse(cached);
    }
    try {
      const data = await this._get({ action: 'getProductImages' });
      localStorage.setItem('vk_images', JSON.stringify(data));
      localStorage.setItem('vk_images_time', Date.now().toString());
      return data;
    } catch (err) {
      console.error('Failed to fetch images:', err);
      if (cached) return JSON.parse(cached);
      return [];
    }
  },

  async saveProductImages(productId, images, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      const result = await this._post({ action: 'saveProductImages', productId, images, adminSecret: finalAdminSecret });
      this.clearLocalCache();
      return result;
    } catch (err) {
      console.error('Failed to save images:', err);
      return { success: false, error: err.message };
    }
  },

  // ---------- Orders ----------
  async createOrder(orderData) {
    try {
      return await this._post({ action: 'createOrder', data: orderData });
    } catch (err) {
      console.error('Failed to create order:', err);
      return { success: false, error: err.message };
    }
  },

  async getOrders() {
    try {
      const res = await this._get({ action: 'getOrders', adminSecret: 'vk_admin_123' });
      return res.success ? res.orders : [];
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      return [];
    }
  },

  async getUserOrders(userId) {
    try {
      return await this._get({ action: 'getUserOrders', userId: userId });
    } catch (err) {
      console.error('Failed to fetch user orders:', err);
      return { success: false, orders: [] };
    }
  },

  async updateOrderStatus(orderId, status, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      return await this._post({ action: 'updateOrderStatus', orderId, status, adminSecret: finalAdminSecret });
    } catch (err) {
      console.error('Failed to update order status:', err);
      return { success: false, error: err.message };
    }
  },

  async updatePaymentStatus(orderId, paymentStatus, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      return await this._post({ action: 'updatePaymentStatus', orderId, paymentStatus, adminSecret: finalAdminSecret });
    } catch (err) {
      console.error('Failed to update payment status:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteOrder(orderId, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      return await this._post({ action: 'deleteOrder', orderId, adminSecret: finalAdminSecret });
    } catch (err) {
      console.error('Failed to delete order:', err);
      return { success: false, error: err.message };
    }
  },

  // ---------- Auth ----------
  async loginAdmin(email, password) {
    try {
      return await this._post({ action: 'loginAdmin', email, password });
    } catch (err) {
      console.error('Login failed:', err);
      return { success: false, error: err.message };
    }
  },

  async registerUser(phone, password) {
    try {
      return await this._post({ action: 'registerUser', phone, password });
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async loginUser(phone, password) {
    try {
      return await this._post({ action: 'loginUser', phone, password });
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ---------- User Data & Sync ----------
  async syncUserData(userId, cartJSON, wishlistJSON) {
    try {
      return await this._post({ action: 'syncUserData', userId, cart: cartJSON, wishlist: wishlistJSON });
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getUserData(userId) {
    try {
      return await this._get({ action: 'getUserData', userId: userId });
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async verifyUser(userId) {
    try {
      return await this._get({ action: 'verifyUser', userId: userId });
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async addAddress(addressData) {
    try {
      return await this._post({ action: 'addAddress', data: addressData });
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getAddresses(userId) {
    try {
      return await this._get({ action: 'getAddresses', userId });
    } catch (err) {
      return { success: false, addresses: [] };
    }
  },

  // ---------- Contact ----------
  async submitContact(formData) {
    try {
      return await this._post({ action: 'submitContact', data: formData });
    } catch (err) {
      console.error('Failed to submit contact:', err);
      return { success: false, error: err.message };
    }
  },

  // ---------- Analytics ----------
  async getAnalytics(refresh = false, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      return await this._get({ action: 'getAnalytics', refresh: refresh, adminSecret: finalAdminSecret });
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      return { success: false, error: err.message };
    }
  },

  async getAnalyticsSummary(refresh = false, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      return await this._get({ action: 'getAnalyticsSummary', refresh: refresh, adminSecret: finalAdminSecret });
    } catch (err) {
      console.error('Failed to fetch analytics summary:', err);
      return { success: false, error: err.message };
    }
  },

  async getWeeklySales(refresh = false, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      return await this._get({ action: 'getWeeklySales', refresh: refresh, adminSecret: finalAdminSecret });
    } catch (err) {
      console.error('Failed to fetch weekly sales:', err);
      return { success: false, error: err.message };
    }
  },

  async getOrdersPerDay(refresh = false, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      return await this._get({ action: 'getOrdersPerDay', refresh: refresh, adminSecret: finalAdminSecret });
    } catch (err) {
      console.error('Failed to fetch orders per day:', err);
      return { success: false, error: err.message };
    }
  },

  async getCustomerGrowth(refresh = false, adminSecret) {
    try {
      const finalAdminSecret = adminSecret || this._resolveAdminSecret();
      return await this._get({ action: 'getCustomerGrowth', refresh: refresh, adminSecret: finalAdminSecret });
    } catch (err) {
      console.error('Failed to fetch customer growth:', err);
      return { success: false, error: err.message };
    }
  },

  // ---------- Cache ----------
  clearLocalCache() {
    localStorage.removeItem('vk_products');
    localStorage.removeItem('vk_products_time');
    localStorage.removeItem('vk_variants');
    localStorage.removeItem('vk_variants_time');
    localStorage.removeItem('vk_images');
    localStorage.removeItem('vk_images_time');
  },
};
