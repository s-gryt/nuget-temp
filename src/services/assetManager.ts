import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface AssetInfo {
  localPath: string;
  webviewUri: vscode.Uri;
  isAvailable: boolean;
  fallbackPath?: string | undefined;
  integrity?: string | undefined;
  size?: number | undefined;
  lastModified?: Date | undefined;
}

export interface BundledAssets {
  forceGraph3d: AssetInfo;
  react: AssetInfo;
  reactDom: AssetInfo;
  three: AssetInfo;
}

export interface AssetLoadingStatus {
  bundledAssetsAvailable: boolean;
  cdnFallbackWorking: boolean;
  specificAssetErrors: Record<string, string>;
  cspViolations: string[];
  loadingProgress: Record<string, AssetLoadingProgress>;
  totalAssets: number;
  loadedAssets: number;
  failedAssets: string[];
}

export interface AssetLoadingProgress {
  status: 'pending' | 'loading' | 'loaded' | 'failed' | 'fallback';
  startTime?: number | undefined;
  endTime?: number | undefined;
  error?: string | undefined;
  fallbackUsed?: boolean | undefined;
  integrityVerified?: boolean | undefined;
}

export interface AssetDiagnostics {
  assetName: string;
  localAvailable: boolean;
  localPath: string;
  localSize?: number;
  localIntegrity?: string;
  lastModified?: Date;
  fallbackUrl: string;
  lastVerified: Date;
  errors: string[];
}

