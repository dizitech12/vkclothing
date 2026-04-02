const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (let file of files) {
        if (['admin', 'assets', 'css', 'js', '.git', 'google-apps-script'].includes(file)) continue;
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (file.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let updated = content;
            
            // Handle both HTML entity and direct symbol
            if (content.includes('&copy; 2026 VKclothing')) {
                updated = content.replace(/&copy; 2026 VKclothing/g, '<span id="footer-admin-trigger" style="cursor:pointer; user-select:none;">&copy; 2026 VKclothing</span>');
            } else if (content.includes('© 2026 VKclothing')) {
                updated = content.replace(/© 2026 VKclothing/g, '<span id="footer-admin-trigger" style="cursor:pointer; user-select:none;">&copy; 2026 VKclothing</span>');
            }
            
            if (content !== updated) {
                fs.writeFileSync(fullPath, updated, 'utf8');
                console.log("Updated footer in", fullPath);
            }
        }
    }
}

processDir(__dirname);
