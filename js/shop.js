// ============================================
// VKclothing — Shop Page Logic
// Load products, filter by category
// Uses localStorage cache (5-min TTL via api.js)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const shopGrid = document.getElementById('shop-grid');
  const filterBar = document.getElementById('filter-bar');

  if (!shopGrid) return;

  let allProducts = [];

  // Check URL for category param
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category') || 'all';

  // Set active filter from URL
  if (initialCategory !== 'all') {
    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === initialCategory);
    });
  }

  // Load products (uses cache when fresh)
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
    // Show skeleton cards immediately while fetching
    showSkeletons(container, 8);

    try {
      allProducts = await API.getProducts();
      filterProducts(container, category);
    } catch (err) {
      container.innerHTML = '<p style="text-align:center;color:var(--color-error);grid-column:1/-1;">Failed to load products. Please refresh.</p>';
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

// ── Skeleton loader ───────────────────────────────────────────────
function showSkeletons(container, count) {
  const skeletonCard = `
    <div style="border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
      <div style="width:100%;aspect-ratio:3/4;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:skeletonShimmer 1.4s infinite;"></div>
      <div style="padding:14px 16px;">
        <div style="height:16px;border-radius:6px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:skeletonShimmer 1.4s infinite;margin-bottom:10px;width:75%;"></div>
        <div style="height:13px;border-radius:6px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:skeletonShimmer 1.4s infinite;margin-bottom:14px;width:50%;"></div>
        <div style="height:38px;border-radius:8px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:skeletonShimmer 1.4s infinite;"></div>
      </div>
    </div>`;

    // Inject keyframe only once
  if (!document.getElementById('skeleton-style')) {
    const s = document.createElement('style');
    s.id = 'skeleton-style';
    s.textContent = `@keyframes skeletonShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
    document.head.appendChild(s);
  }

  container.innerHTML = Array(count).fill(skeletonCard).join('');
}
