import React from 'react';
import { Plus, X } from 'lucide-react';
import { Workspace } from '../types/gettext';

interface WorkspaceTabsProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onCloseWorkspace: (id: string, e: React.MouseEvent) => void;
  onNewWorkspace: () => void;
}

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCloseWorkspace,
  onNewWorkspace,
}) => {
  return (
    <div className="flex items-center h-9 px-3 gap-1 bg-[#090B0E] border-b border-[#2D3139] overflow-x-auto select-none no-scrollbar">
      <div className="flex items-center gap-1 h-full">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const poCount = ws.poFiles.length;
          const stringCount = ws.potFile.entries.length;

          return (
            <div
              key={ws.id}
              onClick={() => onSelectWorkspace(ws.id)}
              className={`group flex items-center gap-2 px-3 h-full text-xs font-medium cursor-pointer transition-all ${
                isActive
                  ? 'bg-[#16191E] border-t-2 border-[#3B82F6] border-x border-[#2D3139] text-[#E2E8F0] shadow-xs'
                  : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0] border-t-2 border-transparent'
              }`}
            >
              <span className={isActive ? 'text-[#3B82F6] font-bold' : 'text-[#64748B]'}>◇</span>
              
              <span className="truncate max-w-[150px] font-mono text-[11px]">{ws.name}</span>
              
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-[10px] px-1 py-0.2 rounded bg-[#090B0E] text-[#64748B] font-mono border border-[#2D3139]/60">
                  {poCount}L • {stringCount}S
                </span>

                {workspaces.length > 1 && (
                  <button
                    onClick={(e) => onCloseWorkspace(ws.id, e)}
                    className="p-0.5 rounded hover:bg-[#2D3139] text-[#64748B] hover:text-[#E2E8F0] transition-colors opacity-0 group-hover:opacity-100"
                    title="Close Workspace"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <button
          onClick={onNewWorkspace}
          className="p-1 rounded hover:bg-[#1C2128] text-[#64748B] hover:text-[#3B82F6] transition-colors ml-1 cursor-pointer"
          title="Create New Workspace"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
