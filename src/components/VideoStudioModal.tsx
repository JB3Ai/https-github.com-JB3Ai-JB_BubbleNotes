import React, { useState, useRef } from 'react';
import { BubbleNote, VideoAspectRatio, VideoAttachment } from '../types';
import { generatePhotoVideo, readFileAsDataUrl } from '../api/videoClient';
import {
  X,
  Upload,
  Film,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Plus,
  Link2,
} from 'lucide-react';
import { soundFx } from '../audio/soundEffects';

interface VideoStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeNotes: BubbleNote[];
  generatedClips: VideoAttachment[];
  onClipGenerated: (clip: VideoAttachment) => void;
  onAttachClipToNote: (noteId: string, clip: VideoAttachment) => void;
  onCreateBubbleWithClip: (title: string, clip: VideoAttachment) => void;
}

const MOTION_PRESETS = [
  'Slow dreamy motion with soft iridescent light drift and subtle camera float.',
  'Gentle breeze rippling across textures with luminous atmospheric depth.',
  'Calm underwater-like slow motion with pearlescent specular reflections.',
];

export const VideoStudioModal: React.FC<VideoStudioModalProps> = ({
  isOpen,
  onClose,
  activeNotes,
  generatedClips,
  onClipGenerated,
  onAttachClipToNote,
  onCreateBubbleWithClip,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [prompt, setPrompt] = useState<string>(MOTION_PRESETS[0]);
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeClip, setActiveClip] = useState<VideoAttachment | null>(null);
  const [targetNoteId, setTargetNoteId] = useState<string>(activeNotes[0]?.id || '');
  const [newBubbleTitle, setNewBubbleTitle] = useState<string>('');
  const [attachedNotice, setAttachedNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a PNG, JPEG, or WebP photo.');
      return;
    }
    try {
      setError(null);
      const { dataUrl, mimeType } = await readFileAsDataUrl(file);
      setImagePreview(dataUrl);
      setImageMime(mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load photo.');
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) {
      setError('Upload a photo first to animate it into video.');
      return;
    }

    setError(null);
    setAttachedNotice(null);
    setIsGenerating(true);
    setStatusText('Submitting photo...');

    try {
      const clip = await generatePhotoVideo({
        imageBase64: imagePreview,
        mimeType: imageMime,
        prompt,
        aspectRatio,
        onStatusUpdate: setStatusText,
      });
      setActiveClip(clip);
      onClipGenerated(clip);
      soundFx.playBirth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate video.');
    } finally {
      setIsGenerating(false);
      setStatusText('');
    }
  };

  const handleAttachExisting = () => {
    if (!activeClip || !targetNoteId) return;
    onAttachClipToNote(targetNoteId, activeClip);
    soundFx.playTodayDock();
    const targetTitle = activeNotes.find((n) => n.id === targetNoteId)?.title || 'bubble';
    setAttachedNotice(`Attached video to "${targetTitle}"`);
  };

  const handleCreateNewBubble = () => {
    if (!activeClip) return;
    const title = newBubbleTitle.trim() || 'Animated memory orb';
    onCreateBubbleWithClip(title, activeClip);
    soundFx.playBirth();
    setNewBubbleTitle('');
    onClose();
  };

  return (
    <div
      id="video-studio-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75"
      onClick={onClose}
    >
      <div
        id="video-studio-card"
        className="relative w-full max-w-2xl rounded-3xl obsidian-modal overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-white tracking-tight">
                Photo-to-Video Studio
              </h2>
              <p className="text-xs text-slate-400">
                Animate a photo into a floating 16:9 or 9:16 orb clip
              </p>
            </div>
          </div>

          <button
            id="btn-close-video-studio"
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {attachedNotice && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{attachedNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: Upload & Controls */}
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Source Photo
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.03] hover:bg-white/[0.06] hover:border-cyan-400/50 transition-colors p-4 flex flex-col items-center justify-center gap-2 cursor-pointer min-h-[148px] overflow-hidden"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Uploaded source frame"
                      className="max-h-36 w-auto rounded-xl object-contain"
                    />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-cyan-400" />
                      <span className="text-xs font-medium text-slate-200">
                        Choose a photo to animate
                      </span>
                      <span className="text-[11px] text-slate-500">
                        PNG, JPG, or WebP
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Aspect Ratio Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['16:9', '9:16'] as VideoAspectRatio[]).map((ratio) => {
                    const selected = aspectRatio === ratio;
                    return (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          selected
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {ratio === '16:9' ? '16:9 Landscape' : '9:16 Portrait'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Motion Prompt */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Motion Direction
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="Describe how the photo should move..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {MOTION_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(preset)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] text-slate-300 cursor-pointer"
                    >
                      Preset {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <button
                id="btn-generate-video"
                type="submit"
                disabled={isGenerating || !imagePreview}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{statusText || 'Generating...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Animate Photo</span>
                  </>
                )}
              </button>
            </form>

            {/* Right: Preview & Attach to Bubble */}
            <div className="flex flex-col justify-between space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-300 mb-2">
                  Video Preview
                </span>
                <div className="w-full rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center min-h-[210px] p-3 overflow-hidden">
                  {activeClip ? (
                    <video
                      key={activeClip.url}
                      src={activeClip.url}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      className={`rounded-xl max-h-[240px] w-auto ${
                        activeClip.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                      }`}
                    />
                  ) : (
                    <div className="text-center px-4 py-8 space-y-2">
                      <Film className="w-7 h-7 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">
                        Your generated 16:9 or 9:16 clip will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Attach Actions when a clip is selected */}
              {activeClip && (
                <div className="space-y-3 pt-2 border-t border-white/10">
                  {activeNotes.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-400">
                        Attach to an existing orb
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={targetNoteId}
                          onChange={(e) => setTargetNoteId(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                        >
                          {activeNotes.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAttachExisting}
                          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Attach</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-400">
                      Or launch as a new bubble
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newBubbleTitle}
                        onChange={(e) => setNewBubbleTitle(e.target.value)}
                        placeholder="Short orb summary..."
                        maxLength={80}
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={handleCreateNewBubble}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Launch Orb</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Session Clip Library */}
          {generatedClips.length > 0 && (
            <div className="pt-4 border-t border-white/10 space-y-2">
              <span className="block text-xs font-medium text-slate-400">
                Session Clips ({generatedClips.length})
              </span>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {generatedClips.map((clip, i) => {
                  const selected = activeClip?.url === clip.url;
                  return (
                    <button
                      key={`${clip.url}-${i}`}
                      type="button"
                      onClick={() => setActiveClip(clip)}
                      className={`px-3 py-2 rounded-xl border text-left shrink-0 transition-colors cursor-pointer ${
                        selected
                          ? 'bg-cyan-500/15 border-cyan-400 text-white'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="text-xs font-medium flex items-center gap-1.5">
                        <Film className="w-3 h-3 text-cyan-400" />
                        <span>Clip {i + 1}</span>
                        <span className="text-[10px] font-mono-tabular text-slate-400">
                          {clip.aspectRatio}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
