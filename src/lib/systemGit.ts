import { Command } from '@tauri-apps/plugin-shell';

export async function executeGitCommand(args: string[], cwd: string): Promise<string> {
  const normalizedCwd = cwd.replace(/\\/g, '/');

  try {
    const cmd = Command.create('git', args, { cwd: normalizedCwd });
    const result = await cmd.execute();

    if (result.code !== 0) {
      const errMsg = result.stderr || result.stdout || `Git exited with code ${result.code}`;
      console.error(`[Git Error] Command: git ${args.join(' ')} | CWD: ${normalizedCwd} | Error: ${errMsg}`);
      throw new Error(errMsg);
    }

    return result.stdout;
  } catch (error: any) {
    console.error(`[Git Execution Failed] args: ${args.join(' ')} | cwd: ${normalizedCwd}:`, error);
    throw error;
  }
}

export async function checkIsGitInitialized(cwd: string): Promise<boolean> {
  try {
    const output = await executeGitCommand(['rev-parse', '--is-inside-work-tree'], cwd);
    return output.trim() === 'true';
  } catch {
    return false;
  }
}

export async function getGitStatus(cwd: string): Promise<string[]> {
  try {
    const output = await executeGitCommand(['status', '--porcelain', '-uall'], cwd);
    return output.split('\n').filter((line) => line.trim().length > 0);
  } catch (err) {
    console.error('Failed to get git status:', err);
    return [];
  }
}

export async function initGitRepo(cwd: string): Promise<string> {
  return await executeGitCommand(['init'], cwd);
}

export async function stageFiles(cwd: string, files: string[]): Promise<void> {
  await executeGitCommand(['add', '--', ...files], cwd);
}

export async function unstageFiles(cwd: string, files: string[]): Promise<void> {
  await executeGitCommand(['reset', 'HEAD', '--', ...files], cwd);
}

export async function commitChanges(
  cwd: string,
  message: string,
  authorName: string,
  authorEmail: string
): Promise<void> {
  await executeGitCommand([
    '-c', `user.name=${authorName || 'Translator'}`,
    '-c', `user.email=${authorEmail || 'translator@example.com'}`,
    'commit',
    '-m', message,
  ], cwd);
}