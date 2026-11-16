import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppConfig, BubbleNote, BubbleCategory, VideoAttachment } from './types';
import {
  INITIAL_BUBBLE_NOTES,
  DEFAULT_APP_CONFIG,
  getEffectiveCategories,
  CATEGORY_DEFAULT_COLOR,
} from './constants';
import { TankCanvas, TankCanvasRef } from './components/TankCanvas';
import { BottomDock } from './components/BottomDock';
import { NoteModal, SplitBubbleDraft } from './components/NoteModal';
import { CreateBubbleModal } from './components/CreateBubbleModal';
import { CompletedListModal } from './components/CompletedListModal';
import { VideoStudioModal } from './components/VideoStudioModal';
import { SettingsModal } from './components/SettingsModal';

const STORAGE_KEY = 'bubblenote_notes_v1';
const CONFIG_STORAGE_KEY = 'bubblenote_config_v1';

export default function App() {
  const [notes, setNotes] = useState<BubbleNote[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback to defaults
    }
    return INITIAL_BUBBLE_NOTES;
  });

  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_APP_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // fallback to defaults
    }
    return DEFAULT_APP_CONFIG;
  });

  const [selectedNote, setSelectedNote] = useState<BubbleNote | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState<boolean>(false);
  const [isVideoStudioOpen, setIsVideoStudioOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<BubbleCategory | null>(null);
  const [generatedClips, setGeneratedClips] = useState<VideoAttachment[]>([]);
  const [mergeToast, setMergeToast] = useState<{ title: string; importance: number } | null>(null);

  const tankCanvasRef = useRef<TankCanvasRef | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // ignore quota errors
    }
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(appConfig));
    } catch {
      // ignore quota errors
    }
  }, [appConfig]);

  const categories = useMemo(() => getEffectiveCategories(appConfig), [appConfig]);

  const activeNotes = notes.filter((n) => !n.completed);
  const completedNotes = notes.filter((n) => n.completed);
  const todayNotes = activeNotes.filter((n) => n.isToday);

  const handleBubbleClick = (clickedNote: BubbleNote) => {
    const fresh = notes.find((n) => n.id === clickedNote.id) || clickedNote;
    setSelectedNote(fresh);
  };

  const handleBubbleMoveToToday = (noteId: string, isToday: boolean) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, isToday } : n))
    );
  };

  const handleBubbleMerge = (mergedNote: BubbleNote, sourceNoteId: string) => {
    setNotes((prev) =>
      prev
        .filter((n) => n.id !== sourceNoteId)
        .map((n) => (n.id === mergedNote.id ? mergedNote : n))
    );

    setSelectedNote((current) => {
      if (current?.id === sourceNoteId || current?.id === mergedNote.id) {
        return mergedNote;
      }
      return current;
    });

    setMergeToast({
      title: mergedNote.title,
      importance: mergedNote.importance,
    });

    setTimeout(() => {
      setMergeToast((curr) => (curr?.title === mergedNote.title ? null : curr));
    }, 3200);
  };

  const handleCreateBubble = (
    newNoteData: Omit<BubbleNote, 'id' | 'createdAt' | 'completed'>
  ) => {
    const newNote: BubbleNote = {
      ...newNoteData,
      id: `bubble-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      completed: false,
    };
    setNotes((prev) => [newNote, ...prev]);
  };

  const handleUpdateNote = (updated: BubbleNote) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setSelectedNote(updated);
  };

  const handleCompleteNote = (noteId: string) => {
    tankCanvasRef.current?.triggerPop(noteId);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? { ...n, completed: true, completedAt: Date.now() } : n
      )
    );
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleSplitNote = (
    sourceNote: BubbleNote,
    first: SplitBubbleDraft,
    second: SplitBubbleDraft
  ) => {
    const secondId = `bubble-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    tankCanvasRef.current?.registerSplitPosition(sourceNote.id, secondId);

    const updatedFirst: BubbleNote = {
      ...sourceNote,
      title: first.title,
      fullNote: first.fullNote,
      importance: first.importance,
      category: first.category,
      color:
        first.category === sourceNote.category
          ? sourceNote.color
          : CATEGORY_DEFAULT_COLOR[first.category],
    };

    const createdSecond: BubbleNote = {
      id: secondId,
      title: second.title,
      fullNote: second.fullNote,
      category: second.category,
      color:
        second.category === sourceNote.category
          ? sourceNote.color
          : CATEGORY_DEFAULT_COLOR[second.category],
      importance: second.importance,
      createdAt: Date.now(),
      deadline: sourceNote.deadline,
      isToday: sourceNote.isToday,
      completed: false,
    };

    setNotes((prev) =>
      prev.flatMap((n) => (n.id === sourceNote.id ? [updatedFirst, createdSecond] : [n]))
    );
  };

  const handleRestoreNote = (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? { ...n, completed: false, completedAt: undefined } : n
      )
    );
  };

  const handleClearCompleted = () => {
    setNotes((prev) => prev.filter((n) => !n.completed));
  };

  const handleClipGenerated = (clip: VideoAttachment) => {
    setGeneratedClips((prev) => [clip, ...prev]);
  };

  const handleAttachClipToNote = (noteId: string, clip: VideoAttachment) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, videoAttachment: clip } : n))
    );
    setSelectedNote((curr) => (curr?.id === noteId ? { ...curr, videoAttachment: clip } : curr));
  };

  const handleCreateBubbleWithClip = (title: string, clip: VideoAttachment) => {
    handleCreateBubble({
      title,
      fullNote: `Animated clip (${clip.aspectRatio}): ${clip.prompt}`,
      category: 'ideas',
      color: 'violet',
      importance: 4,
      isToday: false,
      videoAttachment: clip,
    });
  };

  return (
    <main
      id="bubblenote-app-root"
      className="relative w-screen h-screen overflow-hidden bg-[#030508] text-slate-200 select-none font-sans"
    >
      {/* Full-Bleed 3D Lava-Lamp Tank Viewport */}
      <div className="relative w-full h-full">
        <TankCanvas
          ref={tankCanvasRef}
          notes={activeNotes}
          onBubbleClick={handleBubbleClick}
          onBubbleMoveToToday={handleBubbleMoveToToday}
          onBubbleMerge={handleBubbleMerge}
          activeCategoryFilter={activeCategoryFilter}
          mergeSameCategoryOnly={appConfig.mergeSameCategoryOnly}
          driftSpeed={appConfig.driftSpeed}
        />
      </div>

      {/* Ultra-Minimal Collapsible Bottom Zen HUD */}
      <BottomDock
        notes={activeNotes}
        categories={categories}
        todayCount={todayNotes.length}
        completedCount={completedNotes.length}
        activeCategoryFilter={activeCategoryFilter}
        mergeSameCategoryOnly={appConfig.mergeSameCategoryOnly}
        showWorkflowHints={appConfig.showWorkflowHints}
        onSelectCategoryFilter={setActiveCategoryFilter}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenVideoStudio={() => setIsVideoStudioOpen(true)}
        onOpenCompleted={() => setIsCompletedOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onAgitateTank={() => tankCanvasRef.current?.agitate()}
        onResetCamera={() => tankCanvasRef.current?.resetCamera()}
      />

      {/* Quiet Merge Toast */}
      {mergeToast && (
        <div
          id="bubble-merge-toast"
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[92vw]"
        >
          <div className="obsidian-surface px-4 py-2 rounded-full flex items-center gap-2 text-xs text-white">
            <span className="text-slate-300">Merged into</span>
            <span className="text-cyan-300 font-semibold truncate max-w-[200px] sm:max-w-[340px]">
              {mergeToast.title}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="font-mono-tabular text-cyan-200">Level {mergeToast.importance}</span>
          </div>
        </div>
      )}

      {/* Photo-to-Video Studio Modal */}
      <VideoStudioModal
        isOpen={isVideoStudioOpen}
        onClose={() => setIsVideoStudioOpen(false)}
        activeNotes={activeNotes}
        generatedClips={generatedClips}
        onClipGenerated={handleClipGenerated}
        onAttachClipToNote={handleAttachClipToNote}
        onCreateBubbleWithClip={handleCreateBubbleWithClip}
      />

      {/* Expanded Note Modal (with Split Bubble support) */}
      <NoteModal
        note={selectedNote}
        isOpen={Boolean(selectedNote)}
        categories={categories}
        onClose={() => setSelectedNote(null)}
        onUpdateNote={handleUpdateNote}
        onCompleteNote={handleCompleteNote}
        onDeleteNote={handleDeleteNote}
        onSplitNote={handleSplitNote}
        generatedClips={generatedClips}
        onClipGenerated={handleClipGenerated}
      />

      {/* Create Bubble Modal */}
      <CreateBubbleModal
        isOpen={isCreateOpen}
        categories={categories}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateBubble}
        generatedClips={generatedClips}
        onClipGenerated={handleClipGenerated}
      />

      {/* Completed History Modal */}
      <CompletedListModal
        isOpen={isCompletedOpen}
        categories={categories}
        onClose={() => setIsCompletedOpen(false)}
        completedNotes={completedNotes}
        onRestoreNote={handleRestoreNote}
        onClearCompleted={handleClearCompleted}
      />

      {/* Tank Setup & Category Customization Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={appConfig}
        categories={categories}
        onUpdateConfig={setAppConfig}
        onResetSampleNotes={() => setNotes(INITIAL_BUBBLE_NOTES)}
      />
    </main>
  );
}
