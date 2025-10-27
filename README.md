# NuGet Dependency Graph

A powerful Visual Studio Code extension that visualizes NuGet package dependencies and vulnerabilities with interactive 3D graphs.

## Features

### 🔍 **Dependency Visualization**

- **Interactive 3D Graph**: Visualize your NuGet dependencies in an immersive 3D environment
- **Multiple View Modes**: Switch between dependencies-only, vulnerabilities, and full dependency graph views
- **Smart Analysis**: Automatically detects .NET projects and analyzes package references

### 🛡️ **Security Scanning**

- **Vulnerability Detection**: Scan for known security vulnerabilities in your NuGet packages
- **Severity Indicators**: Color-coded visualization based on vulnerability severity (Critical, High, Moderate, Low)
- **Advisory Links**: Direct links to security advisories for detailed vulnerability information

### 🚀 **Offline Support**

- **Local Asset Bundling**: Works offline with locally bundled 3D visualization libraries
- **Cached Results**: Intelligent caching of vulnerability scan results for faster subsequent analysis
- **Fallback Mechanisms**: Graceful degradation when network connectivity is limited

### 🎯 **Smart Project Detection**

- **Multi-Project Support**: Automatically detects and lists all .NET projects in your workspace
- **Project Validation**: Validates project files and provides helpful error messages
- **Framework Detection**: Identifies target frameworks and project types

## Getting Started

### Prerequisites

- Visual Studio Code 1.74.0 or higher
- .NET SDK (recommended for full functionality)
- .NET projects with NuGet package references

### Installation

1. Open Visual Studio Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "NuGet Dependency Graph"
4. Click Install

### Usage

#### Command Palette

Open the Command Palette (Ctrl+Shift+P) and run:

- `NuGet Graph: Visualize NuGet Dependencies` - Show dependency graph
- `NuGet Graph: Visualize NuGet Vulnerabilities` - Show vulnerabilities
- `NuGet Graph: Visualize Full NuGet Dependency Graph` - Show complete graph

#### Context Menu

Right-click on any `.csproj` file in the Explorer or Editor and select:

- **Visualize NuGet Dependencies**
- **Visualize NuGet Vulnerabilities**
- **Visualize Full NuGet Dependency Graph**

## Visualization Modes

### 📦 Dependencies Mode

- Shows direct and transitive package dependencies
- Color-coded nodes for easy identification
- Interactive navigation and zoom controls

### 🔒 Vulnerabilities Mode

- Highlights packages with known security vulnerabilities
- Severity-based color coding (Red=Critical, Orange=High, Yellow=Moderate, Green=Low)
- Pulsing animations for vulnerable packages
- Click on nodes to view vulnerability details

### 🌐 Full Graph Mode

- Complete dependency tree with all relationships
- Hierarchical layout for better understanding
- Optimized for large dependency graphs

## Interactive Controls

- **Mouse Controls**: Click and drag to rotate, scroll to zoom
- **Node Interaction**: Click nodes to view package details and vulnerabilities
- **Zoom Controls**: Zoom in/out and fit to view
- **Physics Toggle**: Enable/disable physics simulation
- **Center View**: Reset camera to center position

## Supported Project Types

- ✅ .NET Core / .NET 5+ projects
- ✅ .NET Framework projects  
- ✅ .NET Standard libraries
- ✅ PackageReference format
- ✅ packages.config format (legacy)

## Requirements

### Minimum Requirements

- Visual Studio Code 1.74.0+
- .NET project files (.csproj)

### Recommended

- .NET SDK installed for full CLI integration
- Internet connection for vulnerability scanning
- Modern graphics card for optimal 3D performance

## Configuration

The extension works out of the box with no configuration required. It automatically:

- Detects .NET projects in your workspace
- Chooses the best analysis method (CLI or file parsing)
- Caches results for improved performance
- Handles offline scenarios gracefully

## Troubleshooting

### Common Issues

**"No .NET SDK found"**

- Install the .NET SDK from <https://dotnet.microsoft.com/download>
- Restart VS Code after installation

**"No dependencies found"**

- Ensure your project has NuGet package references
- Check that the .csproj file is valid XML
- Try running `dotnet restore` in your project directory

**"Webview failed to load"**

- Check VS Code's webview security settings
- Ensure you have a modern browser engine
- Try reloading the VS Code window

### Performance Tips

- For large projects, use the Dependencies mode first
- Enable caching for faster subsequent scans
- Close other resource-intensive VS Code extensions

## Privacy & Security

- **No Data Collection**: This extension does not collect or transmit personal data
- **Local Processing**: All analysis is performed locally on your machine
- **Secure Connections**: Vulnerability data is fetched over HTTPS when available
- **Offline Capable**: Works without internet connectivity using cached data

## Contributing

We welcome contributions! Please see our [GitHub repository](https://github.com/nuget-tools/nuget-dependency-graph) for:

- 🐛 Bug reports
- 💡 Feature requests  
- 🔧 Pull requests
- 📖 Documentation improvements

## License

This extension is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Changelog

### 1.0.0

- Initial release
- 3D dependency visualization
- Vulnerability scanning
- Offline support
- Multi-project detection
- Interactive graph controls

---

**Enjoy visualizing your NuGet dependencies!** 🚀

For support, please visit our [GitHub Issues](https://github.com/nuget-tools/nuget-dependency-graph/issues) page.
