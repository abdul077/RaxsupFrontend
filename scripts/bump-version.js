const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const versionPath = path.join(root, 'version.json');
const envProdPath = path.join(root, 'src', 'environments', 'environment.prod.ts');

// Read and bump version (semantic: e.g. 1.0.7 -> 1.0.8)
const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
const parts = versionData.version.split('.');
const patch = parseInt(parts[parts.length - 1], 10) + 1;
parts[parts.length - 1] = String(patch);
const newVersion = parts.join('.');

fs.writeFileSync(versionPath, JSON.stringify({ version: newVersion }, null, 2) + '\n');

// Update environment.prod.ts appVersion
let envContent = fs.readFileSync(envProdPath, 'utf8');
envContent = envContent.replace(
  /appVersion:\s*'[\d.]+'/,
  `appVersion: '${newVersion}'`
);
fs.writeFileSync(envProdPath, envContent);

console.log(`Version bumped to ${newVersion}`);
