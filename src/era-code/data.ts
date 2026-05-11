/**
 * Load GB/T era data from the extracted JSON file.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { EraData } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_PATH = join(__dirname, '..', '..', 'library', 'register', 'era-data.json')

let _cached: EraData | null = null

export function loadEraData(path?: string): EraData {
  if (_cached && !path) return _cached
  const dataPath = path || DEFAULT_DATA_PATH
  const raw = readFileSync(dataPath, 'utf-8')
  _cached = JSON.parse(raw) as EraData
  return _cached
}
