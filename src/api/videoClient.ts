import { VideoAspectRatio, VideoAttachment } from '../types';

export interface GenerateVideoParams {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  aspectRatio: VideoAspectRatio;
  onStatusUpdate?: (status: string) => void;
}

export async function generatePhotoVideo({
  imageBase64,
  mimeType,
  prompt,
  aspectRatio,
  onStatusUpdate,
}: GenerateVideoParams): Promise<VideoAttachment> {
  onStatusUpdate?.('Starting video generation...');

  const startRes = await fetch('/api/video/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      mimeType,
      prompt,
      aspectRatio,
    }),
  });

  const startData = await startRes.json();
  if (!startRes.ok) {
    throw new Error(startData.error || `Request failed (${startRes.status})`);
  }

  if (startData.status === 'completed' && startData.videoUrl) {
    return {
      url: startData.videoUrl,
      aspectRatio,
      prompt,
      createdAt: Date.now(),
      interactionId: startData.interactionId,
    };
  }

  const interactionId = startData.interactionId as string | undefined;
  if (!interactionId) {
    throw new Error('Server did not return an interaction ID.');
  }

  onStatusUpdate?.('Animating photo frames...');

  const maxAttempts = 90; // up to ~4.5 minutes at 3s intervals
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const pollRes = await fetch(`/api/video/status/${encodeURIComponent(interactionId)}`);
    const pollData = await pollRes.json();

    if (!pollRes.ok) {
      throw new Error(pollData.error || `Status check failed (${pollRes.status})`);
    }

    if (pollData.status === 'completed' && pollData.videoUrl) {
      return {
        url: pollData.videoUrl,
        aspectRatio,
        prompt,
        createdAt: Date.now(),
        interactionId,
      };
    }

    if (
      pollData.status === 'failed' ||
      pollData.status === 'cancelled' ||
      pollData.status === 'budget_exceeded'
    ) {
      throw new Error(pollData.error || `Video generation ${pollData.status}.`);
    }

    onStatusUpdate?.(
      pollData.status === 'queued'
        ? 'Queued for Omni Flash rendering...'
        : 'Rendering motion frames...'
    );
  }

  throw new Error('Video generation timed out. Please try again.');
}

export function readFileAsDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Failed to read image file.'));
        return;
      }
      resolve({
        dataUrl: result,
        mimeType: file.type || 'image/png',
      });
    };
    reader.onerror = () => reject(new Error('Unable to read selected image file.'));
    reader.readAsDataURL(file);
  });
}
