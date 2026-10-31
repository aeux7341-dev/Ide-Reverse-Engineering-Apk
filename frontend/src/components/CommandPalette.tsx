import React, { useState, useEffect, useRef } from 'react';
import { Search, FileCode } from 'lucide-react';

interface FileItem {
  path: string;
  handle: FileSystemFileHandle;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  fileList: FileItem[];
  onSelectFile: (path: string, handle: FileSystemFileHandle) => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  fileList,
  onSelectFile,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle global escape or enter keys
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter files by query (fuzzy substring match)
  const filteredFiles = fileList
    .filter((file) => file.path.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(1, filteredFiles.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredFiles.length) % Math.max(1, filteredFiles.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredFiles[activeIndex]) {
        const item = filteredFiles[activeIndex];
        onSelectFile(item.path, item.handle);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-start pt-[12vh] z-50 px-4">
      {/* Backdrop closer */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Search Palette Container */}
      <div
        className="w-full max-w-xl bg-[#181818] rounded-[6px] shadow-2xl overflow-hidden flex flex-col relative z-10 text-xs"
        onKeyDown={handleKeyDown}
      >
        {/* Search Box input */}
        <div className="flex items-center gap-3 px-3.5 py-2.5 bg-[#181818]">
          <Search className="text-[#0078D4]" size={16} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type the name of a file to open (e.g. AndroidManifest.xml, MainActivity.smali)..."
            className="flex-1 bg-transparent text-[#FFFFFF] text-xs border-none focus:outline-none focus:ring-0 placeholder-[#696969] caret-[#0078D4]"
          />
          <span className="text-[10px] text-[#696969] bg-[#1F1F1F] px-1.5 py-0.5 rounded-[2px]">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-1 bg-[#181818]">
          {filteredFiles.length === 0 ? (
            <div className="px-4 py-4 text-xs text-[#696969] italic text-center">
              No matching files found.
            </div>
          ) : (
            filteredFiles.map((file, index) => {
              const isSelected = index === activeIndex;
              const name = file.path.split('/').pop() || '';
              const folder = file.path.split('/').slice(0, -1).join('/');

              return (
                <div
                  key={file.path}
                  onClick={() => {
                    onSelectFile(file.path, file.handle);
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#0078D4] text-[#FFFFFF]'
                      : 'text-[#CCCCCC] hover:bg-[#252526]'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileCode size={14} className={isSelected ? 'text-[#FFFFFF]' : 'text-[#696969]'} />
                    <span className="font-medium truncate">{name}</span>
                  </div>
                  {folder && (
                    <span
                      className={`text-[11px] truncate max-w-[200px] ml-4 ${
                        isSelected ? 'text-white/80' : 'text-[#696969]'
                      }`}
                    >
                      {folder}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
