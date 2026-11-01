import React from 'react';
import { Files, Bot, Settings, Wrench, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useI18n } from '../utils/i18n';

type Panel = 'explorer' | 'ai' | 'settings' | 'modifier';

interface ActivityBarProps {
  activePanel: Panel;
  onSelectPanel: (panel: Panel) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isAiPanelOpen?: boolean;
  onToggleAiPanel?: () => void;
  onOpenSettings?: () => void;
}

export default function ActivityBar({
  activePanel,
  onSelectPanel,
  isSidebarOpen,
  onToggleSidebar,
  isAiPanelOpen = false,
  onToggleAiPanel,
  onOpenSettings,
}: ActivityBarProps) {
  const { t } = useI18n();

  const iconBtn = (panel: Panel, Icon: React.ElementType, title: string) => {
    const isAi = panel === 'ai';
    const isSettings = panel === 'settings';
    const active = isAi ? isAiPanelOpen : (activePanel === panel && isSidebarOpen);

    return (
      <button
        key={panel}
        onClick={() => {
          if (isSettings && onOpenSettings) {
            onOpenSettings();
          } else if (isAi) {
            onToggleAiPanel?.();
          } else {
            if (activePanel === panel && isSidebarOpen) {
              onToggleSidebar();
            } else {
              onSelectPanel(panel);
              if (!isSidebarOpen) onToggleSidebar();
            }
          }
        }}
        title={title}
        className={`relative w-12 h-12 flex items-center justify-center select-none transition-colors duration-100 ${
          active
            ? 'text-[#FFFFFF]'
            : 'text-[#696969] hover:text-[#FFFFFF]'
        }`}
      >
        <Icon size={22} strokeWidth={1.5} />
        {active && (
          <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#0078D4]" />
        )}
      </button>
    );
  };

  return (
    <div className="w-12 bg-[#181818] flex flex-col justify-between items-center select-none z-10 shrink-0">
      {/* Top Main Navigation Icons */}
      <div className="flex flex-col w-full items-center">
        {iconBtn('explorer', Files, t('panel.explorer', 'Explorer'))}
        {iconBtn('ai', Bot, t('panel.ai', 'AI Assistant / Agent'))}
        {iconBtn('modifier', Wrench, t('panel.modifier', 'APK Modifier'))}
      </div>

      {/* Bottom Profile, Settings & Collapse Icons */}
      <div className="flex flex-col w-full items-center mb-1">
        <button
          onClick={() => {
            if (onOpenSettings) onOpenSettings();
            else {
              onSelectPanel('settings');
              if (!isSidebarOpen) onToggleSidebar();
            }
          }}
          className="w-12 h-10 flex items-center justify-center text-[#696969] hover:text-[#CCCCCC] transition-colors duration-100 cursor-pointer"
          title={t('panel.account', 'Account & Preferences')}
        >
          <User size={19} strokeWidth={1.5} />
        </button>

        {iconBtn('settings', Settings, t('panel.settings', 'Settings'))}

        <button
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Collapse Primary Side Bar' : 'Expand Primary Side Bar'}
          className="w-12 h-9 flex items-center justify-center text-[#696969] hover:text-[#CCCCCC] transition-colors duration-100"
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  );
}
