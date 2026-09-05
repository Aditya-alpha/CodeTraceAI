'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { GitFork, Network, Database, BrainCircuit, ShieldCheck, ArrowRight, Activity } from 'lucide-react';
import RepoInput from '../components/RepoInput';
import { getRecentRepos } from '../lib/api';

export default function HomePage() {
  const [recentRepos, setRecentRepos] = useState([]);

  useEffect(() => {
    getRecentRepos()
      .then((data) => setRecentRepos(data.repos || []))
      .catch((err) => console.log('No recent repos or backend initializing...'));
  }, []);

  const features = [
    {
      icon: Network,
      title: 'Deterministic AST Analysis',
      desc: 'Babel parser extracts exact Express routes, mounted sub-routers, middleware chains, and branches. Not LLM guesswork.',
      color: 'sky',
    },
    {
      icon: Database,
      title: 'Semantic RAG Knowledge Base',
      desc: 'Chunks code strictly by function and route boundaries. Generates vector embeddings for source-grounded retrieval.',
      color: 'purple',
    },
    {
      icon: BrainCircuit,
      title: 'Attributable AI Q&A',
      desc: 'Groq GPT-OSS 120B reasons over bounded context and must cite exact file paths, line numbers, and function names.',
      color: 'emerald',
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-12 md:py-20 relative">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-sky-500/15 via-indigo-500/10 to-purple-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center space-y-4 mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold tracking-wide">
          <ShieldCheck className="w-4 h-4" />
          <span>CodeTraceAI Phase 1: Ingestion & AST Analysis</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Repository Intelligence & <br />
          <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Static AST Architecture
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Statically analyze Node.js Express repositories. Resolve multi-file mounted routers, query architecture with grounded RAG Q&A, and generate deterministic Mermaid.js flowcharts.
        </p>
      </div>

      {/* Repo Input Box & Presets */}
      <RepoInput />

      {/* Features Grid */}
      <div className="w-full max-w-5xl mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feat, i) => {
          const Icon = feat.icon;
          return (
            <div key={i} className="glass-panel-interactive p-6 rounded-2xl space-y-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  feat.color === 'sky'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    : feat.color === 'purple'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">{feat.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Repos Section */}
      {recentRepos.length > 0 && (
        <div className="w-full max-w-5xl mt-16 glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-sky-400" />
              Recently Analyzed Repositories
            </h3>
            <span className="text-xs text-slate-500 font-mono">{recentRepos.length} cached</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {recentRepos.map((r) => (
              <Link
                key={r._id}
                href={`/repo/${r._id}`}
                className="p-3.5 rounded-xl bg-[#080c14]/50 border border-white/[0.04] hover:border-sky-500/30 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                    {r.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {r.stats?.routeCount || 0} routes • {r.status}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
