import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface TerminalTabMeta {
  id: string;
  name: string;
  shellType: 'powershell' | 'cmd' | 'bash';
}

export interface TerminalPanelRef {
  createTerminal: (shellType?: 'powershell' | 'cmd' | 'bash', initialCommand?: string) => void;
  killTerminal: (id?: string) => void;
  switchTerminal: (id: string) => void;
  clearTerminal: () => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

export interface TerminalPanelProps {
  workspacePath?: string | null;
  onTabsChange?: (tabs: TerminalTabMeta[], activeId: string) => void;
}

const VSCODE_THEME = {
  background: '#181818',
  foreground: '#CCCCCC',
  cursor: '#FFFFFF',
  cursorAccent: '#181818',
  selectionBackground: '#264F78',
  selectionForeground: '#FFFFFF',
  black: '#181818',
  red: '#F14C4C',
  green: '#23D18B',
  yellow: '#F5D93D',
  blue: '#0078D4',
  magenta: '#BC3FBC',
  cyan: '#29B8DB',
  white: '#E5E5E5',
  brightBlack: '#696969',
  brightRed: '#F14C4C',
  brightGreen: '#23D18B',
  brightYellow: '#F5D93D',
  brightBlue: '#3B8EEA',
  brightMagenta: '#D670D6',
  brightCyan: '#29B8DB',
  brightWhite: '#FFFFFF',
};

interface TabInstance {
  id: string;
  name: string;
  shellType: 'powershell' | 'cmd' | 'bash';
  term: Terminal;
  fitAddon: FitAddon;
  element: HTMLDivElement;
  commandBuffer: string;
  unsubData?: () => void;
  unsubExit?: () => void;
}

const TerminalPanel = forwardRef<TerminalPanelRef, TerminalPanelProps>(
  ({ workspacePath, onTabsChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const tabsRef = useRef<Map<string, TabInstance>>(new Map());

    const [tabList, setTabList] = useState<TerminalTabMeta[]>([
      { id: 'term-1', name: '1: pwsh', shellType: 'powershell' },
    ]);
    const [activeId, setActiveId] = useState<string>('term-1');

    // Notify parent on tab state change
    useEffect(() => {
      onTabsChange?.(tabList, activeId);
    }, [tabList, activeId, onTabsChange]);

    // Initialize or show tab
    const initTerminalTab = (
      id: string,
      name: string,
      shellType: 'powershell' | 'cmd' | 'bash'
    ) => {
      if (!containerRef.current) return;
      if (tabsRef.current.has(id)) return;

      const termWrapper = document.createElement('div');
      termWrapper.className =
        'w-full h-full p-2 overflow-hidden bg-[#181818]';
      termWrapper.style.display = id === activeId ? 'block' : 'none';
      containerRef.current.appendChild(termWrapper);

      const term = new Terminal({
        theme: VSCODE_THEME,
        fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
        fontSize: 12.5,
        lineHeight: 1.25,
        cursorBlink: true,
        cursorStyle: 'block',
        convertEol: true,
        scrollback: 5000,
        allowTransparency: false,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termWrapper);

      // Link provider: recognizes URLs, underlines them, and opens them on click/ctrl+click
      const urlRegex = /(https?:\/\/[^\s<>"'{}|\\^`]+)/g;
      term.registerLinkProvider({
        provideLinks(bufferLineNumber, callback) {
          const line = term.buffer.active.getLine(bufferLineNumber - 1);
          if (!line) return callback(undefined);
          const lineText = line.translateToString(true);
          const links: any[] = [];
          let match: RegExpExecArray | null;
          urlRegex.lastIndex = 0;
          while ((match = urlRegex.exec(lineText)) !== null) {
            const url = match[1];
            const startX = match.index + 1;
            const endX = startX + url.length;
            links.push({
              text: url,
              range: {
                start: { x: startX, y: bufferLineNumber },
                end: { x: endX, y: bufferLineNumber },
              },
              decorations: {
                pointerCursor: true,
                underline: true,
              },
              activate(_event: MouseEvent, text: string) {
                const electron = (window as any).electronAPI;
                if (electron?.openExternal) {
                  electron.openExternal(text);
                } else {
                  window.open(text, '_blank');
                }
              },
            });
          }
          callback(links);
        },
      });

      // Keyboard handler: Ctrl+C copies selection, Ctrl+V pastes
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.type === 'keydown') {
          // Ctrl+C with text selected -> copy selection to clipboard
          if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && term.hasSelection()) {
            navigator.clipboard.writeText(term.getSelection());
            return false;
          }
          // Ctrl+Shift+C -> always copy selection
          if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c') && term.hasSelection()) {
            navigator.clipboard.writeText(term.getSelection());
            return false;
          }
          // Ctrl+Shift+V or Ctrl+V -> paste
          if (
            (e.ctrlKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) ||
            (e.ctrlKey && (e.key === 'v' || e.key === 'v'))
          ) {
            navigator.clipboard.readText().then((clipText) => {
              if (clipText) {
                const electron = (window as any).electronAPI;
                if (electron?.sendTerminalInput) {
                  electron.sendTerminalInput(id, clipText);
                } else {
                  term.write(clipText);
                }
              }
            });
            return false;
          }
        }
        return true;
      });

      // Right-click on terminal: copy if selection exists, else paste from clipboard
      termWrapper.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection());
        } else {
          navigator.clipboard.readText().then((clipText) => {
            if (clipText) {
              const electron = (window as any).electronAPI;
              if (electron?.sendTerminalInput) {
                electron.sendTerminalInput(id, clipText);
              } else {
                term.write(clipText);
              }
            }
          });
        }
      });

      // Perform initial fit
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch {}
      });

      const tabInstance: TabInstance = {
        id,
        name,
        shellType,
        term,
        fitAddon,
        element: termWrapper,
        commandBuffer: '',
      };
      tabsRef.current.set(id, tabInstance);

      const electronAPI = (window as any).electronAPI;

      if (electronAPI?.createTerminal) {
        electronAPI.createTerminal({
          id,
          shellType,
          cwd: workspacePath || null,
          cols: term.cols,
          rows: term.rows,
        });

        const unsubData = electronAPI.onTerminalData?.(id, (chunk: string) => {
          term.write(chunk);
        });

        const unsubExit = electronAPI.onTerminalExit?.(id, (code: number) => {
          term.write(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m\r\n`);
        });

        tabInstance.unsubData = unsubData;
        tabInstance.unsubExit = unsubExit;

        term.onData((data) => {
          electronAPI.sendTerminalInput(id, data);
        });

        term.onResize(({ cols, rows }) => {
          electronAPI.resizeTerminal?.(id, cols, rows);
        });
      } else {
        // Web fallback simulation with clean readline loop
        term.writeln('PowerShell 7.6.9 [Web Emulation Runtime]');
        term.write('○ PS C:\\ApkRtool-IDE> ');

        term.onData((data) => {
          if (data === '\r') {
            // Enter key
            term.write('\r\n');
            const cmd = tabInstance.commandBuffer.trim();
            tabInstance.commandBuffer = '';

            if (cmd === 'cls' || cmd === 'clear') {
              term.clear();
            } else if (cmd === 'adb devices') {
              term.writeln('List of devices attached');
              term.writeln('emulator-5554\tdevice');
            } else if (cmd === 'apktool --version' || cmd === 'apktool -version') {
              term.writeln('2.9.3');
            } else if (cmd) {
              term.writeln(`Executing: ${cmd}`);
            }
            term.write('○ PS C:\\ApkRtool-IDE> ');
          } else if (data === '\u007F' || data === '\b') {
            // Backspace
            if (tabInstance.commandBuffer.length > 0) {
              tabInstance.commandBuffer = tabInstance.commandBuffer.slice(0, -1);
              term.write('\b \b');
            }
          } else if (data === '\u0003') {
            // Ctrl+C
            term.write('^C\r\n○ PS C:\\ApkRtool-IDE> ');
            tabInstance.commandBuffer = '';
          } else if (data >= ' ') {
            tabInstance.commandBuffer += data;
            term.write(data);
          }
        });
      }

      // Handle context menu paste
      termWrapper.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            if (electronAPI?.sendTerminalInput) {
              electronAPI.sendTerminalInput(id, text);
            } else {
              tabInstance.commandBuffer += text;
              term.write(text);
            }
          }
        } catch {}
      });
    };

    // Initialize first terminal on mount
    useEffect(() => {
      initTerminalTab('term-1', '1: pwsh', 'powershell');

      // Resize observer to keep xterm fitted to BottomPanel height
      const observer = new ResizeObserver(() => {
        const current = tabsRef.current.get(activeId);
        if (current) {
          try {
            current.fitAddon.fit();
          } catch {}
        }
      });

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      return () => {
        observer.disconnect();
        tabsRef.current.forEach((instance) => {
          try {
            instance.unsubData?.();
            instance.unsubExit?.();
            instance.term.dispose();
            instance.element.remove();
          } catch {}
        });
        tabsRef.current.clear();
      };
    }, []);

    // Switch visible terminal element when activeId changes
    useEffect(() => {
      tabsRef.current.forEach((instance, id) => {
        if (id === activeId) {
          instance.element.style.display = 'block';
          try {
            instance.fitAddon.fit();
            instance.term.focus();
          } catch {}
        } else {
          instance.element.style.display = 'none';
        }
      });
    }, [activeId]);

    // Imperative actions for dock controls
    useImperativeHandle(ref, () => ({
      createTerminal: (shellType = 'powershell', initialCommand?: string) => {
        const nextNum = tabList.length + 1;
        const shortName = shellType === 'powershell' ? 'pwsh' : shellType;
        const newId = `term-${Date.now()}`;
        const newTab: TerminalTabMeta = {
          id: newId,
          name: `${nextNum}: ${shortName}`,
          shellType,
        };

        setTabList((prev) => [...prev, newTab]);
        initTerminalTab(newId, newTab.name, shellType);
        setActiveId(newId);

        if (initialCommand) {
          setTimeout(() => {
            const electronAPI = (window as any).electronAPI;
            electronAPI?.sendTerminalInput?.(newId, `${initialCommand}\r\n`);
          }, 350);
        }
      },

      killTerminal: (id?: string) => {
        const targetId = id || activeId;
        const electronAPI = (window as any).electronAPI;
        electronAPI?.killTerminal?.(targetId);

        const instance = tabsRef.current.get(targetId);
        if (instance) {
          try {
            instance.unsubData?.();
            instance.unsubExit?.();
            instance.term.dispose();
            instance.element.remove();
          } catch {}
          tabsRef.current.delete(targetId);
        }

        if (tabList.length <= 1) {
          // Re-create pristine tab
          const newId = `term-${Date.now()}`;
          const newTab: TerminalTabMeta = {
            id: newId,
            name: '1: pwsh',
            shellType: 'powershell',
          };
          setTabList([newTab]);
          initTerminalTab(newId, newTab.name, 'powershell');
          setActiveId(newId);
          return;
        }

        const remaining = tabList.filter((t) => t.id !== targetId);
        setTabList(remaining);
        if (activeId === targetId) {
          setActiveId(remaining[remaining.length - 1].id);
        }
      },

      switchTerminal: (id: string) => {
        setActiveId(id);
      },

      clearTerminal: () => {
        const instance = tabsRef.current.get(activeId);
        if (instance) {
          instance.term.clear();
          const electronAPI = (window as any).electronAPI;
          if (electronAPI?.sendTerminalInput) {
            electronAPI.sendTerminalInput(activeId, '\r\n');
          } else {
            instance.term.write('○ PS C:\\ApkRtool-IDE> ');
          }
        }
      },

      scrollToTop: () => {
        const instance = tabsRef.current.get(activeId);
        instance?.term.scrollToTop();
      },

      scrollToBottom: () => {
        const instance = tabsRef.current.get(activeId);
        instance?.term.scrollToBottom();
      },
    }));

    return (
      <div
        ref={containerRef}
        className="h-full w-full bg-[#181818] overflow-hidden relative cursor-text select-text"
      />
    );
  }
);

TerminalPanel.displayName = 'TerminalPanel';

export default TerminalPanel;
