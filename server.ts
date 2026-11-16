import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface CachedVideo {
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
}

// In-memory store for generated videos so <video> tags can stream MP4 cleanly with Range support
const videoCache = new Map<string, CachedVideo>();

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please add a billing-enabled API key in Settings > Secrets.');
  }
  return new GoogleGenAI({ apiKey });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (lower.includes('permission_denied') || lower.includes('403') || lower.includes('api_key_invalid') || lower.includes('api key')) {
    return {
      status: 403,
      message: 'Video generation with gemini-omni-1.2-flash requires a valid, billing-enabled Gemini API key in Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota') || lower.includes('billing')) {
    return {
      status: 429,
      message: 'Quota or billing limit reached for gemini-omni-1.2-flash. Please select a billing-enabled Gemini API key in Settings > Secrets.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'Requested video interaction or model was not found. Please verify your Gemini API configuration.',
    };
  }
  return {
    status: 500,
    message: rawMessage || 'Video generation failed. Please try again.',
  };
}

async function resolveVideoBuffer(
  videoPart: { data?: string; uri?: string; mime_type?: string } | undefined
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!videoPart) return null;
  const mimeType = videoPart.mime_type || 'video/mp4';

  if (videoPart.data) {
    return {
      buffer: Buffer.from(videoPart.data, 'base64'),
      mimeType,
    };
  }

  if (videoPart.uri) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['x-goog-api-key'] = apiKey;
    }
    const resp = await fetch(videoPart.uri, { headers });
    if (!resp.ok) {
      throw new Error(`Failed to fetch generated video asset (${resp.status}).`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: resp.headers.get('content-type') || mimeType,
    };
  }

  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Start Photo-to-Video generation via Gemini Interactions API (gemini-omni-1.2-flash)
  app.post('/api/video/generate', async (req, res) => {
    try {
      const { imageBase64, mimeType, prompt, aspectRatio } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        prompt?: string;
        aspectRatio?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Please upload a photo to animate.' });
        return;
      }

      const validAspectRatio: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
      const cleanMime =
        mimeType && /^image\/(png|jpeg|jpg|webp)$/i.test(mimeType)
          ? mimeType.toLowerCase() === 'image/jpg'
            ? 'image/jpeg'
            : mimeType.toLowerCase()
          : 'image/png';
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const motionPrompt =
        prompt && prompt.trim().length > 0
          ? prompt.trim()
          : 'Subtle hypnotic slow motion animation with iridescent ambient lighting and gentle fluid drift.';

      const ai = getGeminiClient();

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: [
            {
              type: 'image',
              mime_type: cleanMime,
              data: cleanBase64,
            },
            {
              type: 'text',
              text: motionPrompt,
            },
          ],
          background: true,
          store: true,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validAspectRatio,
          },
        },
        { timeout: 300000 }
      );

      if (interaction.status === 'completed' && interaction.output_video) {
        const resolved = await resolveVideoBuffer(interaction.output_video);
        if (resolved) {
          videoCache.set(interaction.id, {
            ...resolved,
            createdAt: Date.now(),
          });
          res.json({
            interactionId: interaction.id,
            status: 'completed',
            videoUrl: `/api/video/stream/${encodeURIComponent(interaction.id)}`,
            mimeType: resolved.mimeType,
            aspectRatio: validAspectRatio,
          });
          return;
        }
      }

      res.json({
        interactionId: interaction.id,
        status: interaction.status || 'in_progress',
        aspectRatio: validAspectRatio,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Poll Photo-to-Video generation status
  app.get('/api/video/status/:id', async (req, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Missing interaction ID.' });
      return;
    }

    const cached = videoCache.get(id);
    if (cached) {
      res.json({
        interactionId: id,
        status: 'completed',
        videoUrl: `/api/video/stream/${encodeURIComponent(id)}`,
        mimeType: cached.mimeType,
      });
      return;
    }

    try {
      const ai = getGeminiClient();
      const interaction = await ai.interactions.get(id);

      if (interaction.status === 'completed') {
        const resolved = await resolveVideoBuffer(interaction.output_video);
        if (!resolved) {
          res.status(500).json({
            interactionId: id,
            status: 'failed',
            error: 'Video generation completed without a playable video stream.',
          });
          return;
        }

        videoCache.set(id, {
          ...resolved,
          createdAt: Date.now(),
        });

        res.json({
          interactionId: id,
          status: 'completed',
          videoUrl: `/api/video/stream/${encodeURIComponent(id)}`,
          mimeType: resolved.mimeType,
        });
        return;
      }

      if (
        interaction.status === 'failed' ||
        interaction.status === 'cancelled' ||
        interaction.status === 'budget_exceeded'
      ) {
        res.json({
          interactionId: id,
          status: interaction.status,
          error: `Video generation ended with status: ${interaction.status}.`,
        });
        return;
      }

      res.json({
        interactionId: id,
        status: interaction.status || 'in_progress',
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Stream cached generated MP4 with HTTP Range support
  app.get('/api/video/stream/:id', (req, res) => {
    const entry = videoCache.get(req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Video clip not found or expired from server memory.' });
      return;
    }

    const total = entry.buffer.length;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': entry.mimeType,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(entry.buffer.subarray(start, end + 1));
      return;
    }

    res.writeHead(200, {
      'Content-Length': total,
      'Content-Type': entry.mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(entry.buffer);
  });

  // Vite dev middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BubbleNote server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start BubbleNote server:', err);
  process.exit(1);
});
