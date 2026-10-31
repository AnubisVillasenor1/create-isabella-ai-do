/**
 * StepAudio 3 Music API Routes Ω
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 *
 * Express routes for StepAudio 3 Music integration
 */

import { Router, type Application, type Request, type Response } from 'express';
import { StepAudioTool, StepAudioGenerateOptions } from './stepaudio-music';
import { describeError, toHttpError } from '../http-error';

const router: Router = Router();

// Initialize StepAudio tool
const stepAudioTool = new StepAudioTool({
  apiKey: process.env.STEP_API_KEY,
});

/**
 * POST /api/v1/multimodal/stepaudio/generate
 * Generate music (unified endpoint for all task types)
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      task,
      caption,
      lyrics,
      instrumental,
      songAudio,
      vocalAudio,
      responseFormat,
      sampleRate,
      bitRate,
      lyricsRewrite,
      disableCaptionRewrite,
      maxTokens,
      temperature,
      topK,
      topP,
      repetitionPenalty,
    } = req.body;

    // Validate required fields
    if (!task || !['text_to_music', 'music_cover', 'vocal_to_music'].includes(task)) {
      return res.status(400).json({
        error: 'INVALID_TASK',
        message: 'task must be one of: text_to_music, music_cover, vocal_to_music',
      });
    }

    if (!caption || caption.trim().length === 0) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'caption (style description) is required',
      });
    }

    // Task-specific validation
    if (task === 'music_cover') {
      if (!lyrics) {
        return res
          .status(400)
          .json({ error: 'LYRICS_REQUIRED', message: 'lyrics is required for music_cover' });
      }
      if (!songAudio) {
        return res.status(400).json({
          error: 'SONG_AUDIO_REQUIRED',
          message: 'songAudio (reference song) is required for music_cover',
        });
      }
    }

    if (task === 'vocal_to_music') {
      if (!lyrics) {
        return res
          .status(400)
          .json({ error: 'LYRICS_REQUIRED', message: 'lyrics is required for vocal_to_music' });
      }
      if (!vocalAudio) {
        return res.status(400).json({
          error: 'VOCAL_AUDIO_REQUIRED',
          message: 'vocalAudio (dry vocal) is required for vocal_to_music',
        });
      }
    }

    if (task === 'text_to_music' && instrumental && lyrics) {
      return res.status(400).json({
        error: 'INVALID_COMBINATION',
        message: 'lyrics must not be provided when instrumental=true',
      });
    }

    // Execute generation
    const options: StepAudioGenerateOptions = {
      task,
      caption,
      lyrics,
      instrumental,
      songAudio,
      vocalAudio,
      responseFormat,
      sampleRate,
      bitRate,
      lyricsRewrite,
      disableCaptionRewrite,
      maxTokens,
      temperature,
      topK,
      topP,
      repetitionPenalty,
    };

    const result = await stepAudioTool.execute(options);

    if (result.status === 'FAILED') {
      return res.status(500).json({
        error: 'GENERATION_FAILED',
        message: result.error?.message || 'Music generation failed',
        details: result.error,
      });
    }

    res.json({
      success: true,
      data: result,
      metadata: {
        tool: 'stepaudio-3-music',
        model: 'stepaudio-3-music-preview',
        timestamp: Date.now(),
      },
    });
  } catch (error: unknown) {
    console.error('[StepAudio] route error:', describeError(error));
    const { status, body } = toHttpError(error, 'GENERATION_FAILED');
    res.status(status).json(body);
  }
});

/**
 * POST /api/v1/multimodal/stepaudio/song
 * Generate song from lyrics and style (convenience endpoint)
 */
