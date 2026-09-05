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
    lines.push('  classDef call fill:#064e3b,stroke:#10b981,stroke-width:1px,color:#ecfdf5;');
    lines.push('  classDef term fill:#1e293b,stroke:#38bdf8,stroke-width:1px,color:#f8fafc;');

    const fnId = 'FN_ENTRY';
    const fnName = this._escapeMermaid(funcDef.name || 'function');
    const params = (funcDef.params || []).map((p) => this._escapeMermaid(p)).join(', ');
    lines.push(`  ${fnId}["${funcDef.isAsync ? 'async ' : ''}${fnName}(${params})"]:::fn`);

    let prev = fnId;
    (funcDef.calls || []).slice(0, 6).forEach((call, i) => {
      const callId = `CALL_${i}`;
      lines.push(`  ${callId}["call: ${this._escapeMermaid(call)}()"]:::call`);
      lines.push(`  ${prev} --> ${callId}`);
      prev = callId;
    });

    const returnId = 'FN_RET';
    lines.push(`  ${returnId}(["Return Result"]):::term`);
    lines.push(`  ${prev} --> ${returnId}`);

    return lines.join('\n');
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
