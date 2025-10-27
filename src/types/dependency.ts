// Core data models
export interface NuGetPackage {
  id: string;
  version: string;
  resolved?: string | undefined;
  dependencies?: NuGetPackage[] | undefined;
  vulnerabilities?: Vulnerability[] | undefined;
  isTransitive?: boolean | undefined;
  depth?: number | undefined;
  framework?: string | undefined;
  source?: string | undefined;
  isDevelopmentDependency?: boolean | undefined;
}

export interface Vulnerability {
  id: string;
  severity: 'Low' | 'Moderate' | 'High' | 'Critical';
  title: string;
  description?: string | undefined;
  advisoryUrl?: string | undefined;
  cve?: string[] | undefined;
  publishedDate?: string | undefined;
  lastModified?: string | undefined;
}

export interface VulnerabilityInfo {
  packageName: string;
  packageVersion: string;
  severity: string;
  title: string;
  description?: string | undefined;
  advisoryUrl?: string | undefined;
}

export interface GraphNode {
  id: string;
  name: string;
  version: string;
  group?: string;
  val?: number;
  color?: string;
  vulnerabilities?: Vulnerability[] | undefined;
  isRoot?: boolean;
  depth?: number;
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value?: number;
  color?: string;
  distance?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface DependencyAnalysisResult {
  projectName: string;
  projectPath: string;
  packages: NuGetPackage[];
  graphData: GraphData;
  vulnerabilityCount: VulnerabilityCount;
  analysisMetadata: AnalysisMetadata;
}

export interface VulnerabilityCount {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  total: number;
}

export interface AnalysisMetadata {
  timestamp: Date;
  analysisMethod: 'dotnet-cli' | 'project-file' | 'hybrid' | 'mock';
  framework?: string | undefined;
  sdkVersion?: string | undefined;
  hasTransitiveDependencies: boolean;
  hasVulnerabilityData: boolean;
}

// Service contract interfaces
export interface INuGetDependencyProvider {
  getDependencies(projectPath: string): Promise<DependencyAnalysisResult>;
  getDependenciesWithVulnerabilities(
    projectPath: string
  ): Promise<DependencyAnalysisResult>;
  getFullDependencyGraph(
    projectPath: string
  ): Promise<DependencyAnalysisResult>;
  validateProject(projectPath: string): Promise<ProjectValidationResult>;
  refreshCache(projectPath: string): Promise<void>;
}

export interface IWebviewManager {
  showDependencyGraph(
    data: DependencyAnalysisResult,
    mode: VisualizationMode
  ): Promise<void>;
  dispose(): void;
}

export interface IDotNetCliService {
  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string>;
  listPackages(
    projectPath: string,
    options?: ListPackagesOptions
  ): Promise<NuGetPackage[]>;
  listVulnerablePackages(
    projectPath: string,
    options?: CommandExecutionOptions
  ): Promise<NuGetPackage[]>;
  restorePackages(
    projectPath: string,
    options?: CommandExecutionOptions
  ): Promise<void>;
  getPackageDetails(
    projectPath: string,
    packageId: string,
    options?: CommandExecutionOptions
  ): Promise<NuGetPackage | null>;
}

export interface IVulnerabilityScanner {
  scanProject(
    projectPath: string,
    options?: CommandExecutionOptions
  ): Promise<VulnerabilityScanResult>;
  getCachedResults(
    projectPath: string
  ): Promise<VulnerabilityScanResult | null>;
  clearCache(projectPath: string): Promise<void>;
  scanProjectOffline(projectPath: string): Promise<VulnerabilityScanResult>;
  getVulnerabilityStats(projectPath: string): Promise<VulnerabilityCount>;
  hasVulnerabilityData(projectPath: string): Promise<boolean>;
  refreshVulnerabilityData(
    projectPath: string,
    options?: CommandExecutionOptions
  ): Promise<VulnerabilityScanResult>;
}

// Configuration and options interfaces
export interface ListPackagesOptions {
  includeTransitive?: boolean;
  framework?: string;
  source?: string;
  format?: 'json' | 'table';
}

export interface ProjectValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  projectType: 'dotnet-core' | 'dotnet-framework' | 'dotnet-5+' | 'unknown';
  frameworks: string[];
}

export interface VulnerabilityScanResult {
  packages: NuGetPackage[];
  vulnerabilityCount: VulnerabilityCount;
  scanTimestamp: Date;
  source: 'dotnet-cli' | 'nuget-api' | 'cache';
  error?: string;
}

