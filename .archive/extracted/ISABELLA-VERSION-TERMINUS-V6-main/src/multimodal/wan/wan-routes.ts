/**
 * WAN I2V API Routes Ω
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 * 
 * Express routes for WAN 2.2 I2V integration
 */

import { Router, Request, Response } from "express";
import { WANTool, WANImageInput, WANGenerateParams } from "./wan-i2v";

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
router.post("/generate", async (req: Request, res: Response) => {
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
        error: "INVALID_INPUT",
        message: "inputImage must contain url, base64, or path",
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
        error: "VALIDATION_ERROR",
        message: validation.errors.join(", "),
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
        tool: "wan-i2v",
        model: "Wan 2.2 14B I2V",
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("WAN generation error:", error);
    res.status(500).json({
      error: "GENERATION_FAILED",
      message: String(error),
    });
  }
});

/**
 * POST /api/v1/multimodal/wan/extract-frame
 * Extract frame from generated video
 */
router.post("/extract-frame", async (req: Request, res: Response) => {
  try {
    const { video, timestamp } = req.body;

    if (!video || !video.path) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "video must contain path",
      });
    }

    const result = await wanTool.extractFrame(video as any, timestamp || 0);

    res.json({
      success: true,
      data: result,
      metadata: {
        tool: "wan-i2v",
        operation: "extract-frame",
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("Frame extraction error:", error);
    res.status(500).json({
      error: "EXTRACTION_FAILED",
      message: String(error),
    });
  }
});

/**
 * POST /api/v1/multimodal/wan/upload
 * Upload image for processing
 */
router.post("/upload", async (req: Request, res: Response) => {
  try {
    // Handle multipart/form-data
    // In production, use multer or similar
    const { file, filename, mimeType } = req.body;

    if (!file) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "file is required",
      });
    }

    // Convert base64 to buffer if needed
    let buffer: Buffer;
    if (typeof file === "string") {
      buffer = Buffer.from(file, "base64");
    } else if (Buffer.isBuffer(file)) {
      buffer = file;
    } else {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "file must be base64 string or buffer",
      });
    }

    const uploaded = await wanTool.getClient().uploadImage(buffer, filename || "upload.png", mimeType || "image/png");

    res.json({
      success: true,
      data: uploaded,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      error: "UPLOAD_FAILED",
      message: String(error),
    });
  }
});

/**
 * GET /api/v1/multimodal/wan/health
 * Health check
 */
router.get("/health", async (_req: Request, res: Response) => {
  try {
    const health = await wanTool.getClient().healthCheck();
    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    res.status(503).json({
      error: "HEALTH_CHECK_FAILED",
      message: String(error),
    });
  }
});

/**
 * GET /api/v1/multimodal/wan/capabilities
 * Get tool capabilities
 */
router.get("/capabilities", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: wanTool.getToolDefinition(),
  });
});

/**
 * GET /api/v1/multimodal/wan/schedulers
 * Get available schedulers
 */
router.get("/schedulers", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      schedulers: wanTool.getClient().getSchedulers(),
      frameMultipliers: wanTool.getClient().getFrameMultipliers(),
    },
  });
});

export function registerWANRoutes(app: any): void {
  app.use("/api/v1/multimodal/wan", router);
}

export { router as wanRoutes };
export { wanTool };
