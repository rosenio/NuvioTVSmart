const fs = require('fs');
let content = fs.readFileSync('js/ui/components/sidebarNavigationHelpers-01-root-sidebar-items.js', 'utf8');

// We need to reorder the ROOT_SIDEBAR_ITEMS array to put Live TV last
// Current order: Home, Search, Library, LiveTv, Settings
// Target order: Home, Search, Library, Settings, LiveTv

// Find the ROOT_SIDEBAR_ITEMS array
const arrayStart = content.indexOf('export const ROOT_SIDEBAR_ITEMS = [');
const arrayEnd = content.indexOf('];', arrayStart) + 2;
const arrayContent = content.substring(arrayStart, arrayEnd);

// Extract each item by finding the objects
const items = [];
let pos = arrayStart + 'export const ROOT_SIDEBAR_ITEMS = ['.length;
let braceCount = 0;
let itemStart = -1;
let inString = false;
let stringChar = '';

for (let i = pos; i < arrayEnd; i++) {
  const char = content[i];
  
  if (!inString && (char === '"' || char === "'" || char === '`')) {
    inString = true;
    stringChar = char;
  } else if (inString && char === stringChar && content[i-1] !== '\\') {
    inString = false;
  }
  
  if (!inString) {
    if (char === '{') {
      if (braceCount === 0) {
        itemStart = i;
      }
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && itemStart !== -1) {
        items.push(content.substring(itemStart, i + 1));
        itemStart = -1;
      }
    }
  }
}

console.log('Found items:', items.length);
items.forEach((item, idx) => {
  const actionMatch = item.match(/action:\s*"([^"]+)"/);
  console.log(`Item ${idx}: ${actionMatch ? actionMatch[1] : 'unknown'}`);
});

// Now rebuild array with Settings before Live TV
const newOrder = [0, 1, 2, 4, 3]; // Home, Search, Library, Settings, LiveTv
const newArray = 'export const ROOT_SIDEBAR_ITEMS = [\n  ' + 
  newOrder.map(idx => items[idx]).join(',\n  ') + 
  '\n];';

// Replace in content
const newContent = content.substring(0, arrayStart) + newArray + content.substring(arrayEnd);

fs.writeFileSync('js/ui/components/sidebarNavigationHelpers-01-root-sidebar-items.js', newContent);
console.log('Done');