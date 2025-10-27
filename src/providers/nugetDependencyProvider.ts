import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import {
  NuGetPackage,
  Vulnerability,
  DependencyAnalysisResult,
  GraphData,
  GraphNode,
  GraphLink,
  VulnerabilityCount,
  AnalysisMetadata,
  INuGetDependencyProvider,
  ProjectValidationResult,
  ExtensionError
} from '../types/dependency';
import {
  DotNetCliService,
  DotNetCliError,
  DotNetCliErrorCodes
} from '../services/dotnetCliService';
import { ProjectFileParser } from '../services/projectFileParser';
import { VulnerabilityScanner } from '../services/vulnerabilityScanner';

export class NuGetDependencyProvider implements INuGetDependencyProvider {
  private readonly dotnetCliService: DotNetCliService;
  private readonly projectFileParser: ProjectFileParser;
  private readonly vulnerabilityScanner: VulnerabilityScanner;

  private readonly vulnerabilityColors = {
    Critical: '#8B0000',
    High: '#FF4500',
    Moderate: '#FFA500',
    Low: '#FFD700'
  };

  private readonly packageColors = [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
    '#17becf'
  ];

  private lastAnalysisMethod: 'dotnet-cli' | 'project-file' | 'hybrid' =
    'dotnet-cli';

  constructor(context: vscode.ExtensionContext) {
    this.dotnetCliService = new DotNetCliService();
    this.projectFileParser = new ProjectFileParser();
    this.vulnerabilityScanner = new VulnerabilityScanner(context);
  }

  async getDependencies(
    projectPath: string
  ): Promise<DependencyAnalysisResult> {
    const packages = await this.analyzeDependencies(projectPath, false);
    const graphData = this.createGraphData(packages, 'dependencies');
    const analysisMetadata = await this.createAnalysisMetadata(
      projectPath,
      'dotnet-cli',
      false,
      false
    );

    return {
      projectName: path.basename(projectPath, '.csproj'),
      projectPath,
      packages,
      graphData,
      vulnerabilityCount: this.countVulnerabilities(packages),
      analysisMetadata
    };
  }

  async getDependenciesWithVulnerabilities(
    projectPath: string
  ): Promise<DependencyAnalysisResult> {
    const packages = await this.analyzeDependencies(projectPath, true);
    const graphData = this.createGraphData(packages, 'vulnerabilities');
    const analysisMetadata = await this.createAnalysisMetadata(
      projectPath,
      'dotnet-cli',
      false,
      true
    );

    return {
      projectName: path.basename(projectPath, '.csproj'),
      projectPath,
      packages,
      graphData,
      vulnerabilityCount: this.countVulnerabilities(packages),
      analysisMetadata
    };
  }

  async getFullDependencyGraph(
    projectPath: string
  ): Promise<DependencyAnalysisResult> {
    const packages = await this.analyzeDependencies(projectPath, false, true);
    const graphData = this.createGraphData(packages, 'full');
    const analysisMetadata = await this.createAnalysisMetadata(
      projectPath,
      'dotnet-cli',
      true,
      false
    );

    return {
      projectName: path.basename(projectPath, '.csproj'),
      projectPath,
      packages,
      graphData,
      vulnerabilityCount: this.countVulnerabilities(packages),
      analysisMetadata
    };
  }

  async validateProject(projectPath: string): Promise<ProjectValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if file exists
    if (!fs.existsSync(projectPath)) {
      errors.push(`Project file not found: ${projectPath}`);
      return {
        isValid: false,
        errors,
        warnings,
        projectType: 'unknown',
        frameworks: []
      };
    }

    // Check file extension
    if (!projectPath.endsWith('.csproj')) {
      errors.push('File is not a .csproj project file');
    }

