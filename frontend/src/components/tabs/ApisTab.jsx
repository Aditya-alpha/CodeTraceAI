'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Database, GitBranch, ArrowUpRight, MessageSquareCode, ShieldAlert } from 'lucide-react';
import { getRepoApis } from '../../lib/api';

export default function ApisTab({ repoId, onSelectRouteForChart, onAskRouteInQa }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const methods = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    getRepoApis(repoId, selectedMethod, searchQuery)
      .then((data) => {
        setRoutes(data.routes || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching APIs:', err);
        setLoading(false);
      });
  }, [repoId, selectedMethod, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl glass-panel">
        {/* Method Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {methods.map((method) => (
            <button
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                selectedMethod === method
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {method}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resolved route path..."
            className="w-full bg-[#080c14]/80 text-xs text-slate-100 placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 border border-white/[0.08] focus:outline-none focus:border-sky-500/50"
          />
        </div>
      </div>

      {/* Route Inventory Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            Discovered Express Endpoints ({routes.length})
          </h3>
          <span className="text-xs text-slate-400">Resolved callable paths</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading endpoints...</span>
          </div>
        ) : routes.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No endpoints matched the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {routes.map((route) => {
              const methodColor =
                route.method === 'GET'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : route.method === 'POST'
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  : route.method === 'PUT' || route.method === 'PATCH'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

              const hasDbCalls = (route.dbCalls || []).length > 0;
              const hasBranches = (route.branches || []).length > 0;

              return (
                <div
                  key={route._id}
                  className="p-4 sm:px-6 hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${methodColor} shrink-0 mt-0.5`}>
                      {route.method}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-semibold text-slate-100">
                          {route.resolvedPath}
                        </span>
                        {route.rawPath !== route.resolvedPath && (
                          <span className="text-[10px] font-mono text-slate-400" title="Mounted from sub-router">
                            (raw: {route.rawPath})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="text-slate-400 font-mono">
                          {route.filePath}:{route.loc?.startLine || '?'}
                        </span>
                        <span>•</span>
                        <span>Handler: <code className="text-sky-300 font-mono">{route.handlerName}</code></span>

                        {route.middlewares && route.middlewares.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              Middleware:
                              {route.middlewares.map((mw, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px] font-mono border border-indigo-500/20">
                                  {mw}
                                </span>
                              ))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metadata Tags & Actions */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                    {hasDbCalls && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20" title="AST tagged database queries">
                        <Database className="w-3 h-3" />
                        <span>{route.dbCalls.length} DB</span>
                      </span>
                    )}

                    {hasBranches && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-[11px] font-medium border border-amber-500/20" title="Conditional branches">
                        <GitBranch className="w-3 h-3" />
                        <span>{route.branches.length} Branches</span>
                      </span>
                    )}

                    <button
                      onClick={() => onSelectRouteForChart(route._id)}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <span>Flowchart</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onAskRouteInQa(`Explain the flow and validation of ${route.method} ${route.resolvedPath}`)}
                      className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-xs font-medium text-sky-400 border border-sky-500/20 transition-colors flex items-center gap-1"
                    >
                      <MessageSquareCode className="w-3.5 h-3.5" />
                      <span>Ask AI</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
