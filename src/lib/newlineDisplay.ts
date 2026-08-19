export function toDisplayText(value: string, showMarkers: boolean): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return showMarkers ? normalized.replace(/\n/g, '\\n') : normalized.replace(/\\n/g, '\n');
}

export function toStoredText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\\n');
}

export function countNewlines(value: string): number {
  return (value.match(/\\n|\n/g) || []).length;
}
