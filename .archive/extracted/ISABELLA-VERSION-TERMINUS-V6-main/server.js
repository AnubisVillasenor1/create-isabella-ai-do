// Vercel Express entrypoint: delegate to the bundled Node ESM application.
// Import Express here so framework detection sees the framework at the entrypoint.
// The build script must generate dist/server.js before Vercel packages this entrypoint.
import express from "express";
import app from "./dist/server.js";

void express;
export default app;
