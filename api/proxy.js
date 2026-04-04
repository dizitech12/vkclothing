export default async function handler(req, res) {
  try {
    const url = process.env.API_URL;
    
    // TASK 4: Add debug logging (we log whether it exists to avoid exposing the actual URL in logs if prefered, but we will log it temporarily as requested)
    console.log("DEBUG - Loaded API_URL:", url);

    if (!url) {
      return res.status(500).json({ success: false, error: "API_URL is missing in environment variables" });
    }

    // TASK 2: Fix /api/proxy handler & correctly forward query string
    const query = new URLSearchParams(req.query).toString();
    const fetchUrl = query ? `${url}?${query}` : url;

    // TASK 3: Support both GET and POST
    const options = {
      method: req.method,
      headers: {
        'Accept': 'application/json'
      },
      // Important to follow redirects for Google Apps Script
      redirect: 'follow',
      // Adding a reasonable timeout just in case it hangs
      signal: AbortSignal.timeout(20000)
    };

    if (req.method === 'POST') {
      options.headers['Content-Type'] = 'application/json';
      // Forward JSON body to Apps Script
      options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    }

    const response = await fetch(fetchUrl, options);
    
    // TASK 5: Verify response format
    const data = await response.text();
    
    try {
      // If it's valid JSON, send it as JSON
      const jsonData = JSON.parse(data);
      res.status(200).json(jsonData);
    } catch (parseError) {
      // If it's not JSON, send it as text but still 200 OK (so client can handle it or show error)
      res.status(200).send(data);
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
