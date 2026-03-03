import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { CustomNodeManifest } from '@garage-engine/shared';
import { db, schema } from '../../db/index.js';
import { registerNode, unregisterNode, BUILTIN_NODE_TYPES } from '../registry.js';
import { createCustomNodeRunner } from './custom-node-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFESTS_DIR = path.resolve(__dirname, '../manifests');

// Track currently loaded custom node IDs for reload
let loadedCustomNodeIds: Set<string> = new Set();

/**
 * Load built-in manifest JSON files from the manifests directory.
 */
function loadBuiltinManifests(): CustomNodeManifest[] {
  const manifests: CustomNodeManifest[] = [];

  if (!fs.existsSync(MANIFESTS_DIR)) {
    return manifests;
  }

  const files = fs.readdirSync(MANIFESTS_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(MANIFESTS_DIR, file), 'utf-8');
      const manifest = JSON.parse(content) as CustomNodeManifest;
      manifests.push(manifest);
    } catch (error) {
      console.error(`Failed to load manifest ${file}:`, error);
    }
  }

  return manifests;
}

/**
 * Load user-created custom nodes from the database.
 */
function loadDbManifests(): CustomNodeManifest[] {
  const rows = db
    .select()
    .from(schema.customNodes)
    .where(eq(schema.customNodes.enabled, true))
    .all();

  return rows.map((row) => row.manifest);
}

/**
 * Load all custom nodes (built-in files + DB) and register them.
 * Called at startup after initializeDatabase().
 */
export function loadCustomNodes(): void {
  const builtinManifests = loadBuiltinManifests();
  const dbManifests = loadDbManifests();

  // Merge: DB manifests override built-in if same ID
  const manifestMap = new Map<string, CustomNodeManifest>();
  for (const m of builtinManifests) {
    manifestMap.set(m.id, m);
  }
  for (const m of dbManifests) {
    manifestMap.set(m.id, m);
  }

  for (const [id, manifest] of manifestMap) {
    if (BUILTIN_NODE_TYPES.has(id)) {
      console.warn(`Custom node ID "${id}" conflicts with a built-in node type, skipping.`);
      continue;
    }

    const runner = createCustomNodeRunner(manifest);
    registerNode(id, runner);
    loadedCustomNodeIds.add(id);
  }

  console.log(`Loaded ${loadedCustomNodeIds.size} custom node(s): ${[...loadedCustomNodeIds].join(', ') || 'none'}`);
}

/**
 * Reload custom nodes after CRUD operations.
 */
export function reloadCustomNodes(): void {
  // Unregister all previously loaded custom nodes
  for (const id of loadedCustomNodeIds) {
    unregisterNode(id);
  }
  loadedCustomNodeIds = new Set();

  // Re-load everything
  loadCustomNodes();
}

/**
 * Get all custom node manifests (for API listing).
 * Merges built-in files + DB rows.
 */
export function getAllCustomNodeManifests(): Array<CustomNodeManifest & { isBuiltin: boolean; enabled: boolean }> {
  const builtinManifests = loadBuiltinManifests();
  const dbRows = db.select().from(schema.customNodes).all();

  const result: Array<CustomNodeManifest & { isBuiltin: boolean; enabled: boolean }> = [];
  const dbIds = new Set(dbRows.map((r) => r.id));

  // Add built-in manifests that are NOT overridden in DB
  for (const m of builtinManifests) {
    if (!dbIds.has(m.id)) {
      result.push({ ...m, isBuiltin: true, enabled: true });
    }
  }

  // Add all DB rows
  for (const row of dbRows) {
    result.push({ ...row.manifest, isBuiltin: row.isBuiltin ?? false, enabled: row.enabled ?? true });
  }

  return result;
}
