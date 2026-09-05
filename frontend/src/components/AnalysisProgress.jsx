'use client';

import React from 'react';
import { Loader2, CheckCircle2, Clock, GitBranch, Cpu, Network, Database, Sparkles, AlertTriangle } from 'lucide-react';

export default function AnalysisProgress({ repo }) {
  const steps = [
    { key: 'cloning', label: 'Repository Ingestion & Workspace Scratch Setup', icon: GitBranch, threshold: 15 },
    { key: 'detecting', label: 'Express Framework & TypeScript Discovery', icon: Cpu, threshold: 30 },
    { key: 'ast', label: 'Babel AST Parsing & Heuristic Tagging', icon: Network, threshold: 60 },
    { key: 'routes', label: 'Cross-File Mounted Router Prefix Resolution', icon: Network, threshold: 75 },
    { key: 'chunks', label: 'Semantic AST Code Chunking & Vector Indexing', icon: Database, threshold: 90 },
  ];

  const currentPercent = repo?.progressPercent || 10;
  const currentStepText = repo?.progressStep || 'Analyzing repository...';

  return (
    <div className="w-full max-w-2xl mx-auto my-12 p-8 rounded-2xl bg-[#0f172a]/90 border border-white/[0.1] shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
            Analyzing {repo?.name || 'Repository'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">{currentStepText}</p>
        </div>
        <span className="text-sm font-mono font-bold text-sky-400 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20">
          {currentPercent}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mb-8">
        <div
          className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out"
          style={{ width: `${currentPercent}%` }}
        />
      </div>

      {/* Steps List */}
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isDone = currentPercent >= step.threshold;
          const isCurrent = !isDone && (idx === 0 || currentPercent >= steps[idx - 1].threshold);

          return (
            <div
              key={step.key}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                isDone
                  ? 'bg-emerald-500/[0.04] border-emerald-500/20 text-slate-200'
                  : isCurrent
                  ? 'bg-sky-500/[0.08] border-sky-500/30 text-white'
                  : 'bg-transparent border-white/[0.04] text-slate-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isCurrent
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'bg-white/[0.04] text-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">{step.label}</span>
              </div>

              <div>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-600" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
