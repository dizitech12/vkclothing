// ============================================
// VKclothing — Google Apps Script Backend
// Full User Accounts & Checkout Architecture
// ============================================

// ---- Configuration ----
var PRODUCTS_SHEET = 'Products';
var PRODUCT_VARIANTS_SHEET = 'ProductVariants';
var PRODUCT_IMAGES_SHEET = 'ProductImages';
var ORDERS_SHEET = 'Orders';
var ADMIN_SHEET = 'Admin';
var USERS_SHEET = 'Users';
var ADDRESSES_SHEET = 'Addresses';

var CACHE_KEY = 'products_cache';
var VARIANTS_CACHE_KEY = 'variants_cache';
var IMAGES_CACHE_KEY = 'images_cache';
var FULL_PRODUCTS_CACHE_KEY = 'full_products_cache';
var CACHE_DURATION = 300; // 5 minutes

var ADMIN_SECRET = "CHANGE_THIS_SECRET";  // simple secret for admin action protection

// ---- Helper: Get or Create Sheet ----
function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  } else if (name === 'Orders' && headers && headers.length === 16) {
    var maxCols = sheet.getMaxColumns();
    if (maxCols > 16) {
      sheet.deleteColumns(17, maxCols - 16);
    }
    sheet.getRange(1, 1, 1, 16).setValues([headers]);
  }
  return sheet;
}

// ---- Helper: Rate Limiting (10 second block) ----
function isRateLimited(key) {
  try {
    var cache = CacheService.getScriptCache();
    if (cache.get(key)) return true;
    cache.put(key, "1", 10); // 10 seconds block
    return false;
  } catch (e) {
    return false; // Fallback to allow if cache fails
  }
}

