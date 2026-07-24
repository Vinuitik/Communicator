import React, { useCallback, useEffect, useState } from 'react';
import { summarizeFriendKnowledge } from '../../../services/api/profileAiService';
import { KnowledgeSummaryFact } from '../../../types/api';

const confidenceClass = (percent: number): string => {
  if (percent >= 80) return 'bg-emerald-100 text-emerald-800';
  if (percent >= 60) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
};

interface KnowledgeSummaryTableProps {
  friendId: number;
}

// Ported from profile's modules/knowledgeTable.js — an AI-generated summary
// table of "what we know about this friend", with a references modal showing
// the knowledge-base chunks each fact was drawn from. ai_agent's POST
// /knowledge/summarize (routers/knowledge.py) already existed for the
// MCP/knowledge pipeline — this port just adds a UI caller.
//
// "Add Info"/"Edit" are honest no-op stubs here too: the legacy
// showAddKnowledgeModal()/showEditKnowledgeModal() were already placeholders
// ("coming soon"), not features this port removed.
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

  return (
    <div className="profile-section knowledge-section bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Knowledge</h2>
        <button
          type="button"
          onClick={() => window.alert('Add knowledge feature coming soon!')}
          className="px-4 py-2 text-sm bg-brand text-white rounded hover:bg-brand-dark"
        >
          Add Info
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 p-8">
          <div className="text-3xl mb-2 animate-spin inline-block">⏳</div>
          <p>AI is analyzing knowledge about this friend...</p>
          <p className="text-sm text-gray-400">This may take a few moments</p>
        </div>
      ) : error ? (
        <div className="text-center text-red-600 p-8">
          <div className="text-3xl mb-2">⚠️</div>
          <p>Failed to load knowledge summary</p>
          <p className="text-sm text-gray-500 mb-3">{error}</p>
          <button type="button" onClick={load} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Try Again</button>
        </div>
      ) : !facts || facts.length === 0 ? (
        <div className="text-center text-gray-500 p-8">
          <div className="text-3xl mb-2">🤔</div>
          <p>No knowledge available yet</p>
          <p className="text-sm text-gray-400">Start adding some facts about this friend!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4">Fact</th>
                <th className="py-2 pr-4">Value</th>
                <th className="py-2 pr-4">Confidence</th>
                <th className="py-2">References</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((fact, i) => {
                const percent = Math.round((fact.stability_score || 0) * 100);
                return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium text-gray-800">{fact.key || 'Unknown'}</td>
                    <td className="py-2 pr-4 text-gray-700">{fact.value || ''}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceClass(percent)}`}>{percent}%</span>
                    </td>
                    <td className="py-2">
                      {fact.references && fact.references.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setReferencesFact(fact)}
                          className="text-xs text-brand hover:underline"
                        >
                          🔗 {fact.references.length} source{fact.references.length > 1 ? 's' : ''}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">No sources</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {referencesFact && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setReferencesFact(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-lg font-medium text-gray-800 m-0">Supporting Evidence</h3>
                <p className="text-sm text-gray-600"><strong>{referencesFact.key}:</strong> {referencesFact.value}</p>
              </div>
              <button type="button" onClick={() => setReferencesFact(null)} className="text-2xl text-gray-500 hover:text-gray-900 leading-none">&times;</button>
            </div>
            <div className="p-5 overflow-y-auto flex flex-col gap-3">
              {(referencesFact.references || []).map((ref, i) => {
                const matchPercent = Math.round(ref.relevance_score * 100);
                const matchClass = matchPercent >= 80 ? 'bg-emerald-100 text-emerald-800' : matchPercent >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
                return (
                  <div key={i} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">Source {i + 1}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${matchClass}`}>{matchPercent}% match</span>
                    </div>
                    <div className="text-sm text-gray-700">{ref.chunk_text || '[Text not available]'}</div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button type="button" onClick={() => setReferencesFact(null)} className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeSummaryTable;
