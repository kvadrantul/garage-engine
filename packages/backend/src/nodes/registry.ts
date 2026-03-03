import type { NodeRunner } from '@garage-engine/shared';
import { manualTrigger } from './triggers/manual.js';
import { webhookTrigger } from './triggers/webhook.js';
import { scheduleTrigger } from './triggers/schedule.js';
import { httpRequestNode } from './actions/http-request.js';
import { codeNode } from './actions/code.js';
import { setNode } from './actions/set.js';
import { ifNode } from './logic/if.js';
import { switchNode } from './logic/switch.js';
import { mergeNode } from './logic/merge.js';
import { agentNode } from './ai/agent.js';
import { hitlNode } from './ai/hitl.js';

export const nodeRegistry: Record<string, NodeRunner> = {
  'manual-trigger': manualTrigger,
  'webhook-trigger': webhookTrigger,
  'schedule-trigger': scheduleTrigger,
  'http-request': httpRequestNode,
  'code': codeNode,
  'set': setNode,
  'if': ifNode,
  'switch': switchNode,
  'merge': mergeNode,
  'agent': agentNode,
  'hitl': hitlNode,
};

// Built-in node type IDs (cannot be used for custom nodes)
export const BUILTIN_NODE_TYPES = new Set(Object.keys(nodeRegistry));

export function registerNode(type: string, runner: NodeRunner) {
  nodeRegistry[type] = runner;
}

export function unregisterNode(type: string) {
  delete nodeRegistry[type];
}
