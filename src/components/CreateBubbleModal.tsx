import React, { useState, useRef } from 'react';
import {
  BubbleCategory,
  BubbleColorId,
  BubbleImportance,
  BubbleNote,
  CategoryMap,
  VideoAspectRatio,
  VideoAttachment,
} from '../types';
import {
  IMPORTANCE_LEVELS,
  JELLYFISH_COLORS,
  JELLYFISH_COLOR_LIST,
  CATEGORY_DEFAULT_COLOR,
  getRelativeDeadlineDate,
  getDeadlineInfo,
  calculateDynamicBubbleRadius,
} from '../constants';
import { generatePhotoVideo, readFileAsDataUrl } from '../api/videoClient';
import { soundFx } from '../audio/soundEffects';
import {
  X,
  Plus,
  Calendar,
  Target,
  AlertCircle,
  Film,
  Upload,
  Loader2,
  Trash2,
} from 'lucide-react';

interface CreateBubbleModalProps {
  isOpen: boolean;
  categories: CategoryMap;
  onClose: () => void;
  onCreate: (newNote: Omit<BubbleNote, 'id' | 'createdAt' | 'completed'>) => void;
  generatedClips: VideoAttachment[];
  onClipGenerated: (clip: VideoAttachment) => void;
}

export const CreateBubbleModal: React.FC<CreateBubbleModalProps> = ({
  isOpen,
  categories,
  onClose,
  onCreate,
  generatedClips,
  onClipGenerated,
}) => {
  const [title, setTitle] = useState<string>('');
  const [fullNote, setFullNote] = useState<string>('');
  const [category, setCategory] = useState<BubbleCategory>('ideas');
  const [color, setColor] = useState<BubbleColorId>('violet');
  const [hasCustomColor, setHasCustomColor] = useState<boolean>(false);
  const [importance, setImportance] = useState<BubbleImportance>(3);
  const [hasDeadline, setHasDeadline] = useState<boolean>(false);
  const [deadline, setDeadline] = useState<string>(getRelativeDeadlineDate(2));
  const [isToday, setIsToday] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Optional inline Photo-to-Video attachment
  const [videoAttachment, setVideoAttachment] = useState<VideoAttachment | undefined>(undefined);
  const [showVideoCreator, setShowVideoCreator] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string>('image/png');
  const [videoPrompt, setVideoPrompt] = useState<string>(
    'Slow dreamy motion with soft iridescent light drift.'
  );
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const [videoStatus, setVideoStatus] = useState<string>('');
  const [videoError, setVideoError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const currentColor = JELLYFISH_COLORS[color] || JELLYFISH_COLORS.cyan;
  const currentImportance = IMPORTANCE_LEVELS[importance] || IMPORTANCE_LEVELS[3];
  const deadlineInfo = getDeadlineInfo(hasDeadline ? deadline : undefined);

  const handleSelectCategory = (catKey: BubbleCategory) => {
    setCategory(catKey);
    if (!hasCustomColor) {
      setColor(CATEGORY_DEFAULT_COLOR[catKey]);
    }
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
      setVideoError(err instanceof Error ? err.message : 'Unable to read photo.');
    }
  };

  const handleGenerateInlineVideo = async () => {
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
      setVideoAttachment(clip);
      onClipGenerated(clip);
      setShowVideoCreator(false);
      soundFx.playPop(1.2);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Video generation failed.');
    } finally {
      setIsGeneratingVideo(false);
      setVideoStatus('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a short one-sentence summary for the bubble.');
      return;
    }

    soundFx.playBirth();

    onCreate({
      title: title.trim(),
      fullNote: fullNote.trim() || undefined,
      category,
      color,
      importance,
      deadline: hasDeadline ? deadline : undefined,
      isToday,
      videoAttachment,
    });

    setTitle('');
    setFullNote('');
    setCategory('ideas');
    setColor('violet');
    setHasCustomColor(false);
    setImportance(3);
    setHasDeadline(false);
    setIsToday(false);
    setVideoAttachment(undefined);
    setShowVideoCreator(false);
    setPhotoPreview(null);
    setError(null);
    setVideoError(null);
    onClose();
  };

  const setDeadlinePreset = (days: number) => {
    setHasDeadline(true);
    setDeadline(getRelativeDeadlineDate(days));
  };

  return (
    <div
      id="create-bubble-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75"
      onClick={onClose}
    >
      <div
        id="create-bubble-card"
        className="relative w-full max-w-lg rounded-3xl obsidian-modal overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: `0 0 60px ${currentColor.glowColor}, 0 25px 60px rgba(0, 0, 0, 0.92)`,
          borderColor: `${currentColor.color}40`,
        }}
      >
        <div
          className="h-[2px] w-full transition-colors duration-300"
          style={{ backgroundColor: currentColor.color }}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/10">
          <div>
            <h3 className="font-display text-base font-semibold text-white tracking-tight">
              New Lava-Lamp Bubble
            </h3>
            <p className="text-xs text-slate-400">
              Launch a floating note orb into the 3D tank
            </p>
          </div>

          <button
            id="btn-close-create-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* One-Sentence Summary */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Summary Sentence <span className="text-cyan-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono-tabular">
                {title.length}/90
              </span>
            </div>
            <input
              id="input-create-title"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              maxLength={90}
              placeholder="e.g. Pay electricity account, Send investor pack..."
              className="w-full px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-white font-medium focus:outline-none focus:border-cyan-400 text-sm placeholder:text-slate-500"
            />
          </div>

          {/* Category Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(categories) as BubbleCategory[]).map((catKey) => {
                const cat = categories[catKey];
                const isSelected = category === catKey;
                return (
                  <button
                    key={catKey}
                    id={`btn-create-category-${catKey}`}
                    type="button"
                    onClick={() => handleSelectCategory(catKey)}
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

          {/* Iridescent Liquid Metal & Aurora Finish */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Iridescent Aurora Finish
              </label>
              <span className="text-xs font-medium" style={{ color: currentColor.accentColor }}>
                {currentColor.name}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {JELLYFISH_COLOR_LIST.map((jf) => {
                const isSelected = color === jf.id;
                return (
                  <button
                    key={jf.id}
                    id={`btn-create-color-${jf.id}`}
                    type="button"
                    onClick={() => {
                      setColor(jf.id);
                      setHasCustomColor(true);
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
                      className="w-6 h-6 rounded-full transition-transform group-hover:scale-110 relative flex items-center justify-center"
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

          {/* Importance Level */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-300">Importance & Size</label>
              <span className="text-cyan-300 font-mono-tabular">
                {currentImportance.name} · ~{calculateDynamicBubbleRadius(importance, title, fullNote)}px
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {([1, 2, 3, 4, 5] as BubbleImportance[]).map((lvl) => {
                const meta = IMPORTANCE_LEVELS[lvl];
                const isSelected = importance === lvl;
                return (
                  <button
                    key={lvl}
                    id={`btn-create-importance-${lvl}`}
                    type="button"
                    onClick={() => setImportance(lvl)}
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

          {/* Deadline System */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-medium text-white">
                  Does this have a deadline?
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHasDeadline(!hasDeadline)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  hasDeadline ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    hasDeadline ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {hasDeadline && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <input
                    id="input-create-deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-mono-tabular focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-xs text-cyan-300 font-medium">
                    {deadlineInfo.badgeText}
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

          {/* Today Goal Zone Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-xs font-medium text-white">Dock in Today Goal Zone</div>
                <div className="text-[11px] text-slate-400">Keep anchored near the lower thermal ring</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsToday(!isToday)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                isToday ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  isToday ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Optional Photo-to-Video Attachment */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-medium text-white">Animated Video Memory</span>
              </div>
              <button
                type="button"
                onClick={() => setShowVideoCreator((v) => !v)}
                className="text-xs text-cyan-300 hover:text-cyan-200 font-medium cursor-pointer"
              >
                {showVideoCreator ? 'Hide' : videoAttachment ? 'Replace Video' : 'Add Photo-to-Video'}
              </button>
            </div>

            {videoAttachment && (
              <div className="space-y-2">
                <video
                  src={videoAttachment.url}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className={`rounded-xl max-h-44 w-auto mx-auto bg-black ${
                    videoAttachment.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                  }`}
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{videoAttachment.aspectRatio} Clip attached</span>
                  <button
                    type="button"
                    onClick={() => setVideoAttachment(undefined)}
                    className="text-rose-400 hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            )}

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
                      alt="Selected photo"
                      className="max-h-24 rounded-xl object-contain"
                    />
                    <input
                      type="text"
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      placeholder="Motion description..."
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={isGeneratingVideo}
                      onClick={handleGenerateInlineVideo}
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
                          <span>Generate {aspectRatio} Video</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {generatedClips.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400">Or pick a session clip:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {generatedClips.map((clip, i) => (
                        <button
                          key={`${clip.url}-${i}`}
                          type="button"
                          onClick={() => {
                            setVideoAttachment(clip);
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

          {/* Optional Full Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Optional Full Note
            </label>
            <textarea
              id="textarea-create-fullnote"
              value={fullNote}
              onChange={(e) => setFullNote(e.target.value)}
              rows={3}
              placeholder="Checklists, additional thoughts, context, links..."
              className="w-full px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/10 text-slate-200 focus:outline-none focus:border-cyan-400 text-xs placeholder:text-slate-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/10 flex items-center justify-between">
          <button
            id="btn-cancel-create"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="btn-submit-create-bubble"
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Release into Tank</span>
          </button>
        </div>
      </div>
    </div>
  );
};
