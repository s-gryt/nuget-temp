import {
  IDotNetCliService,
  ListPackagesOptions,
  NuGetPackage,
  CommandExecutionOptions,
  CommandResult,
  ExtensionError,
  Vulnerability
} from '../types/dependency';
import { CommandExecutor } from './commandExecutor';

/**
 * Specific error types for .NET CLI operations
 */
export class DotNetCliError extends Error implements ExtensionError {
  public readonly code: string;
  public readonly category: 'validation' | 'analysis' | 'visualization' | 'system';
  public readonly recoverable: boolean;
  public readonly userMessage: string;
  public readonly technicalDetails?: string | undefined;

  constructor(
    code: string,
    userMessage: string,
    technicalDetails?: string | undefined,
    category: 'validation' | 'analysis' | 'visualization' | 'system' = 'system',
    recoverable: boolean = true
  ) {
    super(userMessage);
    this.name = 'DotNetCliError';
    this.code = code;
    this.category = category;
    this.recoverable = recoverable;
    this.userMessage = userMessage;
    this.technicalDetails = technicalDetails;
  }
}

/**
 * Error codes for different .NET CLI failure scenarios
 */
export const DotNetCliErrorCodes = {
  SDK_NOT_FOUND: 'DOTNET_SDK_NOT_FOUND',
  SDK_VERSION_INCOMPATIBLE: 'DOTNET_SDK_VERSION_INCOMPATIBLE',
  PROJECT_NOT_FOUND: 'DOTNET_PROJECT_NOT_FOUND',
  PROJECT_INVALID: 'DOTNET_PROJECT_INVALID',
  RESTORE_FAILED: 'DOTNET_RESTORE_FAILED',
  LIST_PACKAGES_FAILED: 'DOTNET_LIST_PACKAGES_FAILED',
  VULNERABILITY_SCAN_FAILED: 'DOTNET_VULNERABILITY_SCAN_FAILED',
  TIMEOUT: 'DOTNET_COMMAND_TIMEOUT',
  PERMISSION_DENIED: 'DOTNET_PERMISSION_DENIED',
  NETWORK_ERROR: 'DOTNET_NETWORK_ERROR',
  UNKNOWN_ERROR: 'DOTNET_UNKNOWN_ERROR'
} as const;

export class DotNetCliService implements IDotNetCliService {
  private readonly commandExecutor: CommandExecutor;
  private readonly defaultTimeout = 60000; // 60 seconds for package operations
  private readonly quickTimeout = 10000; // 10 seconds for version checks

