// Intentionally empty — Metro's default sourceExts order is
// ['ts', 'tsx', 'js', 'jsx', 'json'], so when both `index.ts` and
// `index.tsx` exist for the same module path, `index.ts` wins. The real
// implementation lives in `./index.ts` and `./LanguageProvider.tsx`.
// This placeholder stays to avoid a stale .tsx shadowing any future
// editor/IDE "open related file" behaviour. Safe to delete.
export {};
