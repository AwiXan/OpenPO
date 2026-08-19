import React from 'react';
import { Toggle } from './Toggle';

interface SettingToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  icon,
  title,
  description,
  checked,
  onChange,
}) => {
  return (
    // Добавил hover:border-[#3B82F644] для легкой реакции на наведение
    <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] flex items-center justify-between gap-4 transition-colors hover:border-[#3B82F644]">
      <div>
        <label className="text-white font-semibold flex items-center gap-1.5 cursor-pointer" onClick={() => onChange(!checked)}>
          {icon}
          <span>{title}</span>
        </label>
        <p className="text-[11px] text-[#64748B] mt-0.5">
          {description}
        </p>
      </div>
      
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
};