export interface ExtensionConfiguration {
  cacheTimeout: number;
  maxGraphNodes: number;
  enableOfflineMode: boolean;
  preferredAnalysisMethod: 'dotnet-cli' | 'project-file' | 'auto';
  vulnerabilityScanEnabled: boolean;
}

// Visualization types
export type VisualizationMode = 'dependencies' | 'vulnerabilities' | 'full';

export interface GraphVisualizationOptions {
  mode: VisualizationMode;
  showTransitive: boolean;
  colorScheme: 'default' | 'vulnerability' | 'depth';
  layout: 'force' | 'dag' | 'radial';
  physics: boolean;
}

// Error handling interfaces
export interface ExtensionError extends Error {
  code: string;
  category: 'validation' | 'analysis' | 'visualization' | 'system';
  recoverable: boolean;
  userMessage: string;
  technicalDetails?: string | undefined;
}

export interface ErrorContext {
  operation: string;
  projectPath?: string;
  timestamp: Date;
  stackTrace?: string;
}

// Webview communication interfaces
export interface WebviewMessage {
  command: string;
  data?: any;
}

export interface NodeClickMessage extends WebviewMessage {
  command: 'nodeClick';
  data: {
    node: GraphNode;
  };
}

export interface LinkClickMessage extends WebviewMessage {
  command: 'linkClick';
  data: {
    link: GraphLink;
  };
}

export interface GraphReadyMessage extends WebviewMessage {
  command: 'graphReady';
  data: {
    nodeCount: number;
    linkCount: number;
  };
}

export interface ErrorMessage extends WebviewMessage {
  command: 'error';
  data: {
    error: ExtensionError;
  };
}

export type WebviewMessageType =
  | NodeClickMessage
  | LinkClickMessage
  | GraphReadyMessage
  | ErrorMessage;

// Cache interfaces
export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
  key: string;
}

export interface ICacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

// Additional service interfaces for complete architecture
export interface IProjectFileParser {
  parseProjectFile(projectPath: string): Promise<NuGetPackage[]>;
  validateProjectFile(projectPath: string): Promise<ProjectValidationResult>;
  getSupportedFrameworks(projectPath: string): Promise<string[]>;
  parsePackagesConfig(configPath: string): Promise<NuGetPackage[]>;
}

export interface IExtensionLogger {
  info(message: string, context?: ErrorContext): void;
  warn(message: string, context?: ErrorContext): void;
  error(message: string, error?: Error, context?: ErrorContext): void;
  debug(message: string, data?: any): void;
}

// Performance monitoring interfaces
export interface PerformanceMetrics {
  analysisTime: number;
  renderTime: number;
  nodeCount: number;
  linkCount: number;
  memoryUsage?: number;
}

export interface IPerformanceMonitor {
  startTimer(operation: string): string;
  endTimer(timerId: string): number;
  recordMetrics(metrics: PerformanceMetrics): void;
  getMetrics(): PerformanceMetrics[];
}

// Extension state management
export interface ExtensionState {
  activeProjects: Map<string, DependencyAnalysisResult>;
  cachedResults: Map<string, CacheEntry<DependencyAnalysisResult>>;
  configuration: ExtensionConfiguration;
  isAnalyzing: boolean;
}

export interface IStateManager {
  getState(): ExtensionState;
  updateState(updates: Partial<ExtensionState>): void;
  clearState(): void;
  saveState(): Promise<void>;
  loadState(): Promise<void>;
}

// Command execution interfaces
export interface ICommandExecutor {
  executeCommand(
    command: string,
    args?: string[],
    options?: CommandExecutionOptions
  ): Promise<CommandResult>;
  isCommandAvailable(command: string): Promise<boolean>;
  getCommandVersion(command: string): Promise<string>;
}

export interface CommandExecutionOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  encoding?:
    | 'ascii'
    | 'utf8'
    | 'utf-8'
    | 'utf16le'
    | 'ucs2'
    | 'ucs-2'
    | 'base64'
    | 'latin1'
    | 'binary'
    | 'hex';
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  executionTime: number;
}

// File system interfaces
export interface IFileSystemService {
  exists(path: string): Promise<boolean>;
  readFile(
    path: string,
    encoding?:
      | 'ascii'
      | 'utf8'
      | 'utf-8'
      | 'utf16le'
      | 'ucs2'
      | 'ucs-2'
      | 'base64'
      | 'latin1'
      | 'binary'
      | 'hex'
  ): Promise<string>;
  writeFile(
    path: string,
    content: string,
    encoding?:
      | 'ascii'
      | 'utf8'
      | 'utf-8'
      | 'utf16le'
      | 'ucs2'
      | 'ucs-2'
      | 'base64'
      | 'latin1'
      | 'binary'
      | 'hex'
  ): Promise<void>;
  readDirectory(path: string): Promise<string[]>;
  isDirectory(path: string): Promise<boolean>;
  isFile(path: string): Promise<boolean>;
  getFileStats(path: string): Promise<FileStats>;
}

