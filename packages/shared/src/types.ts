// ============================================
// WORKFLOW TYPES
// ============================================

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
  settings?: WorkflowSettings & { variables?: Record<string, unknown> };
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export type NodeType =
  | 'webhook-trigger'
  | 'schedule-trigger'
  | 'manual-trigger'
  | 'http-request'
  | 'code'
  | 'if'
  | 'switch'
  | 'merge'
  | 'split'
  | 'set'
  | 'agent'
  | 'hitl'
  | (string & {}); // allow custom node type strings

export interface NodeData {
  name?: string;
  config: Record<string, unknown>;
  credentials?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  label?: string;
}

export interface WorkflowSettings {
  errorHandling?: 'stop' | 'continue';
  timeout?: number;
  retryOnFail?: boolean;
  maxRetries?: number;
}

// ============================================
// EXECUTION TYPES
// ============================================

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'waiting_hitl'
  | 'completed'
  | 'failed'
  | 'stopped';

export type NodeExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'error'
  | 'skipped'
  | 'waiting_hitl';

export type TriggerType = 'manual' | 'webhook' | 'schedule';

export interface ExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  error?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: NodeExecutionStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
}

// ============================================
// HITL TYPES
// ============================================

export type HITLType = 'approval' | 'input' | 'selection';

export interface HITLRequest {
  type: HITLType;
  message: string;
  details?: string;
  fields?: HITLField[];
  options?: HITLOption[];
  timeoutSeconds?: number;
}

export interface HITLField {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
  label: string;
  required?: boolean;
  default?: unknown;
  options?: { label: string; value: unknown }[];
}

export interface HITLOption {
  label: string;
  value: string;
  description?: string;
}

export interface HITLResponse {
  status: 'approved' | 'rejected' | 'timeout';
  responseData?: unknown;
}

// ============================================
// CREDENTIAL TYPES
// ============================================

export type CredentialType =
  | 'api_key'
  | 'bearer_token'
  | 'basic_auth'
  | 'oauth2'
  | 'header_auth';

export interface CredentialData {
  type: CredentialType;
  apiKey?: string;
  headerName?: string;
  prefix?: string;
  username?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

// ============================================
// NODE RUNNER TYPES
// ============================================

export interface NodeContext {
  node: WorkflowNode;
  inputs: {
    main: unknown[];
  };
  credentials?: Record<string, unknown>;
  execution: {
    id: string;
    workflowId: string;
  };
  helpers: NodeHelpers;
  emit: (event: string, data: unknown) => void;
}

export interface NodeHelpers {
  httpRequest: (options: HttpRequestOptions) => Promise<HttpResponse>;
  getCredential: (name: string) => Promise<unknown>;
}

export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface NodeResult {
  data: unknown;
  waitForHitl?: HITLRequest;
  outputIndex?: number;
}

export interface NodeRunner {
  execute(context: NodeContext): Promise<NodeResult>;
}

// ============================================
// API TYPES
// ============================================

export interface ApiResponse<T> {
  data: T;
  total?: number;
  limit?: number;
  offset?: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================
// WEBSOCKET TYPES
// ============================================

export type WSMessageType =
  | 'execution:started'
  | 'execution:node:started'
  | 'execution:node:completed'
  | 'execution:node:error'
  | 'execution:completed'
  | 'execution:failed'
  | 'hitl:required'
  | 'hitl:resolved';

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
}

export interface WSClientMessage {
  type: 'subscribe:execution' | 'unsubscribe:execution';
  executionId: string;
}

// ============================================
// NODE DEFINITIONS (for UI)
// ============================================

export type NodeCategory = 'triggers' | 'actions' | 'logic' | 'ai' | 'utility';

export interface NodeDefinition {
  type: NodeType;
  category: NodeCategory;
  name: string;
  description: string;
  icon: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  properties: PropertyDefinition[];
  credentials?: { type: string; required: boolean }[];
}

export interface PortDefinition {
  name: string;
  type: 'main' | 'conditional';
  label?: string;
}

export interface PropertyDefinition {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'json' | 'code' | 'expression';
  default?: unknown;
  required?: boolean;
  description?: string;
  options?: { label: string; value: unknown }[];
  placeholder?: string;
  displayOptions?: {
    show?: Record<string, unknown[]>;
    hide?: Record<string, unknown[]>;
  };
}

// ============================================
// CUSTOM NODE TYPES
// ============================================

export interface CustomNodeManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  category: NodeCategory;
  icon: string;
  color: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  properties: PropertyDefinition[];
  code: string;
}
