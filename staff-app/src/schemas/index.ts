/**
 * Schemas barrel. Importing anything from `../schemas` triggers `setup.ts`
 * (which configures the global Russian error map). Always import from
 * here, never directly from sub-files, so the setup runs.
 */
import './setup';

export * from './common';
