const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function analyzeRepo(url) {
  const res = await fetch(`${API_BASE}/api/repos/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Analysis request failed' }));
    throw new Error(error.error || 'Failed to start analysis');
  }
  return res.json();
}

export async function getRecentRepos() {
  const res = await fetch(`${API_BASE}/api/repos`);
  if (!res.ok) throw new Error('Failed to fetch repositories');
  return res.json();
}

export async function getRepoStatus(repoId) {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}`);
  if (!res.ok) throw new Error('Failed to fetch repository status');
  return res.json();
}

export async function getRepoOverview(repoId) {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/overview`);
  if (!res.ok) throw new Error('Failed to fetch repository overview');
  return res.json();
}

export async function getRepoFiles(repoId, path = '') {
  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/files${query}`);
  if (!res.ok) throw new Error('Failed to fetch repository files');
  return res.json();
}

export async function getRepoApis(repoId, method = '', search = '') {
  const params = new URLSearchParams();
  if (method && method !== 'ALL') params.set('method', method);
  if (search) params.set('search', search);

  const res = await fetch(`${API_BASE}/api/repos/${repoId}/apis?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch discovered APIs');
  return res.json();
}

export async function getRepoFunctions(repoId) {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/functions`);
  if (!res.ok) throw new Error('Failed to fetch functions');
  return res.json();
}

export async function askQuestion(repoId, question) {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Q&A request failed' }));
    throw new Error(error.error || 'Failed to get answer');
  }
  return res.json();
}

export async function getRouteFlowchart(repoId, routeId, depth = 4) {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/flowcharts/route/${routeId}?depth=${depth}`);
  if (!res.ok) throw new Error('Failed to fetch route flowchart');
  return res.json();
}

export async function getFunctionFlowchart(repoId, funcId) {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/flowcharts/function/${funcId}`);
  if (!res.ok) throw new Error('Failed to fetch function flowchart');
  return res.json();
}

export async function getCodebaseArchitectureFlowchart(repoId) {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/flowcharts/architecture`);
  if (!res.ok) throw new Error('Failed to fetch codebase architecture flowchart');
  return res.json();
}

export async function getFileTreeFlowchart(repoId) {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/flowcharts/file-tree`);
  if (!res.ok) throw new Error('Failed to fetch file tree flowchart');
  return res.json();
}

export async function getApiConfig() {
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function saveGroqApiKey(apiKey) {
  const res = await fetch(`${API_BASE}/api/config/groq-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Verification failed' }));
    throw new Error(data.error || 'Failed to save Groq API Key');
  }
  return res.json();
}
