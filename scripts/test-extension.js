#!/usr/bin/env node

/**
 * Simple test script to verify the extension compiles and loads correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing NuGet Dependency Graph Extension...\n');

// Check if compiled files exist
const requiredFiles = [
  'out/extension.js',
  'webview/webview.js',
  'webview/index.html'
];

console.log('📁 Checking compiled files:');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) {
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log(
    '\n❌ Some required files are missing. Please run "npm run compile" first.'
  );
  process.exit(1);
}

// Check webview.js size (should be reasonable)
const webviewPath = path.join(__dirname, '..', 'webview/webview.js');
const webviewStats = fs.statSync(webviewPath);
const webviewSizeMB = (webviewStats.size / (1024 * 1024)).toFixed(1);

console.log(`\n📦 Webview bundle size: ${webviewSizeMB} MB`);

if (webviewSizeMB > 20) {
  console.log('⚠️  Webview bundle is quite large. Consider optimizing.');
} else {
  console.log('✅ Webview bundle size is reasonable.');
}

// Check for common issues in compiled files
console.log('\n🔍 Checking for common issues:');

// Check if webview.js contains multiple acquireVsCodeApi calls
const webviewContent = fs.readFileSync(webviewPath, 'utf8');
const acquireVsCodeApiCount = (webviewContent.match(/acquireVsCodeApi/g) || [])
  .length;

console.log(
  `  ${
    acquireVsCodeApiCount <= 1 ? '✅' : '❌'
  } acquireVsCodeApi calls: ${acquireVsCodeApiCount}`
);

if (acquireVsCodeApiCount > 1) {
  console.log(
    '    ⚠️  Multiple acquireVsCodeApi calls detected - this will cause errors!'
  );
}

// Check for eval usage (should be minimal)
const evalCount = (webviewContent.match(/eval\(/g) || []).length;
console.log(
  `  ${evalCount === 0 ? '✅' : '⚠️'} eval() usage: ${evalCount} instances`
);

// Check extension.js for basic structure
const extensionPath = path.join(__dirname, '..', 'out/extension.js');
const extensionContent = fs.readFileSync(extensionPath, 'utf8');

// Check if extension exports activate function
const hasActivate = extensionContent.includes('activate');
const hasDeactivate = extensionContent.includes('deactivate');

console.log(`  ${hasActivate ? '✅' : '❌'} activate function: ${hasActivate}`);
console.log(
  `  ${hasDeactivate ? '✅' : '❌'} deactivate function: ${hasDeactivate}`
);

// Check package.json for required commands
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const requiredCommands = [
  'nugetGraph.visualizeDependencies',
  'nugetGraph.visualizeVulnerabilities',
  'nugetGraph.visualizeFullGraph'
];

console.log('\n📋 Checking package.json commands:');
requiredCommands.forEach(cmd => {
  const exists = packageJson.contributes?.commands?.some(
    c => c.command === cmd
  );
  console.log(`  ${exists ? '✅' : '❌'} ${cmd}`);
});

console.log('\n🎉 Extension test completed!');
console.log('\n📝 Next steps:');
console.log('  1. Press F5 in VS Code to launch the extension in debug mode');
console.log('  2. Open a .NET project (.csproj file)');
console.log('  3. Right-click and select "Visualize NuGet Dependencies"');
console.log('  4. Check the Debug Console for any remaining errors');

if (acquireVsCodeApiCount > 1) {
  console.log('\n🚨 CRITICAL: Multiple acquireVsCodeApi calls detected!');
  console.log(
    '   This will cause "An instance of the VS Code API has already been acquired" errors.'
  );
  console.log(
    '   Please check the webview code for duplicate API acquisitions.'
  );
  process.exit(1);
}

console.log('\n✅ Extension appears to be ready for testing!');
