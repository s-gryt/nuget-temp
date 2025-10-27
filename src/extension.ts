import * as vscode from 'vscode';
import { NuGetDependencyProvider } from './providers/nugetDependencyProvider';
import { WebviewManager } from './webview/webviewManager';

interface ProjectMetadata {
  targetFramework?: string | undefined;
  hasPackageReferences: boolean;
  packageCount?: number;
}

export function activate(context: vscode.ExtensionContext) {
  // Extension activated

  const dependencyProvider = new NuGetDependencyProvider(context);
  const webviewManager = new WebviewManager(context);

  // Register commands
  const visualizeDependencies = vscode.commands.registerCommand(
    'nugetGraph.visualizeDependencies',
    async (uri?: vscode.Uri) => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'NuGet Dependencies',
          cancellable: false
        },
        async progress => {
          try {
            progress.report({ message: 'Detecting project file...' });
            const projectPath = uri?.fsPath || (await getActiveProjectPath());
            if (!projectPath) {
              vscode.window.showErrorMessage(
                'No .csproj file selected or found. Please open a .NET project or select a .csproj file.'
              );
              return;
            }

            progress.report({ message: 'Analyzing NuGet dependencies...' });
            console.log(
              '[DEBUG] Calling getDependencies for project:',
              projectPath
            );
            const dependencies = await dependencyProvider.getDependencies(
              projectPath
            );

            if (dependencies.graphData.nodes.length === 0) {
              vscode.window.showInformationMessage(
                'No NuGet dependencies found in this project. The project may not have any package references.'
              );
              return;
            }

            progress.report({ message: 'Creating visualization...' });
            await webviewManager.showDependencyGraph(
              dependencies,
              'dependencies'
            );

            vscode.window.showInformationMessage(
              `Successfully visualized ${dependencies.graphData.nodes.length} packages from ${dependencies.projectName}`
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(
              `Failed to analyze dependencies: ${errorMessage}. Please ensure the project file is valid and the .NET SDK is installed.`
            );
          }
        }
      );
    }
  );

  const visualizeVulnerabilities = vscode.commands.registerCommand(
    'nugetGraph.visualizeVulnerabilities',
    async (uri?: vscode.Uri) => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'NuGet Vulnerabilities',
          cancellable: false
        },
        async progress => {
          try {
            progress.report({ message: 'Detecting project file...' });
            const projectPath = uri?.fsPath || (await getActiveProjectPath());
            if (!projectPath) {
              vscode.window.showErrorMessage(
                'No .csproj file selected or found. Please open a .NET project or select a .csproj file.'
              );
              return;
            }

            progress.report({ message: 'Scanning for vulnerabilities...' });
            const dependencies =
              await dependencyProvider.getDependenciesWithVulnerabilities(
                projectPath
              );

            if (dependencies.graphData.nodes.length === 0) {
              vscode.window.showInformationMessage(
                'No NuGet dependencies found in this project. The project may not have any package references.'
              );
              return;
            }

            progress.report({
              message: 'Creating vulnerability visualization...'
            });
            await webviewManager.showDependencyGraph(
              dependencies,
              'vulnerabilities'
            );

            const vulnCount = dependencies.vulnerabilityCount?.total || 0;
            const message =
              vulnCount > 0
                ? `Found ${vulnCount} vulnerabilities in ${dependencies.graphData.nodes.length} packages from ${dependencies.projectName}`
                : `No vulnerabilities found in ${dependencies.graphData.nodes.length} packages from ${dependencies.projectName}`;

            vscode.window.showInformationMessage(message);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(
              `Failed to analyze vulnerabilities: ${errorMessage}. Please ensure the .NET SDK is installed and you have internet connectivity for vulnerability scanning.`
            );
          }
        }
      );
    }
  );

  const visualizeFullGraph = vscode.commands.registerCommand(
    'nugetGraph.visualizeFullGraph',
    async (uri?: vscode.Uri) => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Full NuGet Dependency Graph',
          cancellable: false
        },
        async progress => {
          try {
            progress.report({ message: 'Detecting project file...' });
            const projectPath = uri?.fsPath || (await getActiveProjectPath());
            if (!projectPath) {
              vscode.window.showErrorMessage(
                'No .csproj file selected or found. Please open a .NET project or select a .csproj file.'
              );
              return;
            }

            progress.report({ message: 'Analyzing full dependency graph...' });
            const dependencies =
              await dependencyProvider.getFullDependencyGraph(projectPath);

            if (dependencies.graphData.nodes.length === 0) {
              vscode.window.showInformationMessage(
                'No NuGet dependencies found in this project. The project may not have any package references.'
              );
              return;
            }

            progress.report({
              message: 'Creating full graph visualization...'
            });
            await webviewManager.showDependencyGraph(dependencies, 'full');

            vscode.window.showInformationMessage(
              `Successfully visualized complete dependency graph with ${dependencies.graphData.nodes.length} packages from ${dependencies.projectName}`
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(
              `Failed to analyze full dependency graph: ${errorMessage}. Please ensure the project file is valid and the .NET SDK is installed.`
            );
          }
        }
      );
    }
  );

  context.subscriptions.push(
    visualizeDependencies,
    visualizeVulnerabilities,
    visualizeFullGraph
  );
}

