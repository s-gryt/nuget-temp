import { exec } from 'child_process';
import { promisify } from 'util';
import type { ICommandExecutor, CommandExecutionOptions, CommandResult } from '../types/dependency';

const execAsync = promisify(exec);

/**
 * Service for executing system commands with proper error handling,
 * timeout support, and result formatting.
 */
export class CommandExecutor implements ICommandExecutor {
  private readonly defaultTimeout = 30000; // 30 seconds

  async executeCommand(
    command: string,
    args: string[] = [],
    options: CommandExecutionOptions = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    const execOptions = {
      cwd: options.cwd,
      timeout: options.timeout ?? this.defaultTimeout,
      env: { ...process.env, ...options.env },
      encoding: options.encoding ?? 'utf8',
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    };

    try {
      const { stdout, stderr } = await execAsync(fullCommand, execOptions);
      const executionTime = Date.now() - startTime;

      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        command: fullCommand,
        executionTime
      };
    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;

      const err = error as { stdout?: string; stderr?: string; code?: number; message: string };
      return {
        stdout: err.stdout?.toString() ?? '',
        stderr: err.stderr?.toString() ?? err.message,
        exitCode: err.code ?? 1,
        command: fullCommand,
        executionTime
      };
    }
  }

  async isCommandAvailable(command: string): Promise<boolean> {
    try {
      const result = await this.executeCommand(command, ['--version']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async getCommandVersion(command: string): Promise<string> {
    try {
      const result = await this.executeCommand(command, ['--version']);
      if (result.exitCode === 0) {
        return result.stdout.trim();
      }
      throw new Error(`Failed to get version for ${command}`);
    } catch (error) {
      throw new Error(`Command ${command} not available or version check failed: ${error}`);
    }
  }

  /**
   * Execute a command with streaming output (useful for long-running commands)
   */
  executeCommandWithStreaming(
    command: string,
    args: string[] = [],
    options: CommandExecutionOptions = {},
    onData?: (data: string) => void
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

      const childProcess = exec(fullCommand, {
        cwd: options.cwd,
        timeout: options.timeout ?? this.defaultTimeout,
        env: { ...process.env, ...options.env },
        encoding: options.encoding ?? 'utf8'
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: string) => {
        stdout += data;
        onData?.(data);
      });

      childProcess.stderr?.on('data', (data: string) => {
        stderr += data;
      });

      childProcess.on('close', code => {
        const executionTime = Date.now() - startTime;

        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
          command: fullCommand,
          executionTime
        });
      });

      childProcess.on('error', error => {
        const executionTime = Date.now() - startTime;

        reject({
          stdout,
          stderr: stderr + error.message,
          exitCode: 1,
          command: fullCommand,
          executionTime
        });
      });
    });
  }
}
