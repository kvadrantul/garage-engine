// Custom Nodes API Routes

import { Router, type Router as RouterType } from 'express';
import { eq } from 'drizzle-orm';
import type { CustomNodeManifest } from '@garage-engine/shared';
import { db, schema } from '../db/index.js';
import { BUILTIN_NODE_TYPES } from '../nodes/registry.js';
import { reloadCustomNodes, getAllCustomNodeManifests } from '../nodes/custom/custom-node-loader.js';
import { createCustomNodeRunner } from '../nodes/custom/custom-node-runner.js';

export const customNodesRouter: RouterType = Router();

// List all custom nodes (built-in files + DB)
customNodesRouter.get('/', async (_req, res) => {
  try {
    const manifests = getAllCustomNodeManifests();
    res.json({ data: manifests });
  } catch (error) {
    console.error('Error listing custom nodes:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list custom nodes' } });
  }
});

// Get custom node by ID
customNodesRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const all = getAllCustomNodeManifests();
    const node = all.find((n) => n.id === id);

    if (!node) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Custom node not found' } });
    }

    res.json(node);
  } catch (error) {
    console.error('Error getting custom node:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get custom node' } });
  }
});

// Create custom node
customNodesRouter.post('/', async (req, res) => {
  try {
    const manifest = req.body as CustomNodeManifest;

    if (!manifest.id || !manifest.name || !manifest.code) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'id, name, and code are required' },
      });
    }

    // Check for collision with built-in node types
    if (BUILTIN_NODE_TYPES.has(manifest.id)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: `ID "${manifest.id}" conflicts with a built-in node type` },
      });
    }

    // Check for duplicate ID
    const existing = await db
      .select()
      .from(schema.customNodes)
      .where(eq(schema.customNodes.id, manifest.id))
      .get();

    if (existing) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: `Custom node with ID "${manifest.id}" already exists` },
      });
    }

    const now = new Date();
    const result = await db
      .insert(schema.customNodes)
      .values({
        id: manifest.id,
        manifest,
        enabled: true,
        isBuiltin: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    reloadCustomNodes();

    res.status(201).json({ ...result.manifest, isBuiltin: false, enabled: true });
  } catch (error) {
    console.error('Error creating custom node:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create custom node' } });
  }
});

// Update custom node
customNodesRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const manifest = req.body as CustomNodeManifest;

    const existing = await db
      .select()
      .from(schema.customNodes)
      .where(eq(schema.customNodes.id, id))
      .get();

    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Custom node not found' } });
    }

    const result = await db
      .update(schema.customNodes)
      .set({
        manifest: { ...manifest, id },
        updatedAt: new Date(),
      })
      .where(eq(schema.customNodes.id, id))
      .returning()
      .get();

    reloadCustomNodes();

    res.json({ ...result.manifest, isBuiltin: result.isBuiltin ?? false, enabled: result.enabled ?? true });
  } catch (error) {
    console.error('Error updating custom node:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update custom node' } });
  }
});

// Delete custom node
customNodesRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db
      .select()
      .from(schema.customNodes)
      .where(eq(schema.customNodes.id, id))
      .get();

    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Custom node not found' } });
    }

    if (existing.isBuiltin) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Cannot delete built-in custom nodes' },
      });
    }

    await db.delete(schema.customNodes).where(eq(schema.customNodes.id, id));

    reloadCustomNodes();

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting custom node:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete custom node' } });
  }
});

// Toggle enabled state
customNodesRouter.post('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db
      .select()
      .from(schema.customNodes)
      .where(eq(schema.customNodes.id, id))
      .get();

    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Custom node not found' } });
    }

    const result = await db
      .update(schema.customNodes)
      .set({ enabled: !existing.enabled, updatedAt: new Date() })
      .where(eq(schema.customNodes.id, id))
      .returning()
      .get();

    reloadCustomNodes();

    res.json({ id: result.id, enabled: result.enabled });
  } catch (error) {
    console.error('Error toggling custom node:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle custom node' } });
  }
});

// Test custom node execution
customNodesRouter.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { input, config } = req.body as { input: unknown; config: Record<string, unknown> };

    // Find the manifest
    const all = getAllCustomNodeManifests();
    const manifestEntry = all.find((n) => n.id === id);

    if (!manifestEntry) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Custom node not found' } });
    }

    // Create a temporary runner and execute
    const runner = createCustomNodeRunner(manifestEntry);
    const result = await runner.execute({
      node: {
        id: 'test',
        type: id,
        position: { x: 0, y: 0 },
        data: { config: config || {} },
      },
      inputs: { main: [input ?? null] },
      execution: { id: 'test', workflowId: 'test' },
      helpers: {
        httpRequest: async () => { throw new Error('httpRequest not available in test mode'); },
        getCredential: async () => { throw new Error('getCredential not available in test mode'); },
      },
      emit: () => {},
    });

    res.json({ result: result.data });
  } catch (error) {
    console.error('Error testing custom node:', error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: { code: 'EXECUTION_ERROR', message } });
  }
});
