/**
 * Hanology Library — public API.
 *
 * Re-exports everything from the sub-modules.
 * This is the single entry point for scripts and site code.
 *
 * Usage:
 *   import { loadLibrary, buildRegistries, checkCorrespondence } from '../src/library/index.js'
 */

export type { PersonEntity, DynastyEntity, BioSource, LibraryData, CorrespondenceResult } from './types.js'
export { loadLibrary } from './loader.js'
export { buildRegistries } from './registry.js'
export { checkCorrespondence } from './correspondence.js'
