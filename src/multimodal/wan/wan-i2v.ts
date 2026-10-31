/**
 * WAN 2.2 I2V Native Integration Ω
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 *
 * Native integration for Hugging Face Space: kulkas2pintu/wan777
 * Gradio API wrapper for Wan 2.2 14B Image-to-Video with Lightning LoRA
 *
 * Endpoint: https://kulkas2pintu-wan777.hf.space
 * Auth: Bearer HF_TOKEN
 */

import { EventEmitter } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';

export interface WANConfig {
  readonly spaceUrl: string;
  readonly hfToken: string;
  readonly defaultParams: WANGenerateParams;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

export interface WANGenerateParams {
  readonly prompt: string;
  readonly negativePrompt?: string;
  readonly steps?: number;
  readonly durationSeconds?: number;
  readonly guidanceScale?: number;
  readonly guidanceScale2?: number;
  readonly seed?: number;
  readonly randomizeSeed?: boolean;
  readonly quality?: number;
  readonly scheduler?: WANScheduler;
  readonly flowShift?: number;
  readonly frameMultiplier?: WANFrameMultiplier;
  readonly safeMode?: boolean;
  readonly displayResult?: boolean;
  readonly lastImage?: WANImageInput;
}

export type WANScheduler =
  | 'FlowMatchEulerDiscrete'
  | 'SASolver'
  | 'DEISMultistep'
  | 'DPMSolverMultistepInverse'
  | 'UniPCMultistep'
  | 'DPMSolverMultistep'
  | 'DPMSolverSinglestep';

export type WANFrameMultiplier = '16' | '32' | '64' | '128';

export interface WANImageInput {
  readonly path?: string;
  readonly url?: string;
  readonly base64?: string;
  readonly origName?: string;
  readonly mimeType?: string;
}

export interface WANVideoOutput {
  readonly video: WANFileData;
  readonly subtitles?: WANFileData | null;
  readonly seed: number;
}

export interface WANFileData {
  readonly path: string;
  readonly url?: string | null;
  readonly size?: number | null;
  readonly origName?: string | null;
  readonly mimeType?: string | null;
  readonly isStream?: boolean;
  readonly meta: { _type: 'gradio.FileData' };
}

export interface WANFrameExtractResult {
  readonly path?: string | null;
  readonly url?: string | null;
  readonly size?: number | null;
  readonly origName?: string | null;
  readonly mimeType?: string | null;
  readonly isStream?: boolean;
  readonly meta: { _type: 'gradio.FileData' };
}

export interface WANQueueResponse {
  readonly queue_position: number;
  readonly estimate_time?: number;
}

export interface WANJobStatus {
  readonly status: 'queued' | 'processing' | 'completed' | 'failed';
  readonly position?: number;
  readonly output?: WANVideoOutput;
  readonly error?: string;
  readonly progress?: number;
}

const DEFAULT_CONFIG: WANConfig = {
  spaceUrl: 'https://kulkas2pintu-wan777.hf.space',
  hfToken: process.env.HF_TOKEN || '',
  defaultParams: {
    prompt: 'make this image come alive, cinematic motion, smooth animation',
    negativePrompt:
      '色调艳丽, 过曝, 静态, 细节模糊不清, 字幕, 风格, 作品, 画作, 画面, 静止, 整体发灰, 最差质量, 低质量, JPEG压缩残留, 丑陋的, 残缺的, 多余的手指, 画得不好的手部, 画得不好的脸部, 畸形的, 毁容的, 形态畸形的肢体, 手指融合, 静止不动的画面, 杂乱的背景, 三条腿, 背景人很多, 倒着走',
    steps: 4,
    durationSeconds: 3.5,
    guidanceScale: 1,
    guidanceScale2: 1,
    seed: 42,
    randomizeSeed: true,
    quality: 6,
    scheduler: 'UniPCMultistep',
    flowShift: 3.0,
    frameMultiplier: '16',
    safeMode: true,
    displayResult: true,
  },
  timeoutMs: 300000, // 5 minutes
  maxRetries: 3,
};

const ENDPOINTS = {
  generateVideo: '/generate_video',
  extractFrame: '/extract_frame',
  queueJoin: '/gradio_api/queue/join',
  queueData: '/gradio_api/queue/data',
  upload: '/gradio_api/upload',
};

/**
 * WAN I2V Client - Native Gradio API Integration
 */
export class WANClient extends EventEmitter {
  private config: WANConfig;
  private sessionHash: string;

