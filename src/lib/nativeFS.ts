import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile, writeTextFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';

export interface NativeScannedFile {
  name: string;
  path: string;
  content: string;
}

export async function pickNativeDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Localization Project Directory',
  });

  if (typeof selected === 'string') {
    return selected;
  }
  return null;
}

export async function scanNativeDirectoryFiles(dirPath: string): Promise<NativeScannedFile[]> {
  const entries = await readDir(dirPath);
  const result: NativeScannedFile[] = [];

  for (const entry of entries) {
    if (entry.isFile && (entry.name.endsWith('.po') || entry.name.endsWith('.pot'))) {
      const fullPath = `${dirPath}/${entry.name}`;
      const content = await readTextFile(fullPath);
      result.push({
        name: entry.name,
        path: fullPath,
        content,
      });
    }
  }

  return result;
}

export async function writeNativeTextFile(filePath: string, content: string): Promise<void> {
  await writeTextFile(filePath, content);
}

export async function writeNativeBinaryFile(filePath: string, data: Uint8Array): Promise<void> {
  await writeFile(filePath, data);
}