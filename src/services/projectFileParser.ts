import * as fs from 'fs';
import * as path from 'path';
import * as xml2js from 'xml2js';
import { IProjectFileParser, NuGetPackage, ProjectValidationResult, ExtensionError } from '../types/dependency';

/**
 * Specific error types for project file operations
 */
export class ProjectFileError extends Error implements ExtensionError {
  public readonly code: string;
  public readonly category: 'validation' | 'analysis' | 'visualization' | 'system';
  public readonly recoverable: boolean;
  public readonly userMessage: string;
  public readonly technicalDetails?: string | undefined;

  constructor(
    code: string,
    userMessage: string,
    technicalDetails?: string | undefined,
    category: 'validation' | 'analysis' | 'visualization' | 'system' = 'validation',
    recoverable: boolean = true
  ) {
    super(userMessage);
    this.name = 'ProjectFileError';
    this.code = code;
    this.category = category;
    this.recoverable = recoverable;
    this.userMessage = userMessage;
    this.technicalDetails = technicalDetails;
  }
}

/**
 * Error codes for different project file failure scenarios
 */
export const ProjectFileErrorCodes = {
  FILE_NOT_FOUND: 'PROJECT_FILE_NOT_FOUND',
  FILE_NOT_READABLE: 'PROJECT_FILE_NOT_READABLE',
  FILE_EMPTY: 'PROJECT_FILE_EMPTY',
  FILE_TOO_LARGE: 'PROJECT_FILE_TOO_LARGE',
  INVALID_XML: 'PROJECT_FILE_INVALID_XML',
  INVALID_FORMAT: 'PROJECT_FILE_INVALID_FORMAT',
  UNSUPPORTED_TYPE: 'PROJECT_FILE_UNSUPPORTED_TYPE',
  CORRUPTED: 'PROJECT_FILE_CORRUPTED',
  PERMISSION_DENIED: 'PROJECT_FILE_PERMISSION_DENIED',
  ENCODING_ERROR: 'PROJECT_FILE_ENCODING_ERROR',
  PACKAGES_CONFIG_ERROR: 'PACKAGES_CONFIG_ERROR'
} as const;

export class ProjectFileParser implements IProjectFileParser {
  private readonly xmlParserOptions = {
    explicitArray: true,
    ignoreAttrs: false,
    mergeAttrs: false,
    explicitCharkey: false,
    charkey: '_',
    explicitRoot: true,
    normalize: true,
    normalizeTags: false,
    trim: true
  };

