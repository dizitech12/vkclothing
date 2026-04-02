// ============================================
// VKclothing — Shop Page Logic
// Load products, filter by category
// Always fetches fresh data from API
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const shopGrid = document.getElementById('shop-grid');
  const filterBar = document.getElementById('filter-bar');

  if (!shopGrid) return;

  let allProducts = [];

  // Clear cached product data so we always get fresh stock
  API.clearLocalCache();

  // Check URL for category param
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category') || 'all';

  // Set active filter from URL
  if (initialCategory !== 'all') {
    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === initialCategory);
    });
  }

  // Load products (fresh from API)
  loadShopProducts(shopGrid, initialCategory);

  // Filter click handler
  filterBar.addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-btn')) return;

    filterBar.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');

    const category = e.target.dataset.category;
    filterProducts(shopGrid, category);
  });

  async function loadShopProducts(container, category) {
    container.innerHTML = '<div class="loading-spinner"></div>';

    try {
      allProducts = await API.getProducts();
      filterProducts(container, category);
    } catch (err) {
      container.innerHTML = '<p style="text-align:center;color:var(--color-error);grid-column:1/-1;">Failed to load products.</p>';
    }
  }

  function filterProducts(container, category) {
    let filtered = allProducts;

    if (category && category !== 'all') {
      filtered = allProducts.filter(p =>
        p.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);grid-column:1/-1;padding:40px;">No products found in this category.</p>';
      return;
    }

    container.innerHTML = filtered.map(product => createProductCard(product)).join('');
  }
});
