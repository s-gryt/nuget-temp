const fs = require('fs');
const path = require('path');

/**
 * Script to bundle required assets for offline support
 */
async function bundleAssets() {
  const extensionRoot = path.resolve(__dirname, '..');
  const nodeModulesPath = path.join(extensionRoot, 'node_modules');
  const assetsPath = path.join(extensionRoot, 'assets');

  // Ensure assets directory exists
  if (!fs.existsSync(assetsPath)) {
    fs.mkdirSync(assetsPath, { recursive: true });
  }

  const assetsToCopy = [
    {
      source: path.join(nodeModulesPath, 'react-force-graph-3d', 'dist', 'react-force-graph-3d.min.js'),
      target: path.join(assetsPath, 'force-graph-3d.js')
    },
    {
      source: path.join(nodeModulesPath, 'react', 'umd', 'react.production.min.js'),
      target: path.join(assetsPath, 'react.js')
    },
    {
      source: path.join(nodeModulesPath, 'react-dom', 'umd', 'react-dom.production.min.js'),
      target: path.join(assetsPath, 'react-dom.js')
    },
    {
      source: path.join(nodeModulesPath, 'three', 'build', 'three.min.js'),
      target: path.join(assetsPath, 'three.js')
    }
  ];

  console.log('Bundling assets for offline support...');

  for (const asset of assetsToCopy) {
    try {
      if (fs.existsSync(asset.source)) {
        // Check if target is newer than source
        if (fs.existsSync(asset.target)) {
          const sourceStats = fs.statSync(asset.source);
          const targetStats = fs.statSync(asset.target);

          if (targetStats.mtime >= sourceStats.mtime) {
            console.log(`✓ ${path.basename(asset.target)} is up to date`);
            continue;
          }
        }

        fs.copyFileSync(asset.source, asset.target);
        console.log(`✓ Bundled ${path.basename(asset.target)}`);
      } else {
        console.warn(`⚠ Source not found: ${asset.source}`);
      }
    } catch (error) {
      console.error(`✗ Failed to bundle ${path.basename(asset.target)}:`, error.message);
    }
  }

  console.log('Asset bundling complete!');
}

// Run if called directly
if (require.main === module) {
  bundleAssets().catch(console.error);
}

module.exports = { bundleAssets };