router.post('/song', async (req: Request, res: Response) => {
  try {
    const { caption, lyrics, responseFormat, temperature } = req.body;

    if (!caption) {
      return res.status(400).json({ error: 'CAPTION_REQUIRED', message: 'caption is required' });
    }

    const result = await stepAudioTool.generateSong(caption, lyrics, {
      responseFormat,
      temperature,
    });

    if (result.status === 'FAILED') {
      return res.status(500).json({
        error: 'GENERATION_FAILED',
        message: result.error?.message || 'Song generation failed',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error('[StepAudio] route error:', describeError(error));
    const { status, body } = toHttpError(error, 'GENERATION_FAILED');
    res.status(status).json(body);
  }
});

/**
 * POST /api/v1/multimodal/stepaudio/instrumental
 * Generate instrumental music
 */
router.post('/instrumental', async (req: Request, res: Response) => {
  try {
    const { caption, responseFormat, temperature } = req.body;

    if (!caption) {
      return res.status(400).json({ error: 'CAPTION_REQUIRED', message: 'caption is required' });
    }

    const result = await stepAudioTool.generateInstrumental(caption, {
      responseFormat,
      temperature,
    });

    if (result.status === 'FAILED') {
      return res.status(500).json({
        error: 'GENERATION_FAILED',
        message: result.error?.message || 'Instrumental generation failed',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error('[StepAudio] route error:', describeError(error));
    const { status, body } = toHttpError(error, 'GENERATION_FAILED');
    res.status(status).json(body);
  }
});

/**
 * POST /api/v1/multimodal/stepaudio/cover
 * Create song cover / style transfer
 */
router.post('/cover', async (req: Request, res: Response) => {
  try {
    const { caption, lyrics, songAudio, responseFormat } = req.body;

    if (!caption || !lyrics || !songAudio) {
      return res.status(400).json({
        error: 'MISSING_PARAMS',
        message: 'caption, lyrics, and songAudio are required for cover',
      });
    }

    const result = await stepAudioTool.createCover(caption, lyrics, songAudio, { responseFormat });

    if (result.status === 'FAILED') {
      return res.status(500).json({
        error: 'GENERATION_FAILED',
        message: result.error?.message || 'Cover generation failed',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error('[StepAudio] route error:', describeError(error));
    const { status, body } = toHttpError(error, 'GENERATION_FAILED');
    res.status(status).json(body);
  }
});

/**
 * POST /api/v1/multimodal/stepaudio/vocal-to-music
 * Generate music from dry vocal
 */
router.post('/vocal-to-music', async (req: Request, res: Response) => {
  try {
    const { caption, lyrics, vocalAudio, responseFormat } = req.body;

    if (!caption || !lyrics || !vocalAudio) {
      return res.status(400).json({
        error: 'MISSING_PARAMS',
        message: 'caption, lyrics, and vocalAudio are required for vocal_to_music',
      });
    }

    const result = await stepAudioTool.vocalToMusic(caption, lyrics, vocalAudio, {
      responseFormat,
    });

    if (result.status === 'FAILED') {
      return res.status(500).json({
        error: 'GENERATION_FAILED',
        message: result.error?.message || 'Vocal-to-music generation failed',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error('[StepAudio] route error:', describeError(error));
    const { status, body } = toHttpError(error, 'GENERATION_FAILED');
    res.status(status).json(body);
  }
});

/**
 * POST /api/v1/multimodal/stepaudio/submit
 * Submit task only (returns task_id for async polling)
 */
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const options: StepAudioGenerateOptions = req.body;

    if (!options.task || !options.caption) {
      return res
        .status(400)
        .json({ error: 'MISSING_PARAMS', message: 'task and caption are required' });
    }

    const taskId = await stepAudioTool.getClient().submitTask(options);

    res.json({
      success: true,
      data: { taskId },
    });
  } catch (error: unknown) {
    console.error('[StepAudio] route error:', describeError(error));
    const { status, body } = toHttpError(error, 'SUBMIT_FAILED');
    res.status(status).json(body);
  }
});

/**
 * POST /api/v1/multimodal/stepaudio/query
 * Query task status/result
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'TASK_ID_REQUIRED', message: 'taskId is required' });
    }

    const result = await stepAudioTool.getClient().queryTask(taskId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error('[StepAudio] route error:', describeError(error));
    const { status, body } = toHttpError(error, 'QUERY_FAILED');
    res.status(status).json(body);
  }
});

/**
 * GET /api/v1/multimodal/stepaudio/health
 * Health check
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await stepAudioTool.getClient().healthCheck();
    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    res.status(503).json({
      error: 'HEALTH_CHECK_FAILED',
      message: String(error),
    });
  }
});

/**
 * GET /api/v1/multimodal/stepaudio/capabilities
 * Get tool capabilities
 */
router.get('/capabilities', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: stepAudioTool.getToolDefinition(),
  });
});

export function registerStepAudioRoutes(app: Pick<Application, 'use'>): void {
  app.use('/api/v1/multimodal/stepaudio', router);
}

export { router as stepAudioRoutes };
export { stepAudioTool };
