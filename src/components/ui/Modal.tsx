import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // e.g., 'max-w-md', 'max-w-2xl', 'max-w-xl'
  headerGradient?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 'max-w-md',
  headerGradient = false,
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle smooth open/close animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), 200); // 200ms matches CSS transition
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    // Fixed container bounding to the scaled parent
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{ maxHeight: '100%' }}>
      
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`} 
        onClick={onClose}
      />

      {/* Modal Window */}
      <div 
        className={`relative flex flex-col bg-[#16191E] border border-[#2D3139] rounded-xl shadow-2xl overflow-hidden w-full ${maxWidth} max-h-full transition-all duration-200 ease-out transform ${
          isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b border-[#2D3139] flex items-start justify-between shrink-0 ${
          headerGradient ? 'bg-gradient-to-b from-[#1C2128] to-[#16191E]' : 'bg-[#1C2128]'
        }`}>
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-1.5 rounded-lg bg-[#3B82F61A] text-[#3B82F6] border border-[#3B82F633] shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">{title}</h2>
              {subtitle && (
                <div className="text-[11px] text-[#94A3B8] mt-0.5 leading-tight font-mono">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#2D3748] transition-colors cursor-pointer shrink-0 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar text-xs bg-[#16191E]">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-[#2D3139] bg-[#090B0E] flex items-center justify-between shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};