'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Database,
  GitBranch,
  ArrowUpRight,
  MessageSquareCode,
  ShieldCheck,
  ShieldAlert,
  TestTube2,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  Key,
} from 'lucide-react';
import { getRepoApis } from '../../lib/api';

export default function ApisTab({
  repoId,
  onSelectRouteForChart,
  onSelectRouteForTesting,
  onAskRouteInQa,
}) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRouteId, setExpandedRouteId] = useState(null);

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

  const toggleExpand = (routeId) => {
    setExpandedRouteId((prev) => (prev === routeId ? null : routeId));
  };

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
            Formal API Inventory ({routes.length})
          </h3>
          <span className="text-xs text-slate-400">AST Parameter & Validation Specs</span>
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
              const isExpanded = expandedRouteId === route._id;
              const pathParams = route.parameters?.pathParams || [];
              const queryParams = route.parameters?.queryParams || [];
              const bodyParams = route.parameters?.bodyParams || [];
              const totalParams = pathParams.length + queryParams.length + bodyParams.length;

              return (
                <div key={route._id} className="transition-colors">
                  <div className="p-4 sm:px-6 hover:bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left Info */}
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

                          {route.authRequirement?.required && (
                            <>
                              <span>•</span>
                              <span className="text-violet-400 flex items-center gap-1 font-mono text-[10px] bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
                                <ShieldCheck className="w-2.5 h-2.5" />
                                <span>{route.authRequirement.authType}</span>
                              </span>
                            </>
                          )}

                          {totalParams > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-slate-300 text-[10px] font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                                {totalParams} Params
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Tags & Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
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

                      {/* Phase 2: AI Test Code Action */}
                      <button
                        onClick={() => onSelectRouteForTesting?.(route._id)}
                        className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-xs font-semibold text-sky-400 border border-sky-500/30 transition-colors flex items-center gap-1.5 shadow-sm"
                        title="Open AI test suite for this API"
                      >
                        <TestTube2 className="w-3.5 h-3.5" />
                        <span>AI Tests</span>
                      </button>

                      <button
                        onClick={() => onSelectRouteForChart(route._id)}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1"
                      >
                        <span>Flowchart</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onAskRouteInQa(`Explain the flow and validation of ${route.method} ${route.resolvedPath}`)}
                        className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
                        title="Ask AI in Q&A"
                      >
                        <MessageSquareCode className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => toggleExpand(route._id)}
                        className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
                        title={isExpanded ? 'Collapse parameters' : 'Expand parameters & schemas'}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Formal API Parameter & Schema Spec Panel */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-[#080c14]/90 border-t border-white/[0.04] space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Column 1: Path & Query Parameters */}
                        <div className="p-3 rounded-xl bg-[#05080f] border border-white/[0.04] space-y-2">
                          <span className="text-[10px] uppercase font-mono font-semibold text-sky-400 block">
                            Path & Query Parameters
                          </span>
                          {pathParams.length === 0 && queryParams.length === 0 ? (
                            <div className="text-xs text-slate-500 italic">No path or query parameters</div>
                          ) : (
                            <div className="space-y-1.5">
                              {pathParams.map((p) => (
                                <div key={p.name} className="flex items-center justify-between text-xs font-mono">
                                  <span className="text-slate-200">:{p.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                                    path ({p.paramType})
                                  </span>
                                </div>
                              ))}
                              {queryParams.map((q) => (
                                <div key={q.name} className="flex items-center justify-between text-xs font-mono">
                                  <span className="text-slate-300">?{q.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                    query ({q.paramType})
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Column 2: Body Parameters & Validation Rules */}
                        <div className="p-3 rounded-xl bg-[#05080f] border border-white/[0.04] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-mono font-semibold text-emerald-400 block">
                              Request Body & Rules
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/[0.04] text-slate-400">
                              {route.validationDetails?.library || 'inline_manual'}
                            </span>
                          </div>

                          {bodyParams.length === 0 ? (
                            <div className="text-xs text-slate-500 italic">No body payload parameters</div>
                          ) : (
                            <div className="space-y-1.5">
                              {bodyParams.map((b) => (
                                <div key={b.name} className="flex items-center justify-between text-xs font-mono">
                                  <span className="text-slate-200">{b.name}</span>
                                  <div className="flex items-center gap-1 text-[10px]">
                                    {b.required ? (
                                      <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                        Required
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                        Optional
                                      </span>
                                    )}
                                    {b.validationRule && (
                                      <span className="text-amber-400 text-[10px]" title={b.validationRule}>
                                        ({b.validationRule})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Column 3: Known Response Shapes */}
                        <div className="p-3 rounded-xl bg-[#05080f] border border-white/[0.04] space-y-2">
                          <span className="text-[10px] uppercase font-mono font-semibold text-violet-400 block">
                            Known HTTP Responses
                          </span>
                          {(route.knownResponseShapes || []).length === 0 ? (
                            <div className="text-xs text-slate-500 italic">Standard Express HTTP responses</div>
                          ) : (
                            <div className="space-y-1.5">
                              {route.knownResponseShapes.map((rs, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs font-mono">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      rs.statusCode >= 200 && rs.statusCode < 300
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : rs.statusCode >= 400 && rs.statusCode < 500
                                        ? 'bg-amber-500/10 text-amber-400'
                                        : 'bg-rose-500/10 text-rose-400'
                                    }`}
                                  >
                                    HTTP {rs.statusCode}
                                  </span>
                                  <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                                    {rs.keys && rs.keys.length > 0 ? `{ ${rs.keys.join(', ')} }` : 'payload'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
