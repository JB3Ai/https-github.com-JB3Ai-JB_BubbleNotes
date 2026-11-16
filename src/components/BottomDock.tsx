import React, { useState, useEffect } from 'react';
import { BubbleCategory, BubbleNote, CategoryMap } from '../types';
import { soundFx } from '../audio/soundEffects';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Film,
  Waves,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  Target,
  Filter,
  Settings,
} from 'lucide-react';

interface BottomDockProps {
  notes: BubbleNote[];
  categories: CategoryMap;
  todayCount: number;
  completedCount: number;
  activeCategoryFilter: BubbleCategory | null;
  mergeSameCategoryOnly: boolean;
  showWorkflowHints: boolean;
  onSelectCategoryFilter: (cat: BubbleCategory | null) => void;
  onOpenCreate: () => void;
  onOpenVideoStudio: () => void;
  onOpenCompleted: () => void;
  onOpenSettings: () => void;
  onAgitateTank: () => void;
  onResetCamera: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  notes,
  categories,
  todayCount,
  completedCount,
  activeCategoryFilter,
  mergeSameCategoryOnly,
  showWorkflowHints,
  onSelectCategoryFilter,
  onOpenCreate,
  onOpenVideoStudio,
  onOpenCompleted,
  onOpenSettings,
  onAgitateTank,
  onResetCamera,
}) => {
  const [isZenCollapsed, setIsZenCollapsed] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [soundActive, setSoundActive] = useState<boolean>(soundFx.isEnabled());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setIsZenCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleToggleSound = () => {
    const next = soundFx.toggleSound();
    setSoundActive(next);
  };

  const activeCategoryLabel = activeCategoryFilter
    ? categories[activeCategoryFilter]?.name
    : 'All';

  return (
    <>
      {/* Discreet Top-Left Minimal Wordmark & Quiet Today Summary */}
      <header className="fixed top-4 left-5 right-5 z-20 flex items-center justify-between pointer-events-none select-none">
        <div className="flex items-center gap-3 pointer-events-none">
          <h1 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-white">
            BubbleNote
          </h1>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="text-xs font-mono-tabular text-slate-400">
            {notes.length} {notes.length === 1 ? 'orb' : 'orbs'}
          </span>
          {todayCount > 0 && (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-xs font-mono-tabular text-cyan-300">
                <Target className="w-3 h-3" />
                <span>{todayCount} Today</span>
              </span>
            </>
          )}
        </div>

        {showWorkflowHints && (
          <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500 pointer-events-none">
            <span>
              {mergeSameCategoryOnly ? 'Drag same-category orbs to join' : 'Drag any orb onto orb to join'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Click orb to edit or split</span>
          </div>
        )}
      </header>

      {/* Collapsible Unified Bottom Dock */}
      <div
        id="bottom-zen-dock-wrapper"
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center transition-transform duration-300 ease-out max-w-[94vw] ${
          isZenCollapsed ? 'translate-y-[calc(100%+16px)]' : 'translate-y-0'
        }`}
      >
        {/* Expandable Category Filter Bar */}
        {showFilters && !isZenCollapsed && (
          <div className="mb-2 obsidian-surface rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[92vw]">
            <button
              type="button"
              onClick={() => onSelectCategoryFilter(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeCategoryFilter === null
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({notes.length})
            </button>
            {(Object.keys(categories) as BubbleCategory[]).map((catKey) => {
              const cat = categories[catKey];
              const count = notes.filter((n) => n.category === catKey).length;
              const selected = activeCategoryFilter === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => onSelectCategoryFilter(selected ? null : catKey)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    selected
                      ? 'bg-white/15 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.name}</span>
                  {count > 0 && (
                    <span className="font-mono-tabular text-[11px] text-slate-400">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Collapse / Expand Toggle Attached to Top Edge of Dock */}
        <button
          id="btn-toggle-zen-dock"
          type="button"
          onClick={() => setIsZenCollapsed((prev) => !prev)}
          title="Toggle Zen View (H)"
          className={`px-3 py-1 rounded-t-xl obsidian-surface border-b-0 text-[11px] font-medium text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer transition-all ${
            isZenCollapsed ? '-translate-y-10 rounded-xl border-b' : ''
          }`}
        >
          {isZenCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Zen View</span>
            </>
          )}
        </button>

        {/* Main Compact Horizontal Control Dock */}
        <nav
          aria-label="Tank Controls"
          className="obsidian-surface rounded-2xl px-2.5 py-2 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full"
        >
          {/* Category Filter Toggle */}
          <button
            id="btn-dock-filters"
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              showFilters || activeCategoryFilter
                ? 'bg-white/12 text-white'
                : 'text-slate-300 hover:bg-white/[0.06]'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>{activeCategoryLabel}</span>
          </button>

          <div className="w-px h-5 bg-white/10 shrink-0" />

          {/* Photo-to-Video Studio Trigger */}
          <button
            id="btn-dock-video-studio"
            type="button"
            onClick={onOpenVideoStudio}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-white/[0.06] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Film className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden sm:inline">Video Studio</span>
          </button>

          {/* Swirl / Agitate */}
          <button
            id="btn-dock-swirl"
            type="button"
            onClick={onAgitateTank}
            title="Gentle thermal swirl"
            className="px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Swirl</span>
          </button>

          {/* Reset Camera */}
          <button
            id="btn-dock-reset-camera"
            type="button"
            onClick={onResetCamera}
            title="Reset camera angle and zoom"
            className="px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Reset View</span>
          </button>

          {/* Completed Archive */}
          <button
            id="btn-dock-completed"
            type="button"
            onClick={onOpenCompleted}
            title="View popped bubbles"
            className="px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Popped</span>
            {completedCount > 0 && (
              <span className="font-mono-tabular text-[11px] text-emerald-300">
                {completedCount}
              </span>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            id="btn-dock-sound"
            type="button"
            onClick={handleToggleSound}
            title={soundActive ? 'Mute sound' : 'Enable sound'}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.06] shrink-0 transition-colors cursor-pointer"
          >
            {soundActive ? (
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {/* Setup / Gear Modal Trigger */}
          <button
            id="btn-dock-settings"
            type="button"
            onClick={() => {
              soundFx.playPop(1.0);
              onOpenSettings();
            }}
            title="Setup & Categories"
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.06] shrink-0 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-300 hover:text-cyan-300" />
          </button>

          <div className="w-px h-5 bg-white/10 shrink-0" />

          {/* Primary CTA: New Bubble */}
          <button
            id="btn-dock-new-bubble"
            type="button"
            onClick={() => {
              soundFx.playPop(1.3);
              onOpenCreate();
            }}
            className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Bubble</span>
          </button>
        </nav>
      </div>
    </>
  );
};
