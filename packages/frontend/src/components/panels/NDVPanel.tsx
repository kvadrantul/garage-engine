// Node Detail View (NDV) Panel - node inspector
// Shows node configuration and execution input/output

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Node } from 'reactflow';
import { X, Settings, Play, ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';
import { credentialsApi } from '@/api/client';
import { customNodesApi } from '@/api/client';
import { DynamicPropertyForm } from '@/components/nodes/DynamicPropertyForm';

interface NDVPanelProps {
  nodeId: string;
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onClose: () => void;
  onDelete?: () => void;
}

type TabType = 'settings' | 'output';

export function NDVPanel({ nodeId, nodes, setNodes, onClose, onDelete }: NDVPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const node = nodes.find((n) => n.id === nodeId);
  
  if (!node) return null;

  const executionStatus = node.data.executionStatus as string | undefined;
  const executionOutput = node.data.executionOutput;
  const executionError = node.data.executionError;
  const executionDuration = node.data.executionDuration as number | undefined;

  const hasOutput = executionStatus === 'completed' || executionStatus === 'error';

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <NodeStatusBadge status={executionStatus} />
          <h2 className="font-semibold text-foreground truncate max-w-[200px]">
            {node.data.name || node.type}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              onClick={() => {
                if (confirm('Delete this node?')) {
                  onDelete();
                }
              }}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors text-muted-foreground hover:text-red-600"
              title="Delete node"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        <TabButton
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          icon={<Settings size={14} />}
          label="Settings"
        />
        <TabButton
          active={activeTab === 'output'}
          onClick={() => setActiveTab('output')}
          icon={<Play size={14} />}
          label="Output"
          badge={hasOutput}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'settings' ? (
          <SettingsTab node={node} nodeId={nodeId} setNodes={setNodes} />
        ) : (
          <OutputTab 
            node={node}
            executionStatus={executionStatus}
            executionOutput={executionOutput}
            executionError={executionError}
            executionDuration={executionDuration}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  badge 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
        active 
          ? 'text-primary border-b-2 border-primary -mb-px' 
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
      {badge && (
        <span className="w-2 h-2 bg-green-500 rounded-full" />
      )}
    </button>
  );
}

function NodeStatusBadge({ status }: { status: string | undefined }) {
  switch (status) {
    case 'running':
      return <Loader2 size={16} className="text-blue-500 animate-spin" />;
    case 'completed':
      return <CheckCircle size={16} className="text-green-500" />;
    case 'error':
      return <XCircle size={16} className="text-red-500" />;
    case 'waiting_hitl':
      return <Clock size={16} className="text-amber-500" />;
    default:
      return null;
  }
}

// Settings Tab - Node Configuration
function SettingsTab({ 
  node, 
  nodeId, 
  setNodes 
}: { 
  node: Node; 
  nodeId: string; 
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}) {
  const updateNodeData = (newData: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: newData } : n))
    );
  };

  const handleNameChange = (name: string) => {
    updateNodeData({ ...node.data, name });
  };

  const handleConfigChange = (key: string, value: any) => {
    updateNodeData({
      ...node.data,
      config: { ...node.data.config, [key]: value },
    });
  };

  const inputClass = "w-full px-3 py-2 border border-input bg-background text-foreground rounded focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div className="p-4 space-y-4">
      {/* Node Type */}
      <div>
        <label className={labelClass}>Type</label>
        <div className="text-sm text-foreground bg-muted px-3 py-2 rounded">
          {node.type}
        </div>
      </div>

      {/* Node Name */}
      <div>
        <label className={labelClass}>Name</label>
        <input
          type="text"
          value={node.data.name || ''}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder={node.type}
          className={inputClass}
        />
      </div>

      {/* Node-specific config */}
      <NodeConfigForm type={node.type || ''} config={node.data.config} onChange={handleConfigChange} />
    </div>
  );
}

