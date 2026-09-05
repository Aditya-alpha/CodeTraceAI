'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GitFork, Terminal, BookOpen, ShieldCheck, Key } from 'lucide-react';
import { getApiConfig } from '../lib/api';
import ApiKeyModal from './ApiKeyModal';

export default function Navbar() {
  const [configData, setConfigData] = useState(null);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const fetchConfig = () => {
    getApiConfig()
      .then((data) => setConfigData(data))
      .catch((err) => console.log('Config fetch error:', err));
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#090d16]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
            <GitFork className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-sky-300 bg-clip-text text-transparent">
                CodeTrace<span className="text-sky-400">AI</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                v1 Express
              </span>
            </div>
            <span className="text-xs text-slate-400">AST Analysis & Repo Intelligence</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {/* Groq Key status badge */}
          <button
            onClick={() => setShowKeyModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              configData?.hasGroqKey
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
            }`}
            title="Configure Groq API Key"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{configData?.hasGroqKey ? `Groq: Connected` : 'Connect Groq Key'}</span>
          </button>

          <Link
            href="/"
            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors flex items-center gap-1.5"
          >
            <Terminal className="w-4 h-4 text-sky-400" />
            <span>New Analysis</span>
          </Link>
        </div>
      </div>

      <ApiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        onSaved={fetchConfig}
      />
    </header>
  );
}
