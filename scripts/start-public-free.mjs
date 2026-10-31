#!/usr/bin/env node
/**
 * Explicit operator opt-in for the keyless external provider.
 * This is an operator action, not a silent default: it only sets non-secret
 * defaults for this process and states the data-egress disclosure up front.
 *
 * Usage:
 *   npm run start:free      -> builds dist and serves it
 *   npm run dev:free        -> runs src/server.ts through tsx
 */
import process from 'node:process';

const useSource = process.argv.includes('--src');
process.env.ISABELLA_KEYLESS_FREE_PROVIDER ??= 'llm7,pollinations';
process.env.KEYLESS_FREE_PROVIDER_TIMEOUT_MS ??= '30000';
process.env.CHAT_CHAIN_BUDGET_MS ??= '45000';
process.env.ISABELLA_KEYLESS_TTS ??= 'google';
process.env.ISABELLA_KEYLESS_TTS_MAX_CHARS ??= '1200';

console.warn(
  '[Isabella] Free external inference ENABLED for this process: prompts and bounded history may be sent to ' +
    process.env.ISABELLA_KEYLESS_FREE_PROVIDER +
    ' in the configured order. Responses are disclosed as "keyless-free". ' +
    'Set ISABELLA_KEYLESS_FREE_PROVIDER=off to disable.'
);
console.warn(
  '[Isabella] Keyless neural voice ENABLED: spoken replies may be sent to the configured TTS provider. ' +
    'Set ISABELLA_KEYLESS_TTS=off to disable.'
);

await import(useSource ? '../src/server.ts' : '../dist/server.js');
