'use client';

import React from 'react';
import {
  FileCode2,
  Route as RouteIcon,
  Code2,
  Database,
  Globe,
  Boxes,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

export default function OverviewTab({ repo, overviewData, setActiveTab, setSelectedRouteId }) {
  const stats = repo?.stats || {};
  const metadata = repo?.metadata || {};

  const cards = [
    { label: 'Source Files', value: stats.fileCount || 0, icon: FileCode2, color: 'sky' },
    { label: 'Discovered APIs', value: stats.routeCount || 0, icon: RouteIcon, color: 'purple' },
    { label: 'Functions Analyzed', value: stats.functionCount || 0, icon: Code2, color: 'indigo' },
    { label: 'Semantic Chunks', value: stats.chunkCount || 0, icon: Boxes, color: 'emerald' },
    { label: 'DB Calls Tagged', value: stats.dbCallCount || 0, icon: Database, color: 'amber' },
    { label: 'External HTTP Calls', value: stats.httpCallCount || 0, icon: Globe, color: 'rose' },
  ];

  return (
    <div className="space-y-8">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{c.label}</span>
                <div className="p-1.5 rounded-lg bg-white/[0.04]">
                  <Icon className="w-4 h-4 text-slate-300" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold font-mono tracking-tight text-white">
                  {c.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tech Stack & Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl md:col-span-1 space-y-4">
          <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            Detected Stack & Configuration
          </h4>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-slate-400">Framework</span>
              <span className="font-semibold text-sky-400 capitalize">{repo?.framework || 'Express'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-slate-400">Express Version</span>
              <span className="font-mono text-slate-200">{metadata.expressVersion || 'v4.x (inferred)'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-slate-400">TypeScript Support</span>
              <span className="font-medium text-slate-200">
                {metadata.hasTypeScript ? 'Enabled' : 'JavaScript (CommonJS/ESM)'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-slate-400">Primary Datastore</span>
              <span className="font-medium text-emerald-400">MongoDB / Mongoose (tagged)</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400">Vector Search</span>
              <span className="font-medium text-purple-400">Atlas Vector / Cosine Fallback</span>
            </div>
          </div>
        </div>

        {/* Routes Preview */}
        <div className="glass-panel p-6 rounded-2xl md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-purple-400" />
              Discovered Endpoints Snapshot
            </h4>
            <button
              onClick={() => setActiveTab('apis')}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <span>View all {stats.routeCount || 0} APIs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {(overviewData?.routesSummary?.sampleRoutes || []).slice(0, 5).map((route, i) => {
              const methodColor =
                route.method === 'GET'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : route.method === 'POST'
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  : route.method === 'PUT' || route.method === 'PATCH'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

              return (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[#080c14]/40 border border-white/[0.04] flex items-center justify-between hover:border-white/[0.1] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${methodColor} border`}>
                      {route.method}
                    </span>
                    <span className="text-xs font-mono text-slate-200 font-medium">
                      {route.resolvedPath}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {route.middlewares && route.middlewares.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {route.middlewares.join(', ')}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setSelectedRouteId(route._id);
                        setActiveTab('flowcharts');
                      }}
                      className="text-[11px] text-slate-400 hover:text-sky-400 font-medium transition-colors"
                    >
                      Flowchart →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