    try {
      const projectContent = fs.readFileSync(projectPath, 'utf8');
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(projectContent);

      if (!result.Project) {
        errors.push('Invalid project file format: missing Project element');
      }

      // Determine project type and frameworks
      const frameworks: string[] = [];
      let projectType:
        | 'dotnet-core'
        | 'dotnet-framework'
        | 'dotnet-5+'
        | 'unknown' = 'unknown';

      if (result.Project && result.Project.PropertyGroup) {
        for (const propGroup of result.Project.PropertyGroup) {
          if (propGroup.TargetFramework) {
            frameworks.push(propGroup.TargetFramework[0]);
          }
          if (propGroup.TargetFrameworks) {
            frameworks.push(...propGroup.TargetFrameworks[0].split(';'));
          }
        }

        // Determine project type based on frameworks
        if (
          frameworks.some(
            f =>
              f.startsWith('net5') ||
              f.startsWith('net6') ||
              f.startsWith('net7') ||
              f.startsWith('net8')
          )
        ) {
          projectType = 'dotnet-5+';
        } else if (
          frameworks.some(
            f => f.startsWith('netcoreapp') || f.startsWith('netstandard')
          )
        ) {
          projectType = 'dotnet-core';
        } else if (
          frameworks.some(f => f.startsWith('net4') || f.startsWith('net3'))
        ) {
          projectType = 'dotnet-framework';
        }
      }

      if (frameworks.length === 0) {
        warnings.push('No target framework specified in project file');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        projectType,
        frameworks
      };
    } catch (error) {
      errors.push(`Failed to parse project file: ${error}`);
      return {
        isValid: false,
        errors,
        warnings,
        projectType: 'unknown',
        frameworks: []
      };
    }
  }

  async refreshCache(projectPath: string): Promise<void> {
    // For now, this is a no-op since we don't have caching implemented yet
    // This will be implemented when we add the caching functionality
    // Suppress unused parameter warning for now
    void projectPath;
  }

  private async analyzeDependencies(
    projectPath: string,
    includeVulnerabilities: boolean = false,
    includeTransitive: boolean = false
  ): Promise<NuGetPackage[]> {
    let packages: NuGetPackage[] = [];
    let analysisMethod: 'dotnet-cli' | 'project-file' | 'hybrid' = 'dotnet-cli';

    try {
      // First, try to get dependencies using .NET CLI service
      packages = await this.dotnetCliService.listPackages(projectPath, {
        includeTransitive,
        format: 'json'
      });

      if (includeVulnerabilities) {
        try {
          // Use the enhanced vulnerability scanner with caching
          const vulnerabilityScanResult =
            await this.vulnerabilityScanner.scanProject(projectPath);
          this.mergeVulnerabilityData(
            packages,
            vulnerabilityScanResult.packages
          );
        } catch (vulnError) {
          // Vulnerability scanning failed, but we can continue with dependency data
          if (vulnError instanceof DotNetCliError) {
            // Log the vulnerability scan failure but don't fail the entire operation
          }
        }
      }

      analysisMethod = 'dotnet-cli';
    } catch (error) {
      // Graceful fallback to project file parsing
      if (error instanceof DotNetCliError) {
        // Check if the error is recoverable and we should attempt fallback
        if (
          error.recoverable ||
          error.code === DotNetCliErrorCodes.SDK_NOT_FOUND
        ) {
          try {
            packages = await this.projectFileParser.parseProjectFile(
              projectPath
            );
            analysisMethod = 'project-file';
          } catch (fallbackError) {
            // Both methods failed - create a comprehensive error
            throw this.createAnalysisError(error, fallbackError, projectPath);
          }
        } else {
          // Non-recoverable error - don't attempt fallback
          throw error;
        }
      } else {
        // Unknown error - attempt fallback
        try {
          packages = await this.projectFileParser.parseProjectFile(projectPath);
          analysisMethod = 'project-file';
        } catch (fallbackError) {
          throw this.createAnalysisError(error, fallbackError, projectPath);
        }
      }
    }

    // Update analysis metadata to reflect the actual method used
    this.lastAnalysisMethod = analysisMethod;
    return packages;
  }

  private createGraphData(
    packages: NuGetPackage[],
    mode: 'dependencies' | 'vulnerabilities' | 'full'
  ): GraphData {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // Create nodes
    packages.forEach((pkg, index) => {
      const nodeId = `${pkg.id}@${pkg.version}`;
      let color: string = '#6c757d'; // Default neutral color

      if (
        mode === 'vulnerabilities' &&
        pkg.vulnerabilities &&
        pkg.vulnerabilities.length > 0
      ) {
        // Color by highest severity vulnerability
        const highestSeverity = this.getHighestSeverity(pkg.vulnerabilities);
        color = this.vulnerabilityColors[highestSeverity];
      } else if (mode === 'dependencies' || mode === 'full') {
        // Use distinct colors for different packages
        color =
          this.packageColors[index % this.packageColors.length] ?? '#6c757d';
      }

      const node: GraphNode = {
        id: nodeId,
        name: pkg.id,
        version: pkg.version,
        group: pkg.isTransitive ? 'transitive' : 'direct',
        val: pkg.vulnerabilities ? pkg.vulnerabilities.length + 1 : 1,
        color,
        vulnerabilities: pkg.vulnerabilities,
        isRoot: !pkg.isTransitive,
        depth: pkg.depth || 0
      };

      nodes.push(node);
      nodeMap.set(nodeId, node);
    });

    // Create synthetic links based on package hierarchy and relationships
    this.createSyntheticLinks(packages, nodeMap, links, mode);

    return { nodes, links };
  }

  /**
   * Create synthetic links between packages based on hierarchy and relationships
   * Since dotnet list package doesn't provide dependency relationships,
   * we create links based on package hierarchy and transitive relationships
   */
  private createSyntheticLinks(
    packages: NuGetPackage[],
    nodeMap: Map<string, GraphNode>,
    links: GraphLink[],
    mode: 'dependencies' | 'vulnerabilities' | 'full'
  ): void {
    // Separate direct and transitive packages
    const directPackages = packages.filter(pkg => !pkg.isTransitive);
    const transitivePackages = packages.filter(pkg => pkg.isTransitive);

    // Create links from direct packages to transitive packages
    // This creates a hierarchical structure showing dependency relationships
    directPackages.forEach(directPkg => {
      const directNodeId = `${directPkg.id}@${directPkg.version}`;

      // Link direct packages to transitive packages based on common patterns
      transitivePackages.forEach(transitivePkg => {
        const transitiveNodeId = `${transitivePkg.id}@${transitivePkg.version}`;

        // Create links based on common dependency patterns
        if (this.shouldCreateLink(directPkg, transitivePkg)) {
          links.push({
            source: directNodeId,
            target: transitiveNodeId,
            value: 1,
            color: mode === 'vulnerabilities' ? '#ff6b6b' : '#999'
          });
        }
      });
    });

    // Create links between transitive packages that are likely related
    // This helps show the dependency graph structure
    for (let i = 0; i < transitivePackages.length; i++) {
      for (let j = i + 1; j < transitivePackages.length; j++) {
        const pkg1 = transitivePackages[i];
        const pkg2 = transitivePackages[j];

        if (pkg1 && pkg2 && this.arePackagesRelated(pkg1, pkg2)) {
          const nodeId1 = `${pkg1.id}@${pkg1.version}`;
          const nodeId2 = `${pkg2.id}@${pkg2.version}`;

          links.push({
            source: nodeId1,
            target: nodeId2,
            value: 0.5, // Lighter weight for transitive relationships
            color: mode === 'vulnerabilities' ? '#ff6b6b' : '#ccc'
          });
        }
      }
    }

    // If no links were created, create some basic structure links
    if (links.length === 0 && packages.length > 1) {
      this.createFallbackLinks(packages, nodeMap, links, mode);
    }
  }

  /**
   * Determine if a link should be created between two packages
   */
  private shouldCreateLink(
    directPkg: NuGetPackage,
    transitivePkg: NuGetPackage
  ): boolean {
    // Common patterns for package relationships
    const commonPatterns = [
      // Microsoft packages often depend on each other
      directPkg.id.startsWith('Microsoft.') &&
        transitivePkg.id.startsWith('Microsoft.'),
      // System packages
      directPkg.id.startsWith('System.') &&
        transitivePkg.id.startsWith('System.'),
      // Same major package family
      directPkg.id.split('.')[0] === transitivePkg.id.split('.')[0],
      // Common dependency patterns
      this.hasCommonDependencyPattern(directPkg.id, transitivePkg.id)
    ];

    return commonPatterns.some(pattern => pattern);
  }

  /**
   * Check if two transitive packages are likely related
   */
  private arePackagesRelated(pkg1: NuGetPackage, pkg2: NuGetPackage): boolean {
    // Packages from the same vendor/family are likely related
    const pkg1Parts = pkg1.id.split('.');
    const pkg2Parts = pkg2.id.split('.');

    // Same vendor (first part)
    if (pkg1Parts[0] === pkg2Parts[0]) {
      return true;
    }

    // Same major family (first two parts)
    if (pkg1Parts.length >= 2 && pkg2Parts.length >= 2) {
      if (pkg1Parts[0] === pkg2Parts[0] && pkg1Parts[1] === pkg2Parts[1]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for common dependency patterns
   */
  private hasCommonDependencyPattern(pkg1Id: string, pkg2Id: string): boolean {
    const patterns = [
      // Entity Framework patterns
      pkg1Id.includes('EntityFramework') && pkg2Id.includes('EntityFramework'),
      // ASP.NET Core patterns
      pkg1Id.includes('AspNetCore') && pkg2Id.includes('AspNetCore'),
      // Logging patterns
      pkg1Id.includes('Logging') && pkg2Id.includes('Logging'),
      // Configuration patterns
      pkg1Id.includes('Configuration') && pkg2Id.includes('Configuration')
    ];

    return patterns.some(pattern => pattern);
  }

  /**
   * Create fallback links when no relationships can be determined
   */
  private createFallbackLinks(
    packages: NuGetPackage[],
    _nodeMap: Map<string, GraphNode>,
    links: GraphLink[],
    mode: 'dependencies' | 'vulnerabilities' | 'full'
  ): void {
    // Create a simple star topology with direct packages as hubs
    const directPackages = packages.filter(pkg => !pkg.isTransitive);
    const transitivePackages = packages.filter(pkg => pkg.isTransitive);

    if (directPackages.length > 0 && transitivePackages.length > 0) {
      // Link each direct package to some transitive packages
      directPackages.forEach((directPkg, index) => {
        const directNodeId = `${directPkg.id}@${directPkg.version}`;

        // Link to a subset of transitive packages
        const startIndex =
          index * Math.ceil(transitivePackages.length / directPackages.length);
        const endIndex = Math.min(
          startIndex +
            Math.ceil(transitivePackages.length / directPackages.length),
          transitivePackages.length
        );

        for (let i = startIndex; i < endIndex; i++) {
          const transitivePkg = transitivePackages[i];
          if (transitivePkg) {
            const transitiveNodeId = `${transitivePkg.id}@${transitivePkg.version}`;

            links.push({
              source: directNodeId,
              target: transitiveNodeId,
              value: 1,
              color: mode === 'vulnerabilities' ? '#ff6b6b' : '#999'
            });
          }
        }
      });
    }
  }

  private getHighestSeverity(
    vulnerabilities: Vulnerability[]
  ): 'Critical' | 'High' | 'Moderate' | 'Low' {
    const severityOrder: Array<'Critical' | 'High' | 'Moderate' | 'Low'> = [
      'Critical',
      'High',
      'Moderate',
      'Low'
    ];

    for (const severity of severityOrder) {
      if (vulnerabilities.some(v => v.severity === severity)) {
        return severity;
      }
    }

    return 'Low';
  }

  private countVulnerabilities(packages: NuGetPackage[]): VulnerabilityCount {
    const count = { critical: 0, high: 0, moderate: 0, low: 0, total: 0 };

    packages.forEach(pkg => {
      if (pkg.vulnerabilities) {
        pkg.vulnerabilities.forEach(vuln => {
          switch (vuln.severity.toLowerCase()) {
            case 'critical':
              count.critical++;
              break;
            case 'high':
              count.high++;
              break;
            case 'moderate':
              count.moderate++;
              break;
            case 'low':
              count.low++;
              break;
          }
          count.total++;
        });
      }
    });

    return count;
  }

  private async createAnalysisMetadata(
    projectPath: string,
    _method: 'dotnet-cli' | 'project-file' | 'hybrid',
    hasTransitive: boolean,
    hasVulnerabilityData: boolean
  ): Promise<AnalysisMetadata> {
    let sdkVersion: string | undefined;
    let framework: string | undefined;

    try {
      // Try to get .NET SDK version using the CLI service
      sdkVersion = await this.dotnetCliService.getVersion();
    } catch (error) {
      // SDK not available
    }

    try {
      // Try to get target framework from project file
      const validation = await this.validateProject(projectPath);
      if (validation.frameworks.length > 0) {
        framework = validation.frameworks[0];
      }
    } catch (error) {
      // Could not determine framework
    }

    return {
      timestamp: new Date(),
      analysisMethod: this.lastAnalysisMethod, // Use the actual method that was used
      framework,
      sdkVersion,
      hasTransitiveDependencies: hasTransitive,
      hasVulnerabilityData
    };
  }

  /**
   * Merge vulnerability data from vulnerable packages into the main package list
   */
  private mergeVulnerabilityData(
    packages: NuGetPackage[],
    vulnerablePackages: NuGetPackage[]
  ): void {
    for (const vulnPkg of vulnerablePackages) {
      const pkg = packages.find(p => p.id === vulnPkg.id);
      if (pkg && vulnPkg.vulnerabilities) {
        pkg.vulnerabilities = vulnPkg.vulnerabilities;
      }
    }
  }

  /**
   * Create a comprehensive error when both CLI and project file parsing fail
   */
  private createAnalysisError(
    primaryError: unknown,
    fallbackError: unknown,
    projectPath: string
  ): ExtensionError {
    const error: ExtensionError = {
      name: 'DependencyAnalysisError',
      message:
        'Failed to analyze project dependencies using both .NET CLI and project file parsing.',
      code: 'DEPENDENCY_ANALYSIS_FAILED',
      category: 'analysis',
      recoverable: false,
      userMessage: `Unable to analyze dependencies for project: ${path.basename(
        projectPath
      )}. Both .NET CLI and project file parsing failed.`,
      technicalDetails: `Primary error (CLI): ${primaryError}\nFallback error (Project File): ${fallbackError}`
    };

    return error;
  }
}
