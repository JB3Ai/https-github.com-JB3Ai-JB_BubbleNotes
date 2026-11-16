import React, { useState, useEffect, useRef } from 'react';
import {
  BubbleNote,
  BubbleCategory,
  BubbleColorId,
  BubbleImportance,
  CategoryMap,
  VideoAspectRatio,
  VideoAttachment,
} from '../types';
import {
  IMPORTANCE_LEVELS,
  JELLYFISH_COLORS,
  JELLYFISH_COLOR_LIST,
  CATEGORY_DEFAULT_COLOR,
  getBubbleTheme,
  getFloatingAgeText,
  getDeadlineInfo,
  getRelativeDeadlineDate,
  calculateDynamicBubbleRadius,
  suggestBubbleSplit,
} from '../constants';
import { generatePhotoVideo, readFileAsDataUrl } from '../api/videoClient';
import {
  X,
  CheckCircle2,
  Trash2,
  Calendar,
  Clock,
  Target,
  Save,
  Film,
  Upload,
  Loader2,
  Split,
} from 'lucide-react';
import { soundFx } from '../audio/soundEffects';

export interface SplitBubbleDraft {
  title: string;
  fullNote?: string;
  importance: BubbleImportance;
  category: BubbleCategory;
}

interface NoteModalProps {
  note: BubbleNote | null;
  isOpen: boolean;
  categories: CategoryMap;
  onClose: () => void;
  onUpdateNote: (updated: BubbleNote) => void;
  onCompleteNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onSplitNote: (sourceNote: BubbleNote, first: SplitBubbleDraft, second: SplitBubbleDraft) => void;
  generatedClips: VideoAttachment[];
  onClipGenerated: (clip: VideoAttachment) => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  note,
  isOpen,
  categories,
  onClose,
  onUpdateNote,
  onCompleteNote,
  onDeleteNote,
  onSplitNote,
  generatedClips,
  onClipGenerated,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>(note?.title || '');
  const [editFullNote, setEditFullNote] = useState<string>(note?.fullNote || '');
  const [editCategory, setEditCategory] = useState<BubbleCategory>(note?.category || 'general');
  const [editColor, setEditColor] = useState<BubbleColorId>(
    note?.color || CATEGORY_DEFAULT_COLOR[note?.category || 'general']
  );
  const [editImportance, setEditImportance] = useState<BubbleImportance>(note?.importance || 3);
  const [hasDeadline, setHasDeadline] = useState<boolean>(Boolean(note?.deadline));
  const [editDeadline, setEditDeadline] = useState<string>(
    note?.deadline || getRelativeDeadlineDate(2)
  );
  const [editIsToday, setEditIsToday] = useState<boolean>(Boolean(note?.isToday));
  const [editVideo, setEditVideo] = useState<VideoAttachment | undefined>(note?.videoAttachment);

  // Inline video generator inside NoteModal
  const [showVideoCreator, setShowVideoCreator] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string>('image/png');
  const [videoPrompt, setVideoPrompt] = useState<string>(
    'Subtle slow-motion movement with iridescent ambient reflections.'
  );
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const [videoStatus, setVideoStatus] = useState<string>('');
  const [videoError, setVideoError] = useState<string | null>(null);

