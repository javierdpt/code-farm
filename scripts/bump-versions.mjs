#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PACKAGES = [
  'packages/shared',
  'packages/ticket-providers',
  'packages/claude-md-generator',
  'apps/worker-agent',
  'apps/orchestrator',
  'apps/cli',
];

const SCOPE = '@javierdpt/code-farm-';

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default: throw new Error(`Invalid bump type: ${type}. Use patch, minor, or major.`);
  }
}

const type = process.argv[2];
if (!type) {
  console.error('Usage: node scripts/bump-versions.mjs <patch|minor|major>');
  process.exit(1);
}

const rootDir = join(import.meta.dirname, '..');
const sharedPkg = JSON.parse(readFileSync(join(rootDir, 'packages/shared/package.json'), 'utf-8'));
const currentVersion = sharedPkg.version;
const newVersion = bumpVersion(currentVersion, type);

console.log(`Bumping ${currentVersion} → ${newVersion}`);

for (const pkgPath of PACKAGES) {
  const filePath = join(rootDir, pkgPath, 'package.json');
  const pkg = JSON.parse(readFileSync(filePath, 'utf-8'));

  pkg.version = newVersion;

  // Update internal @javierdpt/code-farm-* dependency ranges
  for (const depField of ['dependencies', 'devDependencies']) {
    if (!pkg[depField]) continue;
    for (const dep of Object.keys(pkg[depField])) {
      if (dep.startsWith(SCOPE)) {
        pkg[depField][dep] = `^${newVersion}`;
      }
    }
  }

  writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ${pkgPath}/package.json → ${newVersion}`);
}

console.log('Done.');
