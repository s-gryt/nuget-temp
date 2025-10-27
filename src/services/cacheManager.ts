import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { ICacheManager, CacheEntry, VulnerabilityInfo } from '../types/dependency';

/**
 * Enhanced cache manager with persistent storage for vulnerability data
 * and in-memory caching for other temporary data with TTL support.
 */
export class CacheManager implements ICacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtl = 30 * 60 * 1000; // 30 minutes
  private readonly vulnerabilityTtl = 24 * 60 * 60 * 1000; // 24 hours for vulnerability data
  private readonly cacheDir: string;

  constructor(context: vscode.ExtensionContext) {
    this.cacheDir = path.join(context.globalStorageUri?.fsPath || context.extensionPath, 'cache');
    this.ensureCacheDirectory();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const now = new Date();
    const timeToLive = ttl ?? this.defaultTtl;

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: new Date(now.getTime() + timeToLive),
      key
    };

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clean up expired entries from the cache
   */
  cleanup(): void {
    const now = new Date();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Cache vulnerability data persistently to disk
   */
  async cacheVulnerabilityData(projectPath: string, vulnerabilities: VulnerabilityInfo[]): Promise<void> {
    try {
      const cacheKey = this.getVulnerabilityCacheKey(projectPath);
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

      const cacheData = {
        projectPath,
        vulnerabilities,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.vulnerabilityTtl).toISOString()
      };

      await fs.promises.writeFile(cacheFile, JSON.stringify(cacheData, null, 2), 'utf8');
    } catch (error) {
      console.warn('Failed to cache vulnerability data:', error);
    }
  }

  /**
   * Retrieve cached vulnerability data from disk
   */
  async getCachedVulnerabilityData(projectPath: string): Promise<VulnerabilityInfo[] | null> {
    try {
      const cacheKey = this.getVulnerabilityCacheKey(projectPath);
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

      if (!fs.existsSync(cacheFile)) {
        return null;
      }

      const cacheContent = await fs.promises.readFile(cacheFile, 'utf8');
      const cacheData = JSON.parse(cacheContent);

      // Check if cache has expired
      const expiresAt = new Date(cacheData.expiresAt);
      if (new Date() > expiresAt) {
        // Clean up expired cache file
        await fs.promises.unlink(cacheFile).catch(() => {});
        return null;
      }

      return cacheData.vulnerabilities;
    } catch (error) {
      console.warn('Failed to retrieve cached vulnerability data:', error);
      return null;
    }
  }

  /**
   * Check if vulnerability data is cached and valid
   */
  async hasValidVulnerabilityCache(projectPath: string): Promise<boolean> {
    try {
      const cacheKey = this.getVulnerabilityCacheKey(projectPath);
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

      if (!fs.existsSync(cacheFile)) {
        return false;
      }

      const cacheContent = await fs.promises.readFile(cacheFile, 'utf8');
      const cacheData = JSON.parse(cacheContent);

      // Check if cache has expired
      const expiresAt = new Date(cacheData.expiresAt);
      return new Date() <= expiresAt;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all vulnerability cache files
   */
  async clearVulnerabilityCache(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.cacheDir);
      const vulnerabilityCacheFiles = files.filter(file => file.endsWith('.json'));

      for (const file of vulnerabilityCacheFiles) {
        await fs.promises.unlink(path.join(this.cacheDir, file)).catch(() => {});
      }
    } catch (error) {
      console.warn('Failed to clear vulnerability cache:', error);
    }
  }

  /**
   * Clean up expired vulnerability cache files
   */
  async cleanupExpiredVulnerabilityCache(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.cacheDir);
      const vulnerabilityCacheFiles = files.filter(file => file.endsWith('.json'));

      for (const file of vulnerabilityCacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const cacheContent = await fs.promises.readFile(filePath, 'utf8');
          const cacheData = JSON.parse(cacheContent);

          const expiresAt = new Date(cacheData.expiresAt);
          if (new Date() > expiresAt) {
            await fs.promises.unlink(filePath);
          }
        } catch (error) {
          // If we can't read/parse the file, delete it
          await fs.promises.unlink(filePath).catch(() => {});
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup expired vulnerability cache:', error);
    }
  }

  /**
   * Get cache information including offline mode status
   */
  async getCacheInfo(projectPath?: string): Promise<{
    inMemorySize: number;
    hasVulnerabilityCache: boolean;
    vulnerabilityCacheAge?: number;
    offlineMode: boolean;
  }> {
    const info: {
      inMemorySize: number;
      hasVulnerabilityCache: boolean;
      vulnerabilityCacheAge?: number;
      offlineMode: boolean;
    } = {
      inMemorySize: this.cache.size,
      hasVulnerabilityCache: false,
      offlineMode: false
    };

    if (projectPath) {
      info.hasVulnerabilityCache = await this.hasValidVulnerabilityCache(projectPath);

      if (info.hasVulnerabilityCache) {
        try {
          const cacheKey = this.getVulnerabilityCacheKey(projectPath);
          const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
          const cacheContent = await fs.promises.readFile(cacheFile, 'utf8');
          const cacheData = JSON.parse(cacheContent);

          const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
          info.vulnerabilityCacheAge = cacheAge;

          // Consider offline mode if cache is older than 1 hour
          info.offlineMode = cacheAge > 60 * 60 * 1000;
        } catch (error) {
          // Ignore errors when getting cache age
        }
      }
    }

    return info;
  }

  private ensureCacheDirectory(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {}
  }

  private getVulnerabilityCacheKey(projectPath: string): string {
    // Create a safe filename from the project path
    const normalizedPath = path.normalize(projectPath);
    const hash = this.simpleHash(normalizedPath);
    const projectName = path.basename(projectPath, '.csproj');
    return `vuln_${projectName}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
