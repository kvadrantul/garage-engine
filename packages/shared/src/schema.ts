// Database Schema for Orchestrator
// Using Drizzle ORM with SQLite

import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================
// Helper for generating IDs
// ============================================
const generateId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}${random}`;
};

// ============================================
// WORKFLOWS
// ============================================
export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey().$defaultFn(generateId),
  name: text('name').notNull(),
  description: text('description'),
  definition: text('definition', { mode: 'json' }).notNull().$type<WorkflowDefinition>(),
  settings: text('settings', { mode: 'json' }).$type<WorkflowSettings>(),
  active: integer('active', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================
// EXECUTIONS
// ============================================
export const executions = sqliteTable('executions', {
  id: text('id').primaryKey().$defaultFn(generateId),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['pending', 'running', 'waiting_hitl', 'completed', 'failed', 'stopped'],
  }).notNull().default('pending'),
  triggerType: text('trigger_type', { enum: ['manual', 'webhook', 'schedule'] }).notNull(),
  triggerData: text('trigger_data', { mode: 'json' }),
  error: text('error'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================
// EXECUTION NODES
// ============================================
export const executionNodes = sqliteTable('execution_nodes', {
  id: text('id').primaryKey().$defaultFn(generateId),
  executionId: text('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'error', 'skipped', 'waiting_hitl'],
  }).notNull().default('pending'),
  inputData: text('input_data', { mode: 'json' }),
  outputData: text('output_data', { mode: 'json' }),
  error: text('error'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
});

// ============================================
// CREDENTIALS
// ============================================
export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey().$defaultFn(generateId),
  name: text('name').notNull(),
  type: text('type').notNull(),
  data: blob('data', { mode: 'buffer' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================
// WEBHOOKS
// ============================================
export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey().$defaultFn(generateId),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  path: text('path').notNull().unique(),
  method: text('method', { enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL'] }).default('POST'),
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================
// HITL REQUESTS
// ============================================
export const hitlRequests = sqliteTable('hitl_requests', {
  id: text('id').primaryKey().$defaultFn(generateId),
  executionId: text('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  type: text('type', { enum: ['approval', 'input', 'selection'] }).notNull(),
  requestData: text('request_data', { mode: 'json' }).notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'timeout'] }).default('pending'),
  responseData: text('response_data', { mode: 'json' }),
  respondedAt: integer('responded_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================
// RELATIONS
// ============================================
export const workflowsRelations = relations(workflows, ({ many }) => ({
  executions: many(executions),
  webhooks: many(webhooks),
}));

export const executionsRelations = relations(executions, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [executions.workflowId],
    references: [workflows.id],
  }),
  nodes: many(executionNodes),
  hitlRequests: many(hitlRequests),
}));

export const executionNodesRelations = relations(executionNodes, ({ one }) => ({
  execution: one(executions, {
    fields: [executionNodes.executionId],
    references: [executions.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  workflow: one(workflows, {
    fields: [webhooks.workflowId],
    references: [workflows.id],
  }),
}));

export const hitlRequestsRelations = relations(hitlRequests, ({ one }) => ({
  execution: one(executions, {
    fields: [hitlRequests.executionId],
    references: [executions.id],
  }),
}));

// ============================================
// CUSTOM NODES
// ============================================
export const customNodes = sqliteTable('custom_nodes', {
  id: text('id').primaryKey(),
  manifest: text('manifest', { mode: 'json' }).$type<CustomNodeManifest>().notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================
// TYPE IMPORTS (from types.ts)
// ============================================
import type { WorkflowDefinition, WorkflowSettings, CustomNodeManifest } from './types';
