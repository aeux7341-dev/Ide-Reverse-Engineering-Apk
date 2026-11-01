import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function parseInline(text: string): React.ReactNode[] {
  // Matches inline code, bold, links, italic
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*]+\*|_[^_]+_)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;

    // Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          className="bg-[#1F1F1F] text-[#9CDCFE] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#2B2B2B]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold: **bold** or __bold__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return (
        <strong key={i} className="font-semibold text-white">
          {parseInline(part.slice(2, -2))}
        </strong>
      );
    }

    // Italic: *italic* or _italic_
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return (
        <em key={i} className="italic text-[#E5E5E5]">
          {parseInline(part.slice(1, -1))}
        </em>
      );
    }

    // Link: [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      const url = linkMatch[2];
      return (
        <a
          key={i}
          href={url}
          onClick={(e) => {
            e.preventDefault();
            const electron = (window as any).electronAPI;
            if (electron?.openExternal) electron.openExternal(url);
            else window.open(url, '_blank');
          }}
          className="text-[#0078D4] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
          title={url}
        >
          <span>{linkMatch[1]}</span>
          <ExternalLink size={10} className="inline opacity-70" />
        </a>
      );
    }

    return <span key={i}>{part}</span>;
  });
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-[4px] bg-[#141414] border border-[#2B2B2B] overflow-hidden text-[11px] font-mono">
      <div className="flex items-center justify-between px-3 py-1 bg-[#1F1F1F] text-[#858585] text-[10px] border-b border-[#2B2B2B]">
        <span className="font-sans font-medium">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="hover:text-white flex items-center gap-1 transition-colors px-1 py-0.5 rounded"
          title="Copy code"
        >
          {copied ? <Check size={11} className="text-[#23D18B]" /> : <Copy size={11} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[#D4D4D4] whitespace-pre leading-relaxed font-mono">
        {code}
      </pre>
    </div>
  );
}

export default function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  if (!content) return null;

  // Split into code blocks and normal markdown segments
  const segments: Array<{ type: 'code' | 'text'; content: string; language?: string }> = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }
    segments.push({
      type: 'code',
      language: match[1].trim() || 'text',
      content: match[2].trimEnd(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  return (
    <div className={`space-y-2 text-xs leading-relaxed text-[#CCCCCC] ${className}`}>
      {segments.map((seg, segIdx) => {
        if (seg.type === 'code') {
          return <CodeBlock key={segIdx} code={seg.content} language={seg.language || ''} />;
        }

        // Process markdown text block: headers, lists, quotes, paragraphs
        const lines = seg.content.split(/\r?\n/);
        const elements: React.ReactNode[] = [];
        let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;

        const flushList = () => {
          if (!listBuffer) return;
          if (listBuffer.type === 'ul') {
            elements.push(
              <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-1 pl-1">
                {listBuffer.items.map((item, i) => (
                  <li key={i} className="text-[#CCCCCC]">
                    {parseInline(item)}
                  </li>
                ))}
              </ul>
            );
          } else {
            elements.push(
              <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-1 pl-1">
                {listBuffer.items.map((item, i) => (
                  <li key={i} className="text-[#CCCCCC]">
                    {parseInline(item)}
                  </li>
                ))}
              </ol>
            );
          }
          listBuffer = null;
        };

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          if (!trimmed) {
            flushList();
            continue;
          }

          // Headers
          if (trimmed.startsWith('### ')) {
            flushList();
            elements.push(
              <h3 key={i} className="text-xs font-bold text-white mt-2 mb-1 flex items-center gap-1.5">
                <span className="w-1 h-3 bg-[#0078D4] rounded-full inline-block" />
                <span>{parseInline(trimmed.slice(4))}</span>
              </h3>
            );
            continue;
          }

          if (trimmed.startsWith('## ')) {
            flushList();
            elements.push(
              <h2 key={i} className="text-sm font-bold text-white mt-3 mb-1 pb-1 border-b border-[#2B2B2B]">
                {parseInline(trimmed.slice(3))}
              </h2>
            );
            continue;
          }

          if (trimmed.startsWith('# ')) {
            flushList();
            elements.push(
              <h1 key={i} className="text-sm font-bold text-white mt-3 mb-1.5 pb-1 border-b border-[#333333]">
                {parseInline(trimmed.slice(2))}
              </h1>
            );
            continue;
          }

          // Blockquote
          if (trimmed.startsWith('> ')) {
            flushList();
            elements.push(
              <blockquote key={i} className="border-l-2 border-[#0078D4] pl-2.5 my-1 text-[#858585] italic">
                {parseInline(trimmed.slice(2))}
              </blockquote>
            );
            continue;
          }

          // Bullet list: - or *
          const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
          if (bulletMatch) {
            if (!listBuffer || listBuffer.type !== 'ul') {
              flushList();
              listBuffer = { type: 'ul', items: [] };
            }
            listBuffer.items.push(bulletMatch[1]);
            continue;
          }

          // Numbered list: 1. 2. etc
          const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
          if (orderedMatch) {
            if (!listBuffer || listBuffer.type !== 'ol') {
              flushList();
              listBuffer = { type: 'ol', items: [] };
            }
            listBuffer.items.push(orderedMatch[1]);
            continue;
          }

          // Regular paragraph line
          flushList();
          elements.push(
            <p key={i} className="my-0.5 break-words">
              {parseInline(line)}
            </p>
          );
        }

        flushList();
        return <React.Fragment key={segIdx}>{elements}</React.Fragment>;
      })}
    </div>
  );
}
