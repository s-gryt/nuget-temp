# Local Debugging Guide

## Quick Start for Local Testing

### Option 1: Use Mock Data (Recommended for Initial Testing)

The extension now includes a comprehensive mock data system that allows you to test the visualization without requiring .NET SDK or project files.

#### Debug Commands Available

1. **Debug: Test with Mock Data** - Tests basic dependency visualization
2. **Debug: Test with Mock Vulnerabilities** - Tests vulnerability visualization with mock security data
3. **Debug: Test with Real Output** - Tests with real dotnet CLI output you can paste

#### How to Use Mock Data

1. **Launch Extension in Debug Mode:**
   - Open VS Code in this project directory
   - Press F5 or go to Run and Debug (Ctrl+Shift+D)
   - Select "Run Extension" from the dropdown
   - Click the green play button or press F5

2. **Test with Mock Data:**
   - In the Extension Development Host window, open Command Palette (Ctrl+Shift+P)
   - Type "Debug: Test with Mock Data" and select it
   - The extension will generate realistic mock data and display the 3D graph

3. **Test with Mock Vulnerabilities:**
   - Use "Debug: Test with Mock Vulnerabilities" to test vulnerability scanning
   - This will show packages with different severity levels (Critical, High, Moderate, Low)

4. **Test with Real Output:**
   - Use "Debug: Test with Real Output" to paste your actual dotnet CLI output
   - This parses real JSON output and creates a visualization

### Option 2: Use Real Project Data

If you have a .NET project available:

1. **Prepare Your Project:**

   ```bash
   # Navigate to your .NET project directory
   cd /path/to/your/dotnet/project
   
   # Test if dotnet CLI works
   dotnet --version
   
   # Generate the JSON output for testing
   dotnet list package --include-transitive --format json
   ```

2. **Use the Real Output:**
   - Copy the JSON output from the command above
   - Use "Debug: Test with Real Output" command
   - Paste the JSON when prompted

## Step-by-Step Debugging Process

### Step 1: Launch Extension in Debug Mode

Open VS Code in this project directory
Press F5 or go to Run and Debug (Ctrl+Shift+D)
Select "Run Extension" from the dropdown
Click the green play button or press F5
This will open a new Extension Development Host window where your extension is loaded.

### Step 2: Set Breakpoints for Debugging

In the original VS Code window (not the Extension Development Host), set breakpoints in these key files:

🔍 **Key Debugging Points:**

**Extension Entry Point (src/extension.ts):**

- Line ~45: `const dependencies = await dependencyProvider.getDependencies(projectPath);`
- Line ~46: `console.log('[DEBUG] getDependencies returned:'...`

**Mock Data Provider (src/services/mockDataProvider.ts):**

- Line ~150: `async getMockDependencies(projectName: string = 'MockProject')`
- Line ~295: `private parseRealOutput(data: any): NuGetPackage[]`
- Line ~346: `private createGraphData(packages: NuGetPackage[], mode: 'dependencies' | 'vulnerabilities' | 'full')`

**Dependency Provider (src/providers/nugetDependencyProvider.ts):**

- Beginning of `getDependencies` method
- After parsing project file
- After running dotnet commands
- Before returning data

**Webview Manager (src/webview/webviewManager.ts):**

- Line ~28: `console.log('[DEBUG] showDependencyGraph called with:'...`
- In `getWebviewContent` method where HTML is generated

**React Component (src/webview/components/DependencyGraph.tsx):**

- Line ~32: `console.log('[DEBUG] DependencyGraph rendering with data:'...`
- In `handleNodeClick` and `handleNodeHover` methods

### Step 3: Test the Extension

In the Extension Development Host window:

**For Mock Data Testing:**

- Open Command Palette (Ctrl+Shift+P)
- Type "Debug: Test with Mock Data" and select it
- Watch the debug console in the original VS Code window

**For Real Project Testing:**

- Open a .NET project with a .csproj file
- Right-click on the .csproj file in the Explorer
- Select "Visualize NuGet Dependencies"
- Watch the debug console in the original VS Code window

### Step 4: Monitor Debug Output

In the original VS Code window:

Open Debug Console (Ctrl+Shift+Y)
Look for console.log messages starting with [DEBUG]
Check for any error messages

In the Extension Development Host:
Open Developer Tools (Help → Toggle Developer Tools)
Check Console tab for any JavaScript errors
Check Network tab for failed asset loads

### Step 5: Key Things to Check

🔍 **Data Flow Debugging:**

**Project Detection:**

```
[DEBUG] Calling getDependencies for project: /path/to/project.csproj
```

