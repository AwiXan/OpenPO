import React, { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Workspace } from '../types/gettext';

interface WorkspaceTabsProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onCloseWorkspace: (id: string, e: React.MouseEvent) => void;
  onNewWorkspace: () => void;
  onReorderWorkspaces: (startIndex: number, endIndex: number) => void;
}

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCloseWorkspace,
  onNewWorkspace,
  onReorderWorkspaces,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Горизонтальный скролл колесиком мыши (как в VS Code)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Глобальный слушатель для отпускания мыши (сбрасывает drag)
  useEffect(() => {
    const handlePointerUp = () => {
      if (draggingId) {
        setDraggingId(null);
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [draggingId]);

  // Начало перетаскивания
  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    // Реагируем только на левую кнопку мыши
    if (e.button !== 0) return;
    
    // Блокируем drag, если кликнули по кнопке закрытия
    if ((e.target as HTMLElement).closest('button')) return;

    setDraggingId(id);
    document.body.style.cursor = 'grabbing';
    onSelectWorkspace(id); // Сразу делаем таб активным для красоты
  };

  // Моментальная смена мест при наведении
  const handlePointerEnter = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;

    const startIndex = workspaces.findIndex(w => w.id === draggingId);
    const endIndex = workspaces.findIndex(w => w.id === targetId);

    if (startIndex !== -1 && endIndex !== -1) {
      onReorderWorkspaces(startIndex, endIndex);
    }
  };

  return (
    <div 
      ref={scrollRef}
      className="flex items-center h-9 px-3 gap-1 bg-[#090B0E] border-b border-[#2D3139] overflow-x-auto no-scrollbar relative"
    >
      <div className="flex items-center gap-1 h-full w-max">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const isDragging = draggingId === ws.id;
          const poCount = ws.poFiles.length;
          const stringCount = ws.potFile.entries.length;

          return (
            <div
              key={ws.id}
              onPointerDown={(e) => handlePointerDown(ws.id, e)}
              onPointerEnter={() => handlePointerEnter(ws.id)}
              className={`group flex items-center gap-2 px-3 h-full text-xs font-medium cursor-pointer transition-colors border-x border-[#2D3139] select-none ${
                isActive
                  ? 'bg-[#16191E] border-t-2 border-t-[#3B82F6] text-[#E2E8F0] shadow-xs'
                  : 'bg-[#090B0E] text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0] border-t-2 border-t-transparent'
              } ${isDragging ? 'opacity-50 !bg-[#1E293B]' : ''}`}
            >
              <span className={`pointer-events-none ${isActive ? 'text-[#3B82F6] font-bold' : 'text-[#64748B]'}`}>◇</span>
              
              <span className="truncate max-w-[150px] font-mono text-[11px] pointer-events-none">
                {ws.name}
              </span>
              
              {ws.isModified && (
                <span className="text-[#38BDF8] ml-1 pointer-events-none">*</span>
              )}
              
              <div className="flex items-center gap-1.5 ml-1 pointer-events-none">
                <span className="text-[10px] px-1 py-0.2 rounded bg-[#090B0E] text-[#64748B] font-mono border border-[#2D3139]/60">
                  {poCount}L • {stringCount}S
                </span>
              </div>

              {workspaces.length > 1 && (
                <button
                  onClick={(e) => onCloseWorkspace(ws.id, e)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="p-0.5 rounded hover:bg-[#2D3139] text-[#64748B] hover:text-[#E2E8F0] transition-colors opacity-0 group-hover:opacity-100 cursor-pointer ml-1 z-10"
                  title="Close Workspace"
                >
                  <X className="w-3 h-3 pointer-events-none" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={onNewWorkspace}
          className="p-1 rounded hover:bg-[#1C2128] text-[#64748B] hover:text-[#3B82F6] transition-colors ml-1 cursor-pointer shrink-0"
          title="Create New Workspace"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};