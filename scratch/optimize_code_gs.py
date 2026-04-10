import re
import os

path = r'c:\Users\raiba\OneDrive\Desktop\VKclothing\google-apps-script\Code.gs'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Optimize saveProductVariants
# Target: find function saveProductVariants and replace its body logic
variants_pattern = r'(function saveProductVariants\(productId, variantsArray\) \{[\s\S]*?try \{[\s\S]*?var idStr = productId\.toString\(\);)([\s\S]*?)(clearCache\(\);)'
variants_replacement = r'''\1
    var headers = data[0];
    
    // 1. Keep rows for other products
    var newData = [headers];
    for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString() !== idStr) newData.push(data[i]);
    }
    
    // 2. Add new variants
    if (variantsArray && variantsArray.length > 0) {
        for (var j = 0; j < variantsArray.length; j++) {
            var v = variantsArray[j];
            newData.push([idStr, v.size, v.color, parseInt(v.stock) || 0]);
        }
    }
    
    // 3. Batch write back
    sheet.clearContents();
    sheet.getRange(1, 1, newData.length, headers.length).setValues(newData);
    \3'''

updated = re.sub(variants_pattern, variants_replacement, content)

# 2. Optimize saveProductImages
images_pattern = r'(function saveProductImages\(productId, imagesArray\) \{[\s\S]*?try \{[\s\S]*?var data = sheet\.getDataRange\(\)\.getValues\(\);)([\s\S]*?)(clearCache\(\);)'
images_replacement = r'''\1
    var idStr = productId.toString();
    var headers = data[0];
    
    // 1. Keep rows for other products
    var newData = [headers];
    for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString() !== idStr) newData.push(data[i]);
    }
    
    // 2. Add new images
    if (imagesArray && imagesArray.length > 0) {
        for (var j = 0; j < imagesArray.length; j++) {
            var img = imagesArray[j];
            newData.push([idStr, img.color, img.imageUrl]);
        }
    }
    
    // 3. Batch write back
    sheet.clearContents();
    sheet.getRange(1, 1, newData.length, headers.length).setValues(newData);
    \3'''

updated = re.sub(images_pattern, images_replacement, updated)

with open(path, 'w', encoding='utf-8') as f:
    f.write(updated)

print("Batch optimization applied successfully.")
