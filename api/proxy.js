// Module-level server-side cache (persists within the same Vercel function warm instance)
const _serverCache = new Map();
const SERVER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Only these public GET actions are safe to cache server-side
const CACHEABLE_ACTIONS = ['getProducts', 'getProductVariants', 'getProductImages'];

export default async function handler(req, res) {
  try {
    const url = process.env.API_URL;
    
    if (!url) {
      return res.status(500).json({ success: false, error: "API_URL is missing in environment variables" });
    }

    const ADMIN_SECRET = "vk_admin_123";
    const adminActions = [
      "getOrders", "getAnalytics", "getAnalyticsSummary", 
      "getWeeklySales", "getOrdersPerDay", "getCustomerGrowth",
      "updateOrderStatus", "updatePaymentStatus", "deleteOrder", 
      "addProduct", "updateProduct", "deleteProduct", 
      "saveProductVariants", "saveProductImages"
    ];

    const isGet = req.method === 'GET' || req.method === 'HEAD';
    const reqData = isGet ? req.query : req.body;
    const action = reqData?.action;

    // Admin action guard
    if (action && adminActions.includes(action)) {
      const token = req.headers['x-admin-token'];
      if (!token) {
        return res.status(401).json({ success: false, error: "Unauthorized: Missing x-admin-token" });
      }
      if (isGet) {
        req.query.adminSecret = ADMIN_SECRET;
      } else {
        req.body.adminSecret = ADMIN_SECRET;
      }
    }

    // ── Server-side cache for public read actions ─────────────────
    if (isGet && action && CACHEABLE_ACTIONS.includes(action)) {
      const cacheKey = action;
      const cached = _serverCache.get(cacheKey);
      if (cached && (Date.now() - cached.ts) < SERVER_CACHE_TTL) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cached.data);
      }
    }

    const query = new URLSearchParams(req.query).toString();
    const fetchUrl = query ? `${url}?${query}` : url;

    const options = {
      method: req.method,
      headers: { 'Accept': 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000)
    };

    if (req.method === 'POST') {
      options.headers['Content-Type'] = 'application/json';
      options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    }

    const response = await fetch(fetchUrl, options);
    const data = await response.text();
    
    try {
      const jsonData = JSON.parse(data);

      // Store in server-side cache for eligible actions
      if (isGet && action && CACHEABLE_ACTIONS.includes(action)) {
        _serverCache.set(action, { data: jsonData, ts: Date.now() });
        res.setHeader('X-Cache', 'MISS');
      }

      res.status(200).json(jsonData);
    } catch (parseError) {
      console.error("Google Apps Script returned non-JSON:", data.substring(0, 500));
      res.status(502).json({
        success: false,
        error: "Google Apps Script returned HTML instead of JSON. Check deployment settings.",
        details: data.substring(0, 300)
      });
    }

  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({
      success: false,
      error: "Proxy request failed",
      details: error.message
    });
  }
}
