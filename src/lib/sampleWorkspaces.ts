import { Workspace, PotFileRecord, PoFileRecord, PoEntry, PoHeader } from '../types/gettext';
import { COMMON_PLURAL_RULES } from './pluralEngine';
import { initGitRepository } from './gitEngine';


export const INITIAL_SAMPLE_WORKSPACES: Workspace[] = [
  {
    id: 'ws_new',
    name: 'New Project',
    description: 'Empty workspace',
    createdAt: new Date().toISOString(),
    potFile: {
      id: 'pot_main',
      filename: 'messages.pot',
      header: {
        projectIdVersion: '1.0.0',
        reportMsgidBugsTo: '',
        potCreationDate: new Date().toISOString(),
        mimeVersion: '1.0',
        contentType: 'text/plain; charset=UTF-8',
        contentTransferEncoding: '8bit',
        xGenerator: 'OpenPO',
        rawHeaders: {},
      },
      entries: [],
    },
    poFiles: [],
    activeFileId: '',
    activeEntryId: '',
  },
];