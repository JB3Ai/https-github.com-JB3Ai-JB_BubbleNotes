import React, { useState, useEffect } from 'react';
import {
  AppConfig,
  BubbleCategory,
  CategoryMap,
  DriftSpeedPreset,
} from '../types';
import { CATEGORIES, DEFAULT_APP_CONFIG } from '../constants';
import { soundFx } from '../audio/soundEffects';
import {
  X,
  Settings,
  Tag,
  GitMerge,
  Split,
  Volume2,
  VolumeX,
  RotateCcw,
  Check,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  categories: CategoryMap;
  onUpdateConfig: (next: AppConfig) => void;
  onResetSampleNotes: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  categories,
  onUpdateConfig,
  onResetSampleNotes,
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'workflow'>('categories');
  const [draftConfig, setDraftConfig] = useState<AppConfig>(config);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundFx.isEnabled());
  const [confirmResetNotes, setConfirmResetNotes] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setDraftConfig(config);
      setSoundEnabled(soundFx.isEnabled());
      setConfirmResetNotes(false);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleCategoryNameChange = (catKey: BubbleCategory, name: string) => {
    const existing = draftConfig.categoryOverrides[catKey] || {};
    const updated: AppConfig = {
      ...draftConfig,
      categoryOverrides: {
        ...draftConfig.categoryOverrides,
        [catKey]: {
          ...existing,
          name,
        },
      },
    };
    setDraftConfig(updated);
    onUpdateConfig(updated);
  };

  const handleCategoryDescChange = (catKey: BubbleCategory, description: string) => {
    const existing = draftConfig.categoryOverrides[catKey] || {};
    const updated: AppConfig = {
      ...draftConfig,
      categoryOverrides: {
        ...draftConfig.categoryOverrides,
        [catKey]: {
          ...existing,
          description,
        },
      },
    };
    setDraftConfig(updated);
    onUpdateConfig(updated);
  };

  const handleResetCategories = () => {
    const updated: AppConfig = {
      ...draftConfig,
      categoryOverrides: {},
    };
    setDraftConfig(updated);
    onUpdateConfig(updated);
    soundFx.playPop(1.0);
  };

  const handleSetMergePolicy = (sameOnly: boolean) => {
    const updated: AppConfig = { ...draftConfig, mergeSameCategoryOnly: sameOnly };
    setDraftConfig(updated);
    onUpdateConfig(updated);
    soundFx.playPop(1.05);
  };

  const handleSetDriftSpeed = (driftSpeed: DriftSpeedPreset) => {
    const updated: AppConfig = { ...draftConfig, driftSpeed };
    setDraftConfig(updated);
    onUpdateConfig(updated);
    soundFx.playSquish();
  };

  const handleToggleHints = () => {
    const updated: AppConfig = {
      ...draftConfig,
      showWorkflowHints: !draftConfig.showWorkflowHints,
    };
    setDraftConfig(updated);
    onUpdateConfig(updated);
  };

  const handleToggleSound = () => {
    const next = soundFx.toggleSound();
    setSoundEnabled(next);
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75"
      onClick={onClose}
    >
      <div
        id="settings-modal-card"
        className="relative w-full max-w-xl rounded-3xl obsidian-modal overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-white tracking-tight">
                Tank Setup & Categories
              </h2>
              <p className="text-xs text-slate-400">
                Customize category names, merge workflow, and drift pace
              </p>
            </div>
          </div>

          <button
            id="btn-close-settings-modal"
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-white/10 flex items-center gap-2">
          <button
            id="tab-settings-categories"
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-cyan-400" />
            <span>Categories</span>
          </button>
          <button
            id="tab-settings-workflow"
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'workflow'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-violet-400" />
            <span>Workflow & Motion</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {activeTab === 'categories' ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Rename categories to match your life, team, or projects. Changes save instantly.
                </p>
                <button
                  id="btn-reset-category-names"
                  type="button"
                  onClick={handleResetCategories}
                  className="text-[11px] text-slate-400 hover:text-cyan-300 inline-flex items-center gap-1 shrink-0 ml-3 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Names</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {(Object.keys(CATEGORIES) as BubbleCategory[]).map((catKey) => {
                  const base = CATEGORIES[catKey];
                  const override = draftConfig.categoryOverrides[catKey];
                  const currentName = override?.name !== undefined ? override.name : categories[catKey].name;
                  const currentDesc =
                    override?.description !== undefined
                      ? override.description
                      : categories[catKey].description;

                  return (
                    <div
                      key={catKey}
                      className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{
                            backgroundColor: base.color,
                            boxShadow: `0 0 8px ${base.color}`,
                          }}
                        />
                        <input
                          id={`input-category-name-${catKey}`}
                          type="text"
                          value={currentName}
                          onChange={(e) => handleCategoryNameChange(catKey, e.target.value)}
                          onBlur={() => {
                            if (!currentName.trim()) {
                              handleCategoryNameChange(catKey, base.name);
                            }
                          }}
                          maxLength={28}
                          placeholder={base.name}
                          className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-medium text-white focus:outline-none focus:border-cyan-400"
                        />
                        <span className="text-[10px] font-mono-tabular text-slate-500 uppercase shrink-0">
                          {catKey}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={currentDesc}
                        onChange={(e) => handleCategoryDescChange(catKey, e.target.value)}
                        maxLength={60}
                        placeholder={base.description}
                        className="w-full px-3 py-1 rounded-xl bg-transparent border border-white/[0.06] text-[11px] text-slate-400 focus:text-slate-200 focus:outline-none focus:border-cyan-400/60"
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-5">
              {/* Merge / Join Policy */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-white">
                  <GitMerge className="w-4 h-4 text-cyan-400" />
                  <span>Bubble Joining Rule</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    id="btn-policy-same-category"
                    type="button"
                    onClick={() => handleSetMergePolicy(true)}
                    className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer space-y-1 ${
                      draftConfig.mergeSameCategoryOnly
                        ? 'bg-cyan-500/15 border-cyan-400 text-white'
                        : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Same Category Only</span>
                      {draftConfig.mergeSameCategoryOnly && (
                        <Check className="w-3.5 h-3.5 text-cyan-300" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Recommended. Keeps bills, work, and ideas cleanly grouped without accidental cross-merges.
                    </p>
                  </button>

                  <button
                    id="btn-policy-any-category"
                    type="button"
                    onClick={() => handleSetMergePolicy(false)}
                    className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer space-y-1 ${
                      !draftConfig.mergeSameCategoryOnly
                        ? 'bg-cyan-500/15 border-cyan-400 text-white'
                        : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Allow Cross-Category</span>
                      {!draftConfig.mergeSameCategoryOnly && (
                        <Check className="w-3.5 h-3.5 text-cyan-300" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Join any bubble onto any other bubble; the higher-priority bubble sets the category.
                    </p>
                  </button>
                </div>
              </div>

              {/* Recommended Workflow Note */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-cyan-200">
                  <Split className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Join & Split Workflow</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Drag related bubbles together to combine their notes and amplify importance. Need to separate tasks later? Open any bubble and click <strong className="text-slate-200">Split</strong> to divide it cleanly into two drifting orbs.
                </p>
              </div>

              {/* Lava-Lamp Drift Pace */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <span>Lava-Lamp Drift Pace</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'ultra-slow', label: 'Ultra-Slow', sub: 'Deep meditative' },
                      { id: 'calm', label: 'Calm', sub: 'Classic lava' },
                      { id: 'gentle', label: 'Gentle', sub: 'Lively glide' },
                    ] as { id: DriftSpeedPreset; label: string; sub: string }[]
                  ).map((preset) => {
                    const selected = draftConfig.driftSpeed === preset.id;
                    return (
                      <button
                        key={preset.id}
                        id={`btn-drift-${preset.id}`}
                        type="button"
                        onClick={() => handleSetDriftSpeed(preset.id)}
                        className={`p-2.5 rounded-xl border text-center transition-colors cursor-pointer ${
                          selected
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-xs font-semibold">{preset.label}</div>
                        <div className="text-[10px] opacity-75">{preset.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div>
                    <div className="text-xs font-medium text-white">Workflow Hints</div>
                    <div className="text-[11px] text-slate-400">
                      Show subtle gesture tips in the top-right corner
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleHints}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      draftConfig.showWorkflowHints ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        draftConfig.showWorkflowHints ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-2.5">
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-500" />
                    )}
                    <div>
                      <div className="text-xs font-medium text-white">Fluid Sound Effects</div>
                      <div className="text-[11px] text-slate-400">
                        Soft acoustic pops on merge, split, and completion
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleSound}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      soundEnabled ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        soundEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Reset Sample Bubbles */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400">
                  Restore default starter bubbles or reset all tank config.
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {confirmResetNotes ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmResetNotes(false)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] text-slate-300 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onResetSampleNotes();
                          onUpdateConfig(DEFAULT_APP_CONFIG);
                          setDraftConfig(DEFAULT_APP_CONFIG);
                          setConfirmResetNotes(false);
                          soundFx.playBirth();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-medium cursor-pointer"
                      >
                        Confirm Reset
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmResetNotes(true)}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-xs text-slate-300 cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/10 flex items-center justify-end">
          <button
            id="btn-settings-done"
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
