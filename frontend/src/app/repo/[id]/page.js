'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  GitBranch,
  FileCode2,
  Route as RouteIcon,
  MessageSquareCode,
  Network,
  LayoutDashboard,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

import { getRepoStatus, getRepoOverview } from '../../../lib/api';
import AnalysisProgress from '../../../components/AnalysisProgress';
import OverviewTab from '../../../components/tabs/OverviewTab';
import FilesTab from '../../../components/tabs/FilesTab';
import ApisTab from '../../../components/tabs/ApisTab';
import QATab from '../../../components/tabs/QATab';
import FlowchartTab from '../../../components/tabs/FlowchartTab';

export default function RepoDashboard() {
  const params = useParams();
  const repoId = params?.id;
  const router = useRouter();

  const [repo, setRepo] = useState(null);
  const [overviewData, setOverviewData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [qaInitialPrompt, setQaInitialPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status Polling Effect
  useEffect(() => {
    if (!repoId) return;

    let timer = null;
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const data = await getRepoStatus(repoId);
        if (!isMounted) return;

        setRepo(data.repo);
        setLoading(false);

        if (data.repo.status === 'ready') {
          // Fetch overview details once ready
          const overview = await getRepoOverview(repoId);
          if (isMounted) setOverviewData(overview);
        } else if (['pending', 'cloning', 'analyzing'].includes(data.repo.status)) {
          // Poll every 1.5 seconds
          timer = setTimeout(checkStatus, 1500);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch repository status');
          setLoading(false);
        }
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [repoId]);

  // Handle Tab Switch Actions
  const handleSelectRouteForChart = (routeId) => {
    setSelectedRouteId(routeId);
    setActiveTab('flowcharts');
  };

  const handleAskRouteInQa = (prompt) => {
    setQaInitialPrompt(prompt);
    setActiveTab('qa');
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-slate-400">Connecting to CodeTraceAI engine...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto my-20 p-8 rounded-2xl glass-panel text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-100">Repository Load Error</h2>
        <p className="text-xs text-slate-400">{error}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>
    );
  }

  // Graceful Rejection State (Unsupported Repo)
  if (repo?.status === 'unsupported') {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 rounded-2xl bg-[#0f172a]/90 border border-amber-500/20 shadow-2xl backdrop-blur-xl text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Unsupported Repository Type
          </span>
          <h2 className="text-2xl font-bold text-slate-100">
            {repo.name} is not an Express project
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            {repo.errorReason ||
              'No Express dependency found in package.json and no Express route registrations were detected in source files. CodeTraceAI v1 currently supports Node.js Express repositories only.'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#080c14]/60 border border-white/[0.04] text-xs text-slate-400 text-left space-y-1">
          <div className="font-semibold text-slate-300">Why did this happen?</div>
          <div>• CodeTraceAI performs deterministic static analysis on AST structures.</div>
          <div>• Repositories without `express` in `package.json` or source imports are rejected gracefully.</div>
        </div>

        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Analyze Another Repository</span>
          </Link>
        </div>
      </div>
    );
  }

  // Analyzing / In-Progress State
  if (['pending', 'cloning', 'analyzing'].includes(repo?.status)) {
    return <AnalysisProgress repo={repo} />;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'files', label: 'Files', icon: FileCode2, count: repo?.stats?.fileCount },
    { id: 'apis', label: 'APIs (Inventory)', icon: RouteIcon, count: repo?.stats?.routeCount },
    { id: 'qa', label: 'RAG Q&A', icon: MessageSquareCode },
    { id: 'flowcharts', label: 'Flowcharts', icon: Network },
  ];

  return (
    <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Repo Header Card */}
      <div className="p-6 rounded-2xl glass-panel mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{repo.name}</h1>
            <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Ready
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-sky-400" />
              {repo.defaultBranch || 'main'}
            </span>
            <span>•</span>
            <span className="text-slate-300">{repo.stats?.routeCount || 0} callable routes</span>
            <span>•</span>
            <span>{repo.stats?.fileCount || 0} files</span>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#080c14]/80 border border-white/[0.08] overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all ${
                  isActive
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1">
        {activeTab === 'overview' && (
          <OverviewTab
            repo={repo}
            overviewData={overviewData}
            setActiveTab={setActiveTab}
            setSelectedRouteId={setSelectedRouteId}
          />
        )}

        {activeTab === 'files' && (
          <FilesTab repoId={repoId} files={overviewData?.files || []} />
        )}

        {activeTab === 'apis' && (
          <ApisTab
            repoId={repoId}
            onSelectRouteForChart={handleSelectRouteForChart}
            onAskRouteInQa={handleAskRouteInQa}
          />
        )}

        {activeTab === 'qa' && (
          <QATab repoId={repoId} initialPrompt={qaInitialPrompt} />
        )}

        {activeTab === 'flowcharts' && (
          <FlowchartTab repoId={repoId} initialRouteId={selectedRouteId} />
        )}
      </div>
    </div>
  );
}
