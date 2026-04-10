// ============================================
// VKclothing — API Layer
// All Google Apps Script & ImgBB API calls
// ============================================

const API = {

  // In-flight request deduplication — prevents duplicate network calls
  // when multiple parts of the page call the same method simultaneously
  _pending: {},

  // ---------- Helper: GET request ----------
  async _get(params) {
    try {
      const url = `/api/proxy?${new URLSearchParams(params).toString()}`;
      const headers = { 'Accept': 'application/json' };
      const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('vk_admin_token') : null;
      if (token) headers['x-admin-token'] = token;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        let errorMessage = `HTTP Error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If not JSON, it's likely a Vercel HTML error page
          const text = await res.text();
          if (res.status === 413) errorMessage = "File too large for server. Try a smaller image.";
          else if (text.includes("Request Entity Too Large")) errorMessage = "File too large.";
        }
        throw new Error(errorMessage);
      }
      return await res.json();
    } catch (err) {
      console.error('API GET Error:', err);
      const msg = err.message || 'Something went wrong.';
      if (typeof showToast === 'function') showToast(msg, 'error');
      throw err;
    }
  },

  // ---------- Helper: POST request ----------
  async _post(payload) {
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: (() => {
          const h = { 'Content-Type': 'application/json' };
          const t = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('vk_admin_token') : null;
          if (t) h['x-admin-token'] = t;
          return h;
        })(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let errorMessage = `HTTP Error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const text = await res.text();
          if (res.status === 413) errorMessage = "File too large for server.";
          else if (text.includes("Request Entity Too Large")) errorMessage = "File too large.";
        }
        return { success: false, error: errorMessage };
      }
      return await res.json();
    } catch (err) {
      console.error('API POST Error:', err);
      const msg = err.message || 'Server connection failed';
      if (typeof showToast === 'function') showToast(msg, 'error');
      return { success: false, error: msg };
    }
  },

  // Helper: Convert File object to Base64
  _toBase64(fileOrBlob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileOrBlob);
      reader.onload = () => resolve(reader.result.replace(/^data:.+;base64,/, ''));
      reader.onerror = error => reject(error);
    });
  },

  // Helper: Compress image using Canvas
  _compressImage(file, maxFilesizeMB = 4) {
    return new Promise((resolve) => {
      // If file is already small, don't waste time compressing
      if (file.size < maxFilesizeMB * 1024 * 1024) {
        return resolve(file);
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scale down if dimensions are huge (keep aspect ratio)
          const MAX_DIM = 1920; 
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            } else {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG with 0.8 quality
          canvas.toBlob((blob) => {
            resolve(blob || file);
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  },

  // ---------- ImgBB Upload ----------
  async uploadImage(file) {
    try {
      // 1. Compress if it's a large file
      const processedFile = await this._compressImage(file);
      
      // 2. Convert to Base64
      const base64Image = await this._toBase64(processedFile);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!res.ok) {
        if (res.status === 413) throw new Error("Image too large. Please resize it.");
        const text = await res.text();
        if (text.includes("Request Entity Too Large")) throw new Error("Image too large.");
        throw new Error(`Upload failed: ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        return { success: true, url: data.data.url };
      }
      return { success: false, error: 'Upload failed' };
    } catch (err) {
      console.error('Image upload failed:', err);
      const msg = err.message || 'Something went wrong.';
      if (typeof showToast === 'function') showToast(msg, 'error');
      return { success: false, error: msg };
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
    // 1. Return from localStorage cache if fresh
    const cached = localStorage.getItem('vk_products');
    const cachedTime = localStorage.getItem('vk_products_time');
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < CONFIG.LOCAL_CACHE_DURATION) {
      return JSON.parse(cached);
    }
    // 2. Deduplicate — if a fetch is already in-flight, share it
    if (this._pending.products) return this._pending.products;

    this._pending.products = (async () => {
      try {
        const data = await this._get({ action: 'getProducts' });
        localStorage.setItem('vk_products', JSON.stringify(data));
        localStorage.setItem('vk_products_time', Date.now().toString());
        return data;
      } catch (err) {
        console.error('Failed to fetch products:', err);
        if (cached) return JSON.parse(cached);
        return [];
      } finally {
        delete this._pending.products;
      }
    })();
    return this._pending.products;
  },

  async getProduct(id) {
    const products = await this.getProducts();
    return products.find(p => p.id === id) || null;
  },

  async addProduct(product) {
    try {
      const result = await this._post({ action: 'addProduct', data: product });
      this.clearLocalCache();
      return result;
    } catch (err) {
      console.error('Failed to add product:', err);
      return { success: false, error: err.message };
    }
  },

  async updateProduct(product) {
    try {
      const result = await this._post({ action: 'updateProduct', data: product });
      this.clearLocalCache();
      return result;
    } catch (err) {
      console.error('Failed to update product:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteProduct(id) {
    try {
      const result = await this._post({ action: 'deleteProduct', id });
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
    if (this._pending.variants) return this._pending.variants;

    this._pending.variants = (async () => {
      try {
        const data = await this._get({ action: 'getProductVariants' });
        localStorage.setItem('vk_variants', JSON.stringify(data));
        localStorage.setItem('vk_variants_time', Date.now().toString());
        return data;
      } catch (err) {
        console.error('Failed to fetch variants:', err);
        if (cached) return JSON.parse(cached);
        return [];
      } finally {
        delete this._pending.variants;
      }
    })();
    return this._pending.variants;
  },

  async saveProductVariants(productId, variants) {
    try {
      const result = await this._post({ action: 'saveProductVariants', productId, variants });
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
    if (this._pending.images) return this._pending.images;

    this._pending.images = (async () => {
      try {
        const data = await this._get({ action: 'getProductImages' });
        localStorage.setItem('vk_images', JSON.stringify(data));
        localStorage.setItem('vk_images_time', Date.now().toString());
        return data;
      } catch (err) {
        console.error('Failed to fetch images:', err);
        if (cached) return JSON.parse(cached);
        return [];
      } finally {
        delete this._pending.images;
      }
    })();
    return this._pending.images;
  },

  async saveProductImages(productId, images) {
    try {
      const result = await this._post({ action: 'saveProductImages', productId, images });
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
      const res = await this._get({ action: 'getOrders' });
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

  async updateOrderStatus(orderId, status) {
    try {
      return await this._post({ action: 'updateOrderStatus', orderId, status });
    } catch (err) {
      console.error('Failed to update order status:', err);
      return { success: false, error: err.message };
    }
  },

  async updatePaymentStatus(orderId, paymentStatus) {
    try {
      return await this._post({ action: 'updatePaymentStatus', orderId, paymentStatus });
    } catch (err) {
      console.error('Failed to update payment status:', err);
      return { success: false, error: err.message };
    }
  },

  async deleteOrder(orderId) {
    try {
      return await this._post({ action: 'deleteOrder', orderId });
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
  async getAnalytics(refresh = false) {
    try {
      return await this._get({ action: 'getAnalytics', refresh: refresh });
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      return { success: false, error: err.message };
    }
  },

  async getAnalyticsSummary(refresh = false) {
    try {
      return await this._get({ action: 'getAnalyticsSummary', refresh: refresh });
    } catch (err) {
      console.error('Failed to fetch analytics summary:', err);
      return { success: false, error: err.message };
    }
  },

  async getWeeklySales(refresh = false) {
    try {
      return await this._get({ action: 'getWeeklySales', refresh: refresh });
    } catch (err) {
      console.error('Failed to fetch weekly sales:', err);
      return { success: false, error: err.message };
    }
  },

  async getOrdersPerDay(refresh = false) {
    try {
      return await this._get({ action: 'getOrdersPerDay', refresh: refresh });
    } catch (err) {
      console.error('Failed to fetch orders per day:', err);
      return { success: false, error: err.message };
    }
  },

  async getCustomerGrowth(refresh = false) {
    try {
      return await this._get({ action: 'getCustomerGrowth', refresh: refresh });
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