  async parseProjectFile(projectPath: string): Promise<NuGetPackage[]> {
    try {
      // Comprehensive validation with detailed error handling
      await this.validateFileAccessWithDetails(projectPath);

      const projectContent = await this.readProjectFileWithValidation(projectPath);
      const result = await this.parseXmlWithErrorHandling(projectContent, projectPath);

      const packages: NuGetPackage[] = [];
      const validation = await this.validateProjectFile(projectPath);

      // Handle different project file formats with error recovery
      if (this.isModernProjectFormat(result)) {
        packages.push(...(await this.parseModernProjectFile(result, validation.frameworks)));
      } else if (this.isLegacyProjectFormat(result)) {
        packages.push(...(await this.parseLegacyProjectFile(result, projectPath)));
      } else {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.UNSUPPORTED_TYPE,
          `Unsupported project file format: ${path.basename(
            projectPath
          )}. Please ensure this is a valid .NET project file.`,
          'Project file does not match known .NET project formats (SDK-style or legacy)',
          'validation',
          false
        );
      }

      // Also check for packages.config if it's a legacy project
      if (validation.projectType === 'dotnet-framework') {
        try {
          const packagesConfigPath = path.join(path.dirname(projectPath), 'packages.config');
          const configPackages = await this.parsePackagesConfig(packagesConfigPath);
          packages.push(...configPackages);
        } catch (configError) {
          // packages.config parsing failed, but we can continue with project file packages
        }
      }

      return this.deduplicatePackages(packages);
    } catch (error) {
      if (error instanceof ProjectFileError) {
        throw error;
      }

      // Wrap unknown errors in our error type
      throw this.createProjectFileError(
        ProjectFileErrorCodes.CORRUPTED,
        `Failed to parse project file: ${path.basename(
          projectPath
        )}. The file may be corrupted or in an unsupported format.`,
        `Unexpected error: ${error}`,
        'validation',
        true
      );
    }
  }

  /**
   * Parse modern SDK-style project files (.NET Core, .NET 5+)
   */
  private async parseModernProjectFile(projectXml: any, frameworks: string[]): Promise<NuGetPackage[]> {
    const packages: NuGetPackage[] = [];

    if (!projectXml.Project || !projectXml.Project.ItemGroup) {
      return packages;
    }

    const itemGroups = Array.isArray(projectXml.Project.ItemGroup)
      ? projectXml.Project.ItemGroup
      : [projectXml.Project.ItemGroup];

    for (const itemGroup of itemGroups) {
      if (!itemGroup.PackageReference) continue;

      const packageRefs = Array.isArray(itemGroup.PackageReference)
        ? itemGroup.PackageReference
        : [itemGroup.PackageReference];

      for (const packageRef of packageRefs) {
        const pkg = this.parsePackageReference(packageRef, frameworks);
        if (pkg) {
          packages.push(pkg);
        }
      }
    }

    return packages;
  }

  /**
   * Parse legacy project files (.NET Framework)
   */
  private async parseLegacyProjectFile(projectXml: any, _projectPath: string): Promise<NuGetPackage[]> {
    const packages: NuGetPackage[] = [];

    // Legacy projects typically use packages.config, but may also have PackageReference
    if (projectXml.Project && projectXml.Project.ItemGroup) {
      const itemGroups = Array.isArray(projectXml.Project.ItemGroup)
        ? projectXml.Project.ItemGroup
        : [projectXml.Project.ItemGroup];

      for (const itemGroup of itemGroups) {
        if (itemGroup.PackageReference) {
          const packageRefs = Array.isArray(itemGroup.PackageReference)
            ? itemGroup.PackageReference
            : [itemGroup.PackageReference];

          for (const packageRef of packageRefs) {
            const pkg = this.parsePackageReference(packageRef, ['net48']); // Default framework for legacy
            if (pkg) {
              packages.push(pkg);
            }
          }
        }

        // Also check for Reference elements that might point to NuGet packages
        if (itemGroup.Reference) {
          const references = Array.isArray(itemGroup.Reference) ? itemGroup.Reference : [itemGroup.Reference];

          for (const reference of references) {
            const pkg = this.parseReference(reference);
            if (pkg) {
              packages.push(pkg);
            }
          }
        }
      }
    }

    return packages;
  }

  /**
   * Parse a PackageReference element
   */
  private parsePackageReference(packageRef: any, frameworks: string[]): NuGetPackage | null {
    if (!packageRef.$ || !packageRef.$.Include) {
      return null;
    }

    const id = packageRef.$.Include;
    let version = packageRef.$.Version;

    // Version might be in a child element for some formats
    if (!version && packageRef.Version && packageRef.Version.length > 0) {
      version = packageRef.Version[0];
    }

    if (!version) {
      // Skip packages without version (might be implicitly versioned)
      return null;
    }

    return {
      id,
      version,
      resolved: version,
      isTransitive: false,
      depth: 0,
      framework: frameworks.length > 0 ? frameworks[0] : undefined,
      source: 'project-file'
    };
  }

  /**
   * Parse a Reference element (legacy format)
   */
  private parseReference(reference: any): NuGetPackage | null {
    if (!reference.$ || !reference.$.Include) {
      return null;
    }

    // Check if this looks like a NuGet package reference
    // NuGet packages typically have HintPath pointing to packages folder
    if (reference.HintPath && reference.HintPath.length > 0) {
      const hintPath = reference.HintPath[0];
      const packagesMatch = hintPath.match(/packages[\\\/]([^\\\/]+)\.[0-9]/);

      if (packagesMatch) {
        const packageId = packagesMatch[1];
        const versionMatch = hintPath.match(/\.([0-9]+(?:\.[0-9]+)*(?:-[a-zA-Z0-9-]+)?)[\\\/]/);
        const version = versionMatch ? versionMatch[1] : 'unknown';

        return {
          id: packageId,
          version,
          resolved: version,
          isTransitive: false,
          depth: 0,
          source: 'project-file'
        };
      }
    }

    return null;
  }

  /**
   * Check if this is a modern SDK-style project
   */
  private isModernProjectFormat(projectXml: any): boolean {
    if (!projectXml.Project || !projectXml.Project.$) {
      return false;
    }

    // Modern projects have Sdk attribute
    return !!projectXml.Project.$.Sdk;
  }

  /**
   * Check if this is a legacy project format
   */
  private isLegacyProjectFormat(projectXml: unknown): boolean {
    const xml = projectXml as any;
    if (!xml.Project) {
      return false;
    }

    // Legacy projects don't have Sdk attribute but have xmlns
    return !xml.Project.$.Sdk && (xml.Project.$.xmlns || xml.Project.$['xmlns:xsi']);
  }

  /**
   * Remove duplicate packages (same ID and version)
   */
  private deduplicatePackages(packages: NuGetPackage[]): NuGetPackage[] {
    const seen = new Set<string>();
    const result: NuGetPackage[] = [];

    for (const pkg of packages) {
      const key = `${pkg.id}@${pkg.version}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(pkg);
      }
    }

    return result;
  }

  /**
   * Validate file access
   */
  private async validateFileAccess(filePath: string): Promise<void> {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`Cannot read file ${filePath}: ${error}`);
    }
  }

  async validateProjectFile(projectPath: string): Promise<ProjectValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if file exists and is accessible
      await this.validateFileAccess(projectPath);
    } catch (error) {
      errors.push(`Project file not found or not accessible: ${projectPath} - ${error}`);
      return {
        isValid: false,
        errors,
        warnings,
        projectType: 'unknown',
        frameworks: []
      };
    }

    // Check file extension
    const supportedExtensions = ['.csproj', '.vbproj', '.fsproj'];
    const hasValidExtension = supportedExtensions.some(ext => projectPath.toLowerCase().endsWith(ext));

    if (!hasValidExtension) {
      errors.push(`Unsupported project file type. Supported extensions: ${supportedExtensions.join(', ')}`);
    }

    try {
      const projectContent = await fs.promises.readFile(projectPath, 'utf8');

      // Check for empty or very small files
      if (projectContent.trim().length < 10) {
        errors.push('Project file appears to be empty or corrupted');
        return {
          isValid: false,
          errors,
          warnings,
          projectType: 'unknown',
          frameworks: []
        };
      }

      const parser = new xml2js.Parser(this.xmlParserOptions);
      const result = await parser.parseStringPromise(projectContent);

      if (!result.Project) {
        errors.push('Invalid project file format: missing Project element');
        return {
          isValid: false,
          errors,
          warnings,
          projectType: 'unknown',
          frameworks: []
        };
      }

      // Determine project type and frameworks
      const frameworks: string[] = [];
      let projectType: 'dotnet-core' | 'dotnet-framework' | 'dotnet-5+' | 'unknown' = 'unknown';

      // Check if it's a modern SDK-style project
      if (this.isModernProjectFormat(result)) {
        projectType = 'dotnet-core'; // Default, will be refined below
      } else if (this.isLegacyProjectFormat(result)) {
        projectType = 'dotnet-framework';
      }

      if (result.Project.PropertyGroup) {
        const propertyGroups = Array.isArray(result.Project.PropertyGroup)
          ? result.Project.PropertyGroup
          : [result.Project.PropertyGroup];

        for (const propGroup of propertyGroups) {
          // Handle TargetFramework (single framework)
          if (propGroup.TargetFramework) {
            const framework = Array.isArray(propGroup.TargetFramework)
              ? propGroup.TargetFramework[0]
              : propGroup.TargetFramework;
            if (framework && typeof framework === 'string') {
              frameworks.push(framework.trim());
            }
          }

          // Handle TargetFrameworks (multiple frameworks)
          if (propGroup.TargetFrameworks) {
            const frameworksStr = Array.isArray(propGroup.TargetFrameworks)
              ? propGroup.TargetFrameworks[0]
              : propGroup.TargetFrameworks;
            if (frameworksStr && typeof frameworksStr === 'string') {
              const multipleFrameworks = frameworksStr
                .split(';')
                .map(f => f.trim())
                .filter(f => f.length > 0);
              frameworks.push(...multipleFrameworks);
            }
          }
        }

        // Refine project type based on frameworks
        if (frameworks.length > 0) {
          if (
            frameworks.some(
              f =>
                f.startsWith('net5') ||
                f.startsWith('net6') ||
                f.startsWith('net7') ||
                f.startsWith('net8') ||
                f.startsWith('net9')
            )
          ) {
            projectType = 'dotnet-5+';
          } else if (frameworks.some(f => f.startsWith('netcoreapp') || f.startsWith('netstandard'))) {
            projectType = 'dotnet-core';
          } else if (frameworks.some(f => f.startsWith('net4') || f.startsWith('net3') || f.startsWith('net2'))) {
            projectType = 'dotnet-framework';
          }
        }
      }

      // Validation warnings
      if (frameworks.length === 0) {
        warnings.push('No target framework specified in project file');
      }

      if (frameworks.length > 5) {
        warnings.push(`Large number of target frameworks (${frameworks.length}) may impact performance`);
      }

      // Check for common issues
      if (projectType === 'unknown' && frameworks.length > 0) {
        warnings.push('Could not determine project type despite having target frameworks');
      }

      // Remove duplicate frameworks
      const uniqueFrameworks = [...new Set(frameworks)];

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        projectType,
        frameworks: uniqueFrameworks
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

  async getSupportedFrameworks(projectPath: string): Promise<string[]> {
    const validation = await this.validateProjectFile(projectPath);
    return validation.frameworks;
  }

  async parsePackagesConfig(configPath: string): Promise<NuGetPackage[]> {
    try {
      // Check if file exists
      try {
        await fs.promises.access(configPath, fs.constants.R_OK);
      } catch {
        // File doesn't exist or isn't readable, return empty array
        return [];
      }

      const configContent = await this.readProjectFileWithValidation(configPath);
      const result = await this.parseXmlWithErrorHandling(configContent, configPath);

      const packages: NuGetPackage[] = [];

      if (result.packages && result.packages.package) {
        const packageElements = Array.isArray(result.packages.package)
          ? result.packages.package
          : [result.packages.package];

        for (const pkg of packageElements) {
          if (!pkg.$ || !pkg.$.id || !pkg.$.version) {
            continue; // Skip invalid package entries
          }

          const { id, version, targetFramework, developmentDependency } = pkg.$;

          packages.push({
            id,
            version,
            resolved: version,
            framework: targetFramework || undefined,
            isTransitive: false,
            depth: 0,
            source: 'packages-config',
            // Mark development dependencies if specified
            ...(developmentDependency === 'true' && { isDevelopmentDependency: true })
          });
        }
      }

      return packages;
    } catch (error) {
      if (error instanceof ProjectFileError) {
        throw error;
      }

      throw this.createProjectFileError(
        ProjectFileErrorCodes.PACKAGES_CONFIG_ERROR,
        `Failed to parse packages.config file: ${path.basename(
          configPath
        )}. The file may be corrupted or in an invalid format.`,
        `Error details: ${error}`,
        'validation',
        true
      );
    }
  }

  /**
   * Enhanced file access validation with detailed error messages
   */
  private async validateFileAccessWithDetails(filePath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);

      // Check if it's actually a file
      if (!stats.isFile()) {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.INVALID_FORMAT,
          `Path is not a file: ${path.basename(filePath)}. Please select a valid project file.`,
          `Path points to a directory or other non-file entity: ${filePath}`,
          'validation',
          false
        );
      }

      // Check file size (warn if too large, error if extremely large)
      const maxSize = 50 * 1024 * 1024; // 50MB
      const warnSize = 5 * 1024 * 1024; // 5MB

      if (stats.size > maxSize) {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.FILE_TOO_LARGE,
          `Project file is too large to process: ${path.basename(filePath)} (${Math.round(
            stats.size / 1024 / 1024
          )}MB). Maximum supported size is 50MB.`,
          `File size: ${stats.size} bytes, Max size: ${maxSize} bytes`,
          'validation',
          false
        );
      }

      if (stats.size > warnSize) {
      }

      // Check if file is empty
      if (stats.size === 0) {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.FILE_EMPTY,
          `Project file is empty: ${path.basename(filePath)}. Please ensure the file contains valid project content.`,
          'File size is 0 bytes',
          'validation',
          true
        );
      }

      // Check read permissions
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (error) {
      if (error instanceof ProjectFileError) {
        throw error;
      }

      // Handle specific file system errors
      const fsError = error as any;
      if (fsError.code === 'ENOENT') {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.FILE_NOT_FOUND,
          `Project file not found: ${path.basename(filePath)}. Please ensure the file exists and the path is correct.`,
          `File path: ${filePath}`,
          'validation',
          false
        );
      }

      if (fsError.code === 'EACCES' || fsError.code === 'EPERM') {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.PERMISSION_DENIED,
          `Permission denied accessing project file: ${path.basename(filePath)}. Please check file permissions.`,
          `Error code: ${fsError.code}, Path: ${filePath}`,
          'system',
          true
        );
      }

      throw this.createProjectFileError(
        ProjectFileErrorCodes.FILE_NOT_READABLE,
        `Cannot access project file: ${path.basename(filePath)}. Please ensure the file is accessible.`,
        `File system error: ${error}`,
        'system',
        true
      );
    }
  }

  /**
   * Read project file with validation and encoding detection
   */
  private async readProjectFileWithValidation(filePath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');

      // Check for empty content
      if (content.trim().length === 0) {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.FILE_EMPTY,
          `Project file is empty: ${path.basename(filePath)}. Please ensure the file contains valid project content.`,
          'File content is empty after trimming whitespace',
          'validation',
          true
        );
      }

      // Check for minimum viable content
      if (content.trim().length < 10) {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.CORRUPTED,
          `Project file appears to be corrupted or incomplete: ${path.basename(
            filePath
          )}. The file is too small to contain valid project data.`,
          `Content length: ${content.trim().length} characters`,
          'validation',
          true
        );
      }

      // Basic XML structure check
      if (!content.includes('<Project') && !content.includes('<project')) {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.INVALID_FORMAT,
          `File does not appear to be a valid .NET project file: ${path.basename(
            filePath
          )}. Missing required Project element.`,
          'Content does not contain <Project> element',
          'validation',
          false
        );
      }

      return content;
    } catch (error) {
      if (error instanceof ProjectFileError) {
        throw error;
      }

      // Handle encoding errors
      const fsError = error as any;
      if (fsError.code === 'EILSEQ' || fsError.message.includes('invalid byte sequence')) {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.ENCODING_ERROR,
          `Project file has invalid encoding: ${path.basename(
            filePath
          )}. Please ensure the file is saved with UTF-8 encoding.`,
          `Encoding error: ${error}`,
          'validation',
          true
        );
      }

      throw this.createProjectFileError(
        ProjectFileErrorCodes.FILE_NOT_READABLE,
        `Failed to read project file: ${path.basename(filePath)}. The file may be locked or corrupted.`,
        `Read error: ${fsError}`,
        'system',
        true
      );
    }
  }

  /**
   * Parse XML with comprehensive error handling
   */
  private async parseXmlWithErrorHandling(content: string, filePath: string): Promise<any> {
    try {
      const parser = new xml2js.Parser(this.xmlParserOptions);
      const result = await parser.parseStringPromise(content);

      // Validate basic structure
      if (!result || typeof result !== 'object') {
        throw this.createProjectFileError(
          ProjectFileErrorCodes.INVALID_XML,
          `Invalid XML structure in project file: ${path.basename(
            filePath
          )}. The file could not be parsed as valid XML.`,
          'Parsed result is not a valid object',
          'validation',
          true
        );
      }

      return result;
    } catch (error) {
      if (error instanceof ProjectFileError) {
        throw error;
      }

      // Handle XML parsing errors
      const parseError = error as any;
      if (parseError.message && parseError.message.includes('XML')) {
        const suggestions = this.generateXmlErrorSuggestions(parseError.message);
        throw this.createProjectFileError(
          ProjectFileErrorCodes.INVALID_XML,
          `Invalid XML in project file: ${path.basename(filePath)}. ${suggestions.userMessage}`,
          `XML parsing error: ${parseError.message}. Suggestions: ${suggestions.technicalDetails}`,
          'validation',
          true
        );
      }

      throw this.createProjectFileError(
        ProjectFileErrorCodes.CORRUPTED,
        `Failed to parse project file: ${path.basename(
          filePath
        )}. The file may be corrupted or in an unsupported format.`,
        `Parsing error: ${parseError}`,
        'validation',
        true
      );
    }
  }

  /**
   * Generate helpful suggestions for XML parsing errors
   */
  private generateXmlErrorSuggestions(errorMessage: string): { userMessage: string; technicalDetails: string } {
    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes('unclosed') || lowerError.includes('end tag')) {
      return {
        userMessage: 'Please check for unclosed XML tags in your project file.',
        technicalDetails: 'Look for missing closing tags like </PropertyGroup> or </ItemGroup>'
      };
    }

    if (lowerError.includes('attribute') || lowerError.includes('quote')) {
      return {
        userMessage: 'Please check for unquoted or malformed attributes in your project file.',
        technicalDetails: 'Ensure all attribute values are properly quoted, e.g., Include="PackageName"'
      };
    }

    if (lowerError.includes('encoding')) {
      return {
        userMessage: 'Please save your project file with UTF-8 encoding.',
        technicalDetails: 'The file may contain invalid characters or be saved with an unsupported encoding'
      };
    }

    if (lowerError.includes('prolog') || lowerError.includes('declaration')) {
      return {
        userMessage: 'Please check the XML declaration at the top of your project file.',
        technicalDetails: 'Remove or fix any content before the <?xml declaration or <Project> element'
      };
    }

    return {
      userMessage: 'Please check your project file for XML syntax errors.',
      technicalDetails: 'Use an XML validator or IDE to identify and fix syntax issues'
    };
  }

  /**
   * Create a standardized ProjectFileError
   */
  private createProjectFileError(
    code: string,
    userMessage: string,
    technicalDetails?: string,
    category: 'validation' | 'analysis' | 'visualization' | 'system' = 'validation',
    recoverable: boolean = true
  ): ProjectFileError {
    return new ProjectFileError(code, userMessage, technicalDetails, category, recoverable);
  }
}
