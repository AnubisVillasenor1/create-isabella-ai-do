// Vercel detects this root entrypoint before api/index.js. Delegate to the
// compiled application so Node never imports TypeScript source directly.
import app from "./dist/server.js";

export default app;
