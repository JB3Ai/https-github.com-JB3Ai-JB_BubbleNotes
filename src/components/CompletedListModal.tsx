import React from 'react';
import { BubbleNote, CategoryMap } from '../types';
import { IMPORTANCE_LEVELS, getBubbleTheme } from '../constants';
import { X, CheckCircle2, RotateCcw, Trash2, Sparkles, Calendar } from 'lucide-react';
import { soundFx } from '../audio/soundEffects';

interface CompletedListModalProps {
  isOpen: boolean;
  categories: CategoryMap;
  onClose: () => void;
  completedNotes: BubbleNote[];
  onRestoreNote: (noteId: string) => void;
  onClearCompleted: () => void;
}

export const CompletedListModal: React.FC<CompletedListModalProps> = ({
  isOpen,
  categories,
  onClose,
  completedNotes,
  onRestoreNote,
  onClearCompleted,
}) => {
  if (!isOpen) return null;

  const handleRestore = (noteId: string) => {
    soundFx.playBirth();
    onRestoreNote(noteId);
  };

  const handleClear = () => {
    soundFx.playPop(0.7);
    onClearCompleted();
  };

  return (
    <div
      id="completed-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75"
      onClick={onClose}
    >
      <div
        id="completed-modal-card"
        className="relative w-full max-w-lg rounded-3xl obsidian-modal overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" />

        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-white tracking-tight">
                Popped & Completed
              </h3>
              <p className="text-xs text-slate-400 font-mono-tabular">
                {completedNotes.length} {completedNotes.length === 1 ? 'orb popped' : 'orbs popped'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-completed-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {completedNotes.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto text-slate-500 border border-white/10">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-sm font-medium text-slate-200">No popped bubbles yet</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Click any floating orb in the tank and select Complete to release it.
              </p>
            </div>
          ) : (
            completedNotes.map((note) => {
              const category = categories[note.category] || categories.general;
              const bubbleTheme = getBubbleTheme(note);
              const importanceMeta = IMPORTANCE_LEVELS[note.importance] || IMPORTANCE_LEVELS[3];

              return (
                <div
                  key={note.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                      style={{
                        backgroundColor: bubbleTheme.color,
                        boxShadow: `0 0 8px ${bubbleTheme.color}`,
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200 line-through decoration-slate-600 truncate">
                        {note.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span style={{ color: category.accentColor }}>{category.name}</span>
                        <span aria-hidden="true">·</span>
                        <span>{importanceMeta.name}</span>
                        {note.completedAt && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-slate-400 font-mono-tabular">
                              <Calendar className="w-3 h-3" />
                              {new Date(note.completedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestore(note.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/15 text-slate-200 hover:text-cyan-300 text-xs font-medium transition-colors flex-shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Restore</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {completedNotes.length > 0 && (
          <div className="px-6 py-3.5 bg-black/40 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 font-medium transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