export interface FileStats {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  created: Date;
  modified: Date;
  accessed: Date;
}

// Configuration management
export interface IConfigurationManager {
  getConfiguration(): ExtensionConfiguration;
  updateConfiguration(updates: Partial<ExtensionConfiguration>): Promise<void>;
  resetConfiguration(): Promise<void>;
  onConfigurationChanged(
    callback: (config: ExtensionConfiguration) => void
  ): void;
}

// Notification and user interaction interfaces
export interface INotificationService {
  showInformation(
    message: string,
    ...items: string[]
  ): Promise<string | undefined>;
  showWarning(message: string, ...items: string[]): Promise<string | undefined>;
  showError(message: string, ...items: string[]): Promise<string | undefined>;
  showProgress<T>(
    title: string,
    task: (progress: IProgressReporter) => Promise<T>
  ): Promise<T>;
}

export interface IProgressReporter {
  report(value: { message?: string; increment?: number }): void;
}

// Workspace management
export interface IWorkspaceService {
  findFiles(pattern: string, exclude?: string): Promise<string[]>;
  getWorkspaceFolders(): string[];
  getRelativePath(absolutePath: string): string;
  openTextDocument(path: string): Promise<void>;
  showTextDocument(path: string): Promise<void>;
}

// Telemetry and analytics
export interface ITelemetryService {
  trackEvent(
    eventName: string,
    properties?: Record<string, string>,
    measurements?: Record<string, number>
  ): void;
  trackException(error: Error, properties?: Record<string, string>): void;
  trackDependency(
    name: string,
    data: string,
    duration: number,
    success: boolean
  ): void;
}

// Security and validation
export interface ISecurityValidator {
  validateProjectPath(path: string): ValidationResult;
  validatePackageData(data: NuGetPackage[]): ValidationResult;
  sanitizeUserInput(input: string): string;
  checkPermissions(path: string): Promise<PermissionResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PermissionResult {
  canRead: boolean;
  canWrite: boolean;
  canExecute: boolean;
}

// Data transformation and processing
export interface IDataProcessor {
  processRawDependencyData(
    rawData: any,
    source: 'dotnet-cli' | 'project-file'
  ): NuGetPackage[];
  mergeDependencyData(
    primary: NuGetPackage[],
    secondary: NuGetPackage[]
  ): NuGetPackage[];
  filterPackages(
    packages: NuGetPackage[],
    criteria: FilterCriteria
  ): NuGetPackage[];
  sortPackages(packages: NuGetPackage[], sortBy: SortCriteria): NuGetPackage[];
}

export interface FilterCriteria {
  includeTransitive?: boolean;
  severityFilter?: Array<'Critical' | 'High' | 'Moderate' | 'Low'>;
  namePattern?: string;
  versionPattern?: string;
  frameworkFilter?: string[];
}

export interface SortCriteria {
  field: 'name' | 'version' | 'severity' | 'depth';
  direction: 'asc' | 'desc';
}

// Export and import interfaces
export interface IDataExporter {
  exportToJson(data: DependencyAnalysisResult): Promise<string>;
  exportToCsv(data: DependencyAnalysisResult): Promise<string>;
  exportToXml(data: DependencyAnalysisResult): Promise<string>;
  exportToSarif(data: DependencyAnalysisResult): Promise<string>;
}

export interface IDataImporter {
  importFromJson(jsonData: string): Promise<DependencyAnalysisResult>;
  importFromCsv(csvData: string): Promise<DependencyAnalysisResult>;
  importFromXml(xmlData: string): Promise<DependencyAnalysisResult>;
}

// Plugin and extension interfaces
export interface IExtensionPlugin {
  name: string;
  version: string;
  activate(context: IPluginContext): Promise<void>;
  deactivate(): Promise<void>;
  getCapabilities(): PluginCapabilities;
}

export interface IPluginContext {
  extensionPath: string;
  globalState: any;
  workspaceState: any;
  subscriptions: any[];
}

export interface PluginCapabilities {
  providesAnalysis: boolean;
  providesVisualization: boolean;
  providesExport: boolean;
  supportedFormats: string[];
}
