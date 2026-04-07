export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { order_id, order_amount, customer_details } = req.body;
    
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    
    if (!appId || !secretKey) {
      return res.status(500).json({ success: false, error: 'Payment gateway not configured. Missing API keys.' });
    }

    // Auto-switch URL based on CASHFREE_ENV env variable
    // Set CASHFREE_ENV=production in Vercel for live payments
    const isProduction = process.env.CASHFREE_ENV === 'production';
    const cfUrl = isProduction
      ? 'https://api.cashfree.com/pg/orders'
      : 'https://sandbox.cashfree.com/pg/orders';

    const payload = {
      order_id: order_id,
      order_amount: Number(order_amount),
      order_currency: 'INR',
      customer_details: customer_details,
      order_meta: {
        // notify_url is where Cashfree POSTs webhook events
        notify_url: `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/cashfree-webhook`
      }
    };

    console.log('Creating Cashfree order:', JSON.stringify(payload));

    const response = await fetch(cfUrl, {
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
    console.log('Cashfree response:', JSON.stringify(data));

    if (!response.ok) {
      return res.status(response.status).json({ 
        success: false, 
        error: data.message || data.type || 'Cashfree order creation failed',
        details: data
      });
    }

    const sessionId = data.payment_session_id;

    return res.status(200).json({ 
      success: true, 
      payment_session_id: sessionId,
      cf_order_id: data.cf_order_id
    });

  } catch (err) {
    console.error('Create Order Proxy Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
