export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { order_id, order_amount, customer_details, order_meta } = req.body;
    
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    
    if (!appId || !secretKey) {
      return res.status(500).json({ success: false, error: 'Payment gateway not completely configured. Missing Keys.' });
    }

    // Switch to https://api.cashfree.com/pg/orders when going to Production
    const url = 'https://sandbox.cashfree.com/pg/orders';

    const payload = {
      order_id: order_id,
      order_amount: order_amount,
      order_currency: "INR",
      customer_details: customer_details,
      order_meta: order_meta
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Cashfree API Error:", data);
      return res.status(response.status).json({ success: false, error: data.message || 'Payment initiation failed' });
    }

    return res.status(200).json({ 
      success: true, 
      payment_session_id: data.payment_session_id, 
      payment_link: data.payment_link 
    });

  } catch (err) {
    console.error("Create Order Proxy Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
