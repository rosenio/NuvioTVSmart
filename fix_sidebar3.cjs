const fs = require("fs");
let content = fs.readFileSync(
  "js/ui/components/sidebarNavigationHelpers-01-root-sidebar-items.js",
  "utf8"
);

// Find Live TV item - use the specific action string
const liveTvStart = content.indexOf('action: "gotoLiveTv"');
const liveTvItemStart = content.lastIndexOf("  {", liveTvStart);
const liveTvEnd = content.indexOf("    }", liveTvStart) + 4;
const liveTvItem = content.substring(liveTvItemStart, liveTvEnd);

// Remove Live TV item
content = content.substring(0, liveTvItemStart) + content.substring(liveTvEnd);

// Find Settings item (the LAST item) and insert Live TV AFTER it
const settingsStart = content.indexOf('action: "gotoSettings"');
const settingsEnd = content.indexOf("    }", settingsStart);
const settingsEndPos = content.indexOf("\n", settingsEnd) + 1;
content =
  content.substring(0, settingsEndPos) +
  "  " +
  liveTvItem +
  "," +
  content.substring(settingsEndPos);

fs.writeFileSync("js/ui/components/sidebarNavigationHelpers-01-root-sidebar-items.js", content);
console.log("Done");