  constructor(config: Partial<WANConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionHash = this.generateSessionHash();
  }

  private generateSessionHash(): string {
    return randomBytes(16).toString('hex');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.hfToken) {
      headers['Authorization'] = `Bearer ${this.config.hfToken}`;
    }
    return headers;
  }

  /**
   * Upload an image file to the Gradio server
   */
  async uploadImage(
    file: Buffer | string,
    filename: string,
    mimeType: string
  ): Promise<WANFileData> {
    const formData = new FormData();

    if (typeof file === 'string') {
      // URL or base64
      if (file.startsWith('http')) {
        // Fetch and upload
        const response = await fetch(file);
        const blob = await response.blob();
        formData.append('files', blob, filename);
      } else {
        // Assume base64
        const buffer = Buffer.from(file, 'base64');
        formData.append('files', new Blob([new Uint8Array(buffer)]), filename);
      }
    } else {
      formData.append('files', new Blob([new Uint8Array(file)]), filename);
    }

    const response = await fetch(`${this.config.spaceUrl}${ENDPOINTS.upload}`, {
      method: 'POST',
      headers: this.config.hfToken ? { Authorization: `Bearer ${this.config.hfToken}` } : {},
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`UPLOAD_FAILED: ${response.statusText}`);
    }

    const result = await response.json();
    return result[0] as WANFileData;
  }

  /**
   * Prepare image input for Gradio API
   */
  private prepareImageInput(input: WANImageInput): Record<string, unknown> {
    const result: Record<string, unknown> = {
      meta: { _type: 'gradio.FileData' },
    };

    if (input.path) result.path = input.path;
    if (input.url) result.url = input.url;
    if (input.base64) {
      // Upload base64 and get path
      // This would need to be handled before calling generate
    }
    if (input.origName) result.orig_name = input.origName;
    if (input.mimeType) result.mime_type = input.mimeType;
    result.is_stream = false;

    return result;
  }

  /**
   * Generate video from image (main I2V function)
   */
  async generateVideo(
    inputImage: WANImageInput,
    params: Partial<WANGenerateParams> = {}
  ): Promise<WANVideoOutput> {
    const mergedParams = { ...this.config.defaultParams, ...params };

    // Prepare payload
    const payload = [
      this.prepareImageInput(inputImage),
      params.lastImage ? this.prepareImageInput(params.lastImage) : null,
      mergedParams.prompt,
      mergedParams.steps,
      mergedParams.negativePrompt,
      mergedParams.durationSeconds,
      mergedParams.guidanceScale,
      mergedParams.guidanceScale2,
      mergedParams.seed,
      mergedParams.randomizeSeed,
      mergedParams.quality,
      mergedParams.scheduler,
      mergedParams.flowShift,
      mergedParams.frameMultiplier,
      mergedParams.displayResult,
      mergedParams.safeMode,
    ];

    // Join queue
    const joinResponse = await this.joinQueue(payload);

    // Wait for completion
    return this.waitForCompletion(joinResponse);
  }