export class AssetManager {
  private context: vscode.ExtensionContext;
  private assetsPath: string;
  private loadingStatus: AssetLoadingStatus;
  private diagnostics: Map<string, AssetDiagnostics>;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.assetsPath = path.join(context.extensionPath, 'assets');
    this.loadingStatus = this.initializeLoadingStatus();
    this.diagnostics = new Map();
  }

  /**
   * Initialize asset manager and ensure local assets are available
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureAssetsDirectory();
      await this.bundleRequiredAssets();
      await this.performAssetDiagnostics();
    } catch (error) {
      console.error('Failed to initialize asset manager:', error);
      throw new Error(`Asset manager initialization failed: ${error}`);
    }
  }

  /**
   * Initialize loading status tracking
   */
  private initializeLoadingStatus(): AssetLoadingStatus {
    const requiredAssets = ['force-graph-3d.js', 'react.js', 'react-dom.js', 'three.js'];
    const loadingProgress: Record<string, AssetLoadingProgress> = {};

    requiredAssets.forEach(asset => {
      loadingProgress[asset] = {
        status: 'pending'
      };
    });

    return {
      bundledAssetsAvailable: false,
      cdnFallbackWorking: false,
      specificAssetErrors: {},
      cspViolations: [],
      loadingProgress,
      totalAssets: requiredAssets.length,
      loadedAssets: 0,
      failedAssets: []
    };
  }

  /**
   * Get current asset loading status
   */
  getLoadingStatus(): AssetLoadingStatus {
    return { ...this.loadingStatus };
  }

  /**
   * Update asset loading progress
   */
  updateAssetProgress(assetName: string, progress: Partial<AssetLoadingProgress>): void {
    const currentProgress = this.loadingStatus.loadingProgress[assetName];
    if (currentProgress) {
      this.loadingStatus.loadingProgress[assetName] = {
        status: progress.status ?? currentProgress.status,
        startTime: progress.startTime ?? currentProgress.startTime,
        endTime: progress.endTime ?? currentProgress.endTime,
        error: progress.error ?? currentProgress.error,
        fallbackUsed: progress.fallbackUsed ?? currentProgress.fallbackUsed,
        integrityVerified: progress.integrityVerified ?? currentProgress.integrityVerified
      };

      // Update counters
      this.updateLoadingCounters();
    }
  }

  /**
   * Perform comprehensive asset diagnostics
   */
  async performAssetDiagnostics(): Promise<void> {
    const requiredAssets = ['force-graph-3d.js', 'react.js', 'react-dom.js', 'three.js'];
    const fallbackUrls = this.getFallbackUrls();

    for (const assetName of requiredAssets) {
      const diagnostics: AssetDiagnostics = {
        assetName,
        localAvailable: false,
        localPath: path.join(this.assetsPath, assetName),
        fallbackUrl: fallbackUrls[assetName.replace('.js', '')] || '',
        lastVerified: new Date(),
        errors: []
      };

      try {
        // Check local asset availability and integrity
        await this.verifyLocalAsset(diagnostics);

        // Test CDN fallback availability
        await this.testCdnFallback(diagnostics);
      } catch (error) {
        diagnostics.errors.push(`Diagnostic error: ${error}`);
      }

      this.diagnostics.set(assetName, diagnostics);
    }

    // Update overall loading status
    this.updateOverallStatus();
  }

  /**
   * Verify local asset integrity and availability
   */
  private async verifyLocalAsset(diagnostics: AssetDiagnostics): Promise<void> {
    try {
      const stats = await fs.promises.stat(diagnostics.localPath);
      diagnostics.localAvailable = true;
      diagnostics.localSize = stats.size;
      diagnostics.lastModified = stats.mtime;

      // Calculate file integrity hash
      const fileContent = await fs.promises.readFile(diagnostics.localPath);
      diagnostics.localIntegrity = crypto.createHash('sha256').update(fileContent).digest('hex');

      // Verify file is not corrupted (basic checks)
      if (stats.size === 0) {
        diagnostics.errors.push('Local asset file is empty');
        diagnostics.localAvailable = false;
      } else if (stats.size < 1000) {
        // Minimum expected size for JS libraries
        diagnostics.errors.push('Local asset file appears to be truncated');
      }

      // Basic content validation for JavaScript files
      const content = fileContent.toString('utf8');
      if (!content.includes('function') && !content.includes('=>')) {
        diagnostics.errors.push('Local asset does not appear to contain valid JavaScript');
      }
    } catch (error) {
      diagnostics.localAvailable = false;
      diagnostics.errors.push(`Local asset verification failed: ${error}`);
    }
  }

  /**
   * Test CDN fallback availability (basic connectivity test)
   */
  private async testCdnFallback(diagnostics: AssetDiagnostics): Promise<void> {
    // Note: In VS Code extension context, we can't make HTTP requests directly
    // This is a placeholder for CDN availability testing
    // In practice, this would be tested in the webview context
    diagnostics.errors.push('CDN fallback testing requires webview context');
  }

  /**
   * Update loading counters based on current progress
   */
  private updateLoadingCounters(): void {
    const progress = this.loadingStatus.loadingProgress;
    let loadedCount = 0;
    const failedAssets: string[] = [];

    Object.entries(progress).forEach(([assetName, assetProgress]) => {
      if (assetProgress.status === 'loaded') {
        loadedCount++;
      } else if (assetProgress.status === 'failed') {
        failedAssets.push(assetName);
      }
    });

    this.loadingStatus.loadedAssets = loadedCount;
    this.loadingStatus.failedAssets = failedAssets;
  }

  /**
   * Update overall loading status based on diagnostics
   */
  private updateOverallStatus(): void {
    const allDiagnostics = Array.from(this.diagnostics.values());

    this.loadingStatus.bundledAssetsAvailable = allDiagnostics.every(d => d.localAvailable);

    // Update specific asset errors
    allDiagnostics.forEach(diagnostics => {
      if (diagnostics.errors.length > 0) {
        this.loadingStatus.specificAssetErrors[diagnostics.assetName] = diagnostics.errors.join('; ');
      }
    });
  }

  /**
   * Get detailed diagnostics for all assets
   */
  getAssetDiagnostics(): AssetDiagnostics[] {
    return Array.from(this.diagnostics.values());
  }

  /**
   * Manually reload a specific asset
   */
  async reloadAsset(assetName: string): Promise<boolean> {
    try {
      this.updateAssetProgress(assetName, {
        status: 'loading',
        startTime: Date.now()
      });

      // Attempt to re-bundle the asset
      const nodeModulesPath = path.join(this.context.extensionPath, 'node_modules');
      let sourcePath: string;

      switch (assetName) {
        case 'force-graph-3d.js':
          sourcePath = path.join(nodeModulesPath, 'react-force-graph-3d', 'dist', 'react-force-graph-3d.min.js');
          break;
        case 'react.js':
          sourcePath = path.join(nodeModulesPath, 'react', 'umd', 'react.production.min.js');
          break;
        case 'react-dom.js':
          sourcePath = path.join(nodeModulesPath, 'react-dom', 'umd', 'react-dom.production.min.js');
          break;
        case 'three.js':
          sourcePath = path.join(nodeModulesPath, 'three', 'build', 'three.min.js');
          break;
        default:
          throw new Error(`Unknown asset: ${assetName}`);
      }

      await this.bundleAsset(sourcePath, assetName);

      // Re-verify the asset
      const diagnostics = this.diagnostics.get(assetName);
      if (diagnostics) {
        await this.verifyLocalAsset(diagnostics);
      }

      this.updateAssetProgress(assetName, {
        status: 'loaded',
        endTime: Date.now(),
        integrityVerified: true
      });

      return true;
    } catch (error) {
      this.updateAssetProgress(assetName, {
        status: 'failed',
        endTime: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      });

      return false;
    }
  }

  /**
   * Reload all assets
   */
  async reloadAllAssets(): Promise<boolean> {
    const requiredAssets = ['force-graph-3d.js', 'react.js', 'react-dom.js', 'three.js'];
    const results = await Promise.all(requiredAssets.map(asset => this.reloadAsset(asset)));

    return results.every(result => result);
  }

  /**
   * Get enhanced asset info with diagnostics
   */
  getEnhancedAssetInfo(assetName: string, webview: vscode.Webview): AssetInfo {
    const basicInfo = this.getAssetInfo(assetName, webview);
    const diagnostics = this.diagnostics.get(assetName);

    if (diagnostics) {
      return {
        ...basicInfo,
        integrity: diagnostics.localIntegrity,
        size: diagnostics.localSize,
        lastModified: diagnostics.lastModified
      };
    }

    return basicInfo;
  }

  /**
   * Get bundled assets with webview URIs
   */
  getBundledAssets(webview: vscode.Webview): BundledAssets {
    return {
      forceGraph3d: this.getAssetInfo('force-graph-3d.js', webview),
      react: this.getAssetInfo('react.js', webview),
      reactDom: this.getAssetInfo('react-dom.js', webview),
      three: this.getAssetInfo('three.js', webview)
    };
  }

  /**
   * Check if all required assets are available locally
   */
  areAssetsAvailable(): boolean {
    const requiredAssets = ['force-graph-3d.js', 'react.js', 'react-dom.js', 'three.js'];

    return requiredAssets.every(asset => {
      const assetPath = path.join(this.assetsPath, asset);
      return fs.existsSync(assetPath);
    });
  }

  /**
   * Get fallback CDN URLs for assets when local assets are unavailable
   */
  getFallbackUrls(): Record<string, string> {
    return {
      'force-graph-3d': 'https://unpkg.com/react-force-graph-3d@latest/dist/react-force-graph-3d.min.js',
      react: 'https://unpkg.com/react@18/umd/react.production.min.js',
      'react-dom': 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
      three: 'https://unpkg.com/three@latest/build/three.min.js'
    };
  }

  private async ensureAssetsDirectory(): Promise<void> {
    if (!fs.existsSync(this.assetsPath)) {
      await fs.promises.mkdir(this.assetsPath, { recursive: true });
    }
  }

  private async bundleRequiredAssets(): Promise<void> {
    const nodeModulesPath = path.join(this.context.extensionPath, 'node_modules');

    // Bundle force-graph-3d
    await this.bundleAsset(
      path.join(nodeModulesPath, 'react-force-graph-3d', 'dist', 'react-force-graph-3d.min.js'),
      'force-graph-3d.js'
    );

    // Bundle React (production build)
    await this.bundleAsset(path.join(nodeModulesPath, 'react', 'umd', 'react.production.min.js'), 'react.js');

    // Bundle React DOM (production build)
    await this.bundleAsset(
      path.join(nodeModulesPath, 'react-dom', 'umd', 'react-dom.production.min.js'),
      'react-dom.js'
    );

    // Bundle Three.js
    await this.bundleAsset(path.join(nodeModulesPath, 'three', 'build', 'three.min.js'), 'three.js');
  }

  private async bundleAsset(sourcePath: string, targetName: string): Promise<void> {
    const targetPath = path.join(this.assetsPath, targetName);

    try {
      // Check if source exists
      if (!fs.existsSync(sourcePath)) {
        console.warn(`Source asset not found: ${sourcePath}`);
        return;
      }

      // Check if target already exists and is newer
      if (fs.existsSync(targetPath)) {
        const sourceStats = await fs.promises.stat(sourcePath);
        const targetStats = await fs.promises.stat(targetPath);

        if (targetStats.mtime >= sourceStats.mtime) {
          // Target is up to date
          return;
        }
      }

      // Copy the asset
      await fs.promises.copyFile(sourcePath, targetPath);
    } catch (error) {
      // Don't throw - allow extension to continue with fallbacks
    }
  }

  private getAssetInfo(assetName: string, webview: vscode.Webview): AssetInfo {
    const localPath = path.join(this.assetsPath, assetName);
    const isAvailable = fs.existsSync(localPath);

    return {
      localPath,
      webviewUri: webview.asWebviewUri(vscode.Uri.file(localPath)),
      isAvailable,
      fallbackPath: this.getFallbackUrls()[assetName.replace('.js', '')]
    };
  }
}
