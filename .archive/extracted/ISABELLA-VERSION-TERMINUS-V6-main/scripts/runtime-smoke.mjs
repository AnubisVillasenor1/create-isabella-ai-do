import assert from "node:assert/strict";
import { createServer } from "node:http";

// Prevent the application from opening a production listener while this smoke test imports it.
process.env.VERCEL = "1";
process.env.RUNTIME_SMOKE = "1";
const { default: app } = await import("../dist/server.js");
assert.equal(typeof app, "function", "Express app must be exported as a request handler");

const server = createServer(app);
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const address = server.address();
  assert.ok(address && typeof address === "object", "smoke server must bind an ephemeral port");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(health.status, 200, "GET /health must return HTTP 200");
  const healthBody = await health.json();
  assert.equal(healthBody.status, "healthy");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff", "API must set MIME sniffing protection");
  assert.equal(health.headers.get("x-frame-options"), "DENY", "API must reject framing");
  assert.equal(health.headers.get("referrer-policy"), "strict-origin-when-cross-origin", "API must set a conservative referrer policy");
  assert.equal(health.headers.get("x-powered-by"), null, "Express fingerprint header must be disabled");
  const statusResponse = await fetch(baseUrl + "/api/v1/status", { signal: AbortSignal.timeout(5_000) });
  assert.equal(statusResponse.status, 200, "runtime status must remain available");
  assert.match(statusResponse.headers.get("content-security-policy") ?? "", /default-src 'none'/, "API responses must retain the strict CSP and must not be overwritten by the UI policy");
  const statusBody = await statusResponse.json();
  assert.ok(["VOLATILE_IN_MEMORY_HASH_CHAIN", "DURABLE_APPEND_ONLY_JSONL_LOCAL_SCOPE", "POSTGRES_SHARED_DURABLE"].includes(statusBody.engines?.bookpi),
    "BookPI status must disclose the configured backend without asserting external durability");
  assert.ok(["PROCESS_MEMORY_NOT_DURABLE", "LOCAL_FILE_FSYNCED_NOT_SHARED_NOT_WORM", "POSTGRES_SHARED_DURABLE_NOT_WORM"].includes(statusBody.engines?.bookpiDurability),
    "BookPI status must disclose its durability scope");

  const readyz = await fetch(baseUrl + "/api/v1/readyz", { signal: AbortSignal.timeout(5_000) });
  assert.ok([200, 503].includes(readyz.status), "readiness may only report healthy or explicitly blocked");
  const readyzBody = await readyz.json();
  assert.equal(readyzBody.scope, "dependency-readiness");
  assert.ok(Array.isArray(readyzBody.readinessEvidence), "readiness must include observed dependency evidence");
  assert.equal(readyz.status, readyzBody.snapshot?.readiness?.ready ? 200 : 503,
    "HTTP readiness must match the evaluated runtime readiness state");

  const publicHealth = await fetch(`${baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(publicHealth.status, 200, "public API health must remain available");
  const publicHealthBody = await publicHealth.json();
  assert.equal(typeof publicHealthBody.inferenceMode, "string", "public health must describe inference mode without exposing secrets");
  assert.equal("hasGeminiKey" in publicHealthBody, false, "public health must not disclose provider credential presence");

  const healthz = await fetch(`${baseUrl}/api/v1/healthz`, { signal: AbortSignal.timeout(5_000) });
  assert.ok([200, 503].includes(healthz.status), "deep readiness may only report healthy or explicitly blocked");
  const healthzBody = await healthz.json();
  assert.equal(healthzBody.scope, "deep-dependency-readiness", "deep readiness must declare its scope");
  assert.ok(Array.isArray(healthzBody.evidence), "deep readiness must include observed dependency evidence");
  assert.equal(healthz.status, healthzBody.ready ? 200 : 503, "deep readiness HTTP status must match its evaluated state");

  const chat = await fetch(`${baseUrl}/api/v1/cognition/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: "Hola",
      modelEngine: "sovereign",
      focusLens: "general",
      history: [],
      methodId: "A.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const chatBody = await chat.json();
  assert.equal(chat.status, 200, `chat endpoint returned HTTP ${chat.status}: ${JSON.stringify(chatBody)}`);
  assert.equal(typeof chatBody.generativeNarrative, "string", "chat must return a user-facing narrative");
  assert.ok(chatBody.generativeNarrative.trim().length > 0, "chat narrative must not be empty");
  assert.equal(chatBody.responseEngine, "sovereign", "explicit sovereign mode must disclose the local engine");
  assert.match(chatBody.generativeNarrative, /Soy Isabella Villaseñor AI/, "local fallback must answer greetings conversationally");
  assert.equal(typeof chatBody.openModelConfigured, "boolean", "response must distinguish open provider configuration");
  assert.equal(typeof chatBody.paidProviderConfigured, "boolean", "response must distinguish paid provider configuration");

  const followUp = await fetch(`${baseUrl}/api/v1/cognition/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: "¿Quién eres?",
      modelEngine: "sovereign",
      focusLens: "general",
      history: [
        { role: "user", content: "Hola" },
        { role: "assistant", content: chatBody.generativeNarrative },
      ],
      methodId: "A.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const followUpBody = await followUp.json();
  assert.equal(followUp.status, 200, `follow-up returned HTTP ${followUp.status}: ${JSON.stringify(followUpBody)}`);
  assert.match(followUpBody.generativeNarrative, /Soy Isabella Villaseñor AI/, "fallback must answer identity questions");
  assert.equal(followUpBody.conversationContextTurns, 2, "conversation history must be preserved within the request");
  const emptyInput = await fetch(`${baseUrl}/api/v1/cognition/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: "   ", modelEngine: "sovereign" }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(emptyInput.status, 400, "blank user input must be rejected");

  const oversizedInput = await fetch(`${baseUrl}/api/v1/cognition/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: "x".repeat(20_001), modelEngine: "sovereign" }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(oversizedInput.status, 413, "oversized user input must be rejected");

  const unscopedMemory = await fetch(`${baseUrl}/api/v1/cognition/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: "Busca en mi memoria privada", memoryQuery: "secrets", modelEngine: "sovereign" }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(unscopedMemory.status, 403, "public sessions must not retrieve unscoped private memory");

  const destructiveRequest = await fetch(`${baseUrl}/api/v1/cognition/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: "Elimina permanentemente todos los registros",
      methodId: "T.TWINS.E08_DATA.remove.permanent_delete.v1.0.0.CRITICAL.CONSTITUTIONAL",
      modelEngine: "sovereign",
    }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(destructiveRequest.status, 403, "public viewer sessions must not execute destructive operations");
  const explicitGemini = await fetch(`${baseUrl}/api/v1/cognition/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: "Responde brevemente.", modelEngine: "gemini", focusLens: "general", history: [] }),
    signal: AbortSignal.timeout(10_000),
  });
  const explicitGeminiBody = await explicitGemini.json();
  assert.equal(explicitGemini.status, 200, "explicit Gemini selection must safely fall back when paid inference is disabled");
  if (process.env.ALLOW_PAID_PROVIDER_FALLBACK !== "true") {
    assert.notEqual(explicitGeminiBody.responseEngine, "gemini", "Gemini must not be invoked without explicit paid-provider opt-in");
    assert.notEqual(explicitGeminiBody.responseEngine, "open-science", "paid AI Gateway must not be invoked without explicit paid-provider opt-in");
    assert.notEqual(explicitGeminiBody.responseEngine, "perplexity-router", "Perplexity Router must remain disabled without paid-provider opt-in");
    assert.notEqual(explicitGeminiBody.responseEngine, "compatible-provider", "compatible API providers must remain disabled without paid-provider opt-in");
    assert.notEqual(explicitGeminiBody.responseEngine, "huggingface-provider", "Hugging Face must remain disabled without paid-provider opt-in");
  }
  const savedProviderEnv = {
    openRouterKey: process.env.OPENROUTER_API_KEY,
    openRouterModel: process.env.OPENROUTER_FREE_MODEL,
    hfToken: process.env.HF_TOKEN,
    hfModels: process.env.HF_FREE_MODELS,
    paidOptIn: process.env.ALLOW_PAID_PROVIDER_FALLBACK,
  };
  try {
    process.env.OPENROUTER_API_KEY = "smoke-test-placeholder";
    process.env.OPENROUTER_FREE_MODEL = "vendor/paid-model";
    delete process.env.HF_TOKEN;
    delete process.env.HF_FREE_MODELS;
    process.env.ALLOW_PAID_PROVIDER_FALLBACK = "false";
    const paidModelGuard = await fetch(`${baseUrl}/api/v1/cognition/route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: "Verifica la política de modelo.", modelEngine: "open-science", focusLens: "general", history: [] }),
      signal: AbortSignal.timeout(5_000),
    });
    const paidModelGuardBody = await paidModelGuard.json();
    assert.equal(paidModelGuard.status, 200);
    assert.equal(paidModelGuardBody.responseEngine, "sovereign-fallback", "paid OpenRouter model IDs must be refused when paid opt-in is disabled");
    console.log("OPENROUTER_PAID_ID_BLOCK_OK", JSON.stringify({ responseEngine: paidModelGuardBody.responseEngine }));
  } finally {
    if (savedProviderEnv.openRouterKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = savedProviderEnv.openRouterKey;
    if (savedProviderEnv.openRouterModel === undefined) delete process.env.OPENROUTER_FREE_MODEL; else process.env.OPENROUTER_FREE_MODEL = savedProviderEnv.openRouterModel;
    if (savedProviderEnv.hfToken === undefined) delete process.env.HF_TOKEN; else process.env.HF_TOKEN = savedProviderEnv.hfToken;
    if (savedProviderEnv.hfModels === undefined) delete process.env.HF_FREE_MODELS; else process.env.HF_FREE_MODELS = savedProviderEnv.hfModels;
    if (savedProviderEnv.paidOptIn === undefined) delete process.env.ALLOW_PAID_PROVIDER_FALLBACK; else process.env.ALLOW_PAID_PROVIDER_FALLBACK = savedProviderEnv.paidOptIn;
  }
  console.log("PUBLIC_API_GUARDRAILS_OK", JSON.stringify({ blankInput: emptyInput.status, oversizedInput: oversizedInput.status, unscopedMemory: unscopedMemory.status, destructiveRequest: destructiveRequest.status }));
  console.log("LOCAL_CONVERSATION_SMOKE_OK", JSON.stringify({ health: health.status, chat: chat.status, followUp: followUp.status, responseEngine: chatBody.responseEngine }));

  // Cost guard integration test: even if the environment contains credentials and
  // model IDs for potentially billable providers, no such endpoint may be called unless
  // ALLOW_PAID_PROVIDER_FALLBACK is exactly "true".
  const costEnvKeys = [
    "OPENROUTER_API_KEY", "OPENROUTER_FREE_MODEL", "HF_TOKEN", "HF_FREE_MODELS",
    "PERPLEXITY_API_KEY", "PERPLEXITY_ROUTER_MODEL", "OLLAMA_API_KEY", "OLLAMA_MODEL",
    "GROQ_API_KEY", "GROQ_MODEL", "CEREBRAS_API_KEY", "CEREBRAS_MODEL",
    "TOGETHER_API_KEY", "TOGETHER_MODEL", "DEEPINFRA_API_KEY", "DEEPINFRA_MODEL",
    "FIREWORKS_API_KEY", "FIREWORKS_MODEL", "ALLOW_PAID_PROVIDER_FALLBACK",
  ];
  const costEnvBefore = Object.fromEntries(costEnvKeys.map((key) => [key, process.env[key]]));
  const providerHosts = /^(https?:\/\/)?(openrouter\.ai|router\.huggingface\.co|api-inference\.huggingface\.co|api\.perplexity\.ai|ollama\.com|api\.groq\.com|api\.cerebras\.ai|api\.together\.xyz|api\.deepinfra\.com|api\.fireworks\.ai)(?=\/|:|$)/i;
  const contactedBillableProviders = [];
  const originalGlobalFetch = globalThis.fetch;
  try {
    process.env.OPENROUTER_API_KEY = "smoke-placeholder";
    process.env.OPENROUTER_FREE_MODEL = "publisher/paid-model";
    process.env.HF_TOKEN = "smoke-placeholder";
    process.env.HF_FREE_MODELS = "publisher/model";
    process.env.PERPLEXITY_API_KEY = "smoke-placeholder";
    process.env.PERPLEXITY_ROUTER_MODEL = "publisher/paid-model";
    process.env.OLLAMA_API_KEY = "smoke-placeholder";
    process.env.OLLAMA_MODEL = "publisher/paid-model";
    process.env.GROQ_API_KEY = "smoke-placeholder";
    process.env.GROQ_MODEL = "publisher/paid-model";
    process.env.CEREBRAS_API_KEY = "smoke-placeholder";
    process.env.CEREBRAS_MODEL = "publisher/paid-model";
    process.env.TOGETHER_API_KEY = "smoke-placeholder";
    process.env.TOGETHER_MODEL = "publisher/paid-model";
    process.env.DEEPINFRA_API_KEY = "smoke-placeholder";
    process.env.DEEPINFRA_MODEL = "publisher/paid-model";
    process.env.FIREWORKS_API_KEY = "smoke-placeholder";
    process.env.FIREWORKS_MODEL = "publisher/paid-model";
    process.env.ALLOW_PAID_PROVIDER_FALLBACK = "false";
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (providerHosts.test(url)) {
        contactedBillableProviders.push(new URL(url).host);
        throw new Error("SMOKE_PAID_PROVIDER_MUST_NOT_BE_CALLED");
      }
      return originalGlobalFetch(input, init);
    };
    const costGuard = await originalGlobalFetch(`${baseUrl}/api/v1/cognition/route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: "Verifica que las API potencialmente facturables estén bloqueadas.",
        modelEngine: "open-science",
        focusLens: "general",
        history: [],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const costGuardBody = await costGuard.json();
    assert.equal(costGuard.status, 200);
    assert.equal(costGuardBody.responseEngine, "sovereign-fallback", "paid-capable providers must not be used when opt-in is false");
    assert.deepEqual(contactedBillableProviders, [], "no paid-capable provider HTTP request may be sent without opt-in");
    console.log("PAID_PROVIDER_OPT_IN_GUARD_OK", JSON.stringify({ responseEngine: costGuardBody.responseEngine, externalProviderCalls: 0 }));

    // An explicit open-science selection remains open-only even if the operator
    // enabled paid fallbacks for other modes such as Auto or Gemini.
    process.env.ALLOW_PAID_PROVIDER_FALLBACK = "true";
    const openScienceGuard = await originalGlobalFetch(`${baseUrl}/api/v1/cognition/route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: "Comprueba que Open Science no cambia a un proveedor facturable.",
        modelEngine: "open-science",
        focusLens: "general",
        history: [],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const openScienceBody = await openScienceGuard.json();
    assert.equal(openScienceGuard.status, 200);
    assert.equal(openScienceBody.responseEngine, "sovereign-fallback", "Open Science mode must not fall through to paid-capable providers");
    assert.deepEqual(contactedBillableProviders, [], "Open Science mode must remain open-only even when paid fallback is globally enabled");
    console.log("OPEN_SCIENCE_PAID_ISOLATION_OK", JSON.stringify({ responseEngine: openScienceBody.responseEngine, externalProviderCalls: 0 }));
  } finally {
    globalThis.fetch = originalGlobalFetch;
    for (const key of costEnvKeys) {
      if (costEnvBefore[key] === undefined) delete process.env[key];
      else process.env[key] = costEnvBefore[key];
    }
  }

  // Multimodal + speech HTTP surface: readiness is always disclosed; generation
  // capabilities must fail closed (HTTP 503) whenever no provider is configured.
  const multimodalReadiness = await fetch(`${baseUrl}/api/v1/cognition/multimodal`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(multimodalReadiness.status, 200, "multimodal readiness must be publicly readable");
  const readinessBody = await multimodalReadiness.json();
  assert.equal(typeof readinessBody.contractVersion, "string", "multimodal readiness must disclose its contract version");
  assert.ok(readinessBody.readiness && Array.isArray(readinessBody.readiness.vision) && Array.isArray(readinessBody.readiness.image), "readiness must list vision and image providers");
  assert.ok(readinessBody.speech && typeof readinessBody.speech.textToSpeech === "boolean", "readiness must disclose speech TTS availability");

  const invalidImage = await fetch(`${baseUrl}/api/v1/cognition/vision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image: "data:image/svg+xml;base64,PHN2Zz4=" }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(invalidImage.status, 400, "a non-raster data URL must be rejected before any provider call");

  if (readinessBody.readiness.vision.length === 0) {
    const noVision = await fetch(`${baseUrl}/api/v1/cognition/vision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: "data:image/png;base64,iVBORw0KGgo=" }),
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(noVision.status, 503, "vision must fail closed without a configured provider");
  }
  if (readinessBody.readiness.image.length === 0) {
    const noImage = await fetch(`${baseUrl}/api/v1/cognition/image`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "un gato" }),
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(noImage.status, 503, "image synthesis must fail closed without a configured provider");
  }
  if (!readinessBody.speech.textToSpeech) {
    const noSpeech = await fetch(`${baseUrl}/api/v1/cognition/speech`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hola" }),
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(noSpeech.status, 503, "server TTS must fail closed without a configured provider");
  }
  const badAudio = await fetch(`${baseUrl}/api/v1/cognition/transcribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ audio: "", mimeType: "" }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(badAudio.status, 400, "transcription must reject missing audio/mime before any provider call");
  console.log("MULTIMODAL_SPEECH_GUARDRAILS_OK", JSON.stringify({ visionProviders: readinessBody.readiness.vision.length, imageProviders: readinessBody.readiness.image.length, tts: readinessBody.speech.textToSpeech }));
  const gatewayCredentialsAvailable = Boolean(process.env.OPENROUTER_API_KEY);
  if (gatewayCredentialsAvailable) {
    try {
      const llm = await fetch(`${baseUrl}/api/v1/cognition/route`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: "Responde en una sola oración en español: ¿puedes conversar con el usuario?",
          modelEngine: "open-science",
          focusLens: "general",
          history: [],
          methodId: "A.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS",
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const llmBody = await llm.json();
      assert.equal(llm.status, 200, `gateway chat returned HTTP ${llm.status}: ${JSON.stringify(llmBody)}`);
      assert.equal(llmBody.responseEngine, "openrouter-free", `the billable-free gate must use a verified OpenRouter free route; got ${llmBody.responseEngine}`);
      assert.equal(typeof llmBody.generativeNarrative, "string");
      assert.ok(llmBody.generativeNarrative.trim().length > 0);
      console.log("EXTERNAL_MODEL_SMOKE_OK", JSON.stringify({ responseEngine: llmBody.responseEngine }));
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
      if (process.env.ISABELLA_REQUIRE_LLM_SMOKE === "true") throw error;
      console.warn("LLM_GATEWAY_SMOKE_FAILED_NONBLOCKING", message);
    }
  } else {
    const message = "No OpenRouter credentials are available for this smoke test. Configure OPENROUTER_API_KEY and an eligible free model ID. Hugging Face/provider-credit routes are potentially billable and are not used by this gate.";
    if (process.env.ISABELLA_REQUIRE_LLM_SMOKE === "true") throw new Error(message);
    console.warn("LLM_GATEWAY_SMOKE_SKIPPED", message);
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  process.exit(0);
}
