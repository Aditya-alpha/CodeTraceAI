'use client';

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Copy, Check, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

export default function MermaidViewer({ chartCode, title = 'Flowchart' }) {
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [renderError, setRenderError] = useState(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: 'transparent',
        fontFamily: 'Inter, system-ui, sans-serif',
        primaryColor: '#1e293b',
        primaryBorderColor: '#38bdf8',
        lineColor: '#64748b',
      },
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
      },
    });
  }, []);

  useEffect(() => {
    if (!chartCode) return;

    let isMounted = true;
    const renderChart = async () => {
      try {
        setRenderError(null);
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chartCode);
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (err) {
        console.warn('[MermaidViewer] Render error:', err);
        if (isMounted) {
          setRenderError(err.message || 'Failed to render flowchart');
        }
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chartCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(chartCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_flowchart.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex flex-col rounded-2xl bg-[#0f172a]/80 border border-white/[0.08] overflow-hidden shadow-xl">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-slate-900/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">{title}</span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Deterministic AST Graph
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-slate-400 px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-white/[0.1] mx-1" />

          {/* Action buttons */}
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors flex items-center gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Mermaid'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors flex items-center gap-1"
            title="Download SVG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        className="w-full min-h-[420px] max-h-[650px] overflow-auto p-8 flex items-center justify-center bg-[#080c14]/60 relative"
      >
        {renderError ? (
          <div className="text-center p-6 max-w-md">
            <p className="text-sm font-semibold text-rose-400">Flowchart Syntax Parsing Notice</p>
            <p className="text-xs text-slate-400 mt-1">{renderError}</p>
            <div className="mt-4 p-3 bg-black/50 rounded-lg text-left overflow-x-auto text-[11px] font-mono text-slate-300">
              {chartCode}
            </div>
          </div>
        ) : svgContent ? (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
            className="select-none"
          />
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span>Generating AST graph layout...</span>
          </div>
        )}
      </div>
    </div>
  );
}
