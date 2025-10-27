# Change Log

All notable changes to the "NuGet Dependency Graph" extension will be documented in this file.

## [1.0.2] - 2024-12-19

### Fixed

- **Critical Bug**: Fixed webview blank screen issue caused by incorrect JavaScript file path resolution
- **Asset Loading**: Fixed production build asset loading where webview manager was looking for `webview.js` but files had content hashes
- **Error Logging**: Added comprehensive webview debugging and error logging system
- **File Detection**: Implemented dynamic JavaScript file detection for both development and production builds

### Added

- **Enhanced Debugging**: Added detailed error logging and diagnostic information for webview troubleshooting
- **Asset Monitoring**: Added real-time asset loading status monitoring and error reporting
- **React Initialization Tracking**: Added monitoring for React library loading and component initialization
- **Performance Metrics**: Added load time tracking and performance monitoring for webview rendering

### Improved

- **Error Handling**: Enhanced error boundary and recovery mechanisms for webview failures
- **User Feedback**: Added better error messages and diagnostic information for troubleshooting
- **Development Experience**: Improved debugging capabilities for webview-related issues

## [1.0.1] - 2024-12-19

### Fixed

- **TypeScript Compilation Errors**: Fixed type annotations in dotnet CLI service error handling methods
- **Missing Dependencies**: Added missing `d3-force` package dependency for 3D graph physics
- **Build Configuration**: Updated webpack configuration to use main webview entry point

### Removed

- **Unused Code Cleanup**: Removed unused `graphDataTransformer` service and fallback webview component
- **Build Artifacts**: Cleaned up generated files and build outputs

### Improved

- **Code Quality**: Eliminated unused imports and interfaces
- **Build Performance**: Streamlined build process with cleaner dependency tree
- **Bundle Size**: Reduced extension package size by removing unused components

## [1.0.0] - 2024-12-19

### Added

- **Initial Release** 🎉
- **3D Dependency Visualization**: Interactive 3D graphs using React and force-graph-3d
- **Multiple Visualization Modes**:
  - Dependencies-only view
  - Vulnerabilities-focused view  
  - Full dependency graph view
- **Security Vulnerability Scanning**:
  - Integration with .NET CLI vulnerability scanning
  - Color-coded severity indicators (Critical, High, Moderate, Low)
  - Direct links to security advisories
  - Pulsing animations for vulnerable packages
- **Offline Support**:
  - Local asset bundling for offline functionality
  - Persistent caching of vulnerability scan results
  - Graceful fallback mechanisms
- **Smart Project Detection**:
  - Automatic detection of .NET projects in workspace
  - Support for multiple project types (.NET Core, .NET Framework, .NET 5+)
  - Project file validation with helpful error messages
- **Interactive Graph Controls**:
  - Mouse-based navigation (click, drag, zoom)
  - Zoom controls and fit-to-view functionality
  - Physics simulation toggle
  - Camera reset and centering
- **Comprehensive Error Handling**:
  - Graceful fallback from .NET CLI to project file parsing
  - User-friendly error messages with recovery suggestions
  - Robust handling of corrupted or invalid project files
- **Performance Optimizations**:
  - Intelligent caching for faster subsequent scans
  - Optimized graph rendering for large dependency trees
  - Debounced user interactions
- **VS Code Integration**:
  - Command palette integration
  - Context menu support for .csproj files
  - Progress indicators for long-running operations
  - VS Code theme integration

### Technical Features

- **Dual Analysis Methods**: .NET CLI integration with project file parsing fallback
- **Advanced Caching**: In-memory and persistent file-based caching
- **Asset Management**: Local bundling of 3D visualization libraries
- **Type Safety**: Comprehensive TypeScript implementation
- **Error Boundaries**: React error boundaries for robust UI
- **Security**: Content Security Policy compliance for webviews

### Supported Formats

- ✅ .NET Core / .NET 5+ projects
- ✅ .NET Framework projects
- ✅ .NET Standard libraries
- ✅ PackageReference format
- ✅ packages.config format (legacy)

### Requirements

- Visual Studio Code 1.74.0 or higher
- .NET projects with NuGet package references
- .NET SDK (recommended for full functionality)

---

## Future Releases

### Planned Features

- Enhanced filtering and search capabilities
- Export functionality (JSON, CSV, SARIF)
- Custom color schemes and themes
- Performance metrics and analytics
- Integration with CI/CD pipelines
- Support for additional package managers

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