**Data Parsing:**

```
[DEBUG] getDependencies returned: {
  projectName: "MyProject",
  packageCount: 5,
  nodeCount: 5,
  linkCount: 4,
  vulnerabilityCount: {...}
}
```

**Webview Creation:**

```
[DEBUG] showDependencyGraph called with: {
  projectName: "MyProject",
  packageCount: 5,
  graphNodeCount: 5,
  graphLinkCount: 4,
  mode: "dependencies"
}
```

**React Rendering:**

```
[DEBUG] DependencyGraph rendering with data: {
  nodeCount: 5,
  linkCount: 4,
  mode: "dependencies",
  projectName: "MyProject"
}
```

### Step 6: Common Issues to Look For

❌ **No Data Issues:**

- Check if `nodeCount: 0` in debug logs
- Verify .NET SDK is installed: `dotnet --version`
- Check if project has PackageReference entries

❌ **Webview Issues:**

- Check for asset loading errors in browser console
- Verify React components are rendering
- Check for JavaScript errors

❌ **Asset Loading Issues:**

- Look for 404 errors in Network tab
- Check if bundled assets exist in /assets folder
- Verify CDN fallback is working

### Step 7: Manual Testing Commands

You can also test the underlying commands manually:

```bash
# Test if dotnet CLI works
dotnet --version

# Test dependency listing (run in project directory)
dotnet list package --include-transitive --format json

# Test vulnerability scanning
dotnet list package --vulnerable --include-transitive --format json
```

## Mock Data System Details

### Mock Data Structure

The mock data system generates realistic NuGet package data including:

- **Direct Dependencies:** Top-level packages like Entity Framework, Swagger, etc.
- **Transitive Dependencies:** Nested dependencies with proper depth tracking
- **Vulnerabilities:** Mock security vulnerabilities with different severity levels
- **Graph Relationships:** Links between packages for visualization

### Mock Packages Included

- Microsoft.EntityFrameworkCore (with nested dependencies)
- Swashbuckle.AspNetCore (with vulnerability)
- Microsoft.AspNetCore.Authentication.JwtBearer (with critical vulnerability)
- Serilog.AspNetCore
- AutoMapper.Extensions.Microsoft.DependencyInjection

### Vulnerability Severities

- **Critical:** Red (#8B0000) - JWT token validation bypass
- **High:** Orange (#FF4500) - SQL injection vulnerability
- **Moderate:** Yellow (#FFA500) - Information disclosure
- **Low:** Gold (#FFD700) - Minor security issues

## Real Output Integration

### Using Your Real dotnet CLI Output

1. Run `dotnet list package --include-transitive --format json` in your project
2. Copy the entire JSON output
3. Use "Debug: Test with Real Output" command
4. Paste the JSON when prompted
5. The extension will parse and visualize your real data

### Expected JSON Format

```json
{
  "version": 1,
  "parameters": "--include-transitive",
  "projects": [
    {
      "path": "/path/to/project.csproj",
      "frameworks": [
        {
          "framework": "net8.0",
          "topLevelPackages": [
            {
              "id": "Microsoft.EntityFrameworkCore",
              "requestedVersion": "8.0.2",
              "resolvedVersion": "8.0.2"
            }
          ],
          "transitivePackages": [
            {
              "id": "Azure.Core",
              "resolvedVersion": "1.25.0"
            }
          ]
        }
      ]
    }
  ]
}
```

## Performance Testing

### Large Project Testing

- Use the mock data system to test with different package counts
- Monitor memory usage and rendering performance
- Test with various graph modes (dependencies, vulnerabilities, full)

### Asset Loading Testing

- Test offline scenarios by disconnecting network
- Verify fallback mechanisms work correctly
- Check asset bundling and loading performance

## Troubleshooting Tips

### If Mock Data Doesn't Work

1. Check that the MockDataProvider is properly imported
2. Verify the debug commands are registered in package.json
3. Check the debug console for any TypeScript compilation errors

### If Real Output Parsing Fails

1. Validate your JSON format matches the expected structure
2. Check for any special characters or encoding issues
3. Try with a smaller subset of your data first

### If Webview Doesn't Load

1. Check if all assets are properly bundled
2. Verify the webview HTML is being generated correctly
3. Check browser console for any JavaScript errors

This debugging setup will help you trace exactly where the issue occurs in the data flow from project analysis to graph rendering. The console logs will show you the data at each step, making it easy to identify where the problem lies.

The mock data system provides a reliable way to test the extension locally without requiring .NET SDK or project files, while the real output integration allows you to test with your actual project data.
