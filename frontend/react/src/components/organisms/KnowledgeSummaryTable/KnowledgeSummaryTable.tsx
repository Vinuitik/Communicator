import React, { useCallback, useEffect, useState } from 'react';
import ProgressBar from '../../atoms/ProgressBar';
import { summarizeFriendKnowledge } from '../../../services/api/profileAiService';
import { KnowledgeSummaryFact } from '../../../types/api';

const confidenceColor = (percent: number): string => {
  if (percent >= 80) return '#46D39A';
  if (percent >= 60) return '#F5B544';
  return '#F4676E';
};

interface KnowledgeSummaryTableProps {
  friendId: number;
}

// Ported from profile's modules/knowledgeTable.js — an AI-generated summary
// of "what we know about this friend" (key -> value + confidence + evidence
// count), restyled to the redesign's Structured knowledge row layout:
// uppercase accent key, confidence bar+%, and a source-count chip that opens
// the references modal. ai_agent's POST /knowledge/summarize already
// existed — no backend change.
const KnowledgeSummaryTable: React.FC<KnowledgeSummaryTableProps> = ({ friendId }) => {
  const [facts, setFacts] = useState<KnowledgeSummaryFact[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referencesFact, setReferencesFact] = useState<KnowledgeSummaryFact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await summarizeFriendKnowledge(friendId);
      setFacts(data.facts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge summary');
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!referencesFact) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setReferencesFact(null); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [referencesFact]);

  if (loading) {
    return (
      <div className="text-center text-text-muted py-8">
        <div className="text-2xl mb-2 animate-spin inline-block">⏳</div>
        <p className="text-sm">AI is analyzing knowledge about this friend…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-bad mb-3">Failed to load knowledge summary</p>
        <button type="button" onClick={load} className="px-4 py-2 text-xs border border-white/10 rounded-input text-text-secondary hover:bg-white/5">Try again</button>
      </div>
    );
  }
  if (!facts || facts.length === 0) {
    return (
      <div className="text-center py-[30px] px-4 border border-dashed border-white/10 rounded-card mt-2">
        <div className="text-2xl opacity-50 mb-2">✦</div>
        <div className="text-[13px] text-text-muted font-semibold">No knowledge yet</div>
        <div className="text-[11.5px] text-text-faint mt-1">Log a chat or add a fact — the AI organises it into key facts here.</div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-3.5 text-[11.5px] text-text-faint">AI-extracted key facts, each backed by evidence from your raw notes.</p>
      <div className="flex flex-col gap-2">
        {facts.map((fact, i) => {
          const percent = Math.round((fact.stability_score || 0) * 100);
          const refCount = fact.references?.length || 0;
          return (
            <div key={i} className="px-3.5 py-3 bg-surface-2 rounded-[10px]">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[10.5px] font-bold tracking-[.04em] text-accent-light uppercase min-w-[78px]">{fact.key || 'Unknown'}</span>
                <span className="flex-1 text-[13px] text-text-primary">{fact.value || ''}</span>
              </div>
              <div className="flex items-center gap-2.5 mt-2 pl-[88px]">
                <ProgressBar percent={percent} color={confidenceColor(percent)} className="flex-1 max-w-[120px]" />
                <span className="text-[10.5px] text-text-faint">{percent}% confidence</span>
                {refCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setReferencesFact(fact)}
                    className="ml-auto text-[10.5px] font-semibold text-accent-light bg-accent/[.14] px-2 py-0.5 rounded-pill hover:bg-accent/[.22] transition-colors"
                  >
                    ◈ {refCount} source{refCount > 1 ? 's' : ''}
                  </button>
                ) : (
                  <span className="ml-auto text-[10.5px] text-text-faintest">No sources</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {referencesFact && (
        <div className="fixed inset-0 z-[110] bg-black/70 flex items-center justify-center p-4 animate-ftfade" onClick={() => setReferencesFact(null)}>
          <div className="bg-modal border border-white/10 rounded-card w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-modal animate-ftmodal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-hairline">
              <div>
                <h3 className="text-base font-display font-bold text-text-primary m-0">Supporting evidence</h3>
                <p className="text-sm text-text-muted mt-1"><strong className="text-accent-light">{referencesFact.key}:</strong> {referencesFact.value}</p>
              </div>
              <button type="button" onClick={() => setReferencesFact(null)} className="text-xl text-text-muted hover:text-text-emphasis leading-none">&times;</button>
            </div>
            <div className="p-5 overflow-y-auto flex flex-col gap-3">
              {(referencesFact.references || []).map((ref, i) => {
                const matchPercent = Math.round(ref.relevance_score * 100);
                return (
                  <div key={i} className="border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-text-faint">Source {i + 1}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-pill" style={{ color: confidenceColor(matchPercent), background: `${confidenceColor(matchPercent)}22` }}>
                        {matchPercent}% match
                      </span>
                    </div>
                    <div className="text-sm text-text-secondary">{ref.chunk_text || '[Text not available]'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KnowledgeSummaryTable;
