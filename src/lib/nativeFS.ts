import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile, readFile, writeTextFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';

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

export async function pickNativeFile(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: 'Select a translation file',
    filters: [{ name: 'Translations', extensions: ['po', 'pot', 'csv', 'json'] }],
  });
  return typeof selected === 'string' ? selected : null;
}

export async function readNativeTextFile(filePath: string): Promise<string> {
  return readTextFile(filePath);
}

export async function readNativeEncodedTextFile(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.slice(2));
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.slice(2));
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return new TextDecoder('utf-8').decode(bytes.slice(3));
  return new TextDecoder('utf-8').decode(bytes);
}