  // Split Bubble state
  const [splitFirstTitle, setSplitFirstTitle] = useState<string>('');
  const [splitFirstNote, setSplitFirstNote] = useState<string>('');
  const [splitFirstCategory, setSplitFirstCategory] = useState<BubbleCategory>(note?.category || 'general');
  const [splitFirstImportance, setSplitFirstImportance] = useState<BubbleImportance>(2);
  const [splitSecondTitle, setSplitSecondTitle] = useState<string>('');
  const [splitSecondNote, setSplitSecondNote] = useState<string>('');
  const [splitSecondCategory, setSplitSecondCategory] = useState<BubbleCategory>(note?.category || 'general');
  const [splitSecondImportance, setSplitSecondImportance] = useState<BubbleImportance>(2);
  const [splitError, setSplitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (note) {
      setIsEditing(false);
      setIsSplitting(false);
      setSplitError(null);
      setEditTitle(note.title);
      setEditFullNote(note.fullNote || '');
      setEditCategory(note.category);
      setEditColor(note.color || CATEGORY_DEFAULT_COLOR[note.category]);
      setEditImportance(note.importance);
      setHasDeadline(Boolean(note.deadline));
      setEditDeadline(note.deadline || getRelativeDeadlineDate(2));
      setEditIsToday(note.isToday);
      setEditVideo(note.videoAttachment);
      setShowVideoCreator(false);
      setPhotoPreview(null);
      setVideoError(null);
    }
  }, [note?.id, isOpen, note?.videoAttachment]);

  if (!note || !isOpen) return null;

  const category = categories[isEditing ? editCategory : note.category] || categories.general;
  const bubbleTheme = getBubbleTheme({
    category: isEditing ? editCategory : note.category,
    color: isEditing ? editColor : note.color,
  });
  const importanceMeta =
    IMPORTANCE_LEVELS[isEditing ? editImportance : note.importance] || IMPORTANCE_LEVELS[3];
  const ageText = getFloatingAgeText(note.createdAt);
  const deadlineInfo = getDeadlineInfo(isEditing && hasDeadline ? editDeadline : note.deadline);
  const activeVideo = isEditing ? editVideo : note.videoAttachment;

  const handleSave = () => {
    if (!editTitle.trim()) return;
    const updated: BubbleNote = {
      ...note,
      title: editTitle.trim(),
      fullNote: editFullNote.trim() || undefined,
      category: editCategory,
      color: editColor,
      importance: editImportance,
      deadline: hasDeadline ? editDeadline : undefined,
      isToday: editIsToday,
      videoAttachment: editVideo,
    };
    onUpdateNote(updated);
    setIsEditing(false);
    soundFx.playPop(1.1);
  };

  const handleComplete = () => {
    onCompleteNote(note.id);
    onClose();
  };

  const handleDelete = () => {
    soundFx.playPop(0.7);
    onDeleteNote(note.id);
    onClose();
  };

  const handleOpenSplit = () => {
    const suggestion = suggestBubbleSplit(note);
    setSplitFirstTitle(suggestion.firstTitle);
    setSplitFirstNote(suggestion.firstFullNote);
    setSplitFirstCategory(note.category);
    setSplitFirstImportance(suggestion.firstImportance);
    setSplitSecondTitle(suggestion.secondTitle);
    setSplitSecondNote(suggestion.secondFullNote);
    setSplitSecondCategory(note.category);
    setSplitSecondImportance(suggestion.secondImportance);
    setSplitError(null);
    setIsEditing(false);
    setIsSplitting(true);
    soundFx.playSquish();
  };

  const handleConfirmSplit = () => {
    if (!splitFirstTitle.trim() || !splitSecondTitle.trim()) {
      setSplitError('Both split bubbles need a short summary sentence.');
      return;
    }
    soundFx.playPop(1.25);
    onSplitNote(
      note,
      {
        title: splitFirstTitle.trim(),
        fullNote: splitFirstNote.trim() || undefined,
        importance: splitFirstImportance,
        category: splitFirstCategory,
      },
      {
        title: splitSecondTitle.trim(),
        fullNote: splitSecondNote.trim() || undefined,
        importance: splitSecondImportance,
        category: splitSecondCategory,
      }
    );
    setIsSplitting(false);
    onClose();
  };

  const setDeadlinePreset = (days: number) => {
    setHasDeadline(true);
    setEditDeadline(getRelativeDeadlineDate(days));
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setVideoError('Please select a PNG, JPEG, or WebP photo.');
      return;
    }
    try {
      setVideoError(null);
      const { dataUrl, mimeType } = await readFileAsDataUrl(file);
      setPhotoPreview(dataUrl);
      setPhotoMime(mimeType);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Unable to load photo.');
    }
  };

  const handleGenerateVideo = async () => {
    if (!photoPreview) return;
    setVideoError(null);
    setIsGeneratingVideo(true);
    setVideoStatus('Submitting photo...');
    try {
      const clip = await generatePhotoVideo({
        imageBase64: photoPreview,
        mimeType: photoMime,
        prompt: videoPrompt,
        aspectRatio,
        onStatusUpdate: setVideoStatus,
      });
      onClipGenerated(clip);
      setEditVideo(clip);
      if (!isEditing) {
        onUpdateNote({ ...note, videoAttachment: clip });
      }
      setShowVideoCreator(false);
      soundFx.playBirth();
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Video generation failed.');
    } finally {
      setIsGeneratingVideo(false);
      setVideoStatus('');
    }
  };

  return (
    <div
      id="note-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75"
      onClick={onClose}
    >
      <div
        id="note-modal-card"
        className="relative w-full max-w-lg rounded-3xl obsidian-modal overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: `0 0 60px ${bubbleTheme.glowColor}, 0 25px 60px rgba(0, 0, 0, 0.92)`,
          borderColor: `${bubbleTheme.color}40`,
        }}
      >
        <div
          className="h-[2px] w-full transition-colors duration-300"
          style={{ backgroundColor: bubbleTheme.color }}
        />

        {/* Modal Header with clean unboxed metadata */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                backgroundColor: bubbleTheme.color,
                boxShadow: `0 0 10px ${bubbleTheme.color}`,
              }}
            />
            <span className="font-semibold truncate" style={{ color: bubbleTheme.accentColor }}>
              {category.name}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-slate-300 whitespace-nowrap">{importanceMeta.name}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="font-mono-tabular text-slate-400 whitespace-nowrap">
              Ø {calculateDynamicBubbleRadius(
                isEditing ? editImportance : note.importance,
                isEditing ? editTitle : note.title,
                isEditing ? editFullNote : note.fullNote
              )}px
            </span>
          </div>

          <button
            id="btn-modal-close"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Close modal and return to tank"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Attached Video Player */}
          {activeVideo && (
            <div className="rounded-2xl bg-black/60 border border-white/10 p-2.5 space-y-2">
              <video
                key={activeVideo.url}
                src={activeVideo.url}
                controls
                autoPlay
                loop
                muted
                playsInline
                className={`rounded-xl max-h-56 w-auto mx-auto ${
                  activeVideo.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                }`}
              />
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Film className="w-3 h-3 text-cyan-400" />
                  <span>Attached Clip · {activeVideo.aspectRatio}</span>
                </span>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => setEditVideo(undefined)}
                    className="text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    Remove video
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Split Bubble Mode */}
          {isSplitting ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-cyan-200 bg-cyan-500/10 border border-cyan-500/25 rounded-2xl p-3">
                <Split className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Divide this orb into two separate floating bubbles. Adjust titles, categories, or sizes below.
                </span>
              </div>

              {splitError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
                  {splitError}
                </div>
              )}

              {/* First Split Orb */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                  <span>Bubble 1</span>
                  <span className="font-mono-tabular text-[11px] text-slate-400">
                    {IMPORTANCE_LEVELS[splitFirstImportance].name}
                  </span>
                </div>
                <input
                  id="input-split-first-title"
                  type="text"
                  value={splitFirstTitle}
                  onChange={(e) => setSplitFirstTitle(e.target.value)}
                  maxLength={90}
                  placeholder="First bubble summary..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
                <textarea
                  value={splitFirstNote}
                  onChange={(e) => setSplitFirstNote(e.target.value)}
                  rows={2}
                  placeholder="Optional details for Bubble 1..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <select
                    value={splitFirstCategory}
                    onChange={(e) => setSplitFirstCategory(e.target.value as BubbleCategory)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                  >
                    {(Object.keys(categories) as BubbleCategory[]).map((catKey) => (
                      <option key={catKey} value={catKey}>
                        {categories[catKey].name}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1 ml-auto">
                    {([1, 2, 3, 4, 5] as BubbleImportance[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSplitFirstImportance(lvl)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono-tabular border cursor-pointer ${
                          splitFirstImportance === lvl
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : 'bg-white/[0.03] border-white/10 text-slate-400'
                        }`}
                      >
                        L{lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Second Split Orb */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-violet-300">
                  <span>Bubble 2</span>
                  <span className="font-mono-tabular text-[11px] text-slate-400">
                    {IMPORTANCE_LEVELS[splitSecondImportance].name}
                  </span>
                </div>
                <input
                  id="input-split-second-title"
                  type="text"
                  value={splitSecondTitle}
                  onChange={(e) => setSplitSecondTitle(e.target.value)}
                  maxLength={90}
                  placeholder="Second bubble summary..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
                <textarea
                  value={splitSecondNote}
                  onChange={(e) => setSplitSecondNote(e.target.value)}
                  rows={2}
                  placeholder="Optional details for Bubble 2..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <select
                    value={splitSecondCategory}
                    onChange={(e) => setSplitSecondCategory(e.target.value as BubbleCategory)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                  >
                    {(Object.keys(categories) as BubbleCategory[]).map((catKey) => (
                      <option key={catKey} value={catKey}>
                        {categories[catKey].name}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1 ml-auto">
                    {([1, 2, 3, 4, 5] as BubbleImportance[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSplitSecondImportance(lvl)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono-tabular border cursor-pointer ${
                          splitSecondImportance === lvl
                            ? 'bg-violet-500/20 border-violet-400 text-white'
                            : 'bg-white/[0.03] border-white/10 text-slate-400'
                        }`}
                      >
                        L{lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Title / Summary */}
              {isEditing ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Summary Sentence</label>
              <input
                id="input-edit-title"
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-white font-medium focus:outline-none focus:border-cyan-400 text-base"
                placeholder="Note summary..."
                maxLength={100}
              />
            </div>
          ) : (
            <h2
              id="modal-note-title"
              className="font-display text-2xl font-semibold tracking-tight text-white leading-snug text-balance"
            >
              {note.title}
            </h2>
          )}

          {/* Extended Note Body */}
          {isEditing ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Full Description & Details
              </label>
              <textarea
                id="textarea-edit-fullnote"
                value={editFullNote}
                onChange={(e) => setEditFullNote(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-slate-200 focus:outline-none focus:border-cyan-400 text-sm leading-relaxed"
                placeholder="Add more details, context, checklist items, links..."
              />
            </div>
          ) : (
            <div>
              {note.fullNote ? (
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {note.fullNote}
                </p>
              ) : (
                <p className="text-slate-500 text-xs italic">
                  No extended details yet. Select Edit Note to add more context.
                </p>
              )}
            </div>
          )}

          {/* Age & Deadline Metadata */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-white/[0.03] rounded-2xl border border-white/10">
              <span className="block text-[11px] text-slate-400 mb-1">Age</span>
              <span className="text-sm font-medium text-slate-200 flex items-center gap-1.5 font-mono-tabular">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>{ageText}</span>
              </span>
            </div>

            <div className="p-3 bg-white/[0.03] rounded-2xl border border-white/10">
              <span className="block text-[11px] text-slate-400 mb-1">Deadline</span>
              <span
                className={`text-sm font-medium flex items-center gap-1.5 font-mono-tabular ${
                  deadlineInfo.status === 'overdue'
                    ? 'text-rose-400'
                    : deadlineInfo.status === 'today'
                    ? 'text-amber-400'
                    : 'text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>{deadlineInfo.badgeText || 'No deadline'}</span>
              </span>
            </div>
          </div>

          {/* Today Status */}
          {(isEditing ? editIsToday : note.isToday) && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs font-medium">
              <Target className="w-4 h-4 text-cyan-400" />
              <span>Anchored in Today Goal Zone</span>
            </div>
          )}

          {/* Quick Animate Photo-to-Video attachment option */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <Film className="w-4 h-4 text-violet-400" />
                <span>Photo-to-Video Attachment</span>
              </div>
              <button
                type="button"
                onClick={() => setShowVideoCreator((v) => !v)}
                className="text-xs text-cyan-300 hover:text-cyan-200 font-medium cursor-pointer"
              >
                {showVideoCreator ? 'Hide' : activeVideo ? 'Change Video' : 'Animate a Photo'}
              </button>
            </div>

            {showVideoCreator && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                {videoError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-[11px]">
                    {videoError}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{photoPreview ? 'Change Photo' : 'Upload Photo'}</span>
                  </button>

                  {(['16:9', '9:16'] as VideoAspectRatio[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAspectRatio(r)}
                      className={`px-2.5 py-2 rounded-xl border text-xs font-mono-tabular cursor-pointer ${
                        aspectRatio === r
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-white/[0.03] border-white/10 text-slate-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {photoPreview && (
                  <div className="space-y-2">
                    <img
                      src={photoPreview}
                      alt="Source photo preview"
                      className="max-h-24 rounded-xl object-contain"
                    />
                    <input
                      type="text"
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      placeholder="Describe animation motion..."
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={isGeneratingVideo}
                      onClick={handleGenerateVideo}
                      className="w-full py-2 px-3 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isGeneratingVideo ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{videoStatus || 'Generating...'}</span>
                        </>
                      ) : (
                        <>
                          <Film className="w-3.5 h-3.5" />
                          <span>Generate & Attach {aspectRatio} Video</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {generatedClips.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400">Attach a session clip:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {generatedClips.map((clip, i) => (
                        <button
                          key={`${clip.url}-${i}`}
                          type="button"
                          onClick={() => {
                            setEditVideo(clip);
                            if (!isEditing) {
                              onUpdateNote({ ...note, videoAttachment: clip });
                            }
                            setShowVideoCreator(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/10 border border-white/10 text-[11px] text-cyan-200 cursor-pointer"
                        >
                          Clip {i + 1} ({clip.aspectRatio})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Editing Controls */}
          {isEditing && (
            <div className="space-y-4 pt-3 border-t border-white/10">
              {/* Category Picker */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(categories) as BubbleCategory[]).map((catKey) => {
                    const cat = categories[catKey];
                    const isSelected = editCategory === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setEditCategory(catKey)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-white/12 border-cyan-400 text-white'
                            : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Iridescent Aurora Finish Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Iridescent Aurora Finish
                  </label>
                  <span
                    className="text-xs font-medium"
                    style={{ color: (JELLYFISH_COLORS[editColor] || bubbleTheme).accentColor }}
                  >
                    {(JELLYFISH_COLORS[editColor] || JELLYFISH_COLORS.cyan).name}
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {JELLYFISH_COLOR_LIST.map((jf) => {
                    const isSelected = editColor === jf.id;
                    return (
                      <button
                        key={jf.id}
                        type="button"
                        onClick={() => {
                          setEditColor(jf.id);
                          soundFx.playSquish();
                        }}
                        title={jf.name}
                        className={`group relative flex items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white/12 border-white/40 scale-105'
                            : 'bg-white/[0.03] border-white/10 hover:border-white/25'
                        }`}
                        style={{
                          boxShadow: isSelected ? `0 0 16px ${jf.glowColor}` : undefined,
                        }}
                      >
                        <span
                          className="w-5 h-5 rounded-full transition-transform group-hover:scale-110 relative flex items-center justify-center"
                          style={{
                            background: `radial-gradient(circle at 30% 30%, ${jf.metalTint} 0%, ${jf.color} 55%, ${jf.auroraSecondary} 100%)`,
                            border: `1.5px solid ${jf.accentColor}`,
                            boxShadow: `0 0 10px ${jf.glowColor}`,
                          }}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Importance Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-slate-300">Bubble Size & Importance</label>
                  <span className="text-cyan-300 font-mono-tabular">
                    {IMPORTANCE_LEVELS[editImportance].name} · Ø ~
                    {calculateDynamicBubbleRadius(editImportance, editTitle, editFullNote)}px
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {([1, 2, 3, 4, 5] as BubbleImportance[]).map((lvl) => {
                    const meta = IMPORTANCE_LEVELS[lvl];
                    const isSelected = editImportance === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setEditImportance(lvl)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span
                          className="rounded-full bg-cyan-400 mb-1"
                          style={{ width: 6 + lvl * 3, height: 6 + lvl * 3 }}
                        />
                        <span>{meta.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Deadline Config */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Deadline</label>
                  <button
                    type="button"
                    onClick={() => setHasDeadline(!hasDeadline)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                  >
                    {hasDeadline ? 'Remove Deadline' : 'Set Deadline'}
                  </button>
                </div>

                {hasDeadline && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        id="input-edit-deadline"
                        type="date"
                        value={editDeadline}
                        onChange={(e) => setEditDeadline(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-mono-tabular focus:outline-none focus:border-cyan-400"
                      />
                      <span className="text-xs text-slate-400">
                        {deadlineInfo.badgeText || 'Select date'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Today', days: 0 },
                        { label: 'Tomorrow', days: 1 },
                        { label: 'In 3 Days', days: 3 },
                        { label: 'Next Week', days: 7 },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setDeadlinePreset(p.days)}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/10 text-[11px] text-slate-300 cursor-pointer"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Today Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs font-medium text-white">Focus for Today</div>
                    <div className="text-[11px] text-slate-400">
                      Anchor inside the Today thermal zone
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsToday(!editIsToday)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    editIsToday ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      editIsToday ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          {isSplitting ? (
            <>
              <button
                id="btn-modal-cancel-split"
                type="button"
                onClick={() => setIsSplitting(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-modal-confirm-split"
                type="button"
                onClick={handleConfirmSplit}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Split className="w-3.5 h-3.5" />
                <span>Split into 2 Orbs</span>
              </button>
            </>
          ) : isEditing ? (
            <>
              <button
                id="btn-modal-cancel-edit"
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-modal-save-changes"
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-white text-slate-950 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  id="btn-modal-delete"
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  id="btn-modal-split-bubble"
                  type="button"
                  onClick={handleOpenSplit}
                  title="Split this bubble into two separate orbs"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/12 text-cyan-200 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  <Split className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Split</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  id="btn-modal-toggle-edit"
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 rounded-xl bg-white text-slate-900 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Edit Note
                </button>

                <button
                  id="btn-modal-complete-pop"
                  type="button"
                  onClick={handleComplete}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Complete</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
