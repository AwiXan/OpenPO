import { PoEntry, PoHeader } from '../types/gettext';
import { serializeHeader } from './poParser';

/**
 * Compiles PO entries and header into a real GNU Gettext binary (.mo) Uint8Array
 */
export function compileMoBinary(header: PoHeader, entries: PoEntry[]): Uint8Array {
  const encoder = new TextEncoder();

  interface MoPair {
    originalBytes: Uint8Array;
    translationBytes: Uint8Array;
    originalStr: string;
  }

  const pairs: MoPair[] = [];

  // Entry 0: Header string
  const headerTranslation = serializeHeader(header).replace(/\\n/g, '\n');
  pairs.push({
    originalBytes: new Uint8Array(0),
    translationBytes: encoder.encode(headerTranslation),
    originalStr: '',
  });

  // Add all translated or valid entries
  for (const entry of entries) {
    // Build original key representation
    let origStr = '';
    if (entry.msgctxt) {
      origStr += `${entry.msgctxt}\x04`;
    }
    origStr += entry.msgid;
    if (entry.msgidPlural) {
      origStr += `\x00${entry.msgidPlural}`;
    }

    // Build translation string representation
    let transStr = '';
    if (entry.msgidPlural) {
      transStr = entry.msgstr.join('\x00');
    } else {
      transStr = entry.msgstr[0] || '';
    }

    pairs.push({
      originalBytes: encoder.encode(origStr),
      translationBytes: encoder.encode(transStr),
      originalStr: origStr,
    });
  }

  // Sort pairs by original string (GNU gettext requires original strings table to be sorted)
  pairs.sort((a, b) => {
    if (a.originalStr < b.originalStr) return -1;
    if (a.originalStr > b.originalStr) return 1;
    return 0;
  });

  const numStrings = pairs.length;
  const HEADER_SIZE = 28; // 7 uint32 fields
  const TABLE_ENTRY_SIZE = 8; // length (4 bytes) + offset (4 bytes)
  const ORIG_TABLE_OFFSET = HEADER_SIZE;
  const TRANS_TABLE_OFFSET = ORIG_TABLE_OFFSET + (numStrings * TABLE_ENTRY_SIZE);
  let currentStringOffset = TRANS_TABLE_OFFSET + (numStrings * TABLE_ENTRY_SIZE);

  // Calculate total size
  let totalDataBytes = 0;
  for (const pair of pairs) {
    totalDataBytes += pair.originalBytes.length + 1; // +1 for null terminator
    totalDataBytes += pair.translationBytes.length + 1; // +1 for null terminator
  }

  const buffer = new ArrayBuffer(currentStringOffset + totalDataBytes);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  // Write MO Header
  // Magic number 0x950412de (little endian)
  view.setUint32(0, 0x950412de, true);
  // Version 0
  view.setUint32(4, 0, true);
  // Number of strings
  view.setUint32(8, numStrings, true);
  // Offset of table with original strings
  view.setUint32(12, ORIG_TABLE_OFFSET, true);
  // Offset of table with translation strings
  view.setUint32(16, TRANS_TABLE_OFFSET, true);
  // Size of hashing table (0 = unused)
  view.setUint32(20, 0, true);
  // Offset of hashing table
  view.setUint32(24, 0, true);

  // Write String Tables and String Pool
  for (let i = 0; i < numStrings; i++) {
    const pair = pairs[i];

    // Write Original string to pool
    const origLength = pair.originalBytes.length;
    const origOffset = currentStringOffset;
    uint8View.set(pair.originalBytes, origOffset);
    uint8View[origOffset + origLength] = 0; // null terminator
    currentStringOffset += origLength + 1;

    // Write Translation string to pool
    const transLength = pair.translationBytes.length;
    const transOffset = currentStringOffset;
    uint8View.set(pair.translationBytes, transOffset);
    uint8View[transOffset + transLength] = 0; // null terminator
    currentStringOffset += transLength + 1;

    // Write entry in Original String Table (length, offset)
    const origTableEntryOffset = ORIG_TABLE_OFFSET + (i * TABLE_ENTRY_SIZE);
    view.setUint32(origTableEntryOffset, origLength, true);
    view.setUint32(origTableEntryOffset + 4, origOffset, true);

    // Write entry in Translation String Table (length, offset)
    const transTableEntryOffset = TRANS_TABLE_OFFSET + (i * TABLE_ENTRY_SIZE);
    view.setUint32(transTableEntryOffset, transLength, true);
    view.setUint32(transTableEntryOffset + 4, transOffset, true);
  }

  return new Uint8Array(buffer);
}
