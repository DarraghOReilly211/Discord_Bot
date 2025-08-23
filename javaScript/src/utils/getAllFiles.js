const fs = require('fs');
const path = require('path');

function getAllFiles(dir, filterFn = null, out = []) {
  if (!fs.existsSync(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      getAllFiles(full, filterFn, out);
    } else {
      if (!filterFn || filterFn(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

module.exports = { getAllFiles };
