// Global type definitions for the NuGet Dependency Visualizer extension

declare global {
  interface Window {
    acquireVsCodeApi: () => VSCodeApi;
    vscodeApiInstance?: VSCodeApi;
    graphData: import('./dependency').GraphData;
    mode: import('./dependency').VisualizationMode;
    projectInfo: {
      projectName: string;
      packageCount: number;
      vulnerabilityCount: import('./dependency').VulnerabilityCount;
    };
    THREE: any; // Three.js global
  }
}

interface VSCodeApi {
  postMessage(message: any): void;
  setState(state: any): void;
  getState(): any;
}

// Extend the react-force-graph-3d module types
declare module 'react-force-graph-3d' {
  import { ComponentType } from 'react';

  interface ForceGraph3DProps {
    graphData: {
      nodes: any[];
      links: any[];
    };
    nodeLabel?: string | ((node: any) => string);
    nodeColor?: string | ((node: any) => string);
    nodeVal?: number | string | ((node: any) => number);
    linkColor?: string | ((link: any) => string);
    linkWidth?: number | string | ((link: any) => number);
    linkOpacity?: number;
    onNodeClick?: (node: any, event?: MouseEvent) => void;
    onLinkClick?: (link: any, event?: MouseEvent) => void;
    backgroundColor?: string;
    showNavInfo?: boolean;
    controlType?: 'trackball' | 'orbit' | 'fly';
    enableNodeDrag?: boolean;
    enableNavigationControls?: boolean;
    nodeThreeObject?: (node: any) => any;
    nodeThreeObjectExtend?: boolean;
    width?: number;
    height?: number;
    dagMode?:
      | 'td'
      | 'bu'
      | 'lr'
      | 'rl'
      | 'zout'
      | 'zin'
      | 'radialout'
      | 'radialin'
      | null;
    dagLevelDistance?: number;
    cooldownTicks?: number;
    onEngineStop?: () => void;
    ref?: any;
  }

  interface ForceGraph3DRef {
    cameraPosition(
      position?: { x: number; y: number; z: number },
      lookAt?: { x: number; y: number; z: number },
      ms?: number
    ): void;
    zoomToFit(ms?: number, padding?: number): void;
    pauseAnimation(): void;
    resumeAnimation(): void;
    d3ReheatSimulation(): void;
    scene(): any;
  }

  const ForceGraph3D: ComponentType<ForceGraph3DProps>;
  export default ForceGraph3D;
}

// Extend xml2js types
declare module 'xml2js' {
  export interface Parser {
    parseStringPromise(xml: string): Promise<any>;
  }

  export class Parser {
    constructor(options?: any);
  }
}

// Extend semver types if needed
declare module 'semver' {
  export function valid(version: string): string | null;
  export function gt(version1: string, version2: string): boolean;
  export function lt(version1: string, version2: string): boolean;
  export function gte(version1: string, version2: string): boolean;
  export function lte(version1: string, version2: string): boolean;
  export function satisfies(version: string, range: string): boolean;
}

export {};