// ---- HTTP Handlers ----
function doGet(e) {
  try {
    var action = e.parameter.action;
    var result;

    switch (action) {
      case 'getProducts': result = getProducts(); break;
      case 'getProductsFull': result = getProductsFull(); break;
      case 'getProductVariants': result = getProductVariants(); break;
      case 'getProductImages': result = getProductImages(); break;
      case 'getOrders': 
        if (e.parameter.adminSecret !== ADMIN_SECRET) return { error: 'Unauthorized' };
        result = getOrders(); 
        break;
      case 'getAddresses': result = getAddresses(e.parameter.userId); break;
      case 'getUserData': result = getUserData(e.parameter.userId); break;
      case 'getUserOrders': result = getUserOrders(e.parameter.userId); break;
      case 'verifyUser': result = verifyUser(e.parameter.userId); break;
      case 'getAnalytics': 
        if (e.parameter.adminSecret !== ADMIN_SECRET) return { error: 'Unauthorized' };
        result = getAnalytics(e.parameter.refresh === 'true'); 
        break;
      case 'getAnalyticsSummary': 
        if (e.parameter.adminSecret !== ADMIN_SECRET) return { error: 'Unauthorized' };
        result = getAnalyticsSummary(e.parameter.refresh === 'true'); 
        break;
      case 'getWeeklySales': 
        if (e.parameter.adminSecret !== ADMIN_SECRET) return { error: 'Unauthorized' };
        result = getWeeklySales(); 
        break;
      case 'getOrdersPerDay': 
        if (e.parameter.adminSecret !== ADMIN_SECRET) return { error: 'Unauthorized' };
        result = getOrdersPerDay(); 
        break;
      case 'getCustomerGrowth': 
        if (e.parameter.adminSecret !== ADMIN_SECRET) return { error: 'Unauthorized' };
        result = getCustomerGrowth(); 
        break;
      default: result = { error: 'Invalid action' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var result;

    switch (action) {
      // --- Admin Product Actions (Protected) ---
      case 'addProduct': 
        if (body.adminSecret !== ADMIN_SECRET) return { success: false, error: 'Unauthorized' };
        if (!body.data || !body.data.name) return { success: false, error: 'Product name required' };
        result = addProduct(body.data); 
        break;
      case 'updateProduct': 
        if (body.adminSecret !== ADMIN_SECRET) return { success: false, error: 'Unauthorized' };
        if (!body.data || !body.data.id) return { success: false, error: 'Product ID required' };
        result = updateProduct(body.data); 
        break;
      case 'deleteProduct': 
        if (body.adminSecret !== ADMIN_SECRET) return { success: false, error: 'Unauthorized' };
        result = deleteProduct(body.id); 
        break;
      case 'saveProductVariants': 
        if (body.adminSecret !== ADMIN_SECRET) return { success: false, error: 'Unauthorized' };
        result = saveProductVariants(body.productId, body.variants); 
        break;
      case 'saveProductImages': 
        if (body.adminSecret !== ADMIN_SECRET) return { success: false, error: 'Unauthorized' };
        result = saveProductImages(body.productId, body.images); 
        break;
      
      // --- Order & Status Management (Protected/Semi-Protected) ---
      case 'updateOrderStatus': 
        if (body.adminSecret !== ADMIN_SECRET && body.status !== 'Cancelled') return { success: false, error: 'Unauthorized' };
        result = updateOrderStatus(body.orderId, body.status); 
        break;
      case 'updatePaymentStatus': 
        if (body.adminSecret !== ADMIN_SECRET) return { success: false, error: 'Unauthorized' };
        result = updatePaymentStatus(body.orderId, body.paymentStatus); 
        break;
      case 'deleteOrder': 
        if (body.adminSecret !== ADMIN_SECRET) return { success: false, error: 'Unauthorized' };
        result = deleteOrder(body.orderId); 
        break;
      
      // --- Public / Semi-Public Actions (With Anti-Spam/Validation) ---
      case 'loginAdmin': result = loginAdmin(body.email, body.password); break;
      
      case 'submitContact': 
        if (isRateLimited(body.data ? body.data.email : 'contact')) return { success: false, error: 'Too many requests. Please try again in 10 seconds.' };
        if (!body.data || !body.data.message) return { success: false, error: 'Message content required' };
        result = submitContact(body.data); 
        break;
      
      case 'registerUser': 
        if (!body.phone || !body.password) return { success: false, error: 'Phone and password required' };
        if (body.phone.toString().length < 10) return { success: false, error: 'Valid phone number required' };
        result = registerUser(body.phone, body.password); 
        break;
        
      case 'loginUser': 
        if (isRateLimited(body.phone)) return { success: false, error: 'Login attempt limit reached. Try again in 10 seconds.' };
        result = loginUser(body.phone, body.password); 
        break;
      
      case 'syncUserData': result = syncUserData(body.userId, body.cart, body.wishlist); break;
      
      case 'addAddress': 
        if (!body.data || !body.data.phone || !body.data.addressLine1) return { success: false, error: 'Phone and primary address required' };
        result = addAddress(body.data); 
        break;
      
      case 'createOrder': 
        if (!body.data || !body.data.customerPhone) return { success: false, error: 'Contact phone required' };
        if (isRateLimited(body.data.customerPhone)) return { success: false, error: 'Order placement limit reached. Try again in 10 seconds.' };
        if (!body.data.items || body.data.items.length === 0) return { success: false, error: 'Order items required' };
        result = createOrder(body.data); 
        break;
        
      case 'getUserOrders': result = getUserOrders(body.userId); break;

      default: result = { error: 'Invalid action' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ---- Setup (run once) ----
function setupSheets() {
  getOrCreateSheet(PRODUCTS_SHEET, ['ID', 'Name', 'Category', 'Price', 'Description', 'ImageURL', 'Sizes', 'Colors']);
  getOrCreateSheet(PRODUCT_VARIANTS_SHEET, ['ProductID', 'Size', 'Color', 'Stock']);
  getOrCreateSheet(PRODUCT_IMAGES_SHEET, ['ProductID', 'Color', 'ImageURL']);
  getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'ShippingSnapshot', 'Status', 'Date']);
  getOrCreateSheet(ADMIN_SHEET, ['Email', 'Password']);
  getOrCreateSheet(USERS_SHEET, ['UserID', 'Phone', 'Password', 'CartData', 'WishlistData', 'CreatedDate']);
  getOrCreateSheet(ADDRESSES_SHEET, ['AddressID', 'UserID', 'FirstName', 'LastName', 'Phone', 'AddressLine1', 'AddressLine2', 'City', 'State', 'Zip', 'Country']);
  SpreadsheetApp.getUi().alert('Setup complete! All sheets created for Phase 10.');
}

// ---- Users & Auth ----
function hashPassword(password) {
  // Ultra basic pseudo-hash for Apps Script demo purposes
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  var txtHash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var hashVal = rawHash[i];
    if (hashVal < 0) { hashVal += 256; }
    if (hashVal.toString(16).length == 1) { txtHash += '0'; }
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

function registerUser(phone, password) {
  try {
    var sheet = getOrCreateSheet(USERS_SHEET, ['UserID', 'Phone', 'Password', 'CartData', 'WishlistData', 'CreatedDate']);
    var data = sheet.getDataRange().getValues();
    
    var phoneStr = phone.toString().trim();
    if(!phoneStr) return { success: false, error: 'Phone number required' };
    
    // Check duplicates
    for(var i=1; i<data.length; i++) {
      if(data[i][1].toString() === phoneStr) {
        return { success: false, error: 'Phone number already registered' };
      }
    }
    
    var userId = 'U' + Date.now();
    var passHash = hashPassword(password);
    
    sheet.appendRow([userId, phoneStr, passHash, '[]', '[]', new Date().toISOString()]);
    return { success: true, userId: userId };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function loginUser(phone, password) {
  try {
    var sheet = getOrCreateSheet(USERS_SHEET, ['UserID', 'Phone', 'Password', 'CartData', 'WishlistData', 'CreatedDate']);
    var data = sheet.getDataRange().getValues();
    var phoneStr = phone.toString().trim();
    var passHash = hashPassword(password);
    
    for(var i=1; i<data.length; i++) {
      if(data[i][1].toString() === phoneStr && data[i][2].toString() === passHash) {
        return { 
          success: true, 
          userId: data[i][0].toString(),
          cart: data[i][3].toString() || '[]',
          wishlist: data[i][4].toString() || '[]',
          phone: phoneStr
        };
      }
    }
    return { success: false, error: 'Invalid phone or password' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function verifyUser(userId) {
  try {
    if (!userId) return { success: false, error: 'UserID required' };
    var sheet = getOrCreateSheet(USERS_SHEET, ['UserID', 'Phone', 'Password', 'CartData', 'WishlistData', 'CreatedDate']);
    var data = sheet.getDataRange().getValues();
    for(var i=1; i<data.length; i++) {
      if(data[i][0].toString() === userId.toString()) {
        return { success: true };
      }
    }
    return { success: false, error: 'User not found' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function getUserData(userId) {
  try {
    var sheet = getOrCreateSheet(USERS_SHEET, ['UserID', 'Phone', 'Password', 'CartData', 'WishlistData', 'CreatedDate']);
    var data = sheet.getDataRange().getValues();
    for(var i=1; i<data.length; i++) {
      if(data[i][0].toString() === userId.toString()) {
        return {
          success: true,
          cart: data[i][3].toString() || '[]',
          wishlist: data[i][4].toString() || '[]'
        };
      }
    }
    return { success: false, error: 'User not found' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function syncUserData(userId, cartJSON, wishlistJSON) {
  try {
    var vCheck = verifyUser(userId);
    if (!vCheck.success) return { success: false, error: 'User validation failed: Account deleted.' };

    var sheet = getOrCreateSheet(USERS_SHEET, ['UserID', 'Phone', 'Password', 'CartData', 'WishlistData', 'CreatedDate']);
    var data = sheet.getDataRange().getValues();
    
    for(var i=1; i<data.length; i++) {
      if(data[i][0].toString() === userId.toString()) {
        // update cart at col 4, wishlist at col 5
        if (cartJSON !== undefined && cartJSON !== null) sheet.getRange(i+1, 4).setValue(cartJSON);
        if (wishlistJSON !== undefined && wishlistJSON !== null) sheet.getRange(i+1, 5).setValue(wishlistJSON);
        return { success: true };
      }
    }
    return { success: false, error: 'User not found' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ---- Addresses ----
function addAddress(addrData) {
  try {
    var sheet = getOrCreateSheet(ADDRESSES_SHEET, ['AddressID', 'UserID', 'FirstName', 'LastName', 'Phone', 'AddressLine1', 'AddressLine2', 'City', 'State', 'Zip', 'Country']);
    var addressId = 'A' + Date.now();
    sheet.appendRow([
      addressId,
      addrData.userId,
      addrData.firstName,
      addrData.lastName,
      addrData.phone,
      addrData.addressLine1,
      addrData.addressLine2 || '',
      addrData.city,
      addrData.state,
      addrData.zip,
      addrData.country
    ]);
    return { success: true, addressId: addressId };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function getAddresses(userId) {
  try {
    var sheet = getOrCreateSheet(ADDRESSES_SHEET, ['AddressID', 'UserID', 'FirstName', 'LastName', 'Phone', 'AddressLine1', 'AddressLine2', 'City', 'State', 'Zip', 'Country']);
    var data = sheet.getDataRange().getValues();
    var addrs = [];
    for(var i=1; i<data.length; i++) {
      if(data[i][1].toString() === userId.toString()) {
        addrs.push({
          addressId: data[i][0].toString(),
          userId: data[i][1].toString(),
          firstName: data[i][2],
          lastName: data[i][3],
          phone: data[i][4],
          addressLine1: data[i][5],
          addressLine2: data[i][6] || '',
          city: data[i][7],
          state: data[i][8],
          zip: data[i][9],
          country: data[i][10]
        });
      }
    }
    return { success: true, addresses: addrs };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ---- Products ----
function getProductsFull() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(FULL_PRODUCTS_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var result = {
    success: true,
    products: getProducts(),
    variants: getProductVariants(),
    images: getProductImages()
  };

  try { cache.put(FULL_PRODUCTS_CACHE_KEY, JSON.stringify(result), CACHE_DURATION); } catch (e) {}
  return result;
}

function getProducts() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var sheet = getOrCreateSheet(PRODUCTS_SHEET, ['ID', 'Name', 'Category', 'Price', 'Description', 'ImageURL', 'Sizes', 'Colors']);
  var data = sheet.getDataRange().getValues();
  var products = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    products.push({
      id: row[0].toString(),
      name: row[1],
      category: row[2],
      price: parseFloat(row[3]) || 0,
      description: row[4] || '',
      imageUrl: row[5] || '',
      sizes: row[6] || '',
      colors: row[7] || ''
    });
  }

  try { cache.put(CACHE_KEY, JSON.stringify(products), CACHE_DURATION); } catch (e) {}
  return products;
}

function addProduct(data) {
  try {
    var sheet = getOrCreateSheet(PRODUCTS_SHEET, ['ID', 'Name', 'Category', 'Price', 'Description', 'ImageURL', 'Sizes', 'Colors']);
    var id = 'P' + Date.now();
    sheet.appendRow([
      id, data.name, data.category, parseFloat(data.price),
      data.description || '', data.imageUrl || '', data.sizes || '', data.colors || ''
    ]);
    clearCache();
    return { success: true, id: id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function updateProduct(data) {
  try {
    var sheet = getOrCreateSheet(PRODUCTS_SHEET, ['ID', 'Name', 'Category', 'Price', 'Description', 'ImageURL', 'Sizes', 'Colors']);
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0].toString() === data.id.toString()) {
        var rowNum = i + 1;
        sheet.getRange(rowNum, 2).setValue(data.name);
        sheet.getRange(rowNum, 3).setValue(data.category);
        sheet.getRange(rowNum, 4).setValue(parseFloat(data.price));
        sheet.getRange(rowNum, 5).setValue(data.description || '');
        if (data.imageUrl !== undefined) sheet.getRange(rowNum, 6).setValue(data.imageUrl);
        if (data.sizes !== undefined) sheet.getRange(rowNum, 7).setValue(data.sizes);
        if (data.colors !== undefined) sheet.getRange(rowNum, 8).setValue(data.colors);
        clearCache();
        return { success: true };
      }
    }
    return { success: false, error: 'Product not found' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function deleteProduct(id) {
  try {
    var idStr = id.toString();
    
    // 1. Delete Product
    var sheet = getOrCreateSheet(PRODUCTS_SHEET, ['ID', 'Name', 'Category', 'Price', 'Description', 'ImageURL', 'Sizes', 'Colors']);
    var rows = sheet.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      if (rows[i][0].toString() === idStr) {
        sheet.deleteRow(i + 1);
        break; // IDs unique
      }
    }

    // 2. Delete Variants
    var vSheet = getOrCreateSheet(PRODUCT_VARIANTS_SHEET, ['ProductID', 'Size', 'Color', 'Stock']);
    var vRows = vSheet.getDataRange().getValues();
    for (var j = vRows.length - 1; j >= 1; j--) {
      if (vRows[j][0].toString() === idStr) vSheet.deleteRow(j + 1);
    }

    // 3. Delete Images
    var imgSheet = getOrCreateSheet(PRODUCT_IMAGES_SHEET, ['ProductID', 'Color', 'ImageURL']);
    var imgRows = imgSheet.getDataRange().getValues();
    for (var k = imgRows.length - 1; k >= 1; k--) {
      if (imgRows[k][0].toString() === idStr) imgSheet.deleteRow(k + 1);
    }

    clearCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Product Variants ----
function getProductVariants() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(VARIANTS_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var sheet = getOrCreateSheet(PRODUCT_VARIANTS_SHEET, ['ProductID', 'Size', 'Color', 'Stock']);
  var data = sheet.getDataRange().getValues();
  var variants = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    variants.push({
      productId: data[i][0].toString(),
      size: data[i][1].toString(),
      color: data[i][2].toString(),
      stock: parseInt(data[i][3]) || 0
    });
  }

  try { cache.put(VARIANTS_CACHE_KEY, JSON.stringify(variants), CACHE_DURATION); } catch (e) {}
  return variants;
}

function saveProductVariants(productId, variantsArray) {
  try {
    var sheet = getOrCreateSheet(PRODUCT_VARIANTS_SHEET, ['ProductID', 'Size', 'Color', 'Stock']);
    var data = sheet.getDataRange().getValues();
    var idStr = productId.toString();
    
    // 1. Delete existing rows
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0].toString() === idStr) {
        sheet.deleteRow(i + 1);
      }
    }

    // 2. Insert new variants
    if (variantsArray && variantsArray.length > 0) {
      for (var j = 0; j < variantsArray.length; j++) {
        var v = variantsArray[j];
        sheet.appendRow([idStr, v.size, v.color, parseInt(v.stock) || 0]);
      }
    }

    clearCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Product Images ----
function getProductImages() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(IMAGES_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var sheet = getOrCreateSheet(PRODUCT_IMAGES_SHEET, ['ProductID', 'Color', 'ImageURL']);
  var data = sheet.getDataRange().getValues();
  var images = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    images.push({
      productId: data[i][0].toString(),
      color: data[i][1].toString().toLowerCase(),
      imageUrl: data[i][2].toString()
    });
  }

  try { cache.put(IMAGES_CACHE_KEY, JSON.stringify(images), CACHE_DURATION); } catch (e) {}
  return images;
}

function saveProductImages(productId, imagesArray) {
  try {
    var sheet = getOrCreateSheet(PRODUCT_IMAGES_SHEET, ['ProductID', 'Color', 'ImageURL']);
    var data = sheet.getDataRange().getValues();
    
    const targetColors = imagesArray.map(img => img.color.toLowerCase());
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0].toString() === productId.toString() && targetColors.includes(data[i][1].toString().toLowerCase())) {
        sheet.deleteRow(i + 1);
      }
    }

    if (imagesArray && imagesArray.length > 0) {
      for (var j = 0; j < imagesArray.length; j++) {
        var img = imagesArray[j];
        sheet.appendRow([productId, img.color, img.imageUrl]);
      }
    }

    clearCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Orders Updated ----
function createOrder(data) {
  // Verify User if applicable
  if (data.userId && data.userId !== 'Guest') {
    var vCheck = verifyUser(data.userId);
    if (!vCheck.success) return { success: false, error: 'User validation failed: Account deleted. Please sign in again.' };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    var vSheet = getOrCreateSheet(PRODUCT_VARIANTS_SHEET, ['ProductID', 'Size', 'Color', 'Stock']);
    var oSheet = getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'ShippingSnapshot', 'Status', 'Date']);
    var vData = vSheet.getDataRange().getValues();
    
    var items = data.items || [];
    var updates = [];

    // Verify stock
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var foundMatch = false;
      var currentStock = 0;
      var rowToUpdate = -1;

      for (var i = 1; i < vData.length; i++) {
        if (vData[i][0].toString() === item.productId.toString() &&
            vData[i][1].toString() === item.size.toString() &&
            vData[i][2].toString() === item.color.toString()) {
          foundMatch = true;
          currentStock = parseInt(vData[i][3]) || 0;
          rowToUpdate = i + 1;
          break;
        }
      }

      if (!foundMatch) throw new Error('Variant not found for ' + item.productName);
      var qty = parseInt(item.quantity) || 1;
      if (currentStock < qty) throw new Error('Not enough stock for ' + item.productName + ' (' + item.size + ' - ' + item.color + '). Only ' + currentStock + ' left.');
      updates.push({ row: rowToUpdate, newStock: currentStock - qty });
    }

    // Deduct stock
    for (var k = 0; k < updates.length; k++) {
      vSheet.getRange(updates[k].row, 4).setValue(updates[k].newStock);
    }

    // Empty User Cart automatically on success if they are logged in
    if(data.userId) {
       syncUserData(data.userId, '[]');
    }

    var orderId = 'ORD' + Date.now();
    var date = new Date().toISOString();
    // Payment status logic
    var paymentStatus = data.paymentMethod === 'UPI' ? 'Paid' : 'Pending';

    // Fetch Address Snapshot
    var aSheet = getOrCreateSheet(ADDRESSES_SHEET, ['AddressID', 'UserID', 'FirstName', 'LastName', 'Phone', 'AddressLine1', 'AddressLine2', 'City', 'State', 'Zip', 'Country']);
    var aData = aSheet.getDataRange().getValues();
    var sName='', sPhone='', sLine1='', sLine2='', sCity='', sState='', sZip='', sCountry='';
    if (data.addressId) {
      for(var a=1; a<aData.length; a++) {
        if(aData[a][0].toString() === data.addressId.toString()) {
          sName = (aData[a][2].toString() + ' ' + aData[a][3].toString()).trim();
          sPhone = aData[a][4].toString();
          sLine1 = aData[a][5].toString();
          sLine2 = aData[a][6].toString();
          sCity = aData[a][7].toString();
          sState = aData[a][8].toString();
          sZip = aData[a][9].toString();
          sCountry = aData[a][10].toString();
          break;
        }
      }
    }

    // Insert order rows
    for (var m = 0; m < items.length; m++) {
      var it = items[m];
      var total = parseFloat(it.price) * parseInt(it.quantity);
      
      var snapshotText = data.shippingSnapshot || 'Address details not available.';
      if (sName || sLine1) {
        snapshotText = [sName, sLine1, sCity, sState, sZip].filter(Boolean).join(', ') + (sPhone ? ' (Ph: ' + sPhone + ')' : '');
      }

      // OrderID | UserID | CustomerPhone | ProductID | ProductName | Size | Color | Quantity | Price | Total | PaymentMethod | PaymentStatus | AddressID | ShippingSnapshot | Status | Date
      oSheet.appendRow([
        orderId, data.userId || 'Guest', data.customerPhone || '', it.productId, it.productName,
        it.size, it.color, parseInt(it.quantity), parseFloat(it.price),
        total, data.paymentMethod || 'COD', paymentStatus, data.addressId || '', 
        snapshotText, 'Pending', date
      ]);
    }

    clearCache();
    return { success: true, orderId: orderId };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    lock.releaseLock(); // always release lock!
  }
}

function getOrders() {
  try {
    var sheet = getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'ShippingSnapshot', 'Status', 'Date']);
    var data = sheet.getDataRange().getValues();
    var orders = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      
      // Handle schema misalignment for any orders placed during the broken 23-column phase
      var isBrokenSchema = (row[21] && ['Pending','Processed','Shipped','Delivered','Cancelled'].indexOf(row[21].toString()) !== -1);
      var actualStatus = isBrokenSchema ? row[21].toString() : (row[14] ? row[14].toString() : 'Pending');
      var actualDate = isBrokenSchema ? row[22].toString() : (row[15] ? row[15].toString() : '');
      var actualSnapshot = isBrokenSchema 
          ? [row[13], row[15], row[17], row[18], row[19]].filter(Boolean).join(', ')
          : (row[13] ? row[13].toString() : '');

      orders.push({
        orderId: row[0].toString(),
        userId: row[1].toString(),
        customerPhone: row[2].toString(),
        productId: row[3].toString(),
        productName: row[4].toString(),
        size: row[5].toString() || '',
        color: row[6].toString() || '',
        quantity: parseInt(row[7]) || 0,
        price: parseFloat(row[8]) || 0,
        total: parseFloat(row[9]) || 0,
        paymentMethod: row[10].toString() || '',
        paymentStatus: row[11].toString() || '',
        addressId: row[12].toString() || '',
        shippingSnapshot: actualSnapshot,
        status: actualStatus,
        date: actualDate,
      });
    }

    return { success: true, orders: orders };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getUserOrders(userId) {
  try {
    if (!userId) return { success: false, error: 'UserID required' };
    
    var vCheck = verifyUser(userId);
    if (!vCheck.success) return { success: false, error: 'User validation failed: Account deleted.' };

    var sheet = getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'ShippingSnapshot', 'Status', 'Date']);
    var data = sheet.getDataRange().getValues();
    var orders = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[1].toString() === userId.toString()) {
        
        // Handle schema misalignment for any orders placed during the broken 23-column phase
        var isBrokenSchema = (row[21] && ['Pending','Processed','Shipped','Delivered','Cancelled'].indexOf(row[21].toString()) !== -1);
        var actualStatus = isBrokenSchema ? row[21].toString() : (row[14] ? row[14].toString() : 'Pending');
        var actualDate = isBrokenSchema ? row[22].toString() : (row[15] ? row[15].toString() : '');
        var actualSnapshot = isBrokenSchema 
            ? [row[13], row[15], row[17], row[18], row[19]].filter(Boolean).join(', ')
            : (row[13] ? row[13].toString() : '');

        orders.push({
          orderId: row[0].toString(),
          userId: row[1].toString(),
          customerPhone: row[2].toString(),
          productId: row[3].toString(),
          productName: row[4].toString(),
          size: row[5].toString() || '',
          color: row[6].toString() || '',
          quantity: parseInt(row[7]) || 0,
          price: parseFloat(row[8]) || 0,
          total: parseFloat(row[9]) || 0,
          paymentMethod: row[10].toString() || '',
          paymentStatus: row[11].toString() || '',
          addressId: row[12].toString() || '',
          shippingSnapshot: actualSnapshot,
          status: actualStatus,
          date: actualDate,
        });
      }
    }
    // Sort descending by date
    orders.sort(function(a, b) {
      var da = new Date(a.date).getTime() || 0;
      var db = new Date(b.date).getTime() || 0;
      return db - da;
    });
    return { success: true, orders: orders };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function updateOrderStatus(orderId, newStatus) {
  try {
    var sheet = getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'ShippingName', 'ShippingPhone', 'ShippingAddressLine1', 'ShippingAddressLine2', 'ShippingCity', 'ShippingState', 'ShippingZip', 'ShippingCountry', 'Status', 'Date']);
    var data = sheet.getDataRange().getValues();
    var updated = false;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString() === orderId.toString()) {
        var isBrokenSchema = (data[i][21] && ['Pending','Processed','Shipped','Delivered','Cancelled'].indexOf(data[i][21].toString()) !== -1);
        var actualStatusIndex = isBrokenSchema ? 21 : 14;
        
        var currentStatus = data[i][actualStatusIndex] ? data[i][actualStatusIndex].toString() : 'Pending';

        // Anti-cancel protection
        if (newStatus === 'Cancelled') {
          if (currentStatus === 'Shipped' || currentStatus === 'Delivered' || currentStatus === 'Cancelled') {
             return { success: false, error: 'Cannot cancel an order that is ' + currentStatus };
          }
        }

        sheet.getRange(i + 1, actualStatusIndex + 1).setValue(newStatus);
        updated = true;

        // Restore variant stock if cancelled
          if (newStatus === 'Cancelled') {
            var pId = data[i][3] ? data[i][3].toString() : '';
            var size = data[i][5] ? data[i][5].toString() : '';
            var color = data[i][6] ? data[i][6].toString() : '';
            var qtyToRestore = parseInt(data[i][7]) || 0;

            if (pId && qtyToRestore > 0) {
              var vSheet = getOrCreateSheet(PRODUCT_VARIANTS_SHEET, ['ProductID', 'Size', 'Color', 'Stock']);
              var vData = vSheet.getDataRange().getValues();
              for (var v = 1; v < vData.length; v++) {
                if (vData[v][0].toString() === pId && vData[v][1].toString() === size && vData[v][2].toString() === color) {
                  var cStock = parseInt(vData[v][3]) || 0;
                  vSheet.getRange(v + 1, 4).setValue(cStock + qtyToRestore);
                  break;
                }
              }
            }
        }
      }
    }

    return { success: updated };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function updatePaymentStatus(orderId, newPaymentStatus) {
  try {
    var sheet = getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'ShippingName', 'ShippingPhone', 'ShippingAddressLine1', 'ShippingAddressLine2', 'ShippingCity', 'ShippingState', 'ShippingZip', 'ShippingCountry', 'Status', 'Date']);
    var data = sheet.getDataRange().getValues();
    var header = data[0];
    var updated = false;

    // Find PaymentStatus column index
    var paymentStatusIndex = header.indexOf('PaymentStatus');

    if (paymentStatusIndex === -1) {
      return { success: false, error: 'PaymentStatus column not found' };
    }

    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString() === orderId.toString()) {
        // Update the PaymentStatus column
        sheet.getRange(i + 1, paymentStatusIndex + 1).setValue(newPaymentStatus);
        updated = true;
      }
    }

    return { success: updated };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function deleteOrder(orderId) {
  try {
    var sheet = getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'Status', 'Date']);
    var data = sheet.getDataRange().getValues();
    
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0].toString() === orderId.toString()) {
        sheet.deleteRow(i + 1);
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Admin Auth ----
function loginAdmin(email, password) {
  try {
    var sheet = getOrCreateSheet(ADMIN_SHEET, ['Email', 'Password']);
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString() === email && data[i][1].toString() === password) {
        var token = Utilities.getUuid();
        return { success: true, token: token };
      }
    }
    return { success: false, error: 'Invalid credentials' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Contact Form ----
function submitContact(data) {
  try {
    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: 'VKclothing Contact: ' + data.name,
      body: 'Name: ' + data.name + '\nEmail: ' + data.email + '\nMessage: ' + data.message,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Analytics ----
function getAnalytics(refresh) {
  try {
    var cache = CacheService.getScriptCache();
    var ANALYTICS_CACHE_KEY = 'analytics_cache';
    var ANALYTICS_CACHE_DURATION = 60; // 60 seconds

    // Check cache first (skip if refresh is true)
    if (!refresh) {
      var cached = cache.get(ANALYTICS_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Get Orders data
    var ordersSheet = getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'ShippingName', 'ShippingPhone', 'ShippingAddressLine1', 'ShippingAddressLine2', 'ShippingCity', 'ShippingState', 'ShippingZip', 'ShippingCountry', 'Status', 'Date']);
    var ordersData = ordersSheet.getDataRange().getValues();

    // Total Orders (excluding header)
    var totalOrders = ordersData.length > 1 ? ordersData.length - 1 : 0;

    // Total Revenue (sum of Total column - index 9)
    var totalRevenue = 0;
    var uniqueCustomers = {};
    var productSales = {};

    for (var i = 1; i < ordersData.length; i++) {
      var row = ordersData[i];

      // Sum revenue
      var orderTotal = parseFloat(row[9]) || 0;
      totalRevenue += orderTotal;

      // Count unique customers by UserID (index 1)
      var userId = row[1] ? row[1].toString() : '';
      if (userId && userId !== 'Guest') {
        uniqueCustomers[userId] = true;
      }

      // Track product sales for best seller (ProductName at index 4, Quantity at index 7)
      var productName = row[4] ? row[4].toString() : '';
      var quantity = parseInt(row[7]) || 0;
      if (productName) {
        if (!productSales[productName]) {
          productSales[productName] = 0;
        }
        productSales[productName] += quantity;
      }
    }

    // Total unique customers
    var totalCustomers = Object.keys(uniqueCustomers).length;

    // Best selling product
    var bestProduct = '-';
    var maxSales = 0;
    for (var product in productSales) {
      if (productSales[product] > maxSales) {
        maxSales = productSales[product];
        bestProduct = product;
      }
    }

    // Get total products count
    var productsSheet = getOrCreateSheet(PRODUCTS_SHEET, ['ID', 'Name', 'Category', 'Price', 'Description', 'ImageURL', 'Sizes', 'Colors']);
    var productsData = productsSheet.getDataRange().getValues();
    var totalProducts = productsData.length > 1 ? productsData.length - 1 : 0;

    var result = {
      success: true,
      totalOrders: totalOrders,
      totalRevenue: totalRevenue,
      totalCustomers: totalCustomers,
      totalProducts: totalProducts,
      bestProduct: bestProduct
    };

    // Cache the result for 60 seconds
    try {
      cache.put(ANALYTICS_CACHE_KEY, JSON.stringify(result), ANALYTICS_CACHE_DURATION);
    } catch (e) {}

    return result;

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Analytics Summary (for dashboard cards) ----
function getAnalyticsSummary(refresh) {
  try {
    var cache = CacheService.getScriptCache();
    var ANALYTICS_SUMMARY_CACHE_KEY = 'analytics_summary_cache';
    var ANALYTICS_CACHE_DURATION = 60; // 60 seconds

    // Check cache first (skip if refresh is true)
    if (!refresh) {
      var cached = cache.get(ANALYTICS_SUMMARY_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Get Orders data
    var ordersSheet = getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'ShippingName', 'ShippingPhone', 'ShippingAddressLine1', 'ShippingAddressLine2', 'ShippingCity', 'ShippingState', 'ShippingZip', 'ShippingCountry', 'Status', 'Date']);
    var ordersData = ordersSheet.getDataRange().getValues();

    // Total Orders (excluding header)
    var totalOrders = ordersData.length > 1 ? ordersData.length - 1 : 0;

    // Total Revenue (sum of Total column - index 9)
    var totalRevenue = 0;
    var uniqueCustomers = {};
    var productSales = {};

    for (var i = 1; i < ordersData.length; i++) {
      var row = ordersData[i];

      // Sum revenue
      var orderTotal = parseFloat(row[9]) || 0;
      totalRevenue += orderTotal;

      // Count unique customers by UserID (index 1)
      var userId = row[1] ? row[1].toString() : '';
      if (userId && userId !== 'Guest') {
        uniqueCustomers[userId] = true;
      }

      // Track product sales for best seller (ProductName at index 4, Quantity at index 7)
      var productName = row[4] ? row[4].toString() : '';
      var quantity = parseInt(row[7]) || 0;
      if (productName) {
        if (!productSales[productName]) {
          productSales[productName] = 0;
        }
        productSales[productName] += quantity;
      }
    }

    // Total unique customers
    var totalCustomers = Object.keys(uniqueCustomers).length;

    // Best selling product
    var bestProduct = '-';
    var maxSales = 0;
    for (var product in productSales) {
      if (productSales[product] > maxSales) {
        maxSales = productSales[product];
        bestProduct = product;
      }
    }

    // Get total products count
    var productsSheet = getOrCreateSheet(PRODUCTS_SHEET, ['ID', 'Name', 'Category', 'Price', 'Description', 'ImageURL', 'Sizes', 'Colors']);
    var productsData = productsSheet.getDataRange().getValues();
    var totalProducts = productsData.length > 1 ? productsData.length - 1 : 0;

    var result = {
      success: true,
      totalOrders: totalOrders,
      totalRevenue: totalRevenue,
      totalCustomers: totalCustomers,
      totalProducts: totalProducts,
      bestProduct: bestProduct
    };

    // Cache the result for 60 seconds
    try {
      cache.put(ANALYTICS_SUMMARY_CACHE_KEY, JSON.stringify(result), ANALYTICS_CACHE_DURATION);
    } catch (e) {}

    return result;

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Weekly Sales Data (last 7 days revenue) ----
function getWeeklySales() {
  try {
    var ordersSheet = getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'ShippingName', 'ShippingPhone', 'ShippingAddressLine1', 'ShippingAddressLine2', 'ShippingCity', 'ShippingState', 'ShippingZip', 'ShippingCountry', 'Status', 'Date']);
    var ordersData = ordersSheet.getDataRange().getValues();

    var headers = ordersData[0] || [];
    var dateIdx = headers.indexOf('Date');
    var totalIdx = headers.indexOf('Total');

    var dailyRevenue = {};
    var today = new Date();

    function toYMD(dateObj) {
      if (!(dateObj instanceof Date) || isNaN(dateObj)) return null;
      var m = dateObj.getMonth() + 1;
      var d = dateObj.getDate();
      return dateObj.getFullYear() + '-' + (m < 10 ? '0'+m : m) + '-' + (d < 10 ? '0'+d : d);
    }

    // Initialize last 7 days with zero revenue
    for (var d = 6; d >= 0; d--) {
      var date = new Date(today);
      date.setDate(date.getDate() - d);
      var dateStr = toYMD(date);
      if (dateStr) dailyRevenue[dateStr] = 0;
    }

    // Sum revenue per day
    for (var i = 1; i < ordersData.length; i++) {
      var row = ordersData[i];
      var isBrokenSchema = (row[21] && ['Pending','Processed','Shipped','Delivered','Cancelled'].indexOf(row[21].toString()) !== -1);
      var actualDateVal = isBrokenSchema ? row[22] : (dateIdx !== -1 ? row[dateIdx] : row[15]);
      
      if (!actualDateVal) continue;
      
      var orderDate = new Date(actualDateVal);
      var dStr = toYMD(orderDate);

      if (dStr && (dStr in dailyRevenue)) {
        var orderTotal = parseFloat(totalIdx !== -1 ? row[totalIdx] : row[9]) || 0;
        dailyRevenue[dStr] += orderTotal;
      }
    }

    // Format for chart
    var labels = [];
    var data = [];
    for (var d = 6; d >= 0; d--) {
      var date = new Date(today);
      date.setDate(date.getDate() - d);
      var dateStr = toYMD(date);
      var dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      labels.push(dayName);
      data.push(dailyRevenue[dateStr]);
    }

    return {
      success: true,
      labels: labels,
      data: data
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Orders per Day Data (last 7 days) ----
function getOrdersPerDay() {
  try {
    var ordersSheet = getOrCreateSheet(ORDERS_SHEET, ['OrderID', 'UserID', 'CustomerPhone', 'ProductID', 'ProductName', 'Size', 'Color', 'Quantity', 'Price', 'Total', 'PaymentMethod', 'PaymentStatus', 'AddressID', 'ShippingName', 'ShippingPhone', 'ShippingAddressLine1', 'ShippingAddressLine2', 'ShippingCity', 'ShippingState', 'ShippingZip', 'ShippingCountry', 'Status', 'Date']);
    var ordersData = ordersSheet.getDataRange().getValues();

    var headers = ordersData[0] || [];
    var dateIdx = headers.indexOf('Date');

    var dailyOrders = {};
    var today = new Date();

    function toYMD(dateObj) {
      if (!(dateObj instanceof Date) || isNaN(dateObj)) return null;
      var m = dateObj.getMonth() + 1;
      var d = dateObj.getDate();
      return dateObj.getFullYear() + '-' + (m < 10 ? '0'+m : m) + '-' + (d < 10 ? '0'+d : d);
    }

    // Initialize last 7 days with zero orders
    for (var d = 6; d >= 0; d--) {
      var date = new Date(today);
      date.setDate(date.getDate() - d);
      var dateStr = toYMD(date);
      if (dateStr) dailyOrders[dateStr] = 0;
    }

    // Count orders per day
    for (var i = 1; i < ordersData.length; i++) {
      var row = ordersData[i];
      var isBrokenSchema = (row[21] && ['Pending','Processed','Shipped','Delivered','Cancelled'].indexOf(row[21].toString()) !== -1);
      var actualDateVal = isBrokenSchema ? row[22] : (dateIdx !== -1 ? row[dateIdx] : row[15]);
      
      if (!actualDateVal) continue;

      var orderDate = new Date(actualDateVal);
      var dStr = toYMD(orderDate);

      if (dStr && (dStr in dailyOrders)) {
        dailyOrders[dStr] += 1;
      }
    }

    // Format for chart
    var labels = [];
    var data = [];
    for (var d = 6; d >= 0; d--) {
      var date = new Date(today);
      date.setDate(date.getDate() - d);
      var dateStr = toYMD(date);
      var dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      labels.push(dayName);
      data.push(dailyOrders[dateStr]);
    }

    return {
      success: true,
      labels: labels,
      data: data
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Customer Growth Data (new users over time) ----
function getCustomerGrowth() {
  try {
    var usersSheet = getOrCreateSheet(USERS_SHEET, ['UserID', 'Phone', 'Password', 'CartData', 'WishlistData', 'CreatedDate']);
    var usersData = usersSheet.getDataRange().getValues();

    var headers = usersData[0] || [];
    var dateIdx = headers.indexOf('CreatedDate');

    var dailySignups = {};
    var today = new Date();

    function toYMD(dateObj) {
      if (!(dateObj instanceof Date) || isNaN(dateObj)) return null;
      var m = dateObj.getMonth() + 1;
      var d = dateObj.getDate();
      return dateObj.getFullYear() + '-' + (m < 10 ? '0'+m : m) + '-' + (d < 10 ? '0'+d : d);
    }

    // Initialize last 14 days with zero signups
    for (var d = 13; d >= 0; d--) {
      var date = new Date(today);
      date.setDate(date.getDate() - d);
      var dateStr = toYMD(date);
      if (dateStr) dailySignups[dateStr] = 0;
    }

    // Count new users per day
    for (var i = 1; i < usersData.length; i++) {
      var row = usersData[i];
      var actualDateVal = dateIdx !== -1 ? row[dateIdx] : row[5];
      if (!actualDateVal) continue;

      var createdDate = new Date(actualDateVal);
      var dStr = toYMD(createdDate);

      if (dStr && (dStr in dailySignups)) {
        dailySignups[dStr] += 1;
      }
    }

    // Format for chart
    var labels = [];
    var data = [];
    for (var d = 13; d >= 0; d--) {
      var date = new Date(today);
      date.setDate(date.getDate() - d);
      var dateStr = toYMD(date);
      var dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      labels.push(dayName);
      data.push(dailySignups[dateStr]);
    }

    return {
      success: true,
      labels: labels,
      data: data
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Cache Helpers ----
function clearCache() {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove(CACHE_KEY);
    cache.remove(VARIANTS_CACHE_KEY);
    cache.remove(IMAGES_CACHE_KEY);
    cache.remove(FULL_PRODUCTS_CACHE_KEY);
  } catch(e) {}
}
