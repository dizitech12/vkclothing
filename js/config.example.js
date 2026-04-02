// ============================================
// VKclothing — Configuration (EXAMPLE)
// Copy this to js/config.js and fill in your credentials
// ============================================

const CONFIG = {
  // Google Apps Script Web App URL
  // Replace with your deployed Web App URL
  API_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',

  // ImgBB API Key
  // Get a free key from https://api.imgbb.com/
  IMGBB_API_KEY: 'YOUR_IMGBB_API_KEY',

  // ImgBB Upload endpoint
  IMGBB_URL: 'https://api.imgbb.com/1/upload',

  // Brand info
  BRAND_NAME: 'VKclothing',
  BRAND_EMAIL: 'your@email.com',
  INSTAGRAM: 'https://instagram.com/your_instagram',

  // Store profile explicitly for invoices
  STORE_NAME: 'VKclothing',
  STORE_PHONE: '+91 0000000000',
  STORE_EMAIL: 'your@email.com',
  STORE_ADDRESS: 'Online Store Only',
  STORE_LOGO: '../assets/images/favicon.png',

  // Cache duration (ms) for local product caching
  LOCAL_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};
