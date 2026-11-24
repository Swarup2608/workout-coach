// Vercel function entry. Plain JavaScript on purpose: Vercel's Node builder compiles TypeScript entries with
// the TypeScript compiler API, which TypeScript 7 (native) doesn't ship, so it fails with TS2688.
// The real handler is src/vercel.ts, bundled by `npm run build:vercel` (esbuild) to dist/vercel.js.
export { default } from "../dist/vercel.js";
