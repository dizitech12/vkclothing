const fs = require('fs');
const path = require('path');

function migrateApi(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping: ${filePath} does not exist`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Remove _resolveAdminSecret
  content = content.replace(/\s*\/\/\s*-+\s*Helper: Admin secret\s*-+[\s\S]*?_resolveAdminSecret\(\)\s*\{[\s\S]*?\},?(\n\s*(?=\/\/ ---------- Helper: GET))/m, '\n\n  ');

  // 2. Inject headers into _get
  content = content.replace(
    /const url = `\/api\/proxy\?\$\{new URLSearchParams\(params\)\.toString\(\)\}`;[\s\S]*?const res = await fetch\(url\);/,
    `const url = \`/api/proxy?$\{new URLSearchParams(params).toString()}\`;
      const headers = { 'Accept': 'application/json' };
      const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('vk_admin_token') : null;
      if (token) headers['x-admin-token'] = token;
      const res = await fetch(url, { headers });`
  );

  // 3. Inject headers into _post
  content = content.replace(
    /method: 'POST',\s*headers: \{\s*'Content-Type': 'application\/json',\s*\},/,
    `method: 'POST',
        headers: (() => {
          const h = { 'Content-Type': 'application/json' };
          const t = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('vk_admin_token') : null;
          if (t) h['x-admin-token'] = t;
          return h;
        })(),`
  );

  // 4. Clean method signatures: remove `adminSecret` completely
  // `async addProduct(product, adminSecret)` -> `async addProduct(product)`
  content = content.replace(/,\s*adminSecret\)/g, ')');
  content = content.replace(/\(adminSecret\)/g, '()');

  // 5. Clean var assignment: `const finalAdminSecret = adminSecret || this._resolveAdminSecret();`
  content = content.replace(/\s*const finalAdminSecret =.*?;/g, '');

  // 6. Clean payload: `adminSecret: finalAdminSecret` or `adminSecret: 'vk_admin_123'`
  content = content.replace(/,\s*adminSecret:\s*(finalAdminSecret|'vk_admin_123')/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully migrated ${filePath}`);
}

migrateApi(path.join(__dirname, 'js/api.js'));
migrateApi(path.join(__dirname, 'templete/js/api.js'));
