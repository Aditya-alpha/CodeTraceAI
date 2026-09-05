'use client';

import React, { useState } from 'react';
import { Key, X, CheckCircle2, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
import { saveGroqApiKey } from '../lib/api';

export default function ApiKeyModal({ isOpen, onClose, onSaved }) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Please enter a valid Groq API key.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveGroqApiKey(apiKey.trim());
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (onSaved) onSaved();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to verify API key with Groq.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#0f172a] border border-white/[0.12] shadow-2xl space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-glow">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Groq API Key</h3>
            <p className="text-xs text-slate-400">Enables live reasoning with openai/gpt-oss-120b</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Enter your Groq API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                if (error) setError(null);
              }}
              placeholder="gsk_..."
              className="w-full bg-[#080c14] text-xs font-mono text-slate-100 placeholder-slate-600 px-3.5 py-2.5 rounded-xl border border-white/[0.1] focus:outline-none focus:border-sky-500/60"
              disabled={saving || success}
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Key verified and saved successfully!</span>
            </div>
          )}

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Don't have a key?</span>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
            >
              <span>Get free key from Groq Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || success || !apiKey.trim()}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-md shadow-sky-500/20 disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Save Key</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