// Output Tab - Execution Results
function OutputTab({ 
  node,
  executionStatus,
  executionOutput,
  executionError,
  executionDuration
}: {
  node: Node;
  executionStatus: string | undefined;
  executionOutput: unknown;
  executionError: string | undefined;
  executionDuration: number | undefined;
}) {
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(true);

  if (!executionStatus || executionStatus === 'pending') {
    return (
      <div className="p-4 text-center">
        <div className="text-muted-foreground text-sm">
          No execution data yet.
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Run the workflow to see output here.
        </p>
      </div>
    );
  }

  if (executionStatus === 'running') {
    return (
      <div className="p-4 text-center">
        <Loader2 size={24} className="text-blue-500 animate-spin mx-auto mb-2" />
        <div className="text-sm text-foreground">Executing...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Execution Info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <NodeStatusBadge status={executionStatus} />
          <span className={executionStatus === 'error' ? 'text-red-500' : 'text-green-500'}>
            {executionStatus === 'error' ? 'Failed' : 'Success'}
          </span>
        </div>
        {executionDuration !== undefined && (
          <span className="text-muted-foreground">
            {executionDuration < 1000 
              ? `${executionDuration}ms` 
              : `${(executionDuration / 1000).toFixed(2)}s`}
          </span>
        )}
      </div>

      {/* Error Display */}
      {executionError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
          <div className="text-sm font-medium text-red-500 mb-1">Error</div>
          <div className="text-xs text-red-400 font-mono whitespace-pre-wrap">
            {executionError}
          </div>
        </div>
      )}

      {/* Input Section */}
      <DataSection
        title="Input"
        expanded={inputExpanded}
        onToggle={() => setInputExpanded(!inputExpanded)}
        data={node.data.executionInput}
      />

      {/* Output Section */}
      <DataSection
        title="Output"
        expanded={outputExpanded}
        onToggle={() => setOutputExpanded(!outputExpanded)}
        data={executionOutput}
      />
    </div>
  );
}

function DataSection({
  title,
  expanded,
  onToggle,
  data
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  data: unknown;
}) {
  const hasData = data !== undefined && data !== null;
  
  return (
    <div className="border border-border rounded overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {title}
        </div>
        {hasData && (
          <span className="text-xs text-muted-foreground">
            {Array.isArray(data) ? `${data.length} items` : 'Object'}
          </span>
        )}
      </button>
      {expanded && (
        <div className="p-3 bg-background">
          {hasData ? (
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <div className="text-xs text-muted-foreground">No data</div>
          )}
        </div>
      )}
    </div>
  );
}

