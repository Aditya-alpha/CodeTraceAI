'use client';

import React, { useState, useEffect } from 'react';
import { Network, GitBranch, Layers, Sliders, Database, ArrowRight } from 'lucide-react';
import MermaidViewer from '../MermaidViewer';
import { getRepoApis, getRepoFunctions, getRouteFlowchart, getFunctionFlowchart } from '../../lib/api';

export default function FlowchartTab({ repoId, initialRouteId }) {
  const [mode, setMode] = useState('api'); // 'api' | 'function'
  const [routes, setRoutes] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(initialRouteId || '');
  const [selectedFuncId, setSelectedFuncId] = useState('');
  const [depth, setDepth] = useState(4);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load routes and functions list
  useEffect(() => {
    if (!repoId) return;

    getRepoApis(repoId)
      .then((data) => {
        const rList = data.routes || [];
        setRoutes(rList);
        if (!selectedRouteId && rList.length > 0) {
          // Default to a route with branches if possible (e.g. POST /api/v1/articles)
          const branchingRoute = rList.find((r) => (r.branches || []).length > 0);
          setSelectedRouteId(branchingRoute ? branchingRoute._id : rList[0]._id);
        }
      })
      .catch((err) => console.error(err));

    getRepoFunctions(repoId)
      .then((data) => {
        const fList = data.functions || [];
        setFunctions(fList);
        if (fList.length > 0) setSelectedFuncId(fList[0]._id);
      })
      .catch((err) => console.error(err));
  }, [repoId]);

  // Load flowchart when route or depth changes
  useEffect(() => {
    if (!repoId) return;

    if (mode === 'api' && selectedRouteId) {
      setLoading(true);
      getRouteFlowchart(repoId, selectedRouteId, depth)
        .then((data) => {
          setChartData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else if (mode === 'function' && selectedFuncId) {
      setLoading(true);
      getFunctionFlowchart(repoId, selectedFuncId)
        .then((data) => {
          setChartData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [repoId, mode, selectedRouteId, selectedFuncId, depth]);

  const activeRoute = routes.find((r) => r._id === selectedRouteId);

  return (
    <div className="space-y-6">
      {/* Configuration Header Bar */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-xl bg-[#080c14] border border-white/[0.08]">
            <button
              onClick={() => setMode('api')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'api' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              API Route Flow
            </button>
            <button
              onClick={() => setMode('function')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'function' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Function Flow
            </button>
          </div>

          {/* Depth Limiter */}
          {mode === 'api' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#080c14] border border-white/[0.08]">
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px] text-slate-400 font-mono">Max Depth:</span>
              <select
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="bg-transparent text-xs font-mono text-sky-300 focus:outline-none cursor-pointer"
              >
                <option value={1} className="bg-slate-900">1 (Linear)</option>
                <option value={2} className="bg-slate-900">2 Levels</option>
                <option value={4} className="bg-slate-900">4 Levels (Default)</option>
                <option value={6} className="bg-slate-900">6 (Deepest)</option>
              </select>
            </div>
          )}
        </div>

        {/* Dropdown Selector */}
        <div className="flex-1 max-w-lg">
          {mode === 'api' ? (
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full bg-[#080c14] text-xs font-mono text-slate-200 px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-sky-500/50"
            >
              {routes.map((r) => (
                <option key={r._id} value={r._id} className="bg-slate-900 text-slate-200">
                  {r.method} {r.resolvedPath} ({(r.branches || []).length} branches, {(r.dbCalls || []).length} DB)
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedFuncId}
              onChange={(e) => setSelectedFuncId(e.target.value)}
              className="w-full bg-[#080c14] text-xs font-mono text-slate-200 px-3 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-sky-500/50"
            >
              {functions.map((f) => (
                <option key={f._id} value={f._id} className="bg-slate-900 text-slate-200">
                  {f.name}() — {f.filePath}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Route Metadata Bar */}
      {mode === 'api' && activeRoute && (
        <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/[0.04] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sky-400">{activeRoute.method}</span>
            <span className="font-mono text-slate-200">{activeRoute.resolvedPath}</span>
            <span className="text-slate-500">→</span>
            <span className="text-slate-400 font-mono">{activeRoute.filePath}</span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-slate-400">
              Middlewares: <span className="text-slate-200">{activeRoute.middlewares?.length || 0}</span>
            </span>
            <span className="text-slate-400">
              AST Branches: <span className="text-amber-400 font-bold">{activeRoute.branches?.length || 0}</span>
            </span>
            <span className="text-slate-400">
              DB Calls: <span className="text-emerald-400 font-bold">{activeRoute.dbCalls?.length || 0}</span>
            </span>
          </div>
        </div>
      )}

      {/* Mermaid Graph Component */}
      {loading ? (
        <div className="h-[450px] glass-panel rounded-2xl flex items-center justify-center text-slate-400 text-xs">
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mr-2" />
          <span>Generating deterministic AST flowchart...</span>
        </div>
      ) : chartData?.mermaid ? (
        <MermaidViewer
          chartCode={chartData.mermaid}
          title={
            mode === 'api'
              ? `${activeRoute?.method || 'ROUTE'} ${activeRoute?.resolvedPath || ''}`
              : 'Function Control Flow'
          }
        />
      ) : (
        <div className="h-[400px] glass-panel rounded-2xl flex items-center justify-center text-slate-500 text-xs">
          No flowchart available. Select a route to view its AST control flow.
        </div>
      )}
    </div>
  );
}
