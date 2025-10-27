import {
  NuGetPackage,
  DependencyAnalysisResult,
  GraphData,
  GraphNode,
  GraphLink,
  VulnerabilityCount,
  AnalysisMetadata,
  Vulnerability
} from '../../src/types/dependency';

/**
 * Mock data provider for local testing and debugging
 * Generates realistic NuGet dependency data without requiring .NET SDK or project files
 */
export class MockDataProvider {
  private readonly mockPackages: NuGetPackage[] = [
    {
      id: 'Microsoft.EntityFrameworkCore',
      version: '8.0.2',
      resolved: '8.0.2',
      framework: 'net8.0',
      isTransitive: false,
      depth: 0,
      dependencies: [
        {
          id: 'Microsoft.EntityFrameworkCore.Relational',
          version: '8.0.2',
          resolved: '8.0.2',
          framework: 'net8.0',
          isTransitive: true,
          depth: 1,
          dependencies: [
            {
              id: 'Microsoft.EntityFrameworkCore.SqlServer',
              version: '8.0.2',
              resolved: '8.0.2',
              framework: 'net8.0',
              isTransitive: true,
              depth: 2,
              vulnerabilities: [
                {
                  id: 'GHSA-1234-5678',
                  severity: 'High',
                  title: 'SQL Injection vulnerability in Entity Framework Core',
                  description:
                    'A critical SQL injection vulnerability was discovered in Entity Framework Core',
                  advisoryUrl: 'https://github.com/advisories/GHSA-1234-5678',
                  cve: ['CVE-2024-1234'],
                  publishedDate: '2024-01-15',
                  lastModified: '2024-01-20'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'Swashbuckle.AspNetCore',
      version: '6.4.0',
      resolved: '6.4.0',
      framework: 'net8.0',
      isTransitive: false,
      depth: 0,
      dependencies: [
        {
          id: 'Swashbuckle.AspNetCore.Swagger',
          version: '6.4.0',
          resolved: '6.4.0',
          framework: 'net8.0',
          isTransitive: true,
          depth: 1
        },
        {
          id: 'Swashbuckle.AspNetCore.SwaggerGen',
          version: '6.4.0',
          resolved: '6.4.0',
          framework: 'net8.0',
          isTransitive: true,
          depth: 1,
          vulnerabilities: [
            {
              id: 'GHSA-5678-9012',
              severity: 'Moderate',
              title: 'Information disclosure in Swagger UI',
              description:
                'Swagger UI may expose sensitive information in development environments',
              advisoryUrl: 'https://github.com/advisories/GHSA-5678-9012',
              cve: ['CVE-2024-5678'],
              publishedDate: '2024-02-10',
              lastModified: '2024-02-15'
            }
          ]
        }
      ]
    },
    {
      id: 'Microsoft.AspNetCore.Authentication.JwtBearer',
      version: '8.0.2',
      resolved: '8.0.2',
      framework: 'net8.0',
      isTransitive: false,
      depth: 0,
      dependencies: [
        {
          id: 'System.IdentityModel.Tokens.Jwt',
          version: '7.0.3',
          resolved: '7.0.3',
          framework: 'net8.0',
          isTransitive: true,
          depth: 1,
          vulnerabilities: [
            {
              id: 'GHSA-9012-3456',
              severity: 'Critical',
              title: 'JWT token validation bypass',
              description:
                'Critical vulnerability allowing JWT token validation to be bypassed',
              advisoryUrl: 'https://github.com/advisories/GHSA-9012-3456',
              cve: ['CVE-2024-9012'],
              publishedDate: '2024-03-01',
              lastModified: '2024-03-05'
            }
          ]
        }
      ]
    },
    {
      id: 'Serilog.AspNetCore',
      version: '8.0.1',
      resolved: '8.0.1',
      framework: 'net8.0',
      isTransitive: false,
      depth: 0,
      dependencies: [
        {
          id: 'Serilog',
          version: '3.1.1',
          resolved: '3.1.1',
          framework: 'net8.0',
          isTransitive: true,
          depth: 1
        },
        {
          id: 'Serilog.Sinks.Console',
          version: '5.0.1',
          resolved: '5.0.1',
          framework: 'net8.0',
          isTransitive: true,
          depth: 1
        }
      ]
    },
    {
      id: 'AutoMapper.Extensions.Microsoft.DependencyInjection',
      version: '12.0.1',
      resolved: '12.0.1',
      framework: 'net8.0',
      isTransitive: false,
      depth: 0,
      dependencies: [
        {
          id: 'AutoMapper',
          version: '12.0.1',
          resolved: '12.0.1',
          framework: 'net8.0',
          isTransitive: true,
          depth: 1
        }
      ]
    }
  ];

  /**
   * Generate mock dependency analysis result for testing
   */
  async getMockDependencies(
    projectName: string = 'MockProject'
  ): Promise<DependencyAnalysisResult> {
    const packages = this.flattenDependencies(this.mockPackages);
    const graphData = this.createGraphData(packages, 'dependencies');
    const vulnerabilityCount = this.countVulnerabilities(packages);
    const analysisMetadata = this.createAnalysisMetadata();

    return {
      projectName,
      projectPath: `/mock/path/${projectName}.csproj`,
      packages,
      graphData,
      vulnerabilityCount,
      analysisMetadata
    };
  }

  /**
   * Generate mock dependency analysis with vulnerabilities
   */
  async getMockDependenciesWithVulnerabilities(
    projectName: string = 'MockProject'
  ): Promise<DependencyAnalysisResult> {
    const packages = this.flattenDependencies(this.mockPackages);
    const graphData = this.createGraphData(packages, 'vulnerabilities');
    const vulnerabilityCount = this.countVulnerabilities(packages);
    const analysisMetadata = this.createAnalysisMetadata();

    return {
      projectName,
      projectPath: `/mock/path/${projectName}.csproj`,
      packages,
      graphData,
      vulnerabilityCount,
      analysisMetadata
    };
  }

  /**
   * Generate mock full dependency graph
   */
  async getMockFullDependencyGraph(
    projectName: string = 'MockProject'
  ): Promise<DependencyAnalysisResult> {
    const packages = this.flattenDependencies(this.mockPackages);
    const graphData = this.createGraphData(packages, 'full');
    const vulnerabilityCount = this.countVulnerabilities(packages);
    const analysisMetadata = this.createAnalysisMetadata();

    return {
      projectName,
      projectPath: `/mock/path/${projectName}.csproj`,
      packages,
      graphData,
      vulnerabilityCount,
      analysisMetadata
    };
  }

  /**
   * Generate mock data from real dotnet CLI output
   */
  async getMockFromRealOutput(
    realOutput: string,
    projectName: string = 'MockProject'
  ): Promise<DependencyAnalysisResult> {
    try {
      const parsedData = JSON.parse(realOutput);
      const packages = this.parseRealOutput(parsedData);
      const graphData = this.createGraphData(packages, 'dependencies');
      const vulnerabilityCount = this.countVulnerabilities(packages);
      const analysisMetadata = this.createAnalysisMetadata();

      return {
        projectName,
        projectPath: `/mock/path/${projectName}.csproj`,
        packages,
        graphData,
        vulnerabilityCount,
        analysisMetadata
      };
    } catch (error) {
      console.error(
        'Failed to parse real output, falling back to mock data:',
        error
      );
      return this.getMockDependencies(projectName);
    }
  }

  /**
   * Flatten nested dependencies into a flat array
   */
  private flattenDependencies(
    packages: NuGetPackage[],
    depth: number = 0
  ): NuGetPackage[] {
    const flattened: NuGetPackage[] = [];

    for (const pkg of packages) {
      const flatPkg = { ...pkg, depth };
      flattened.push(flatPkg);

      if (pkg.dependencies && pkg.dependencies.length > 0) {
        flattened.push(
          ...this.flattenDependencies(pkg.dependencies, depth + 1)
        );
      }
    }

    return flattened;
  }

  /**
   * Parse real dotnet CLI output into NuGetPackage array
   */
  private parseRealOutput(data: any): NuGetPackage[] {
    const packages: NuGetPackage[] = [];

    if (data.projects && Array.isArray(data.projects)) {
      for (const project of data.projects) {
        if (project.frameworks && Array.isArray(project.frameworks)) {
          for (const framework of project.frameworks) {
            // Parse top-level packages
            if (
              framework.topLevelPackages &&
              Array.isArray(framework.topLevelPackages)
            ) {
              for (const pkg of framework.topLevelPackages) {
                packages.push({
                  id: pkg.id,
                  version:
                    pkg.requestedVersion || pkg.resolvedVersion || '0.0.0',
                  resolved: pkg.resolvedVersion || '0.0.0',
                  framework: framework.framework || 'net8.0',
                  isTransitive: false,
                  depth: 0
                });
              }
            }

            // Parse transitive packages
            if (
              framework.transitivePackages &&
              Array.isArray(framework.transitivePackages)
            ) {
              for (const pkg of framework.transitivePackages) {
                packages.push({
                  id: pkg.id,
                  version: pkg.resolvedVersion || '0.0.0',
                  resolved: pkg.resolvedVersion || '0.0.0',
                  framework: framework.framework || 'net8.0',
                  isTransitive: true,
                  depth: 1
                });
              }
            }
          }
        }
      }
    }

    return packages;
  }

  /**
   * Create graph data from packages
   */
  private createGraphData(
    packages: NuGetPackage[],
    mode: 'dependencies' | 'vulnerabilities' | 'full'
  ): GraphData {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // Create nodes
    for (const pkg of packages) {
      const node: GraphNode = {
        id: pkg.id,
        name: pkg.id,
        version: pkg.version,
        group: pkg.isTransitive ? 'transitive' : 'direct',
        val: pkg.isTransitive ? 1 : 2,
        color: this.getNodeColor(pkg, mode),
        vulnerabilities: pkg.vulnerabilities,
        isRoot: !pkg.isTransitive,
        depth: pkg.depth || 0
      };

      nodes.push(node);
      nodeMap.set(pkg.id, node);
    }

    // Create links (simplified - in real implementation this would be based on actual dependencies)
    if (mode === 'full' || mode === 'dependencies') {
      // Create some sample links between packages
      const directPackages = packages.filter(p => !p.isTransitive);
      const transitivePackages = packages.filter(p => p.isTransitive);

      for (const direct of directPackages) {
        for (const transitive of transitivePackages) {
          // Create a link with some probability to simulate real dependencies
          if (Math.random() > 0.7) {
            links.push({
              source: direct.id,
              target: transitive.id,
              value: 1,
              color: '#999'
            });
          }
        }
      }
    }

    return { nodes, links };
  }

  /**
   * Get node color based on package and mode
   */
  private getNodeColor(pkg: NuGetPackage, mode: string): string {
    if (
      mode === 'vulnerabilities' &&
      pkg.vulnerabilities &&
      pkg.vulnerabilities.length > 0
    ) {
      const highestSeverity = this.getHighestSeverity(pkg.vulnerabilities);
      switch (highestSeverity) {
        case 'Critical':
          return '#8B0000';
        case 'High':
          return '#FF4500';
        case 'Moderate':
          return '#FFA500';
        case 'Low':
          return '#FFD700';
        default:
          return '#1f77b4';
      }
    }

    // Default color scheme
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
    return colors[(pkg.depth || 0) % colors.length];
  }

  /**
   * Get highest severity from vulnerabilities
   */
  private getHighestSeverity(
    vulnerabilities: Vulnerability[]
  ): 'Critical' | 'High' | 'Moderate' | 'Low' {
    const severityOrder = { Critical: 4, High: 3, Moderate: 2, Low: 1 };
    let highest: 'Critical' | 'High' | 'Moderate' | 'Low' = 'Low';

    for (const vuln of vulnerabilities) {
      if (severityOrder[vuln.severity] > severityOrder[highest]) {
        highest = vuln.severity;
      }
    }

    return highest;
  }

  /**
   * Count vulnerabilities by severity
   */
  private countVulnerabilities(packages: NuGetPackage[]): VulnerabilityCount {
    const counts = { critical: 0, high: 0, moderate: 0, low: 0, total: 0 };

    for (const pkg of packages) {
      if (pkg.vulnerabilities) {
        for (const vuln of pkg.vulnerabilities) {
          counts[
            vuln.severity.toLowerCase() as keyof Omit<
              VulnerabilityCount,
              'total'
            >
          ]++;
          counts.total++;
        }
      }
    }

    return counts;
  }

  /**
   * Create analysis metadata
   */
  private createAnalysisMetadata(): AnalysisMetadata {
    return {
      timestamp: new Date(),
      analysisMethod: 'mock',
      framework: 'net8.0',
      sdkVersion: '8.0.100',
      hasTransitiveDependencies: true,
      hasVulnerabilityData: true
    };
  }
}

Failed to save 'dbbae84c51d3_add_default_organization_for_local_.py': User did not grant permission.