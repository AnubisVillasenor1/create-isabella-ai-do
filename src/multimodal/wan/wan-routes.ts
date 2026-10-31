/**
 * WAN I2V API Routes Ω
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 *
 * Express routes for WAN 2.2 I2V integration
 */

import { Router, type Application, type Request, type Response } from 'express';
import { WANTool, WANImageInput, WANGenerateParams, type WANFileData } from './wan-i2v';
import { describeError, toHttpError } from '../http-error';

const router: Router = Router();

// Initialize WAN tool
const wanTool = new WANTool({
  hfToken: process.env.HF_TOKEN,
  timeoutMs: 300000,
});

/**
 * POST /api/v1/multimodal/wan/generate
 * Generate video from image
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      inputImage,
      lastImage,
      prompt,
      negativePrompt,
      steps,
      durationSeconds,
      guidanceScale,
      guidanceScale2,
      seed,
      randomizeSeed,
      quality,
      scheduler,
      flowShift,
      frameMultiplier,
      safeMode,
      displayResult,
    } = req.body;

    // Validate required fields
    if (!inputImage || (!inputImage.url && !inputImage.base64 && !inputImage.path)) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'inputImage must contain url, base64, or path',
      });
    }

    // Validate parameters
    const validation = wanTool.getClient().validateParams({
      steps,
      durationSeconds,
      guidanceScale,
      guidanceScale2,
      seed,
      quality,
      scheduler,
      flowShift,
      frameMultiplier,
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: validation.errors.join(', '),
      });
    }

    // Generate video
    const result = await wanTool.execute({
      inputImage: inputImage as WANImageInput,
      lastImage: lastImage as WANImageInput | undefined,
      prompt,
      negativePrompt,
      steps,
      durationSeconds,
      guidanceScale,
      guidanceScale2,
      seed,
      randomizeSeed,
      quality,
      scheduler,
      flowShift,
      frameMultiplier,
      safeMode,
      displayResult,
    });

    res.json({
      success: true,
      data: result,
      metadata: {
        tool: 'wan-i2v',
        model: 'Wan 2.2 14B I2V',
        timestamp: Date.now(),
      },
    });
  } catch (error: unknown) {
    console.error('[WAN] route error:', describeError(error));
    const { status, body } = toHttpError(error, 'GENERATION_FAILED');
    res.status(status).json(body);
  }
});

/**
 * POST /api/v1/multimodal/wan/extract-frame
 * Extract frame from generated video
 */
router.post('/extract-frame', async (req: Request, res: Response) => {
  try {
    const { video, timestamp } = req.body as {
      video?: { path?: unknown; url?: unknown; size?: unknown; origName?: unknown };
      timestamp?: unknown;
    };

    // Input comes from the network: accept only a bounded relative path (no traversal, no scheme, no NUL).
    const path = video?.path;
    if (
      typeof path !== 'string' ||
      path.length === 0 ||
      path.length > 512 ||
      path.includes('..') ||
      path.includes('\0') ||
      /^[a-z][a-z0-9+.-]*:/i.test(path)
    ) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'video.path must be a bounded relative path',
      });
    }
    const at = timestamp === undefined ? 0 : timestamp;
    if (typeof at !== 'number' || !Number.isFinite(at) || at < 0 || at > 86_400) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'timestamp must be a finite number of seconds in [0, 86400]',
      });
    }
    const file: WANFileData = {
      path,
      url: typeof video?.url === 'string' ? video.url : null,
      size: typeof video?.size === 'number' && Number.isFinite(video.size) ? video.size : null,
      origName: typeof video?.origName === 'string' ? video.origName.slice(0, 255) : null,
      meta: { _type: 'gradio.FileData' },
    };

    const result = await wanTool.extractFrame(file, at);

    res.json({
      success: true,
      data: result,
      metadata: {
        tool: 'wan-i2v',
        operation: 'extract-frame',
        timestamp: Date.now(),
      },
    });
  } catch (error: unknown) {
    console.error('[WAN] route error:', describeError(error));
    const { status, body } = toHttpError(error, 'EXTRACTION_FAILED');
    res.status(status).json(body);
  }
});

/**
 * POST /api/v1/multimodal/wan/upload
 * Upload image for processing
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    // Handle multipart/form-data
    // In production, use multer or similar
    const { file, filename, mimeType } = req.body;

    if (!file) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'file is required',
      });
    }

    // Convert base64 to buffer if needed
    let buffer: Buffer;
    if (typeof file === 'string') {
      buffer = Buffer.from(file, 'base64');
    } else if (Buffer.isBuffer(file)) {
      buffer = file;
    } else {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'file must be base64 string or buffer',
      });
    }

    const uploaded = await wanTool
      .getClient()
      .uploadImage(buffer, filename || 'upload.png', mimeType || 'image/png');

    res.json({
      success: true,
      data: uploaded,
    });
  } catch (error: unknown) {
    console.error('[WAN] route error:', describeError(error));
    const { status, body } = toHttpError(error, 'UPLOAD_FAILED');
    res.status(status).json(body);
  }
});

/**
 * GET /api/v1/multimodal/wan/health
 * Health check
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await wanTool.getClient().healthCheck();
    res.json({
      success: true,
      data: health,
    });
  } catch (error: unknown) {
    console.error('[WAN] health check failed:', describeError(error));
    res.status(503).json({
      error: 'HEALTH_CHECK_FAILED',
      message: 'WAN provider health check failed.',
    });
  }
});

/**
 * GET /api/v1/multimodal/wan/capabilities
 * Get tool capabilities
 */
router.get('/capabilities', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: wanTool.getToolDefinition(),
  });
});

/**
 * GET /api/v1/multimodal/wan/schedulers
 * Get available schedulers
 */
router.get('/schedulers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      schedulers: wanTool.getClient().getSchedulers(),
      frameMultipliers: wanTool.getClient().getFrameMultipliers(),
    },
  });
});

export function registerWANRoutes(app: Pick<Application, 'use'>): void {
  app.use('/api/v1/multimodal/wan', router);
}

export { router as wanRoutes };
export { wanTool };
