// api/verify-payment.js
// Server-side payment verification with Cashfree
// Called from order-success.html BEFORE marking order as Paid

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { order_id } = req.query;

  if (!order_id) {
    return res.status(400).json({ success: false, error: 'order_id is required' });
  }

  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    return res.status(500).json({ success: false, error: 'Payment gateway not configured' });
  }

  try {
    // Auto-switch URL based on CASHFREE_ENV env variable
    const isProduction = process.env.CASHFREE_ENV === 'production';
    const url = isProduction
      ? `https://api.cashfree.com/pg/orders/${order_id}/payments`
      : `https://sandbox.cashfree.com/pg/orders/${order_id}/payments`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01',
        'Accept': 'application/json'
      }
    });

    const payments = await response.json();
    console.log('Cashfree payment verification response:', JSON.stringify(payments));

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: 'Failed to fetch payment status' });
    }

    // payments is an array of payment objects
    const successfulPayment = Array.isArray(payments)
      ? payments.find(p => p.payment_status === 'SUCCESS')
      : null;

    if (successfulPayment) {
      return res.status(200).json({
        success: true,
        verified: true,
        payment_status: 'SUCCESS',
        cf_payment_id: successfulPayment.cf_payment_id,
        payment_amount: successfulPayment.payment_amount,
        payment_method: successfulPayment.payment_method
      });
    }

    // Payment pending or failed
    const latestPayment = Array.isArray(payments) && payments.length > 0 ? payments[0] : null;
    return res.status(200).json({
      success: true,
      verified: false,
      payment_status: latestPayment?.payment_status || 'UNKNOWN'
    });

  } catch (err) {
    console.error('Verify Payment Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