  constructor() {
    this.commandExecutor = new CommandExecutor();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.commandExecutor.executeCommand('dotnet', ['--version'], {
        timeout: this.quickTimeout
      });
      return result.exitCode === 0;
    } catch (error) {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      const result = await this.commandExecutor.executeCommand('dotnet', ['--version'], {
        timeout: this.quickTimeout
      });

      if (result.exitCode !== 0) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.SDK_NOT_FOUND,
          'The .NET SDK is not installed or not accessible. Please install the .NET SDK to use this extension.',
          `Command failed with exit code ${result.exitCode}: ${result.stderr}`,
          'system',
          false
        );
      }

      const version = result.stdout.trim();
      if (!version) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.SDK_VERSION_INCOMPATIBLE,
          'Unable to determine .NET SDK version. The installed version may be incompatible.',
          'Version command returned empty output',
          'system',
          false
        );
      }

      return version;
    } catch (error) {
      if (error instanceof DotNetCliError) {
        throw error;
      }

      // Check if it's a command not found error
      if (this.isCommandNotFoundError(error)) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.SDK_NOT_FOUND,
          "The .NET SDK is not installed or not in your system PATH. Please install the .NET SDK and ensure it's accessible from the command line.",
          `Command execution failed: ${error}`,
          'system',
          false
        );
      }

      throw this.createDotNetError(
        DotNetCliErrorCodes.UNKNOWN_ERROR,
        'Failed to check .NET SDK version. Please ensure the .NET SDK is properly installed.',
        `Unexpected error: ${error}`,
        'system',
        true
      );
    }
  }

  async listPackages(projectPath: string, options: ListPackagesOptions = {}): Promise<NuGetPackage[]> {
    // Validate project path first
    if (!projectPath || typeof projectPath !== 'string') {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PROJECT_INVALID,
        'Invalid project path provided.',
        `Project path is empty or not a string: ${projectPath}`,
        'validation',
        false
      );
    }

    const args = ['list', projectPath, 'package'];

    if (options.includeTransitive) {
      args.push('--include-transitive');
    }

    if (options.framework) {
      args.push('--framework', options.framework);
    }

    if (options.source) {
      args.push('--source', options.source);
    }

    if (options.format) {
      args.push('--format', options.format);
    }

    try {
      const result = await this.commandExecutor.executeCommand('dotnet', args, {
        timeout: this.defaultTimeout
      });

      if (result.exitCode !== 0) {
        return this.handleListPackagesError(result, projectPath);
      }

      if (options.format === 'json') {
        return this.parseJsonOutput(result.stdout);
      }
      return this.parseTableOutput(result.stdout);
    } catch (error) {
      if (error instanceof DotNetCliError) {
        throw error;
      }

      if (this.isTimeoutError(error)) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.TIMEOUT,
          'The package listing operation timed out. This may indicate a large project or network issues.',
          `Command timed out after ${this.defaultTimeout}ms: ${error}`,
          'system',
          true
        );
      }

      if (this.isCommandNotFoundError(error)) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.SDK_NOT_FOUND,
          'The .NET SDK is not installed or not accessible. Please install the .NET SDK to analyze dependencies.',
          `Command not found: ${error}`,
          'system',
          false
        );
      }

      throw this.createDotNetError(
        DotNetCliErrorCodes.LIST_PACKAGES_FAILED,
        'Failed to list packages. Please ensure the project file is valid and the .NET SDK is properly installed.',
        `Unexpected error: ${error}`,
        'analysis',
        true
      );
    }
  }

  async listVulnerablePackages(projectPath: string, options: CommandExecutionOptions = {}): Promise<NuGetPackage[]> {
    // Validate project path first
    if (!projectPath || typeof projectPath !== 'string') {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PROJECT_INVALID,
        'Invalid project path provided for vulnerability scanning.',
        `Project path is empty or not a string: ${projectPath}`,
        'validation',
        false
      );
    }

    const args = ['list', projectPath, 'package', '--vulnerable', '--format', 'json'];

    try {
      const execOptions: CommandExecutionOptions = {
        timeout: options.timeout || this.defaultTimeout
      };

      if (options.cwd) {
        execOptions.cwd = options.cwd;
      }

      const result = await this.commandExecutor.executeCommand('dotnet', args, execOptions);

      if (result.exitCode !== 0) {
        return this.handleVulnerabilityScanError(result, projectPath);
      }

      return this.parseVulnerablePackagesOutput(result.stdout);
    } catch (error) {
      if (error instanceof DotNetCliError) {
        throw error;
      }

      if (this.isTimeoutError(error)) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.TIMEOUT,
          'The vulnerability scan timed out. This may indicate network issues or a large project.',
          `Vulnerability scan timed out after ${options.timeout || this.defaultTimeout}ms: ${error}`,
          'system',
          true
        );
      }

      if (this.isNetworkError(error)) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.NETWORK_ERROR,
          'Network error during vulnerability scan. Please check your internet connection and try again.',
          `Network error: ${error}`,
          'system',
          true
        );
      }

      if (this.isCommandNotFoundError(error)) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.SDK_NOT_FOUND,
          'The .NET SDK is not installed or not accessible. Please install the .NET SDK to scan for vulnerabilities.',
          `Command not found: ${error}`,
          'system',
          false
        );
      }

      throw this.createDotNetError(
        DotNetCliErrorCodes.VULNERABILITY_SCAN_FAILED,
        'Failed to scan for vulnerable packages. Please ensure the project is valid and try again.',
        `Unexpected error: ${error}`,
        'analysis',
        true
      );
    }
  }

  /**
   * Execute dotnet restore command with timeout support
   */
  async restorePackages(projectPath: string, options: CommandExecutionOptions = {}): Promise<void> {
    // Validate project path first
    if (!projectPath || typeof projectPath !== 'string') {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PROJECT_INVALID,
        'Invalid project path provided for package restore.',
        `Project path is empty or not a string: ${projectPath}`,
        'validation',
        false
      );
    }

    const args = ['restore', projectPath];

    try {
      const execOptions: CommandExecutionOptions = {
        timeout: options.timeout || this.defaultTimeout * 2 // Restore can take longer
      };

      if (options.cwd) {
        execOptions.cwd = options.cwd;
      }

      const result = await this.commandExecutor.executeCommand('dotnet', args, execOptions);

      if (result.exitCode !== 0) {
        return this.handleRestoreError(result, projectPath);
      }
    } catch (error) {
      if (error instanceof DotNetCliError) {
        throw error;
      }

      if (this.isTimeoutError(error)) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.TIMEOUT,
          'The package restore operation timed out. This may indicate network issues or a large project.',
          `Restore timed out after ${options.timeout || this.defaultTimeout * 2}ms: ${error}`,
          'system',
          true
        );
      }

      if (this.isNetworkError(error)) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.NETWORK_ERROR,
          'Network error during package restore. Please check your internet connection and try again.',
          `Network error: ${error}`,
          'system',
          true
        );
      }

      if (this.isCommandNotFoundError(error)) {
        throw this.createDotNetError(
          DotNetCliErrorCodes.SDK_NOT_FOUND,
          'The .NET SDK is not installed or not accessible. Please install the .NET SDK to restore packages.',
          `Command not found: ${error}`,
          'system',
          false
        );
      }

      throw this.createDotNetError(
        DotNetCliErrorCodes.RESTORE_FAILED,
        'Failed to restore packages. Please ensure the project file is valid and try again.',
        `Unexpected error: ${error}`,
        'analysis',
        true
      );
    }
  }

  /**
   * Get detailed package information including dependencies
   */
  async getPackageDetails(
    projectPath: string,
    packageId: string,
    options: CommandExecutionOptions = {}
  ): Promise<NuGetPackage | null> {
    try {
      // First get all packages with transitive dependencies
      const packages = await this.listPackages(projectPath, {
        includeTransitive: true,
        format: 'json'
      });

      // Find the specific package
      const targetPackage = packages.find(pkg => pkg.id === packageId);
      if (!targetPackage) {
        return null;
      }

      // Get vulnerability information for this specific package
      try {
        const vulnerablePackages = await this.listVulnerablePackages(projectPath, options);
        const vulnerablePackage = vulnerablePackages.find(pkg => pkg.id === packageId);
        if (vulnerablePackage && vulnerablePackage.vulnerabilities) {
          targetPackage.vulnerabilities = vulnerablePackage.vulnerabilities;
        }
      } catch (error) {
        // Vulnerability scan failed, but we can still return package info
      }

      return targetPackage;
    } catch (error) {
      throw new Error(`Failed to get package details for ${packageId}: ${error}`);
    }
  }

  private parseJsonOutput(output: string): NuGetPackage[] {
    const packages: NuGetPackage[] = [];

    if (!output || output.trim() === '') {
      return packages;
    }

    try {
      const result = JSON.parse(output);

      if (!result.projects || !Array.isArray(result.projects) || result.projects.length === 0) {
        return packages;
      }

      for (const project of result.projects) {
        if (!project.frameworks || !Array.isArray(project.frameworks)) {
          continue;
        }

        for (const framework of project.frameworks) {
          const frameworkName = framework.framework || 'unknown';

          // Process top-level packages
          if (framework.topLevelPackages && Array.isArray(framework.topLevelPackages)) {
            for (const pkg of framework.topLevelPackages) {
              if (!pkg.id) continue;

              packages.push({
                id: pkg.id,
                version: pkg.requestedVersion || pkg.resolvedVersion || 'unknown',
                resolved: pkg.resolvedVersion,
                isTransitive: false,
                depth: 0,
                framework: frameworkName
              });
            }
          }

          // Process transitive packages
          if (framework.transitivePackages && Array.isArray(framework.transitivePackages)) {
            for (const pkg of framework.transitivePackages) {
              if (!pkg.id) continue;

              packages.push({
                id: pkg.id,
                version: pkg.resolvedVersion || 'unknown',
                resolved: pkg.resolvedVersion,
                isTransitive: true,
                depth: 1,
                framework: frameworkName
              });
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse dotnet CLI JSON output: ${error}. Output was: ${output.substring(0, 200)}...`);
    }

    return packages;
  }

  private parseTableOutput(output: string): NuGetPackage[] {
    const packages: NuGetPackage[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('>')) {
        // Parse package line format: "> PackageName    Version    ResolvedVersion"
        const parts = trimmed.substring(1).trim().split(/\s+/);
        if (parts.length >= 2 && parts[0] && parts[1]) {
          packages.push({
            id: parts[0],
            version: parts[1],
            resolved: parts[2] || parts[1],
            isTransitive: false,
            depth: 0
          });
        }
      }
    }

    return packages;
  }

  private parseVulnerablePackagesOutput(output: string): NuGetPackage[] {
    const packages: NuGetPackage[] = [];

    if (!output || output.trim() === '') {
      return packages;
    }

    try {
      const result = JSON.parse(output);

      if (!result.projects || !Array.isArray(result.projects) || result.projects.length === 0) {
        return packages;
      }

      for (const project of result.projects) {
        if (!project.frameworks || !Array.isArray(project.frameworks)) {
          continue;
        }

        for (const framework of project.frameworks) {
          const frameworkName = framework.framework || 'unknown';

          if (!framework.vulnerablePackages || !Array.isArray(framework.vulnerablePackages)) {
            continue;
          }

          for (const vulnPkg of framework.vulnerablePackages) {
            if (!vulnPkg.id) continue;

            const pkg: NuGetPackage = {
              id: vulnPkg.id,
              version: vulnPkg.resolvedVersion || vulnPkg.requestedVersion || 'unknown',
              resolved: vulnPkg.resolvedVersion,
              isTransitive: vulnPkg.isTransitive || false,
              depth: vulnPkg.isTransitive ? 1 : 0,
              framework: frameworkName,
              vulnerabilities: []
            };

            if (vulnPkg.vulnerabilities && Array.isArray(vulnPkg.vulnerabilities)) {
              pkg.vulnerabilities = vulnPkg.vulnerabilities
                .map((v: unknown) => {
                  const vuln = v as Record<string, unknown>;

                  // Validate required fields
                  if (!vuln || typeof vuln !== 'object') {
                    return null;
                  }

                  const severity = this.normalizeSeverity(vuln['severity'] as string);

                  return {
                    id:
                      (vuln['advisoryUrl'] as string) ||
                      (vuln['id'] as string) ||
                      `vuln-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    severity,
                    title: (vuln['title'] as string) || 'Unknown vulnerability',
                    description: vuln['description'] as string,
                    advisoryUrl: vuln['advisoryUrl'] as string,
                    cve: this.extractCveIds(vuln['cve']),
                    publishedDate: vuln['publishedDate'] as string,
                    lastModified: vuln['lastModified'] as string
                  };
                })
                .filter((v: unknown) => v !== null) as Vulnerability[];
            }

            packages.push(pkg);
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to parse vulnerable packages JSON output: ${error}. Output was: ${output.substring(0, 200)}...`
      );
    }

    return packages;
  }

  /**
   * Normalize severity values to match our expected enum
   */
  private normalizeSeverity(severity: string): 'Critical' | 'High' | 'Moderate' | 'Low' {
    if (!severity || typeof severity !== 'string') {
      return 'Low';
    }

    const normalized = severity.toLowerCase().trim();
    switch (normalized) {
      case 'critical':
        return 'Critical';
      case 'high':
        return 'High';
      case 'moderate':
      case 'medium':
        return 'Moderate';
      case 'low':
        return 'Low';
      default:
        return 'Low';
    }
  }

  /**
   * Extract CVE IDs from various formats
   */
  private extractCveIds(cveData: unknown): string[] {
    if (!cveData) {
      return [];
    }

    if (typeof cveData === 'string') {
      return [cveData];
    }

    if (Array.isArray(cveData)) {
      return cveData.filter(item => typeof item === 'string' && item.trim() !== '').map(item => item.trim());
    }

    return [];
  }

  /**
   * Create a standardized DotNetCliError
   */
  private createDotNetError(
    code: string,
    userMessage: string,
    technicalDetails?: string,
    category: 'validation' | 'analysis' | 'visualization' | 'system' = 'system',
    recoverable: boolean = true
  ): DotNetCliError {
    return new DotNetCliError(code, userMessage, technicalDetails, category, recoverable);
  }

  /**
   * Check if an error is a command not found error
   */
  private isCommandNotFoundError(error: unknown): boolean {
    if (!error) return false;

    const errorStr = String(error).toLowerCase();
    return (
      errorStr.includes('command not found') ||
      errorStr.includes('is not recognized') ||
      errorStr.includes('not found') ||
      errorStr.includes('enoent') ||
      errorStr.includes('spawn dotnet')
    );
  }

  /**
   * Check if an error is a timeout error
   */
  private isTimeoutError(error: unknown): boolean {
    if (!error) return false;

    const errorStr = String(error).toLowerCase();
    return errorStr.includes('timeout') || errorStr.includes('timed out') || errorStr.includes('etimedout');
  }

  /**
   * Check if an error is a network-related error
   */
  private isNetworkError(error: unknown): boolean {
    if (!error) return false;

    const errorStr = String(error).toLowerCase();
    return (
      errorStr.includes('network') ||
      errorStr.includes('connection') ||
      errorStr.includes('dns') ||
      errorStr.includes('enotfound') ||
      errorStr.includes('econnrefused') ||
      errorStr.includes('econnreset') ||
      errorStr.includes('unable to load the service index')
    );
  }

  /**
   * Handle specific errors from dotnet list package command
   */
  private handleListPackagesError(result: CommandResult, projectPath: string): never {
    const stderr = result.stderr || '';
    const stdout = result.stdout || '';
    const combinedOutput = `${stderr} ${stdout}`.toLowerCase();

    // Project not found
    if (combinedOutput.includes('could not find project') || combinedOutput.includes('project file does not exist')) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PROJECT_NOT_FOUND,
        `Project file not found: ${projectPath}. Please ensure the project file exists and is accessible.`,
        `Command output: ${stderr || stdout}`,
        'validation',
        false
      );
    }

    // Invalid project file
    if (
      combinedOutput.includes('invalid project') ||
      combinedOutput.includes('malformed') ||
      combinedOutput.includes('xml')
    ) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PROJECT_INVALID,
        `Invalid or corrupted project file: ${projectPath}. Please check the project file format.`,
        `Command output: ${stderr || stdout}`,
        'validation',
        true
      );
    }

    // Permission denied
    if (
      combinedOutput.includes('access denied') ||
      combinedOutput.includes('permission denied') ||
      combinedOutput.includes('unauthorized')
    ) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PERMISSION_DENIED,
        `Permission denied accessing project: ${projectPath}. Please check file permissions.`,
        `Command output: ${stderr || stdout}`,
        'system',
        true
      );
    }

    // Network issues
    if (this.isNetworkError(combinedOutput)) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.NETWORK_ERROR,
        'Network error while listing packages. Please check your internet connection and package sources.',
        `Command output: ${stderr || stdout}`,
        'system',
        true
      );
    }

    // Generic failure
    throw this.createDotNetError(
      DotNetCliErrorCodes.LIST_PACKAGES_FAILED,
      'Failed to list packages. Please ensure the project is valid and the .NET SDK is properly configured.',
      `Exit code: ${result.exitCode}, Output: ${stderr || stdout}`,
      'analysis',
      true
    );
  }

  /**
   * Handle specific errors from vulnerability scanning
   */
  private handleVulnerabilityScanError(result: CommandResult, projectPath: string): NuGetPackage[] {
    const stderr = result.stderr || '';
    const stdout = result.stdout || '';
    const combinedOutput = `${stderr} ${stdout}`.toLowerCase();

    // Check if it's a "no vulnerabilities found" case vs actual error
    if (
      combinedOutput.includes('no vulnerable packages found') ||
      combinedOutput.includes('no vulnerabilities found') ||
      combinedOutput.includes('no packages with known vulnerabilities')
    ) {
      return [];
    }

    // Project not found
    if (combinedOutput.includes('could not find project') || combinedOutput.includes('project file does not exist')) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PROJECT_NOT_FOUND,
        `Project file not found: ${projectPath}. Please ensure the project file exists and is accessible.`,
        `Command output: ${stderr || stdout}`,
        'validation',
        false
      );
    }

    // Network issues during vulnerability scan
    if (this.isNetworkError(combinedOutput)) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.NETWORK_ERROR,
        'Network error during vulnerability scan. Please check your internet connection and try again.',
        `Command output: ${stderr || stdout}`,
        'system',
        true
      );
    }

    // Permission denied
    if (combinedOutput.includes('access denied') || combinedOutput.includes('permission denied')) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PERMISSION_DENIED,
        `Permission denied accessing project: ${projectPath}. Please check file permissions.`,
        `Command output: ${stderr || stdout}`,
        'system',
        true
      );
    }

    // Generic vulnerability scan failure
    throw this.createDotNetError(
      DotNetCliErrorCodes.VULNERABILITY_SCAN_FAILED,
      'Failed to scan for vulnerabilities. Please ensure the project is valid and try again.',
      `Exit code: ${result.exitCode}, Output: ${stderr || stdout}`,
      'analysis',
      true
    );
  }

  /**
   * Handle specific errors from dotnet restore command
   */
  private handleRestoreError(result: CommandResult, projectPath: string): never {
    const stderr = result.stderr || '';
    const stdout = result.stdout || '';
    const combinedOutput = `${stderr} ${stdout}`.toLowerCase();

    // Project not found
    if (combinedOutput.includes('could not find project') || combinedOutput.includes('project file does not exist')) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PROJECT_NOT_FOUND,
        `Project file not found: ${projectPath}. Please ensure the project file exists and is accessible.`,
        `Command output: ${stderr || stdout}`,
        'validation',
        false
      );
    }

    // Invalid project file
    if (
      combinedOutput.includes('invalid project') ||
      combinedOutput.includes('malformed') ||
      combinedOutput.includes('xml')
    ) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PROJECT_INVALID,
        `Invalid or corrupted project file: ${projectPath}. Please check the project file format.`,
        `Command output: ${stderr || stdout}`,
        'validation',
        true
      );
    }

    // Network issues during restore
    if (this.isNetworkError(combinedOutput)) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.NETWORK_ERROR,
        'Network error during package restore. Please check your internet connection and package sources.',
        `Command output: ${stderr || stdout}`,
        'system',
        true
      );
    }

    // Permission denied
    if (combinedOutput.includes('access denied') || combinedOutput.includes('permission denied')) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.PERMISSION_DENIED,
        `Permission denied during package restore: ${projectPath}. Please check file permissions.`,
        `Command output: ${stderr || stdout}`,
        'system',
        true
      );
    }

    // Package source issues
    if (combinedOutput.includes('unable to load the service index') || combinedOutput.includes('package source')) {
      throw this.createDotNetError(
        DotNetCliErrorCodes.NETWORK_ERROR,
        'Unable to access package sources. Please check your NuGet configuration and internet connection.',
        `Command output: ${stderr || stdout}`,
        'system',
        true
      );
    }

    // Generic restore failure
    throw this.createDotNetError(
      DotNetCliErrorCodes.RESTORE_FAILED,
      'Failed to restore packages. Please ensure the project file is valid and package sources are accessible.',
      `Exit code: ${result.exitCode}, Output: ${stderr || stdout}`,
      'analysis',
      true
    );
  }
}
