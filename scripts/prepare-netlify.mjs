// state: draft | engine-generated
import { cp, mkdir } from 'node:fs/promises';

// Serve media through the CDN: large video responses exceed function payload limits.
await mkdir('netlify/public/assets', { recursive: true });
await cp('src/assets/video', 'netlify/public/assets/video', { recursive: true });
