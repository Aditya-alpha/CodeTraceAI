'use client';

import React from 'react';
import { FileCode, Terminal } from 'lucide-react';

export default function MarkdownRenderer({ content = '' }) {
  if (!content) return null;

  // Split into lines to parse structured blocks
  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines = [];

  const parseInline = (text) => {
    // Regex for:
    // 1. Chinese citation brackets: 【file:lines】 or 【file】
    // 2. Square citation brackets: [file:lines]
    // 3. Bold text: **bold**
    // 4. Inline code: `code`
    const regex = /(【[^】]+】|\[[^\]]+:\d+[^\]]*\]|\*\*[^*]+\*\*|`[^`]+`)/g;
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (!part) return null;

      // Citation bracket 【path:lines】
      if (part.startsWith('【') && part.endsWith('】')) {
        const inner = part.slice(1, -1);
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono text-[11px] font-semibold align-baseline select-all"
          >
            <FileCode className="w-3 h-3 text-sky-400 shrink-0" />
            <span>{inner}</span>
          </span>
        );
      }

      // Citation bracket [path:lines]
      if (part.startsWith('[') && part.includes(':') && part.endsWith(']')) {
        const inner = part.slice(1, -1);
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono text-[11px] font-semibold align-baseline select-all"
          >
            <FileCode className="w-3 h-3 text-sky-400 shrink-0" />
            <span>{inner}</span>
          </span>
        );
      }

      // Bold **text**
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Inline code `code`
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-white/[0.08] text-sky-300 font-mono text-xs border border-white/[0.06]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return <span key={i}>{part}</span>;
    });
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Fenced Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <div key={`code-${idx}`} className="my-3 rounded-xl overflow-hidden bg-[#070a10] border border-white/[0.08]">
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/60 border-b border-white/[0.06] text-[10px] font-mono text-slate-400">
              <span>{codeBlockLang || 'javascript'}</span>
              <Terminal className="w-3 h-3 text-sky-400" />
            </div>
            <pre className="p-3.5 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = '';
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = line.trim().replace(/^```/, '');
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={idx} className="text-sm font-bold text-white mt-4 mb-2 flex items-center gap-1.5">
          {parseInline(line.replace(/^### /, ''))}
        </h4>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={idx} className="text-base font-bold text-white mt-5 mb-2.5">
          {parseInline(line.replace(/^## /, ''))}
        </h3>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={idx} className="text-lg font-extrabold text-white mt-5 mb-3">
          {parseInline(line.replace(/^# /, ''))}
        </h2>
      );
      continue;
    }

    // Unordered List Items (- or *)
    if (/^\s*[-*]\s+/.test(line)) {
      const clean = line.replace(/^\s*[-*]\s+/, '');
      elements.push(
        <li key={idx} className="ml-4 list-disc text-slate-200 text-xs sm:text-sm my-1 pl-1 leading-relaxed">
          {parseInline(clean)}
        </li>
      );
      continue;
    }

    // Numbered List Items (1. , 2. )
    if (/^\s*\d+\.\s+/.test(line)) {
      const numMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
      if (numMatch) {
        elements.push(
          <div key={idx} className="flex items-start gap-2 my-1.5 text-xs sm:text-sm text-slate-200">
            <span className="font-mono font-bold text-sky-400 shrink-0 mt-0.5">{numMatch[1]}.</span>
            <div className="flex-1 leading-relaxed">{parseInline(numMatch[2])}</div>
          </div>
        );
        continue;
      }
    }

    // Horizontal Rule
    if (line.trim() === '---') {
      elements.push(<hr key={idx} className="my-4 border-white/[0.08]" />);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={idx} className="h-2" />);
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={idx} className="text-xs sm:text-sm text-slate-200 leading-relaxed my-1">
        {parseInline(line)}
      </p>
    );
  }

  // If code block remained open at end
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <div key="code-end" className="my-3 rounded-xl overflow-hidden bg-[#070a10] border border-white/[0.08]">
        <pre className="p-3.5 text-xs font-mono text-slate-200 overflow-x-auto">
          <code>{codeBlockLines.join('\n')}</code>
        </pre>
      </div>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}
