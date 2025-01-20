#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function getCurrentBranch() {
  const result = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], {
    encoding: 'utf8'
  });
  
  if (result.error) {
    throw new Error('Failed to get current git branch');
  }
  
  return result.stdout.trim();
}

function validateVersion(packagePath, newVersion) {
  if (!newVersion) {
    return; // Skip if no version change
  }

  const currentBranch = getCurrentBranch();
  const isAlpha = newVersion.includes('-alpha.');
  const isDevelopBranch = currentBranch === 'develop';
  const pkgJson = require(path.join(packagePath, 'package.json'));
  
  if (isAlpha && isDevelopBranch) {
    throw new Error(
      `Cannot publish alpha version ${newVersion} for package ${pkgJson.name} from develop branch.\n` +
      'Alpha versions should only be published from feature branches.'
    );
  }
  
  if (!isAlpha && !isDevelopBranch) {
    throw new Error(
      `Cannot publish non-alpha version ${newVersion} for package ${pkgJson.name} from branch ${currentBranch}.\n` +
      'Non-alpha versions should only be published from develop branch.'
    );
  }
}

// Get all changed versions from Lerna
try {
  const lernaCmd = spawnSync('npx', ['lerna', 'changed', '--json', '--include-merged-tags'], {
    encoding: 'utf8'
  });

  if (lernaCmd.error) {
    throw new Error('Failed to get changed packages from Lerna');
  }

  const changedPackages = JSON.parse(lernaCmd.stdout || '[]');
  
  // Get version from command line args if provided
  const versionArg = process.argv.find(arg => arg.startsWith('--new-version='));
  const newVersion = versionArg ? versionArg.split('=')[1] : null;

  // Check each changed package
  changedPackages.forEach(pkg => {
    validateVersion(pkg.location, newVersion || pkg.version);
  });

} catch (error) {
  console.error('\x1b[31m%s\x1b[0m', `Error: ${error.message}`);
  process.exit(1);
}