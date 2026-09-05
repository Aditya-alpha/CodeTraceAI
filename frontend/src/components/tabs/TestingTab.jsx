'use client';

import React, { useState, useEffect } from 'react';
import {
  TestTube2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Copy,
  Check,
  RefreshCw,
  Search,
  Code2,
  FileCheck,
  Layers,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Save,
  Play,
  Terminal,
  Clock,
  Cpu,
  History,
  Info,
  ChevronDown,
  ChevronUp,
  Box,
} from 'lucide-react';
import {
  getRepoTests,
  getRouteTest,
  generateRouteTest,
  generateAllTests,
  updateTestPlan,
  runTests,
  getTestRuns,
  getTestRunDetails,
} from '../../lib/api';

const METHOD_COLORS = {
  GET: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  POST: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  PATCH: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  DELETE: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  ALL: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const SCENARIO_TYPE_BADGES = {
  happy_path: { label: 'Happy Path', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  auth_case: { label: 'Auth Check', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  validation_failure: { label: 'Validation', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  branch: { label: 'Branch Logic', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  boundary: { label: 'Boundary Case', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
};

export default function TestingTab({ repoId, initialRouteId = null }) {
  const [routes, setRoutes] = useState([]);
  const [testPlans, setTestPlans] = useState([]);
  const [stats, setStats] = useState({ totalRoutes: 0, generatedTests: 0, reviewedTests: 0 });
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [currentTestPlan, setCurrentTestPlan] = useState(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('ALL');

  // Active view inside route: 'code' | 'scenarios' | 'execution'
  const [viewMode, setViewMode] = useState('execution');

  // Edit code mode
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [developerNotes, setDeveloperNotes] = useState('');
  const [savingChanges, setSavingChanges] = useState(false);

  // Phase 3: Execution State
  const [testRuns, setTestRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [batchExecuting, setBatchExecuting] = useState(false);
  const [executionFilter, setExecutionFilter] = useState('ALL'); // 'ALL' | 'passed' | 'failed'
  const [selectedResultDetails, setSelectedResultDetails] = useState(null);
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Load all tests, routes, and past execution runs
  const loadData = async () => {
    try {
      setLoading(true);
      const [testData, runsData] = await Promise.all([
        getRepoTests(repoId),
        getTestRuns(repoId).catch(() => ({ runs: [] })),
      ]);

      setRoutes(testData.routes || []);
      setTestPlans(testData.testPlans || []);
      setStats(testData.stats || {});
      setTestRuns(runsData.runs || []);

      if (runsData.runs && runsData.runs.length > 0) {
        setActiveRun(runsData.runs[0]);
      }

      // Select initial or first route
      if (testData.routes && testData.routes.length > 0) {
        const targetRoute = initialRouteId
          ? testData.routes.find((r) => r._id === initialRouteId) || testData.routes[0]
          : testData.routes[0];
        setSelectedRoute(targetRoute);
      }
    } catch (err) {
      console.error('Failed to load test data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repoId) loadData();
  }, [repoId, initialRouteId]);

  // When selected route changes, fetch or locate test plan
  useEffect(() => {
    if (!selectedRoute) return;

    const existing = testPlans.find((tp) => tp.routeId === selectedRoute._id);
    if (existing) {
      setCurrentTestPlan(existing);
      setEditedCode(existing.testCode || '');
      setDeveloperNotes(existing.developerNotes || '');
      setIsEditing(false);
    } else {
      fetchRouteTestPlan(selectedRoute._id);
    }
  }, [selectedRoute, testPlans]);

  const fetchRouteTestPlan = async (routeId) => {
    try {
      setGenerating(true);
      const res = await getRouteTest(repoId, routeId);
      setCurrentTestPlan(res.testPlan);
      setEditedCode(res.testPlan?.testCode || '');
      setDeveloperNotes(res.testPlan?.developerNotes || '');
      setIsEditing(false);

      setTestPlans((prev) => {
        const idx = prev.findIndex((tp) => tp.routeId === routeId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = res.testPlan;
          return next;
        }
        return [res.testPlan, ...prev];
      });
    } catch (err) {
      console.error('Failed to fetch route test:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Generate / Regenerate single route
  const handleRegenerate = async () => {
    if (!selectedRoute) return;
    try {
      setGenerating(true);
      const res = await generateRouteTest(repoId, selectedRoute._id);
      setCurrentTestPlan(res.testPlan);
      setEditedCode(res.testPlan?.testCode || '');
      setIsEditing(false);

      setTestPlans((prev) => {
        const idx = prev.findIndex((tp) => tp.routeId === selectedRoute._id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = res.testPlan;
          return next;
        }
        return [res.testPlan, ...prev];
      });
      const refreshed = await getRepoTests(repoId);
      setStats(refreshed.stats);
    } catch (err) {
      console.error('Regeneration failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Batch generate all
  const handleBatchGenerate = async () => {
    try {
      setBatchGenerating(true);
      const res = await generateAllTests(repoId);
      setTestPlans(res.testPlans || []);
      if (selectedRoute) {
        const updated = (res.testPlans || []).find((tp) => tp.routeId === selectedRoute._id);
        if (updated) {
          setCurrentTestPlan(updated);
          setEditedCode(updated.testCode);
        }
      }
      const refreshed = await getRepoTests(repoId);
      setStats(refreshed.stats);
    } catch (err) {
      console.error('Batch generation failed:', err);
    } finally {
      setBatchGenerating(false);
    }
  };

  // Phase 3: Run Tests for Current Route
  const handleRunRouteTests = async () => {
    if (!selectedRoute) return;
    try {
      setExecuting(true);
      setViewMode('execution');
      const res = await runTests(repoId, { routeId: selectedRoute._id, preferredMode: 'auto' });
      setActiveRun(res.testRun);
      setTestRuns((prev) => [res.testRun, ...prev.filter((r) => r._id !== res.testRun._id)]);
    } catch (err) {
      console.error('Route test execution failed:', err);
      alert(`Test execution failed: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  // Phase 3: Batch Run All Repo Suites
  const handleRunAllSuites = async () => {
    try {
      setBatchExecuting(true);
      setViewMode('execution');
      const res = await runTests(repoId, { routeId: null, preferredMode: 'auto' });
      setActiveRun(res.testRun);
      setTestRuns((prev) => [res.testRun, ...prev.filter((r) => r._id !== res.testRun._id)]);
    } catch (err) {
      console.error('Batch execution failed:', err);
      alert(`Batch test execution failed: ${err.message}`);
    } finally {
      setBatchExecuting(false);
    }
  };

  // Toggle Reviewed status
  const handleToggleReviewed = async () => {
    if (!currentTestPlan) return;
    const newStatus = !currentTestPlan.isReviewed;
    try {
      const res = await updateTestPlan(repoId, currentTestPlan._id, { isReviewed: newStatus });
      setCurrentTestPlan(res.testPlan);
      setTestPlans((prev) => prev.map((tp) => (tp._id === res.testPlan._id ? res.testPlan : tp)));
      setStats((prev) => ({
        ...prev,
        reviewedTests: newStatus ? prev.reviewedTests + 1 : prev.reviewedTests - 1,
      }));
    } catch (err) {
      console.error('Failed to update review status:', err);
    }
  };

  // Save manual code edits & developer notes
  const handleSaveChanges = async () => {
    if (!currentTestPlan) return;
    try {
      setSavingChanges(true);
      const res = await updateTestPlan(repoId, currentTestPlan._id, {
        testCode: editedCode,
        developerNotes,
      });
      setCurrentTestPlan(res.testPlan);
      setTestPlans((prev) => prev.map((tp) => (tp._id === res.testPlan._id ? res.testPlan : tp)));
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save code changes:', err);
    } finally {
      setSavingChanges(false);
    }
  };

  // Copy code to clipboard
  const handleCopy = () => {
    if (!currentTestPlan?.testCode) return;
    navigator.clipboard.writeText(currentTestPlan.testCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download .test.js file
  const handleDownload = () => {
    if (!currentTestPlan?.testCode || !selectedRoute) return;
    const sanitizedPath = (selectedRoute.resolvedPath || 'api')
      .replace(/\//g, '_')
      .replace(/:/g, '')
      .replace(/^_/, '');
    const filename = `${selectedRoute.method.toLowerCase()}_${sanitizedPath}.test.js`;

    const blob = new Blob([currentTestPlan.testCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter routes
  const filteredRoutes = routes.filter((r) => {
    const matchesMethod = selectedMethod === 'ALL' || r.method === selectedMethod;
    const matchesSearch =
      !search ||
      r.resolvedPath.toLowerCase().includes(search.toLowerCase()) ||
      (r.handlerName || '').toLowerCase().includes(search.toLowerCase());
    return matchesMethod && matchesSearch;
  });

  const getRoutePlanStatus = (routeId) => {
    const plan = testPlans.find((tp) => tp.routeId === routeId);
    if (!plan) return { label: 'Pending', color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' };
    if (plan.isReviewed) return { label: 'Reviewed', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    return { label: 'Generated', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
  };

  const highConfidenceCount = (currentTestPlan?.scenarios || []).filter((s) => s.confidence === 'high').length;
  const lowConfidenceCount = (currentTestPlan?.scenarios || []).filter((s) => s.confidence === 'low').length;

  const filteredExecutionResults = (activeRun?.results || []).filter((r) => {
    if (executionFilter === 'ALL') return true;
    return r.status === executionFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Metrics & Action Bar */}
      <div className="p-6 rounded-2xl glass-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-medium text-sky-400 mb-1">
            <TestTube2 className="w-3.5 h-3.5" />
            <span>PHASE 3: DOCKER-ISOLATED TEST EXECUTION & LIVE RUNNER</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>Isolated Test Execution</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Box className="w-3 h-3" />
              <span>Containerized / In-Memory Sandbox</span>
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Executes Jest + Supertest suites in isolated environments with ephemeral MongoDB. Captures raw assertion telemetry, diffs, and duration.
          </p>
        </div>

        {/* Stats & Batch Triggers */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#080c14]/60 border border-white/[0.04] text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-mono">APIs</span>
              <span className="font-bold text-slate-200">{stats.totalRoutes || routes.length}</span>
            </div>
            <div className="w-[1px] h-6 bg-white/10" />
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-mono">Generated</span>
              <span className="font-bold text-sky-400">{stats.generatedTests || testPlans.length}</span>
            </div>
            <div className="w-[1px] h-6 bg-white/10" />
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-mono">Runs</span>
              <span className="font-bold text-purple-400">{testRuns.length}</span>
            </div>
          </div>

          <button
            onClick={handleBatchGenerate}
            disabled={batchGenerating || executing || batchExecuting}
            className="px-3.5 py-2 rounded-xl bg-[#080c14] hover:bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className={`w-3.5 h-3.5 text-sky-400 ${batchGenerating ? 'animate-spin' : ''}`} />
            <span>{batchGenerating ? 'Synthesizing...' : 'Generate All'}</span>
          </button>

          <button
            onClick={handleRunAllSuites}
            disabled={batchExecuting || executing}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${batchExecuting ? 'animate-pulse' : ''}`} />
            <span>{batchExecuting ? 'Executing All...' : 'Run All Tests'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Column: API List (4 Cols) */}
        <div className="lg:col-span-4 rounded-2xl glass-panel p-4 flex flex-col space-y-3 h-[780px]">
          {/* Search & Method Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter routes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#080c14]/80 border border-white/[0.06] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMethod(m)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                    selectedMethod === m
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Route List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredRoutes.map((route) => {
              const isSelected = selectedRoute?._id === route._id;
              const status = getRoutePlanStatus(route._id);

              return (
                <div
                  key={route._id}
                  onClick={() => setSelectedRoute(route)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-sky-500/10 border-sky-500/40 shadow-lg shadow-sky-500/5'
                      : 'bg-[#080c14]/40 border-white/[0.04] hover:bg-[#080c14]/80 hover:border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        METHOD_COLORS[route.method] || METHOD_COLORS.GET
                      }`}
                    >
                      {route.method}
                    </span>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="text-xs font-mono font-medium text-slate-200 truncate">
                    {route.resolvedPath}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <span className="truncate">fn: {route.handlerName || 'anonymous'}</span>
                    {route.authRequirement?.required && (
                      <span className="text-violet-400 flex items-center gap-0.5">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>Auth</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredRoutes.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs">
                No matching endpoints found
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Test Runner & Telemetry Viewer (8 Cols) */}
        <div className="lg:col-span-8 rounded-2xl glass-panel p-6 flex flex-col h-[780px] overflow-hidden">
          {selectedRoute ? (
            <div className="flex-1 flex flex-col h-full space-y-4">
              {/* Selected Route Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                      METHOD_COLORS[selectedRoute.method] || METHOD_COLORS.GET
                    }`}
                  >
                    {selectedRoute.method}
                  </span>
                  <div>
                    <h3 className="text-sm font-mono font-bold text-white">
                      {selectedRoute.resolvedPath}
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>Handler: <code className="text-sky-300 font-mono">{selectedRoute.handlerName}</code></span>
                      {selectedRoute.authRequirement?.required ? (
                        <span className="text-violet-400 flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3" />
                          <span>JWT Auth Required</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">Public Route</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Top Execution & Code Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunRouteTests}
                    disabled={executing || batchExecuting}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
                    title="Execute test suite in isolated sandbox"
                  >
                    <Play className={`w-3 h-3 fill-current ${executing ? 'animate-spin' : ''}`} />
                    <span>{executing ? 'Running...' : 'Run Tests'}</span>
                  </button>

                  <button
                    onClick={handleRegenerate}
                    disabled={generating}
                    className="px-2.5 py-1.5 rounded-lg bg-[#080c14] border border-white/[0.08] hover:border-sky-500/40 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                    title="Regenerate test code via AST and LLM"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin text-sky-400' : ''}`} />
                    <span>{generating ? 'Regen...' : 'Regen'}</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    className="p-1.5 rounded-lg bg-[#080c14] border border-white/[0.08] hover:border-white/[0.2] text-slate-400 hover:text-white transition-colors"
                    title="Download Jest test file (.test.js)"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg bg-[#080c14] border border-white/[0.08] hover:border-white/[0.2] text-slate-400 hover:text-white transition-colors"
                    title="Copy test code to clipboard"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* View Switcher: Execution Results | Jest Code | Scenarios */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#080c14]/80 border border-white/[0.06] w-fit">
                  <button
                    onClick={() => setViewMode('execution')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      viewMode === 'execution'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Execution Dashboard</span>
                  </button>

                  <button
                    onClick={() => setViewMode('code')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      viewMode === 'code'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Jest Code</span>
                  </button>

                  <button
                    onClick={() => setViewMode('scenarios')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      viewMode === 'scenarios'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>AST Checklist ({currentTestPlan?.scenarios?.length || 0})</span>
                  </button>
                </div>

                {/* History Run Selector */}
                {testRuns.length > 0 && viewMode === 'execution' && (
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={activeRun?._id || ''}
                      onChange={(e) => {
                        const target = testRuns.find((r) => r._id === e.target.value);
                        if (target) setActiveRun(target);
                      }}
                      className="text-xs bg-[#080c14] border border-white/[0.08] text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500/50"
                    >
                      {testRuns.map((run, idx) => (
                        <option key={run._id} value={run._id}>
                          Run #{testRuns.length - idx} · {run.status.toUpperCase()} ({run.summary?.passRate || 0}% Pass)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* ========================================================= */}
              {/* VIEW 1: PHASE 3 EXECUTION DASHBOARD                       */}
              {/* ========================================================= */}
              {viewMode === 'execution' && (
                <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                  {/* Execution In-Progress Banner */}
                  {(executing || batchExecuting) && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-2.5">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        <div>
                          <div className="font-semibold text-emerald-200">Executing Test Suite in Isolated Environment</div>
                          <div className="text-[11px] text-emerald-400/80">
                            Provisioning ephemeral MongoDB and running Supertest assertions against cloned app...
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/30">
                        Sandboxed Engine
                      </span>
                    </div>
                  )}

                  {/* Active Run Telemetry Summary */}
                  {activeRun ? (
                    <>
                      {/* Boot Failure Diagnostics Banner */}
                      {activeRun.status === 'cannot_boot' && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                          <div className="flex items-center gap-2 font-bold text-amber-300">
                            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Target Repository Cannot Boot — Missing Secrets / Configuration</span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {activeRun.bootstrapping?.errorReason || 'Missing required secrets or database configurations.'}
                          </p>
                          {activeRun.bootstrapping?.missingSecrets?.length > 0 && (
                            <div className="pt-1">
                              <span className="text-[10px] font-mono uppercase text-amber-400/80 block mb-1">
                                Missing Required Variables Detected in Codebase:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {activeRun.bootstrapping.missingSecrets.map((secret) => (
                                  <span
                                    key={secret}
                                    className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 font-mono text-[10px] text-amber-200"
                                  >
                                    {secret}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 italic">
                            Note: CodeTraceAI never mocks external cloud services (Stripe, AWS, SendGrid). Provide test values in .env to boot.
                          </div>
                        </div>
                      )}

                      {/* Summary Metrics Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        <div className="p-3 rounded-xl bg-[#080c14]/80 border border-white/[0.04]">
                          <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Tests</span>
                          <span className="text-base font-bold text-slate-100">{activeRun.summary?.total || 0}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080c14]/80 border border-white/[0.04]">
                          <span className="text-[10px] uppercase font-mono text-slate-500 block">Passed</span>
                          <span className="text-base font-bold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{activeRun.summary?.passed || 0}</span>
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080c14]/80 border border-white/[0.04]">
                          <span className="text-[10px] uppercase font-mono text-slate-500 block">Failed</span>
                          <span className="text-base font-bold text-rose-400 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{activeRun.summary?.failed || 0}</span>
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080c14]/80 border border-white/[0.04]">
                          <span className="text-[10px] uppercase font-mono text-slate-500 block">Pass Rate</span>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-sky-400">{activeRun.summary?.passRate || 0}%</span>
                            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${activeRun.summary?.passRate || 0}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#080c14]/80 border border-white/[0.04] col-span-2 sm:col-span-1">
                          <span className="text-[10px] uppercase font-mono text-slate-500 block">Engine</span>
                          <span className="text-xs font-mono text-purple-300 font-medium flex items-center gap-1 mt-0.5">
                            <Cpu className="w-3 h-3" />
                            <span className="capitalize">{activeRun.executionMode || 'Sandboxed'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Execution Table Filter Toolbar */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1">
                          {['ALL', 'passed', 'failed'].map((flt) => (
                            <button
                              key={flt}
                              onClick={() => setExecutionFilter(flt)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-colors ${
                                executionFilter === flt
                                  ? 'bg-white/10 text-white border border-white/20'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {flt.toUpperCase()} ({
                                flt === 'ALL'
                                  ? activeRun.results?.length || 0
                                  : (activeRun.results || []).filter((r) => r.status === flt).length
                              })
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => setShowRawLogs(!showRawLogs)}
                          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded bg-[#080c14] border border-white/[0.06]"
                        >
                          <Terminal className="w-3 h-3 text-sky-400" />
                          <span>{showRawLogs ? 'Hide Console' : 'View Console Logs'}</span>
                        </button>
                      </div>

                      {/* Execution Results Table */}
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {filteredExecutionResults.map((result, idx) => {
                          const isPass = result.status === 'passed';
                          const isSelected = selectedResultDetails?.testName === result.testName;

                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border transition-all ${
                                isPass
                                  ? 'bg-emerald-500/[0.02] border-emerald-500/20'
                                  : 'bg-rose-500/[0.03] border-rose-500/25 hover:border-rose-500/40'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                      isPass
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                    }`}
                                  >
                                    {isPass ? 'PASS' : 'FAIL'}
                                  </span>
                                  <span className="text-xs font-mono font-medium text-slate-200">
                                    {result.testName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3">
                                  {result.durationMs > 0 && (
                                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>{result.durationMs}ms</span>
                                    </span>
                                  )}

                                  {result.expected && result.actual && (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                                      Exp: <strong>{result.expected}</strong> | Recv: <strong>{result.actual}</strong>
                                    </span>
                                  )}

                                  {(result.errorMessage || result.stackTrace) && (
                                    <button
                                      onClick={() => setSelectedResultDetails(isSelected ? null : result)}
                                      className="text-[10px] font-mono text-sky-400 hover:text-sky-300 underline"
                                    >
                                      {isSelected ? 'Close Trace' : 'View Trace'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Expanded Stack Trace Drawer */}
                              {isSelected && (
                                <div className="mt-3 p-3 rounded-lg bg-[#05080f] border border-rose-500/20 font-mono text-[11px] text-rose-300 space-y-2">
                                  <div className="font-semibold text-rose-400">Assertion Failure & Stack Trace:</div>
                                  <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed text-slate-300">
                                    {result.stackTrace || result.errorMessage}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {filteredExecutionResults.length === 0 && (
                          <div className="text-center py-12 text-slate-500 text-xs">
                            No test results matching filter &quot;{executionFilter}&quot;.
                          </div>
                        )}
                      </div>

                      {/* Raw Terminal Console Drawer */}
                      {showRawLogs && (
                        <div className="p-3 rounded-xl bg-[#05080f] border border-white/[0.08] font-mono text-xs text-slate-300 max-h-48 overflow-y-auto">
                          <div className="flex items-center justify-between mb-2 text-[10px] text-slate-500 border-b border-white/[0.04] pb-1">
                            <span className="flex items-center gap-1">
                              <Terminal className="w-3 h-3 text-sky-400" />
                              <span>Raw Jest Execution Output (Stdout & Stderr)</span>
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(activeRun.rawLogs || '');
                                setCopiedLogs(true);
                                setTimeout(() => setCopiedLogs(false), 2000);
                              }}
                              className="hover:text-white flex items-center gap-1"
                            >
                              {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <pre className="whitespace-pre-wrap leading-relaxed text-[11px] text-slate-400">
                            {activeRun.rawLogs || 'No console output logged.'}
                          </pre>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <Play className="w-8 h-8 fill-current" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-200">No Execution Telemetry Yet</h4>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Execute tests inside the isolated sandbox to capture real pass/fail metrics, execution timings, and assertion diffs.
                      </p>
                      <button
                        onClick={handleRunRouteTests}
                        disabled={executing}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Run Test Suite Now</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* VIEW 2: JEST + SUPERTEST CODE VIEWER & EDITOR             */}
              {/* ========================================================= */}
              {viewMode === 'code' && (
                <div className="flex-1 flex flex-col overflow-hidden space-y-2">
                  {/* Code Toolbar */}
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-sky-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Syntax Validated (Babel AST Parser)</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveChanges}
                            disabled={savingChanges}
                            className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-xs flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            <span>{savingChanges ? 'Saving...' : 'Save Changes'}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="text-slate-400 hover:text-white flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-white/[0.06] hover:border-white/[0.12]"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Code</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Code Area */}
                  <div className="flex-1 rounded-xl bg-[#080c14] border border-white/[0.06] p-4 overflow-auto font-mono text-xs text-slate-200 leading-relaxed shadow-inner">
                    {isEditing ? (
                      <textarea
                        value={editedCode}
                        onChange={(e) => setEditedCode(e.target.value)}
                        className="w-full h-full bg-transparent resize-none focus:outline-none font-mono text-xs text-slate-100"
                        spellCheck={false}
                      />
                    ) : (
                      <pre className="whitespace-pre">
                        {currentTestPlan?.testCode || '// No test code synthesized yet'}
                      </pre>
                    )}
                  </div>

                  {/* Developer Review Notes Field */}
                  <div className="pt-1">
                    <input
                      type="text"
                      placeholder="Developer review notes (e.g. 'Verified status code 422 matches inline validation')..."
                      value={developerNotes}
                      onChange={(e) => setDeveloperNotes(e.target.value)}
                      onBlur={handleSaveChanges}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#080c14]/60 border border-white/[0.04] text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-sky-500/40"
                    />
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* VIEW 3: SCENARIOS CHECKLIST MATRIX                        */}
              {/* ========================================================= */}
              {viewMode === 'scenarios' && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {(currentTestPlan?.scenarios || []).map((scenario, idx) => {
                    const badge = SCENARIO_TYPE_BADGES[scenario.type] || SCENARIO_TYPE_BADGES.branch;

                    return (
                      <div
                        key={scenario.id || idx}
                        className={`p-4 rounded-xl border transition-all ${
                          scenario.confidence === 'low'
                            ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                            : 'bg-[#080c14]/40 border-white/[0.06] hover:border-white/[0.12]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badge.color}`}>
                              {badge.label}
                            </span>
                            <span className="text-xs font-semibold text-slate-100">
                              {scenario.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-slate-300">
                              Expect: <strong className="text-emerald-400">{scenario.expectedStatus}</strong>
                            </span>

                            {scenario.confidence === 'high' ? (
                              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>High Confidence</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Needs Review</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                          {scenario.description}
                        </p>

                        {scenario.confidence === 'low' && (
                          <div className="mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-1.5">
                            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{scenario.confidenceReason}</span>
                          </div>
                        )}

                        {scenario.payloadSample && (
                          <div className="p-2 rounded-lg bg-[#05080f] border border-white/[0.04]">
                            <span className="text-[9px] uppercase font-mono text-slate-500 block mb-1">
                              Payload Sample:
                            </span>
                            <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto">
                              {JSON.stringify(scenario.payloadSample, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {(currentTestPlan?.scenarios || []).length === 0 && (
                    <div className="text-center py-16 text-slate-500 text-xs">
                      No scenarios enumerated yet. Click &quot;Regenerate&quot; to synthesize.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Select an endpoint from the left to view and execute test suites.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
