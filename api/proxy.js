export default async function handler(req, res) {
  try {
    const url = process.env.API_URL;
    
    console.log("DEBUG - Loaded API_URL:", url);

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

    // Check if the requested action is an admin action
    if (action && adminActions.includes(action)) {
      const token = req.headers['x-admin-token'];
      if (!token) {
        return res.status(401).json({ success: false, error: "Unauthorized: Missing x-admin-token" });
      }

      // Inject the secret
      if (isGet) {
        req.query.adminSecret = ADMIN_SECRET;
      } else {
        req.body.adminSecret = ADMIN_SECRET;
      }
    }

    const query = new URLSearchParams(req.query).toString();
    const fetchUrl = query ? `${url}?${query}` : url;

    const options = {
      method: req.method,
      headers: {
        'Accept': 'application/json'
      },
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
      res.status(200).json(jsonData);
    } catch (parseError) {
      console.error("Google Apps Script returned non-JSON:", data.substring(0, 500));
      res.status(502).json({
        success: false,
        error: "Google Apps Script returned HTML instead of JSON. Check if 'Who has access' is set to 'Anyone' in your deployment settings.",
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
