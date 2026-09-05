'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch, Search, Sparkles, AlertCircle, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { analyzeRepo } from '../lib/api';

export default function RepoInput() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const presets = [
    {
      title: 'Real-World Multi-File Express App',
      desc: 'Nested routers (/api/v1), auth middleware, Mongoose models, branching articles route',
      value: 'fixture:express-sample-app',
      tag: 'Express Benchmark',
      color: 'sky',
    },
    {
      title: 'Non-Express Project (Rejection Test)',
      desc: 'Static HTML site to test graceful rejection without crashing',
      value: 'fixture:non-express-sample',
      tag: 'Negative Test',
      color: 'amber',
    },
    {
      title: 'RealWorld Node/Express Public Repo',
      desc: 'Full Conduit clone with JWT auth, articles, and comment routers',
      value: 'https://github.com/gothinkster/node-express-realworld-example-app',
      tag: 'Public GitHub',
      color: 'purple',
    },
  ];

  const handleSubmit = async (e, customUrl) => {
    if (e) e.preventDefault();
    const targetUrl = (customUrl || url).trim();

    if (!targetUrl) {
      setError('Please enter a valid GitHub repository URL or choose a preset sample.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await analyzeRepo(targetUrl);
      if (data && data.repoId) {
        router.push(`/repo/${data.repoId}`);
      } else {
        throw new Error('No repository ID returned from backend.');
      }
    } catch (err) {
      setError(err.message || 'Failed to start repository analysis.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Search Input Box */}
      <form onSubmit={(e) => handleSubmit(e)} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-sky-500/30 via-indigo-500/20 to-purple-500/30 rounded-2xl blur-lg opacity-70 group-hover:opacity-100 transition duration-500"></div>

        <div className="relative flex flex-col sm:flex-row items-center gap-3 p-2.5 rounded-2xl bg-[#0f172a]/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3 flex-1 w-full pl-3">
            <GitBranch className="w-5 h-5 text-sky-400 shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://github.com/expressjs/express or owner/repo..."
              className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm sm:text-base focus:outline-none py-2"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Initializing...</span>
              </>
            ) : (
              <>
                <span>Analyze Repository</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error state */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div>
            <div className="font-semibold text-rose-300">Analysis Error</div>
            <div className="text-rose-200/90 text-xs mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Presets & Samples */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            Quick Test Presets (Instant Local Fixtures)
          </span>
          <span className="text-xs text-slate-400">Deterministic verification</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setUrl(preset.value);
                handleSubmit(null, preset.value);
              }}
              disabled={loading}
              className="p-4 rounded-xl bg-[#0f172a]/60 border border-white/[0.08] hover:border-sky-500/30 hover:bg-[#0f172a] text-left transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      preset.color === 'sky'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        : preset.color === 'amber'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}
                  >
                    {preset.tag}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
                </div>
                <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white line-clamp-1">
                  {preset.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {preset.desc}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/[0.04] text-[11px] text-sky-400/80 font-mono">
                Click to load & analyze →
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