async function getActiveProjectPath(): Promise<string | undefined> {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && activeEditor.document.fileName.endsWith('.csproj')) {
    // Validate the active project file before returning
    const isValid = await validateProjectFile(activeEditor.document.fileName);
    if (isValid) {
      return activeEditor.document.fileName;
    }
    vscode.window.showWarningMessage(
      'The active .csproj file appears to be invalid or inaccessible.'
    );
  }

  return await selectProjectFromWorkspace();
}

async function selectProjectFromWorkspace(): Promise<string | undefined> {
  // Search for .csproj files in workspace with broader exclusions
  const csprojFiles = await vscode.workspace.findFiles(
    '**/*.csproj',
    '{**/node_modules/**,**/bin/**,**/obj/**,**/.git/**,**/packages/**}',
    100 // Increased limit for larger workspaces
  );

  if (csprojFiles.length === 0) {
    vscode.window.showErrorMessage(
      'No .NET project files (.csproj) found in the workspace. Please ensure you have a .NET project open.'
    );
    return undefined;
  }

  if (csprojFiles.length === 1) {
    const projectPath = csprojFiles[0]?.fsPath;
    if (projectPath && (await validateProjectFile(projectPath))) {
      return projectPath;
    }
  }

  // Multiple projects found - let user choose
  const projectNames = csprojFiles.map(file => ({
    label: file.fsPath.split('/').pop() || file.fsPath,
    description: file.fsPath,
    detail: file.fsPath
  }));

  const selected = await vscode.window.showQuickPick(projectNames, {
    placeHolder: 'Select a .NET project to analyze'
  });

  if (selected) {
    const projectPath = selected.description;
    if (projectPath && (await validateProjectFile(projectPath))) {
      return projectPath;
    }
  }

  return undefined;
}

async function validateProjectFile(projectPath: string): Promise<boolean> {
  try {
    const metadata = await getProjectMetadata(projectPath);
    return metadata.hasPackageReferences;
  } catch (error) {
    console.error('Project validation failed:', error);
    return false;
  }
}

async function getProjectMetadata(
  projectPath: string
): Promise<ProjectMetadata> {
  const fs = require('fs');
  const xml2js = require('xml2js');

  try {
    const projectContent = fs.readFileSync(projectPath, 'utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(projectContent);

    let targetFramework: string | undefined;
    let hasPackageReferences = false;
    let packageCount = 0;

    if (result.Project && result.Project.PropertyGroup) {
      for (const propGroup of result.Project.PropertyGroup) {
        if (propGroup.TargetFramework) {
          targetFramework = propGroup.TargetFramework[0];
        }
      }
    }

    if (result.Project && result.Project.ItemGroup) {
      for (const itemGroup of result.Project.ItemGroup) {
        if (itemGroup.PackageReference) {
          hasPackageReferences = true;
          packageCount += itemGroup.PackageReference.length;
        }
      }
    }

    return {
      targetFramework: targetFramework || undefined,
      hasPackageReferences,
      packageCount
    };
  } catch (error) {
    console.error('Failed to parse project file:', error);
    return {
      hasPackageReferences: false
    };
  }
}

export function deactivate() {}
