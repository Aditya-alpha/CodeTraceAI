'use client';

import React, { useState, useEffect } from 'react';
import { FileCode, Folder, ChevronRight, Hash, Database, Network } from 'lucide-react';
import { getRepoFiles } from '../../lib/api';

export default function FilesTab({ repoId, files = [] }) {
  const [selectedFile, setSelectedFile] = useState(files[0]?.relativePath || '');
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFile && files.length > 0) {
      setSelectedFile(files[0].relativePath);
    }
  }, [files, selectedFile]);

  useEffect(() => {
    if (!selectedFile || !repoId) return;

    let isMounted = true;
    setLoading(true);

    getRepoFiles(repoId, selectedFile)
      .then((data) => {
        if (isMounted) {
          setFileContent(data.content || '// Empty file or binary content');
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFileContent(`// Error loading file content: ${err.message}`);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [repoId, selectedFile]);

  const activeFileData = files.find((f) => f.relativePath === selectedFile);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[720px]">
      {/* File Tree Explorer (Left) */}
      <div className="md:col-span-4 glass-panel rounded-2xl p-4 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Folder className="w-4 h-4 text-sky-400" />
            Repository Files ({files.length})
          </span>
          <span className="text-[10px] text-slate-500 font-mono">AST Parsed</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {files.map((file) => {
            const isSelected = file.relativePath === selectedFile;
            return (
              <button
                key={file.relativePath}
                onClick={() => setSelectedFile(file.relativePath)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                  <span className="truncate font-mono">{file.relativePath}</span>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0 font-mono ml-2">
                  {file.lineCount}L
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Code Viewer (Right) */}
      <div className="md:col-span-8 glass-panel rounded-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] bg-slate-900/40">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
            <span className="text-sky-400">{selectedFile || 'Select a file'}</span>
          </div>
          {activeFileData && (
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span>{activeFileData.lineCount} lines</span>
              <span>{(activeFileData.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </div>

        {/* Editor / Content Area */}
        <div className="flex-1 overflow-auto bg-[#070a10] p-4 font-mono text-xs leading-relaxed text-slate-300">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mr-2" />
              <span>Loading file content...</span>
            </div>
          ) : (
            <pre className="overflow-x-auto">
              {fileContent.split('\n').map((line, idx) => (
                <div key={idx} className="table-row hover:bg-white/[0.03]">
                  <span className="table-cell pr-4 text-slate-600 select-none text-right w-10">
                    {idx + 1}
                  </span>
                  <span className="table-cell whitespace-pre">{line}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
