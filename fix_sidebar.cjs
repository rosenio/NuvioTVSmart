const fs = require("fs");
let content = fs.readFileSync(
  "js/ui/components/sidebarNavigationHelpers-01-root-sidebar-items.js",
  "utf8"
);

// Find Live TV item
const liveTvStart = content.indexOf('  {\n    action: "gotoLiveTv"');
const liveTvEnd = content.indexOf("    }", liveTvStart) + 4;
const liveTvItem = content.substring(liveTvStart, liveTvEnd);

// Remove Live TV item
content = content.substring(0, liveTvStart) + content.substring(liveTvEnd);

// Find Settings item end and insert Live TV after it
const settingsStart = content.indexOf('action: "gotoSettings"');
const settingsEnd = content.indexOf("    }", settingsStart);
const settingsEndPos = content.indexOf("\n", settingsEnd) + 1;
content =
  content.substring(0, settingsEndPos) + liveTvItem + "," + content.substring(settingsEndPos);

fs.writeFileSync("js/ui/components/sidebarNavigationHelpers-01-root-sidebar-items.js", content);
console.log("Done");
