import { X, Copy, Download } from 'lucide-react';

interface BuildLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildLog: string[];
  buildStatus: string;
  buildProgress: number;
}

export default function BuildLogModal({
  isOpen,
  onClose,
  buildLog,
  buildStatus,
  buildProgress,
}: BuildLogModalProps) {
  if (!isOpen) return null;

  const handleCopyLog = () => {
    const logText = buildLog.join('\n');
    navigator.clipboard.writeText(logText);
  };

  const handleDownloadLog = () => {
    const logText = buildLog.join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `build-log-${new Date().toISOString().replace(/:/g, '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isBuilding = buildProgress >= 0;
  const hasErrors = buildLog.some(line => line.includes('❌'));
  const hasWarnings = buildLog.some(line => line.includes('⚠️'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#181818] rounded-[6px] shadow-2xl w-[90vw] max-w-4xl max-h-[80vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#181818] select-none">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-[#FFFFFF]">Build Log Console</h2>
            {hasErrors && (
              <span className="px-2 py-0.5 text-[10px] bg-[#1F1F1F] text-[#FFFFFF] font-medium rounded-[2px] uppercase">
                Errors
              </span>
            )}
            {hasWarnings && !hasErrors && (
              <span className="px-2 py-0.5 text-[10px] bg-[#1F1F1F] text-[#696969] font-medium rounded-[2px] uppercase">
                Warnings
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[#696969]">
            <button
              onClick={handleCopyLog}
              className="p-1.5 hover:bg-[#252526] hover:text-[#FFFFFF] rounded-[3px] transition-colors"
              title="Copy log to clipboard"
            >
              <Copy size={15} />
            </button>
            <button
              onClick={handleDownloadLog}
              className="p-1.5 hover:bg-[#252526] hover:text-[#FFFFFF] rounded-[3px] transition-colors"
              title="Download log file"
            >
              <Download size={15} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[#252526] hover:text-[#FFFFFF] rounded-[3px] transition-colors"
              disabled={isBuilding}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        {buildStatus && (
          <div className="px-5 py-2.5 bg-[#1F1F1F] select-none">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#FFFFFF] font-medium">{buildStatus}</span>
              {buildProgress >= 0 && (
                <span className="text-xs text-[#0078D4] font-mono font-medium">{buildProgress}%</span>
              )}
            </div>
            {buildProgress >= 0 && (
              <div className="w-full bg-[#181818] rounded-[2px] h-1.5 overflow-hidden">
                <div
                  className="h-full bg-[#0078D4] transition-all duration-150"
                  style={{ width: `${buildProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Log Content */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-[#1F1F1F] text-[#CCCCCC] select-text leading-relaxed">
          {buildLog.length === 0 ? (
            <div className="text-center text-[#696969] py-8 italic">
              No build logs yet. Click "Build APK" to trigger compilation.
            </div>
          ) : (
            buildLog.map((line, idx) => (
              <div
                key={idx}
                className={`py-0.5 whitespace-pre-wrap ${
                  line.includes('❌') || line.includes('error') || line.includes('Error')
                    ? 'text-[#FFFFFF] font-semibold'
                    : line.includes('⚠️') || line.includes('warning') || line.includes('Warning')
                    ? 'text-[#696969]'
                    : line.includes('✅') || line.includes('SUCCESS')
                    ? 'text-[#FFFFFF]'
                    : line.includes('📦') || line.includes('🔨') || line.includes('🔍')
                    ? 'text-[#0078D4]'
                    : 'text-[#CCCCCC]'
                }`}
              >
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
