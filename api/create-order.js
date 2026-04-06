export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { order_id, order_amount, customer_details, order_meta } = req.body;
    
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    
    if (!appId || !secretKey) {
      return res.status(500).json({ success: false, error: 'Payment gateway not configured. Missing API keys.' });
    }

    // Sandbox URL — switch to https://api.cashfree.com/pg/orders for Production
    const cfUrl = 'https://sandbox.cashfree.com/pg/orders';

    const payload = {
      order_id: order_id,
      order_amount: Number(order_amount),
      order_currency: 'INR',
      customer_details: customer_details,
      order_meta: order_meta
    };

    console.log("Creating Cashfree order:", JSON.stringify(payload));

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
    console.log("Cashfree response:", JSON.stringify(data));

    if (!response.ok) {
      return res.status(response.status).json({ 
        success: false, 
        error: data.message || data.type || 'Cashfree order creation failed',
        details: data
      });
    }

    const sessionId = data.payment_session_id;

    // Construct the hosted payment page URL (Sandbox)
    // Switch to https://payments.cashfree.com/forms/view?id= for Production
    const paymentLink = `https://payments-test.cashfree.com/forms/view?id=${sessionId}`;

    return res.status(200).json({ 
      success: true, 
      payment_session_id: sessionId,
      payment_link: paymentLink
    });

  } catch (err) {
    console.error('Create Order Proxy Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