  private async joinQueue(data: unknown[]): Promise<WANQueueResponse> {
    const response = await fetch(`${this.config.spaceUrl}${ENDPOINTS.queueJoin}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        data,
        fn_index: 0, // generate_video endpoint index
        session_hash: this.sessionHash,
      }),
    });

    if (!response.ok) {
      throw new Error(`QUEUE_JOIN_FAILED: ${response.statusText}`);
    }

    return response.json();
  }

  private async waitForCompletion(joinResponse: WANQueueResponse): Promise<WANVideoOutput> {
    const startTime = Date.now();
    let lastPosition = joinResponse.queue_position;

    while (Date.now() - startTime < this.config.timeoutMs) {
      const status = await this.checkStatus();

      if (status.status === 'completed' && status.output) {
        this.emit('generation:completed', status.output);
        return status.output;
      }

      if (status.status === 'failed') {
        throw new Error(`GENERATION_FAILED: ${status.error}`);
      }

      if (status.position !== undefined && status.position !== lastPosition) {
        lastPosition = status.position;
        this.emit('generation:progress', { position: status.position, progress: status.progress });
      }

      // Wait before polling
      await this.sleep(Math.min(2000 + status.position! * 100, 10000));
    }

    throw new Error('GENERATION_TIMEOUT');
  }

  private async checkStatus(): Promise<WANJobStatus> {
    const response = await fetch(
      `${this.config.spaceUrl}${ENDPOINTS.queueData}?session_hash=${this.sessionHash}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error(`STATUS_CHECK_FAILED: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.msg || data.msg.length === 0) {
      return { status: 'queued', position: 0 };
    }

    const msg = data.msg[0];

    if (msg.msg === 'process_completed') {
      return {
        status: 'completed',
        output: msg.output as WANVideoOutput,
      };
    }

    if (msg.msg === 'process_error') {
      return {
        status: 'failed',
        error: msg.output?.error || 'Unknown error',
      };
    }

    return {
      status: 'processing',
      position: msg.msg === 'queue_full' ? data.msg[1]?.position : 0,
      progress: msg.msg === 'progress' ? msg.output?.progress : undefined,
    };
  }

  /**
   * Extract a frame from generated video
   */
  async extractFrame(
    videoPath: WANFileData,
    timestamp: number = 0
  ): Promise<WANFrameExtractResult> {
    const payload = [{ video: videoPath, subtitles: null }, timestamp];

    const joinResponse = await this.joinQueueWithFnIndex(payload, 1); // extract_frame is fn_index 1
    return this.waitForFrameExtraction(joinResponse);
  }

  private async joinQueueWithFnIndex(data: unknown[], fnIndex: number): Promise<WANQueueResponse> {
    const response = await fetch(`${this.config.spaceUrl}${ENDPOINTS.queueJoin}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        data,
        fn_index: fnIndex,
        session_hash: this.generateSessionHash(), // New session for each call
      }),
    });

    if (!response.ok) {
      throw new Error(`QUEUE_JOIN_FAILED: ${response.statusText}`);
    }

    return response.json();
  }

  private async waitForFrameExtraction(
    joinResponse: WANQueueResponse
  ): Promise<WANFrameExtractResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.config.timeoutMs) {
      const response = await fetch(
        `${this.config.spaceUrl}${ENDPOINTS.queueData}?session_hash=${this.sessionHash}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`STATUS_CHECK_FAILED: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.msg && data.msg.length > 0) {
        const msg = data.msg[0];
        if (msg.msg === 'process_completed') {
          return msg.output as WANFrameExtractResult;
        }
        if (msg.msg === 'process_error') {
          throw new Error(`FRAME_EXTRACTION_FAILED: ${msg.output?.error}`);
        }
      }

      await this.sleep(1000);
    }

    throw new Error('FRAME_EXTRACTION_TIMEOUT');
  }

  /**
   * Get available schedulers
   */
  getSchedulers(): WANScheduler[] {
    return [
      'FlowMatchEulerDiscrete',
      'SASolver',
      'DEISMultistep',
      'DPMSolverMultistepInverse',
      'UniPCMultistep',
      'DPMSolverMultistep',
      'DPMSolverSinglestep',
    ];
  }

  /**
   * Get available frame multipliers
   */
  getFrameMultipliers(): WANFrameMultiplier[] {
    return ['16', '32', '64', '128'];
  }

  /**
   * Validate generation parameters
   */
  validateParams(params: Partial<WANGenerateParams>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (params.steps !== undefined && (params.steps < 1 || params.steps > 30)) {
      errors.push('steps must be between 1 and 30');
    }
    if (
      params.durationSeconds !== undefined &&
      (params.durationSeconds < 0.5 || params.durationSeconds > 10)
    ) {
      errors.push('durationSeconds must be between 0.5 and 10');
    }
    if (
      params.guidanceScale !== undefined &&
      (params.guidanceScale < 0 || params.guidanceScale > 10)
    ) {
      errors.push('guidanceScale must be between 0 and 10');
    }
    if (
      params.guidanceScale2 !== undefined &&
      (params.guidanceScale2 < 0 || params.guidanceScale2 > 10)
    ) {
      errors.push('guidanceScale2 must be between 0 and 10');
    }
    if (params.seed !== undefined && (params.seed < 0 || params.seed > 2147483647)) {
      errors.push('seed must be between 0 and 2147483647');
    }
    if (params.quality !== undefined && (params.quality < 1 || params.quality > 10)) {
      errors.push('quality must be between 1 and 10');
    }
    if (params.flowShift !== undefined && (params.flowShift < 0.5 || params.flowShift > 15)) {
      errors.push('flowShift must be between 0.5 and 15');
    }
    if (params.frameMultiplier && !['16', '32', '64', '128'].includes(params.frameMultiplier)) {
      errors.push('frameMultiplier must be one of: 16, 32, 64, 128');
    }
    if (params.scheduler && !this.getSchedulers().includes(params.scheduler)) {
      errors.push(`scheduler must be one of: ${this.getSchedulers().join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.config.spaceUrl}/config`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return { healthy: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }
}

/**
 * Isabella Cognitive Tool Wrapper
 * Exposes WAN I2V as a cognitive tool for the MoE router
 */
export class WANTool extends EventEmitter {
  private client: WANClient;
  private toolId = 'multimodal.wan.i2v';

  constructor(config?: Partial<WANConfig>) {
    super();
    this.client = new WANClient(config);
  }

  getToolDefinition() {
    return {
      id: this.toolId,
      name: 'WAN 2.2 I2V',
      description:
        'Generate video animations from static images using Wan 2.2 14B Image-to-Video model with Lightning LoRA',
      category: 'multimodal',
      subcategory: 'video-generation',
      capabilities: ['image-to-video', 'animation', 'cinematic-motion', 'frame-extraction'],
      inputSchema: {
        type: 'object',
        required: ['inputImage'],
        properties: {
          inputImage: {
            type: 'object',
            description: 'Input image (URL, base64, or file path)',
            properties: {
              url: { type: 'string', format: 'uri' },
              base64: { type: 'string' },
              path: { type: 'string' },
              origName: { type: 'string' },
              mimeType: { type: 'string' },
            },
          },
          prompt: { type: 'string', description: 'Animation prompt' },
          negativePrompt: { type: 'string', description: 'Negative prompt' },
          steps: { type: 'integer', minimum: 1, maximum: 30, default: 4 },
          durationSeconds: { type: 'number', minimum: 0.5, maximum: 10, default: 3.5 },
          guidanceScale: { type: 'number', minimum: 0, maximum: 10, default: 1 },
          guidanceScale2: { type: 'number', minimum: 0, maximum: 10, default: 1 },
          seed: { type: 'integer', minimum: 0, maximum: 2147483647, default: 42 },
          randomizeSeed: { type: 'boolean', default: true },
          quality: { type: 'integer', minimum: 1, maximum: 10, default: 6 },
          scheduler: {
            type: 'string',
            enum: this.client.getSchedulers(),
            default: 'UniPCMultistep',
          },
          flowShift: { type: 'number', minimum: 0.5, maximum: 15, default: 3.0 },
          frameMultiplier: {
            type: 'string',
            enum: this.client.getFrameMultipliers(),
            default: '16',
          },
          safeMode: { type: 'boolean', default: true },
          lastImage: { type: 'object', description: 'Optional end frame image' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          video: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              url: { type: 'string' },
              size: { type: 'integer' },
              origName: { type: 'string' },
              mimeType: { type: 'string' },
            },
          },
          subtitles: { type: ['object', 'null'] },
          seed: { type: 'integer' },
        },
      },
      costEstimate: { compute: 'high', latency: 'medium', credits: 'variable' },
      requirements: { gpu: true, memory: '16GB+' },
    };
  }

  async execute(params: {
    inputImage: WANImageInput;
    lastImage?: WANImageInput;
    [key: string]: unknown;
  }): Promise<WANVideoOutput> {
    const { inputImage, lastImage, ...generationParams } = params;

    this.emit('tool:started', { toolId: this.toolId, params: generationParams });

    try {
      const result = await this.client.generateVideo(inputImage, {
        ...generationParams,
        lastImage,
      } as WANGenerateParams);

      this.emit('tool:completed', { toolId: this.toolId, result });
      return result;
    } catch (error) {
      this.emit('tool:failed', { toolId: this.toolId, error: String(error) });
      throw error;
    }
  }

  async extractFrame(video: WANFileData, timestamp: number): Promise<WANFrameExtractResult> {
    return this.client.extractFrame(video, timestamp);
  }

  getClient(): WANClient {
    return this.client;
  }
}

/**
 * Factory function for easy integration
 */
export function createWANIntegration(hfToken?: string): WANTool {
  return new WANTool({
    hfToken: hfToken || process.env.HF_TOKEN,
  });
}

// Default export
export const defaultWANTool = createWANIntegration();
