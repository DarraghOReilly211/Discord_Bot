const path = require('path');
const { getAllFiles } = require('../src/utils/getAllFiles');

const roots = [
  path.join(__dirname, '../src'),
];

const jsFilter = (p) => p.endsWith('.js');

let ok = true;
for (const root of roots) {
  const files = getAllFiles(root, jsFilter);
  for (const f of files) {
    try {
      require(f);
    } catch (e) {
      ok = false;
      console.error('Require failed:', f);
      console.error(e && e.stack ? e.stack.split('\n')[0] : e);
    }
  }
}

if (ok) {
  console.log('All modules required successfully.');
} else {
  process.exitCode = 1;
}
