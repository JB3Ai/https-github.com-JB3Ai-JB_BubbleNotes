import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { BubbleNote, DriftSpeedPreset } from '../types';
import { getBubbleTheme, getDeadlineInfo } from '../constants';
import {
  LavaLampTankEngine,
  MergePreviewState,
  OrbScreenSnapshot,
} from '../scene/LavaLampTankEngine';
import { Film, Target, Sparkles, Lock } from 'lucide-react';

export interface TankCanvasRef {
  triggerPop: (noteId: string) => void;
  agitate: () => void;
  resetCamera: () => void;
  setCategoryFilter: (category: string | null) => void;
  registerSplitPosition: (sourceId: string, newId: string) => void;
}

interface TankCanvasProps {
  notes: BubbleNote[];
  onBubbleClick: (note: BubbleNote) => void;
  onBubbleMoveToToday: (noteId: string, isToday: boolean) => void;
  onBubbleMerge?: (mergedNote: BubbleNote, sourceNoteId: string) => void;
  activeCategoryFilter: string | null;
  mergeSameCategoryOnly: boolean;
  driftSpeed: DriftSpeedPreset;
}

export const TankCanvas = forwardRef<TankCanvasRef, TankCanvasProps>(
  (
    {
      notes,
      onBubbleClick,
      onBubbleMoveToToday,
      onBubbleMerge,
      activeCategoryFilter,
      mergeSameCategoryOnly,
      driftSpeed,
    },
    ref
  ) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const engineRef = useRef<LavaLampTankEngine | null>(null);
    const orbDomRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const collisionTimersRef = useRef<Map<string, number>>(new Map());
    const lastDiametersRef = useRef<Map<string, number>>(new Map());
    const mergeBadgeRef = useRef<HTMLDivElement | null>(null);
    const [contextLost, setContextLost] = useState(false);

    const callbacksRef = useRef({ onBubbleClick, onBubbleMoveToToday, onBubbleMerge });
    useEffect(() => {
      callbacksRef.current = { onBubbleClick, onBubbleMoveToToday, onBubbleMerge };
    });

    useImperativeHandle(ref, () => ({
      triggerPop: (noteId: string) => {
        engineRef.current?.triggerCompletionPop(noteId);
      },
      agitate: () => {
        engineRef.current?.agitateTank();
      },
      resetCamera: () => {
        engineRef.current?.resetCamera();
      },
      setCategoryFilter: (cat: string | null) => {
        engineRef.current?.setCategoryFilter(cat);
      },
      registerSplitPosition: (sourceId: string, newId: string) => {
        engineRef.current?.registerSplitPosition(sourceId, newId);
      },
    }));

    useEffect(() => {
      if (!mountRef.current) return;

      const engine = new LavaLampTankEngine(mountRef.current);
      engineRef.current = engine;

      engine.setCallbacks(
        (note) => callbacksRef.current.onBubbleClick(note),
        (noteId, isToday) => callbacksRef.current.onBubbleMoveToToday(noteId, isToday),
        (mergedNote, sourceNoteId) => callbacksRef.current.onBubbleMerge?.(mergedNote, sourceNoteId)
      );

      const handleFrameSync = (
        snapshots: OrbScreenSnapshot[],
        mergePreview: MergePreviewState | null
      ) => {
        const activeIds = new Set<string>();

        for (let i = 0; i < snapshots.length; i++) {
          const snap = snapshots[i];
          activeIds.add(snap.id);
          const el = orbDomRefs.current.get(snap.id);
          if (!el) continue;

          const diameter = Math.max(36, snap.screenRadius * 2);
          el.style.transform = `translate3d(${snap.screenX}px, ${snap.screenY}px, 0)`;
          el.style.zIndex = String(snap.isDragging ? 9999 : snap.zOrder);

          const prevDiameter = lastDiametersRef.current.get(snap.id);
          if (prevDiameter === undefined || Math.abs(prevDiameter - diameter) > 0.5) {
            lastDiametersRef.current.set(snap.id, diameter);
            el.style.width = `${diameter}px`;
            el.style.height = `${diameter}px`;
            el.style.marginLeft = `${-diameter / 2}px`;
            el.style.marginTop = `${-diameter / 2}px`;
          }

          el.style.opacity = String(snap.opacity);
          el.style.pointerEvents = snap.opacity > 0.08 ? 'auto' : 'none';
        }

        orbDomRefs.current.forEach((el, id) => {
          if (!activeIds.has(id)) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
          }
        });

        // Update floating merge badge without React re-render
        const badgeEl = mergeBadgeRef.current;
        if (badgeEl) {
          if (mergePreview && mergePreview.active) {
            badgeEl.style.opacity = '1';
            badgeEl.style.transform = `translate3d(${mergePreview.x}px, ${mergePreview.y}px, 0) translate(-50%, -50%)`;
            const allowBox = badgeEl.querySelector('[data-merge-allowed]') as HTMLElement | null;
            const blockBox = badgeEl.querySelector('[data-merge-blocked]') as HTMLElement | null;
            if (mergePreview.blocked) {
              if (allowBox) allowBox.style.display = 'none';
              if (blockBox) blockBox.style.display = 'flex';
            } else {
              if (allowBox) allowBox.style.display = 'flex';
              if (blockBox) blockBox.style.display = 'none';
              const lvlSpan = badgeEl.querySelector('[data-merge-level]');
              if (lvlSpan) {
                lvlSpan.textContent = `Level ${mergePreview.combinedLevel}`;
              }
            }
          } else {
            badgeEl.style.opacity = '0';
          }
        }
      };

      const triggerCollisionSquish = (id: string) => {
        const el = orbDomRefs.current.get(id);
        if (!el) return;

        el.classList.remove('is-colliding');
        void el.offsetWidth;
        el.classList.add('is-colliding');

        const existingTimer = collisionTimersRef.current.get(id);
        if (existingTimer !== undefined) {
          window.clearTimeout(existingTimer);
        }

        const timerId = window.setTimeout(() => {
          el.classList.remove('is-colliding');
          collisionTimersRef.current.delete(id);
        }, 720);
        collisionTimersRef.current.set(id, timerId);
      };

      const handleBubbleCollide = (id1: string, id2: string) => {
        triggerCollisionSquish(id1);
        triggerCollisionSquish(id2);
      };

      engine.setVisualSyncCallbacks(handleFrameSync, handleBubbleCollide, setContextLost);
      engine.setCategoryFilter(activeCategoryFilter);
      engine.setConfig({ mergeSameCategoryOnly, driftSpeed });

      const updateSize = () => {
        if (!mountRef.current) return;
        engine.resize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      };

      const resizeObserver = new ResizeObserver(() => {
        updateSize();
      });

      resizeObserver.observe(mountRef.current);
      updateSize();

      engine.syncNotes(notes);
      engine.start();

      return () => {
        resizeObserver.disconnect();
        collisionTimersRef.current.forEach((t) => window.clearTimeout(t));
        collisionTimersRef.current.clear();
        engine.dispose();
        engineRef.current = null;
      };
    }, []);

    useEffect(() => {
      engineRef.current?.syncNotes(notes);
    }, [notes]);

    useEffect(() => {
      engineRef.current?.setCategoryFilter(activeCategoryFilter);
    }, [activeCategoryFilter]);

    useEffect(() => {
      engineRef.current?.setConfig({ mergeSameCategoryOnly, driftSpeed });
    }, [mergeSameCategoryOnly, driftSpeed]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      engineRef.current?.handlePointerDown(e.clientX, e.clientY);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      engineRef.current?.handlePointerMove(e.clientX, e.clientY);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if already released
      }
      engineRef.current?.handlePointerUp(e.clientX, e.clientY);
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
      engineRef.current?.handleWheel(e.deltaY);
    };

    return (
      <div
        id="tank-canvas-container"
        className="relative w-full h-full overflow-hidden select-none touch-none bg-[#030508]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* Dedicated isolated WebGL mount container */}
        <div ref={mountRef} className="absolute inset-0 w-full h-full" />

        {/* Graceful fallback if WebGL context is lost */}
        {contextLost && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#030508]/95 text-slate-300 text-sm">
            Restoring 3D Iridescent Tank Graphics...
          </div>
        )}

        {/* Synced Projected Semantic DOM Overlay (Upright Crisp Text + CSS Squish Membrane) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {notes.map((note, idx) => {
            const theme = getBubbleTheme(note);
            const deadline = getDeadlineInfo(note.deadline);
            const isSmall = note.importance <= 1;

            return (
              <div
                key={note.id}
                ref={(node) => {
                  if (node) {
                    orbDomRefs.current.set(note.id, node);
                  } else {
                    orbDomRefs.current.delete(note.id);
                    lastDiametersRef.current.delete(note.id);
                    const timerId = collisionTimersRef.current.get(note.id);
                    if (timerId !== undefined) {
                      window.clearTimeout(timerId);
                      collisionTimersRef.current.delete(note.id);
                    }
                  }
                }}
                className="lava-orb-wrapper absolute left-0 top-0 rounded-full pointer-events-auto cursor-grab active:cursor-grabbing"
                style={
                  {
                    opacity: 0,
                    willChange: 'transform, opacity',
                    '--orb-glow': theme.glowColor,
                    '--orb-core': theme.coreColor,
                    '--orb-accent': theme.accentColor,
                  } as React.CSSProperties
                }
              >
                <div
                  className="lava-orb-membrane w-full h-full flex items-center justify-center"
                  style={{
                    animationDelay: `${-((idx * 1.9) % 12).toFixed(2)}s`,
                  }}
                >
                  <div className="lava-orb-squish w-full h-full border border-transparent flex flex-col items-center justify-center px-3 text-center">
                    {/* Upright Single-Sentence Bubble Text */}
                    <span
                      className={`font-display font-medium leading-tight tracking-[0.01em] text-balance select-none pointer-events-none line-clamp-3 ${
                        isSmall ? 'text-[11px]' : note.importance >= 4 ? 'text-sm sm:text-[15px]' : 'text-xs sm:text-[13px]'
                      }`}
                      style={{
                        color: theme.textColor,
                        textShadow: '0 2px 12px rgba(0, 0, 0, 0.9), 0 0 6px rgba(0, 0, 0, 0.7)',
                      }}
                    >
                      {note.title}
                    </span>

                    {/* Quiet inline indicators for Today / Video / Urgent Deadline */}
                    {(note.isToday || note.videoAttachment || deadline.urgencyLevel >= 2) && (
                      <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] font-mono-tabular text-slate-200/90 pointer-events-none">
                        {note.videoAttachment && (
                          <span className="inline-flex items-center gap-0.5 text-cyan-300" title="Video attached">
                            <Film className="w-2.5 h-2.5" />
                            <span>Clip</span>
                          </span>
                        )}
                        {note.isToday && (
                          <span className="inline-flex items-center gap-0.5 text-sky-300">
                            <Target className="w-2.5 h-2.5" />
                            <span>Today</span>
                          </span>
                        )}
                        {deadline.urgencyLevel >= 2 && (
                          <span
                            className={
                              deadline.status === 'overdue'
                                ? 'text-rose-300'
                                : 'text-amber-300'
                            }
                          >
                            {deadline.badgeText}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Merge Preview Indicator (zero React re-renders during drag) */}
        <div
          ref={mergeBadgeRef}
          className="absolute left-0 top-0 z-20 pointer-events-none opacity-0 transition-opacity duration-150"
        >
          <div
            data-merge-allowed
            className="obsidian-surface px-3.5 py-1.5 rounded-full flex items-center gap-2 text-xs text-cyan-200 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Drop to merge</span>
            <span className="text-slate-500">·</span>
            <span data-merge-level className="font-mono-tabular font-semibold text-cyan-300">
              Level 4
            </span>
          </div>
          <div
            data-merge-blocked
            style={{ display: 'none' }}
            className="obsidian-surface px-3.5 py-1.5 rounded-full items-center gap-2 text-xs text-amber-200 whitespace-nowrap border-amber-500/30"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Same category only</span>
          </div>
        </div>
      </div>
    );
  }
);

TankCanvas.displayName = 'TankCanvas';
