const fs = require('fs');
const path = require('path');

// Extract environment variables or use defaults
const config = {
  API_URL: process.env.API_URL || 'https://script.google.com/macros/s/AKfycbznCrBD3qqfPhemcsSaFmCzjsLD1PGBvG4lKm0USeztvlT6d0HOzW0lbbk26MriuZ3_/exec',
  IMGBB_API_KEY: process.env.IMGBB_API_KEY || 'b53bb17fa59026df04b87aa5b1c6a3dc',
  IMGBB_URL: process.env.IMGBB_URL || 'https://api.imgbb.com/1/upload',
  BRAND_NAME: process.env.BRAND_NAME || 'VKclothing',
  BRAND_EMAIL: process.env.BRAND_EMAIL || 'vkclothing111@gmail.com',
  INSTAGRAM: process.env.INSTAGRAM || 'https://instagram.com/vkclothing',
  STORE_NAME: process.env.STORE_NAME || 'VKclothing',
  STORE_PHONE: process.env.STORE_PHONE || '+91 8147251952',
  STORE_EMAIL: process.env.STORE_EMAIL || 'vkclothing111@gmail.com',
  STORE_ADDRESS: process.env.STORE_ADDRESS || 'Online Store Only',
  STORE_LOGO: process.env.STORE_LOGO || '../assets/images/favicon.png',
  LOCAL_CACHE_DURATION: parseInt(process.env.LOCAL_CACHE_DURATION) || 300000,
};

const configContent = `// ============================================
// VKclothing — Generated Configuration
// ============================================

const CONFIG = ${JSON.stringify(config, null, 2)};
`;

const dir = path.join(__dirname, 'js');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

fs.writeFileSync(path.join(dir, 'config.js'), configContent);
console.log('js/config.js has been generated successfully.');
