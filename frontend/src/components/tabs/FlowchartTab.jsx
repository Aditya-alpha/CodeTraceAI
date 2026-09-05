'use client';

import React, { useState, useEffect } from 'react';
import {
  Network,
  GitBranch,
  Layers,
  Sliders,
  Database,
  FolderTree,
  Cpu,
  Shield,
  FileCode,
  Boxes,
  Compass,
} from 'lucide-react';
import MermaidViewer from '../MermaidViewer';
import {
  getRepoApis,
  getRepoFunctions,
  getRouteFlowchart,
  getFunctionFlowchart,
  getCodebaseArchitectureFlowchart,
  getFileTreeFlowchart,
} from '../../lib/api';

export default function FlowchartTab({ repoId, initialRouteId }) {
  // Modes: 'api' | 'function' | 'architecture' | 'file-tree'
  const [mode, setMode] = useState('api');
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

  // Load flowchart when mode, route, func, or depth changes
  useEffect(() => {
    if (!repoId) return;

    setLoading(true);

    if (mode === 'api') {
      if (!selectedRouteId) {
        setLoading(false);
        return;
      }
      getRouteFlowchart(repoId, selectedRouteId, depth)
        .then((data) => {
          setChartData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else if (mode === 'function') {
      if (!selectedFuncId) {
        setLoading(false);
        return;
      }
      getFunctionFlowchart(repoId, selectedFuncId)
        .then((data) => {
          setChartData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else if (mode === 'architecture') {
      getCodebaseArchitectureFlowchart(repoId)
        .then((data) => {
          setChartData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else if (mode === 'file-tree') {
      getFileTreeFlowchart(repoId)
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
  const layerStats = chartData?.layerStats || {};

  return (
    <div className="space-y-6">
      {/* Top Mode Selection Bar */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Mode Toggle Group */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 rounded-xl bg-[#080c14] border border-white/[0.08] overflow-x-auto">
            {/* 1. API Route Flow (Separate) */}
            <button
              onClick={() => setMode('api')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                mode === 'api'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>API Route Flow</span>
            </button>

            {/* 2. Function Flow */}
            <button
              onClick={() => setMode('function')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                mode === 'function'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Function Flow</span>
            </button>

            {/* 3. Codebase Architecture (New!) */}
            <button
              onClick={() => setMode('architecture')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                mode === 'architecture'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-purple-300" />
              <span>Codebase Architecture</span>
            </button>

            {/* 4. File Structure Tree (New!) */}
            <button
              onClick={() => setMode('file-tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                mode === 'file-tree'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5 text-emerald-300" />
              <span>File Structure Tree</span>
            </button>
          </div>

          {/* Depth Limiter (Only for API flow) */}
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
                <option value={4} className="bg-slate-900">4 Levels</option>
                <option value={6} className="bg-slate-900">6 (Deepest)</option>
              </select>
            </div>
          )}
        </div>

        {/* Dropdown Selectors for API or Function Modes */}
        {mode === 'api' && (
          <div className="flex-1 max-w-md">
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
          </div>
        )}

        {mode === 'function' && (
          <div className="flex-1 max-w-md">
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
          </div>
        )}
      </div>

      {/* Mode 1 Details Bar: API Route */}
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

      {/* Mode 3 Details Bar: Codebase Architecture Layers */}
      {mode === 'architecture' && (
        <div className="p-4 rounded-2xl glass-panel space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400" />
                Codebase Architecture & Dependency Flow
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic module graph mapping cross-file imports across architectural layers.
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 shrink-0">
              {layerStats.totalFiles || 0} Analyzed Modules
            </span>
          </div>

          {/* Layer Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-center">
              <span className="text-[10px] text-sky-300 font-medium block">🚀 App Entry</span>
              <span className="text-sm font-mono font-bold text-sky-400">{layerStats.entry || 0}</span>
            </div>
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
              <span className="text-[10px] text-purple-300 font-medium block">🌐 Routers</span>
              <span className="text-sm font-mono font-bold text-purple-400">{layerStats.routes || 0}</span>
            </div>
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
              <span className="text-[10px] text-indigo-300 font-medium block">🛡️ Middlewares</span>
              <span className="text-sm font-mono font-bold text-indigo-400">{layerStats.middlewares || 0}</span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <span className="text-[10px] text-emerald-300 font-medium block">🗄️ Data Models</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{layerStats.models || 0}</span>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <span className="text-[10px] text-amber-300 font-medium block">⚙️ Config & DB</span>
              <span className="text-sm font-mono font-bold text-amber-400">{layerStats.config || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Mode 4 Details Bar: File Structure */}
      {mode === 'file-tree' && (
        <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/[0.04] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">Repository Directory Hierarchy</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Visual containment tree derived from repository files</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {chartData?.fileCount || 0} Files
          </span>
        </div>
      )}

      {/* Mermaid Graph Display */}
      {loading ? (
        <div className="h-[480px] glass-panel rounded-2xl flex items-center justify-center text-slate-400 text-xs">
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mr-2" />
          <span>Generating deterministic AST flowchart...</span>
        </div>
      ) : chartData?.mermaid ? (
        <MermaidViewer
          chartCode={chartData.mermaid}
          title={
            mode === 'api'
              ? `${activeRoute?.method || 'ROUTE'} ${activeRoute?.resolvedPath || ''}`
              : mode === 'function'
              ? 'Function AST Control Flow'
              : mode === 'architecture'
              ? 'Codebase Architecture & Module Dependencies'
              : 'Repository Directory Hierarchy'
          }
        />
      ) : (
        <div className="h-[400px] glass-panel rounded-2xl flex items-center justify-center text-slate-500 text-xs">
          No flowchart available for this selection.
        </div>
      )}
    </div>
  );
}
