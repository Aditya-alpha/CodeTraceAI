'use client';

import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  FileCode,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Layers,
  ExternalLink,
  Key,
  ShieldCheck,
} from 'lucide-react';
import { askQuestion, getApiConfig } from '../../lib/api';
import ApiKeyModal from '../ApiKeyModal';
import MarkdownRenderer from '../MarkdownRenderer';

export default function QATab({ repoId, initialPrompt }) {
  const [question, setQuestion] = useState(initialPrompt || '');
  const [hasGroqKey, setHasGroqKey] = useState(true);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I am CodeTraceAI. I have statically analyzed this repository using AST parsing and indexed its semantic units for vector retrieval.\n\n' +
        'You can ask me questions about authentication, route flows, database queries, and middleware architecture. Every answer will be grounded with strict citations from the source code.',
      citations: [],
      contextChunks: [],
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [showChunksIdx, setShowChunksIdx] = useState(null);

  React.useEffect(() => {
    getApiConfig()
      .then((cfg) => setHasGroqKey(cfg.hasGroqKey))
      .catch(() => {});
  }, []);

  const suggestedQuestions = [
    'How does authentication work?',
    'What endpoints require authentication middleware?',
    'Show me the database queries and validation in articles routes',
    'How are routers mounted and prefixes resolved?',
  ];

  const handleSend = async (customQ) => {
    const q = (customQ || question).trim();
    if (!q || loading) return;

    const userMessage = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setLoading(true);

    try {
      const data = await askQuestion(repoId, q);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          citations: data.citations || [],
          contextChunks: data.contextChunks || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Failed to get answer: ${err.message}`,
          citations: [],
          contextChunks: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[750px] glass-panel rounded-2xl overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-3.5 border-b border-white/[0.08] bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200">AST & Vector RAG Engine</span>
          <span className="text-[10px] text-slate-400 font-mono">Bounded Context & Strict Citations</span>
        </div>
        <div className="text-xs text-sky-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Zero Hallucination Grounding</span>
        </div>
      </div>

      {/* Suggested Questions */}
      <div className="px-6 py-2.5 bg-slate-900/30 border-b border-white/[0.04] flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-sky-400" />
          Try:
        </span>
        {suggestedQuestions.map((sq, i) => (
          <button
            key={i}
            onClick={() => handleSend(sq)}
            className="text-[11px] text-slate-300 hover:text-sky-300 bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1 rounded-lg shrink-0 border border-white/[0.06] transition-colors"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Groq Key Missing Banner */}
      {!hasGroqKey && (
        <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>Groq API Key not connected. Responses are running in deterministic mock mode.</span>
          </div>
          <button
            onClick={() => setShowKeyModal(true)}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] transition-colors shrink-0"
          >
            Connect Groq Key →
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 max-w-3xl ${
              msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${
                msg.role === 'user'
                  ? 'bg-sky-500 text-white'
                  : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-glow'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Content Card */}
            <div
              className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-sky-600 text-white rounded-tr-none whitespace-pre-wrap font-sans'
                  : 'bg-[#0f172a]/90 border border-white/[0.08] text-slate-200 rounded-tl-none space-y-3'
              }`}
            >
              {msg.role === 'user' ? (
                <div>{msg.content}</div>
              ) : (
                <MarkdownRenderer content={msg.content} />
              )}

              {/* Citations List if assistant */}
              {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                <div className="pt-3 mt-3 border-t border-white/[0.08] space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-sky-400" />
                    Verified Source Citations:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.citations.map((cite, cIdx) => (
                      <span
                        key={cIdx}
                        className="px-2 py-1 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[11px] font-mono flex items-center gap-1"
                      >
                        <FileCode className="w-3 h-3 text-sky-400" />
                        <span>
                          {cite.filePath}:{cite.loc?.startLine || '1'}-{cite.loc?.endLine || '?'}
                        </span>
                        <span className="text-slate-400">({cite.name})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Context chunks toggle */}
              {msg.role === 'assistant' && msg.contextChunks && msg.contextChunks.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowChunksIdx(showChunksIdx === idx ? null : idx)}
                    className="text-[10px] text-slate-400 hover:text-sky-300 flex items-center gap-1 font-mono transition-colors"
                  >
                    <Layers className="w-3 h-3" />
                    <span>
                      {showChunksIdx === idx ? 'Hide' : 'Inspect'} {msg.contextChunks.length} Retrieved AST Chunks
                    </span>
                    {showChunksIdx === idx ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showChunksIdx === idx && (
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                      {msg.contextChunks.map((chunk, chIdx) => (
                        <div key={chIdx} className="p-2.5 rounded-lg bg-black/40 border border-white/[0.04] text-[11px] font-mono">
                          <div className="text-sky-400 font-semibold">{chunk.filePath} ({chunk.type})</div>
                          <div className="text-slate-400 text-[10px]">Name: {chunk.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-3xl">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-[#0f172a]/90 border border-white/[0.08] text-xs text-slate-400 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <span>Retrieving AST chunks & synthesizing grounded response...</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-4 bg-slate-900/60 border-t border-white/[0.08] flex items-center gap-3"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about authentication, route flow, database calls, or middleware..."
          className="flex-1 bg-[#080c14] text-xs sm:text-sm text-slate-100 placeholder-slate-500 px-4 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-sky-500/50"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <span>Ask</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      <ApiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        onSaved={() => setHasGroqKey(true)}
      />
    </div>
  );
}
