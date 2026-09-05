class FlowchartService {
  /**
   * Generates a deterministic Mermaid.js flowchart for an API route.
   * Based strictly on AST-extracted middleware, branches, DB calls, and responses.
   *
   * @param {object} route - Route document from DB
   * @param {number} maxDepth - Max branch depth to prevent graph explosion
   * @returns {string} Mermaid.js graph definition
   */
  static generateApiFlowchart(route, maxDepth = 4) {
    if (!route) {
      return 'graph TD\n  Empty["No route data available"]';
    }

    const lines = [];
    lines.push('graph TD');
    lines.push('  %% Styles');
    lines.push('  classDef entry fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;');
    lines.push('  classDef mw fill:#312e81,stroke:#818cf8,stroke-width:1px,color:#f8fafc;');
    lines.push('  classDef ctrl fill:#1e1b4b,stroke:#a855f7,stroke-width:2px,color:#f8fafc;');
    lines.push('  classDef cond fill:#451a03,stroke:#f59e0b,stroke-width:1px,color:#fef3c7;');
    lines.push('  classDef db fill:#064e3b,stroke:#10b981,stroke-width:1px,color:#ecfdf5;');
    lines.push('  classDef http fill:#164e63,stroke:#06b6d4,stroke-width:1px,color:#ecfeff;');
    lines.push('  classDef resOk fill:#064e3b,stroke:#22c55e,stroke-width:2px,color:#f0fdf4;');
    lines.push('  classDef resErr fill:#7f1d1d,stroke:#ef4444,stroke-width:2px,color:#fef2f2;');

    // 1. Entry node
    const entryId = 'R_ENTRY';
    const cleanMethod = route.method || 'GET';
    const cleanPath = this._escapeMermaid(route.resolvedPath || route.rawPath || '/');
    lines.push(`  ${entryId}["${cleanMethod} ${cleanPath}"]:::entry`);

    let prevNode = entryId;

    // 2. Middlewares chain
    const middlewares = route.middlewares || [];
    middlewares.forEach((mwName, idx) => {
      const mwId = `MW_${idx}`;
      lines.push(`  ${mwId}["Middleware: ${this._escapeMermaid(mwName)}"]:::mw`);
      lines.push(`  ${prevNode} --> ${mwId}`);
      prevNode = mwId;
    });

    // 3. Controller node
    const ctrlId = 'CTRL';
    const handlerLabel = this._escapeMermaid(route.handlerName || 'AnonymousHandler');
    lines.push(`  ${ctrlId}["Controller: ${handlerLabel}"]:::ctrl`);
    lines.push(`  ${prevNode} --> ${ctrlId}`);
    prevNode = ctrlId;

    // 4. AST Branches and Terminal Responses
    const branches = (route.branches || []).slice(0, maxDepth);
    const dbCalls = route.dbCalls || [];
    const httpCalls = route.httpCalls || [];
    const responses = route.responses || [];

    if (branches.length === 0) {
      // Linear execution flow
      let curr = prevNode;

      // DB calls
      dbCalls.forEach((db, i) => {
        const dbId = `DB_${i}`;
        const dbText = `${this._escapeMermaid(db.callee)}.${this._escapeMermaid(db.method)}()`;
        lines.push(`  ${dbId}[("${dbText}")]:::db`);
        lines.push(`  ${curr} --> ${dbId}`);
        curr = dbId;
      });

      // HTTP calls
      httpCalls.forEach((http, i) => {
        const httpId = `HTTP_${i}`;
        const httpText = `${this._escapeMermaid(http.callee)}.${this._escapeMermaid(http.method)}()`;
        lines.push(`  ${httpId}["${httpText}"]:::http`);
        lines.push(`  ${curr} --> ${httpId}`);
        curr = httpId;
      });

      // Terminal response
      if (responses.length > 0) {
        responses.forEach((res, i) => {
          const resId = `RES_${i}`;
          const isOk = (res.statusCode || 200) < 400;
          const styleClass = isOk ? 'resOk' : 'resErr';
          lines.push(`  ${resId}(["res.${res.method || 'json'}(${res.statusCode || 200})"]):::${styleClass}`);
          lines.push(`  ${curr} --> ${resId}`);
        });
      } else {
        const endId = 'RES_END';
        lines.push(`  ${endId}(["Terminal Response (200 OK)"]):::resOk`);
        lines.push(`  ${curr} --> ${endId}`);
      }
    } else {
      // Branching execution flow
      branches.forEach((b, bIdx) => {
        const condId = `COND_${bIdx}`;
        const condText = this._escapeMermaid(b.condition || `Branch ${bIdx + 1}`);
        lines.push(`  ${condId}{"${condText}"}:::cond`);
        lines.push(`  ${prevNode} --> ${condId}`);

        // True branch
        const trueNode = `TRUE_${bIdx}`;
        const matchingDb = dbCalls[bIdx]
          ? `[("${this._escapeMermaid(dbCalls[bIdx].callee)}.${this._escapeMermaid(dbCalls[bIdx].method)}()")]:::db`
          : `(["Pass Validation / Execute"]):::ctrl`;

        lines.push(`  ${trueNode}${matchingDb}`);
        lines.push(`  ${condId} -- "Yes / Match" --> ${trueNode}`);

        // False branch (Error or Fallback)
        const falseNode = `FALSE_${bIdx}`;
        const falseStatus = bIdx === 0 ? 400 : 404;
        lines.push(`  ${falseNode}(["res.status(${falseStatus}) - Error"]):::resErr`);
        lines.push(`  ${condId} -- "No / Fail" --> ${falseNode}`);

        prevNode = trueNode;
      });

      // Final terminal response from main path
      const finalResId = 'RES_FINAL';
      lines.push(`  ${finalResId}(["res.status(200).json(...)"]):::resOk`);
      lines.push(`  ${prevNode} --> ${finalResId}`);
    }

    return lines.join('\n');
  }

  /**
   * Generates a deterministic Mermaid.js flowchart for a function definition.
   */
  static generateFunctionFlowchart(funcDef) {
    if (!funcDef) {
      return 'graph TD\n  Empty["No function data available"]';
    }

    const lines = [];
    lines.push('graph TD');
    lines.push('  classDef fn fill:#1e1b4b,stroke:#a855f7,stroke-width:2px,color:#f8fafc;');
    lines.push('  classDef fnCall fill:#064e3b,stroke:#10b981,stroke-width:1px,color:#ecfdf5;');
    lines.push('  classDef term fill:#1e293b,stroke:#38bdf8,stroke-width:1px,color:#f8fafc;');

    const fnId = 'FN_ENTRY';
    const fnName = this._escapeMermaid(funcDef.name || 'function');
    const params = (funcDef.params || []).map((p) => this._escapeMermaid(p)).join(', ');
    lines.push(`  ${fnId}["${funcDef.isAsync ? 'async ' : ''}${fnName}(${params})"]:::fn`);

    let prev = fnId;
    (funcDef.calls || []).slice(0, 6).forEach((call, i) => {
      const callId = `CALL_${i}`;
      lines.push(`  ${callId}["call: ${this._escapeMermaid(call)}()"]:::fnCall`);
      lines.push(`  ${prev} --> ${callId}`);
      prev = callId;
    });

    const returnId = 'FN_RET';
    lines.push(`  ${returnId}(["Return Result"]):::term`);
    lines.push(`  ${prev} --> ${returnId}`);

    return lines.join('\n');
  }

  /**
   * Generates a deterministic Mermaid.js flowchart for the repository's codebase architecture.
   * Shows how files import and connect to one another across architectural layers:
   * (Entry -> Routes/Controllers -> Middlewares -> Models/DB -> Config/Utils).
   *
   * @param {Array<object>} files - Array of CodeFile documents
   * @param {Array<object>} routes - Array of Route documents
   * @returns {object} { mermaid: string, layerStats: object }
   */
  static generateCodebaseArchitectureFlowchart(files = [], routes = []) {
    if (!files || files.length === 0) {
      return {
        mermaid: 'graph TD\n  Empty["No codebase files available"]',
        layerStats: { entry: 0, routes: 0, middlewares: 0, models: 0, config: 0, other: 0 },
      };
    }

    const lines = [];
    lines.push('graph TD');
    lines.push('  %% Styles for Architectural Layers');
    lines.push('  classDef entry fill:#082f49,stroke:#38bdf8,stroke-width:2px,color:#f0f9ff;');
    lines.push('  classDef routeLayer fill:#2e1065,stroke:#a855f7,stroke-width:2px,color:#f5f3ff;');
    lines.push('  classDef mwLayer fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#eef2ff;');
    lines.push('  classDef modelLayer fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#ecfdf5;');
    lines.push('  classDef configLayer fill:#451a03,stroke:#f59e0b,stroke-width:2px,color:#fffbeb;');
    lines.push('  classDef defaultLayer fill:#0f172a,stroke:#64748b,stroke-width:1px,color:#f8fafc;');

    // Map routes count per file
    const routeCountByFile = new Map();
    routes.forEach((r) => {
      const p = (r.filePath || '').replace(/\\/g, '/');
      routeCountByFile.set(p, (routeCountByFile.get(p) || 0) + 1);
    });

    // Classify files into architectural layers
    const categorized = {
      entry: [],
      routes: [],
      middlewares: [],
      models: [],
      config: [],
      other: [],
    };

    const fileNodeIdMap = new Map(); // relativePath -> safe Node ID

    files.forEach((file, idx) => {
      const rel = (file.relativePath || file.fileName).replace(/\\/g, '/');
      const safeId = `F_${idx}_${rel.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`;
      fileNodeIdMap.set(rel, safeId);

      const lower = rel.toLowerCase();
      const fileNameLower = (file.fileName || '').toLowerCase();

      if (
        ['server.js', 'app.js', 'index.js', 'main.js', 'src/server.js', 'src/app.js', 'src/index.js'].includes(
          lower
        ) ||
        file.isExpressEntry
      ) {
        categorized.entry.push({ file, safeId, rel });
      } else if (lower.includes('route') || lower.includes('controller') || (routeCountByFile.get(rel) || 0) > 0) {
        categorized.routes.push({ file, safeId, rel });
      } else if (lower.includes('middleware') || lower.includes('auth') || lower.includes('guard')) {
        categorized.middlewares.push({ file, safeId, rel });
      } else if (lower.includes('model') || lower.includes('schema') || lower.includes('entity')) {
        categorized.models.push({ file, safeId, rel });
      } else if (lower.includes('config') || lower.includes('db') || lower.includes('util') || lower.includes('helper')) {
        categorized.config.push({ file, safeId, rel });
      } else {
        categorized.other.push({ file, safeId, rel });
      }
    });

    // If no entry detected, pick first root file or first file
    if (categorized.entry.length === 0 && files.length > 0) {
      const fallback = files[0];
      const rel = fallback.relativePath.replace(/\\/g, '/');
      const safeId = fileNodeIdMap.get(rel);
      categorized.entry.push({ file: fallback, safeId, rel });
      // remove from others
      for (const k of Object.keys(categorized)) {
        if (k !== 'entry') {
          categorized[k] = categorized[k].filter((item) => item.rel !== rel);
        }
      }
    }

    // Render Subgraphs per Layer
    const renderSubgroup = (title, items, styleClass) => {
      if (items.length === 0) return;
      lines.push(`  subgraph sub_${styleClass} ["${title}"]`);
      items.forEach(({ file, safeId, rel }) => {
        const rCount = routeCountByFile.get(rel) || 0;
        const labelExtra = rCount > 0 ? ` (${rCount} APIs)` : '';
        lines.push(`    ${safeId}["📄 ${this._escapeMermaid(rel)}${labelExtra}"]:::${styleClass}`);
      });
      lines.push('  end');
    };

    renderSubgroup('🚀 Application Entry Point', categorized.entry, 'entry');
    renderSubgroup('🌐 Routing & Controllers', categorized.routes, 'routeLayer');
    renderSubgroup('🛡️ Middlewares & Guards', categorized.middlewares, 'mwLayer');
    renderSubgroup('🗄️ Database & Schemas', categorized.models, 'modelLayer');
    renderSubgroup('⚙️ Config & Utilities', categorized.config, 'configLayer');
    if (categorized.other.length > 0) {
      renderSubgroup('📦 Other Components', categorized.other, 'defaultLayer');
    }

    // Resolve cross-file import connections
    const drawnEdges = new Set();

    files.forEach((file) => {
      const sourceRel = file.relativePath.replace(/\\/g, '/');
      const sourceId = fileNodeIdMap.get(sourceRel);
      if (!sourceId) return;

      const imports = file.imports || [];
      imports.forEach((imp) => {
        const importSrc = imp.source;
        if (!importSrc || !importSrc.startsWith('.')) return; // skip npm packages

        // Match with known files
        const targetRel = this._resolveImportTarget(sourceRel, importSrc, fileNodeIdMap);
        if (targetRel && targetRel !== sourceRel) {
          const targetId = fileNodeIdMap.get(targetRel);
          if (targetId) {
            const edgeKey = `${sourceId}-->${targetId}`;
            if (!drawnEdges.has(edgeKey)) {
              drawnEdges.add(edgeKey);
              lines.push(`  ${sourceId} --> ${targetId}`);
            }
          }
        }
      });
    });

    // If few edges drawn, ensure entry links to routes
    if (drawnEdges.size === 0 && categorized.entry.length > 0) {
      const entryId = categorized.entry[0].safeId;
      categorized.routes.forEach((r) => {
        lines.push(`  ${entryId} -.-> ${r.safeId}`);
      });
      categorized.config.forEach((c) => {
        lines.push(`  ${entryId} -.-> ${c.safeId}`);
      });
    }

    const layerStats = {
      entry: categorized.entry.length,
      routes: categorized.routes.length,
      middlewares: categorized.middlewares.length,
      models: categorized.models.length,
      config: categorized.config.length,
      other: categorized.other.length,
      totalFiles: files.length,
    };

    return { mermaid: lines.join('\n'), layerStats };
  }

  /**
   * Generates a deterministic Mermaid.js file tree hierarchy graph.
   *
   * @param {Array<object>} files - Array of CodeFile documents
   * @returns {string} Mermaid.js graph definition
   */
  static generateFileTreeFlowchart(files = []) {
    if (!files || files.length === 0) {
      return 'graph TD\n  Empty["No files found"]';
    }

    const lines = [];
    lines.push('graph TD');
    lines.push('  classDef folder fill:#1e293b,stroke:#38bdf8,stroke-width:1.5px,color:#f8fafc;');
    lines.push('  classDef file fill:#0f172a,stroke:#818cf8,stroke-width:1px,color:#e2e8f0;');

    // Root node
    lines.push('  ROOT["📁 Repository Root"]:::folder');

    // Group files by directory
    const dirsMap = new Map(); // dirName -> Array<file>

    files.forEach((f) => {
      const p = (f.relativePath || f.fileName).replace(/\\/g, '/');
      const parts = p.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      if (!dirsMap.has(dir)) dirsMap.set(dir, []);
      dirsMap.get(dir).push(f);
    });

    const dirNodeIds = new Map(); // dir -> safeId
    dirNodeIds.set('.', 'ROOT');

    // Create folder nodes
    Array.from(dirsMap.keys()).sort().forEach((dir, idx) => {
      if (dir === '.') return;

      const dirId = `DIR_${idx}`;
      dirNodeIds.set(dir, dirId);
      lines.push(`  ${dirId}["📁 ${this._escapeMermaid(dir)}/"]:::folder`);

      // Connect to parent folder
      const parts = dir.split('/');
      const parentDir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      const parentId = dirNodeIds.get(parentDir) || 'ROOT';
      lines.push(`  ${parentId} --> ${dirId}`);
    });

    // Create file nodes and connect to their folder
    files.forEach((f, idx) => {
      const p = (f.relativePath || f.fileName).replace(/\\/g, '/');
      const parts = p.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      const fileId = `FL_${idx}`;
      const parentDirId = dirNodeIds.get(dir) || 'ROOT';

      const lineText = f.lineCount ? ` (${f.lineCount}L)` : '';
      lines.push(`  ${fileId}["📄 ${this._escapeMermaid(f.fileName)}${lineText}"]:::file`);
      lines.push(`  ${parentDirId} --- ${fileId}`);
    });

    return lines.join('\n');
  }

  static _resolveImportTarget(sourceRel, importSrc, fileMap) {
    const parts = sourceRel.split('/');
    const sourceDir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    
    // Normalize path
    let targetCandidate = '';
    if (importSrc.startsWith('./')) {
      targetCandidate = sourceDir ? `${sourceDir}/${importSrc.slice(2)}` : importSrc.slice(2);
    } else if (importSrc.startsWith('../')) {
      const dirParts = sourceDir ? sourceDir.split('/') : [];
      let upCount = 0;
      let rem = importSrc;
      while (rem.startsWith('../')) {
        upCount++;
        rem = rem.slice(3);
      }
      const remainingDir = dirParts.slice(0, Math.max(0, dirParts.length - upCount)).join('/');
      targetCandidate = remainingDir ? `${remainingDir}/${rem}` : rem;
    }

    targetCandidate = targetCandidate.replace(/\\/g, '/');

    // Try extensions
    const exts = ['', '.js', '.ts', '.mjs', '.cjs', '/index.js', '/index.ts'];
    for (const ext of exts) {
      const candidate = targetCandidate + ext;
      if (fileMap.has(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  static _escapeMermaid(str) {
    if (!str) return '';
    return str
      .replace(/"/g, "'")
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/[\n\r]/g, ' ')
      .slice(0, 50);
  }
}

module.exports = FlowchartService;