// Node-specific configuration forms
function NodeConfigForm({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
}) {
  const inputClass = "w-full px-3 py-2 border border-input bg-background text-foreground rounded focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  // Fetch credentials for http-request nodes
  const { data: credentialsData } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialsApi.list(),
    enabled: type === 'http-request' || type === 'agent',
  });

  const credentials = credentialsData?.data || [];

  switch (type) {
    case 'http-request':
      return (
        <>
          <div>
            <label className={labelClass}>Credential</label>
            <select
              value={config.credentialId || ''}
              onChange={(e) => onChange('credentialId', e.target.value || undefined)}
              className={inputClass}
            >
              <option value="">No credential</option>
              {credentials.map((cred: any) => (
                <option key={cred.id} value={cred.id}>
                  {cred.name} ({cred.type})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Authentication for this request
            </p>
          </div>
          <div>
            <label className={labelClass}>Method</label>
            <select
              value={config.method || 'GET'}
              onChange={(e) => onChange('method', e.target.value)}
              className={inputClass}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>URL</label>
            <input
              type="text"
              value={config.url || ''}
              onChange={(e) => onChange('url', e.target.value)}
              placeholder="https://api.example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Headers (JSON)</label>
            <textarea
              value={config.headers ? JSON.stringify(config.headers, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onChange('headers', parsed);
                } catch {
                  // Invalid JSON, don't update
                }
              }}
              placeholder='{"Content-Type": "application/json"}'
              rows={3}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className={labelClass}>Body (JSON)</label>
            <textarea
              value={config.body ? JSON.stringify(config.body, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onChange('body', parsed);
                } catch {
                  onChange('body', e.target.value);
                }
              }}
              placeholder='{"key": "value"}'
              rows={4}
              className={`${inputClass} font-mono`}
            />
          </div>
        </>
      );

    case 'code':
      return (
        <div>
          <label className={labelClass}>JavaScript Code</label>
          <textarea
            value={config.code || ''}
            onChange={(e) => onChange('code', e.target.value)}
            placeholder="// Your JavaScript code here&#10;// Access input via $input&#10;// Set result via $result = ..."
            rows={12}
            className={`${inputClass} font-mono`}
          />
        </div>
      );

    case 'if':
      return (
        <>
          <div>
            <label className={labelClass}>Field Path</label>
            <input
              type="text"
              value={config.conditions?.[0]?.field || ''}
              onChange={(e) => onChange('conditions', [{ ...config.conditions?.[0], field: e.target.value }])}
              placeholder="data.value"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Operation</label>
            <select
              value={config.conditions?.[0]?.operation || 'equals'}
              onChange={(e) => onChange('conditions', [{ ...config.conditions?.[0], operation: e.target.value }])}
              className={inputClass}
            >
              <option value="equals">Equals</option>
              <option value="notEquals">Not Equals</option>
              <option value="contains">Contains</option>
              <option value="gt">Greater Than</option>
              <option value="lt">Less Than</option>
              <option value="isEmpty">Is Empty</option>
              <option value="isNotEmpty">Is Not Empty</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Value</label>
            <input
              type="text"
              value={config.conditions?.[0]?.value || ''}
              onChange={(e) => onChange('conditions', [{ ...config.conditions?.[0], value: e.target.value }])}
              placeholder="expected value"
              className={inputClass}
            />
          </div>
        </>
      );

    case 'set':
      return (
        <>
          <div>
            <label className={labelClass}>Values (JSON)</label>
            <textarea
              value={config.values ? JSON.stringify(config.values, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onChange('values', parsed);
                } catch {
                  // Invalid JSON
                }
              }}
              placeholder='{"key": "value"}'
              rows={4}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className={labelClass}>Mode</label>
            <select
              value={config.mode || 'set'}
              onChange={(e) => onChange('mode', e.target.value)}
              className={inputClass}
            >
              <option value="set">Set (merge)</option>
              <option value="append">Append (array)</option>
              <option value="remove">Remove (delete keys)</option>
            </select>
          </div>
        </>
      );

    case 'agent':
      return (
        <>
          <div>
            <label className={labelClass}>Credential</label>
            <select
              value={config.credentialId || ''}
              onChange={(e) => onChange('credentialId', e.target.value || undefined)}
              className={inputClass}
            >
              <option value="">No credential (use env vars)</option>
              {credentials.map((cred: any) => (
                <option key={cred.id} value={cred.id}>
                  {cred.name} ({cred.type})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              API key for AI provider
            </p>
          </div>
          <div>
            <label className={labelClass}>Provider</label>
            <select
              value={config.provider || 'openai'}
              onChange={(e) => onChange('provider', e.target.value)}
              className={inputClass}
            >
              <option value="openai">OpenAI</option>
              <option value="openclaw">OpenClaw CLI</option>
            </select>
          </div>
          {config.provider === 'openclaw' && (
            <div>
              <label className={labelClass}>Agent ID</label>
              <input
                type="text"
                value={config.agentId || ''}
                onChange={(e) => onChange('agentId', e.target.value)}
                placeholder="agent-xxx"
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className={labelClass}>Model</label>
            <input
              type="text"
              value={config.model || ''}
              onChange={(e) => onChange('model', e.target.value)}
              placeholder={config.provider === 'openclaw' ? 'claude-3-5-sonnet' : 'gpt-4o-mini'}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>System Prompt</label>
            <textarea
              value={config.systemPrompt || ''}
              onChange={(e) => onChange('systemPrompt', e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={3}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Message</label>
            <textarea
              value={config.message || ''}
              onChange={(e) => onChange('message', e.target.value)}
              placeholder="Message to send (or leave empty to use input)"
              rows={4}
              className={inputClass}
            />
          </div>
        </>
      );

    case 'hitl':
      return (
        <>
          <div>
            <label className={labelClass}>Type</label>
            <select
              value={config.type || 'approval'}
              onChange={(e) => onChange('type', e.target.value)}
              className={inputClass}
            >
              <option value="approval">Approval</option>
              <option value="input">Input</option>
              <option value="selection">Selection</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Message</label>
            <input
              type="text"
              value={config.message || ''}
              onChange={(e) => onChange('message', e.target.value)}
              placeholder="Approval required"
              className={inputClass}
            />
          </div>
        </>
      );

    case 'schedule-trigger':
      return (
        <div>
          <label className={labelClass}>Cron Expression</label>
          <input
            type="text"
            value={config.cronExpression || ''}
            onChange={(e) => onChange('cronExpression', e.target.value)}
            placeholder="0 9 * * *"
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground mt-1">e.g., "0 9 * * *" for every day at 9 AM</p>
        </div>
      );

    case 'webhook-trigger':
      return (
        <>
          <div>
            <label className={labelClass}>Path</label>
            <input
              type="text"
              value={config.path || ''}
              onChange={(e) => onChange('path', e.target.value)}
              placeholder="/webhook/my-path"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Method</label>
            <select
              value={config.method || 'POST'}
              onChange={(e) => onChange('method', e.target.value)}
              className={inputClass}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </>
      );

    default: {
      // Try to render dynamic form for custom nodes
      return (
        <CustomNodeConfigFallback type={type} config={config} onChange={onChange} />
      );
    }
  }
}

// Dynamic form for custom nodes - fetches manifest and renders DynamicPropertyForm
function CustomNodeConfigFallback({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
}) {
  const { data: customNodesData } = useQuery({
    queryKey: ['custom-nodes'],
    queryFn: () => customNodesApi.list(),
    staleTime: 30000,
  });

  const manifest = (customNodesData?.data || []).find((n: any) => n.id === type);

  if (!manifest || !manifest.properties || manifest.properties.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No additional configuration for this node type.
      </div>
    );
  }

  return <DynamicPropertyForm properties={manifest.properties} config={config} onChange={onChange} />;
}
