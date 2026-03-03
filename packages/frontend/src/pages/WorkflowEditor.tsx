// Workflow Editor Page

import { useEffect, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Save, Play, ArrowLeft, Moon, Sun, History } from 'lucide-react';
import { workflowsApi, executionsApi, customNodesApi } from '@/api/client';
import { NodePalette } from '@/components/canvas/NodePalette';
import { NDVPanel } from '@/components/panels/NDVPanel';
import { HITLPanel } from '@/components/panels/HITLPanel';
import { ExecutionHistorySidebar } from '@/components/panels/ExecutionHistorySidebar';
import { WorkflowNode } from '@/components/nodes/WorkflowNode';
import { DeletableEdge } from '@/components/edges/DeletableEdge';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/components/ui/Toast';

interface HITLRequest {
  id: string;
  executionId: string;
  nodeId: string;
  type: 'approval' | 'input' | 'selection';
  status: string;
  requestData: {
    type: string;
    message: string;
    details?: string;
    fields?: Array<{ name: string; label: string; type: string; required?: boolean }>;
    options?: Array<{ label: string; value: string }>;
    timeoutSeconds?: number;
  };
  expiresAt?: string;
  createdAt: string;
}

const allNodeTypes = [
  'webhook-trigger', 'schedule-trigger', 'manual-trigger',
  'http-request', 'code', 'set',
  'if', 'switch', 'merge',
  'agent', 'hitl',
];

export function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  
  // Local state (no Zustand store sync to avoid infinite loops)
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [isDirty, setIsDirty] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [hitlRequest, setHitlRequest] = useState<HITLRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();
  const { toast } = useToast();

  // Fetch custom nodes for dynamic type registration
  const { data: customNodesData } = useQuery({
    queryKey: ['custom-nodes'],
    queryFn: () => customNodesApi.list(),
    staleTime: 30000,
  });

  const customNodeTypes = (customNodesData?.data || [])
    .filter((n: any) => n.enabled !== false)
    .map((n: any) => n.id);

  const allRegisteredTypes = [...allNodeTypes, ...customNodeTypes];

  // Register all node types to use the same custom component
  const nodeTypes = useMemo(
    () => Object.fromEntries(allRegisteredTypes.map((t) => [t, WorkflowNode])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customNodeTypes.join(',')],
  );

  // Register custom edge type with delete button
  const edgeTypes = useMemo(
    () => ({ deletable: DeletableEdge }),
    [],
  );

  // React Flow state - single source of truth for nodes/edges
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Track changes to mark as dirty
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      if (changes.some((c: any) => c.type !== 'select')) {
        setIsDirty(true);
      }
    },
    [onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      if (changes.some((c: any) => c.type !== 'select')) {
        setIsDirty(true);
      }
    },
    [onEdgesChange],
  );

  // Delete node handler (defined early for use in node data)
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNodeId(null);
      setIsDirty(true);
    },
    [setNodes, setEdges],
  );

  // Delete edge handler (for hover delete on connections)
  const deleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setIsDirty(true);
    },
    [setEdges],
  );

  // WebSocket for real-time execution updates
  const wsMessageHandler = useCallback(
    (event: { type: string; payload: Record<string, unknown> }) => {
      const { type, payload } = event;

      if (type === 'execution:node:started') {
        const nodeId = payload.nodeId as string;
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    executionStatus: 'running',
                    executionStartTime: Date.now(),
                  },
                }
              : n,
          ),
        );
        // Animate edges leading TO this node (data flowing in)
        setEdges((eds) =>
          eds.map((e) =>
            e.target === nodeId
              ? { ...e, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }
              : e,
          ),
        );
      }

      if (type === 'execution:node:completed') {
        const nodeId = payload.nodeId as string;
        const output = payload.output;
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== nodeId) return n;
            const startTime = n.data.executionStartTime as number | undefined;
            const duration = startTime ? Date.now() - startTime : undefined;
            return {
              ...n,
              data: {
                ...n.data,
                executionStatus: 'completed',
                executionOutput: output,
                executionDuration: duration,
              },
            };
          }),
        );
        // Animate the edge from this node (data flowing out, success)
        setEdges((eds) =>
          eds.map((e) =>
            e.source === nodeId
              ? { ...e, animated: true, style: { stroke: '#22c55e', strokeWidth: 2 } }
              : e,
          ),
        );
      }

      if (type === 'execution:node:error') {
        const nodeId = payload.nodeId as string;
        const error = payload.error;
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    executionStatus: 'error',
                    executionError: error,
                  },
                }
              : n,
          ),
        );
        setEdges((eds) =>
          eds.map((e) =>
            e.source === nodeId
              ? { ...e, animated: false, style: { stroke: '#ef4444', strokeWidth: 2 } }
              : e,
          ),
        );
      }

      // Handle HITL required
      if (type === 'hitl:required') {
        const nodeId = payload.nodeId as string;
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, executionStatus: 'waiting_hitl' } }
              : n,
          ),
        );
        setHitlRequest({
          id: payload.hitlId as string,
          executionId: payload.executionId as string,
          nodeId: payload.nodeId as string,
          type: (payload.requestData as any)?.type || 'approval',
          status: 'pending',
          requestData: payload.requestData as any,
          createdAt: new Date().toISOString(),
        });
      }

      // Handle HITL resolved
      if (type === 'hitl:resolved') {
        setHitlRequest(null);
      }

      if (type === 'execution:completed' || type === 'execution:failed') {
        setExecutionId(null);
        setHitlRequest(null);
        // Stop edge animations when execution ends
        setEdges((eds) =>
          eds.map((e) => ({ ...e, animated: false })),
        );
        if (type === 'execution:completed') {
          toast({ title: 'Execution completed', variant: 'success' });
        } else {
          toast({
            title: 'Execution failed',
            description: (payload.error as string) || 'Unknown error',
            variant: 'destructive',
          });
        }
      }
    },
    [setNodes, setEdges, toast],
  );

  const { subscribe, unsubscribe } = useWebSocket(wsMessageHandler);

  // Cleanup subscription on unmount or execution change
  useEffect(() => {
    return () => {
      if (executionId) unsubscribe(executionId);
    };
  }, [executionId, unsubscribe]);

  // Load workflow
  const { data: workflow, isLoading } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowsApi.get(id!),
    enabled: !isNew,
  });

  // Initialize from loaded workflow
  useEffect(() => {
    if (workflow) {
      setWorkflowName(workflow.name);
      setNodes(
        workflow.definition.nodes.map((n: any) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: { ...n.data, onDelete: deleteNode },
        })),
      );
      setEdges(
        workflow.definition.edges.map((e: any) => ({
          ...e,
          type: 'deletable',
          data: { ...e.data, onDelete: deleteEdge },
        })),
      );
      setIsDirty(false);
    }
  }, [workflow, setNodes, setEdges, deleteNode, deleteEdge]);

  // Save workflow
  const saveMutation = useMutation({
    mutationFn: async () => {
      const definition = {
        nodes: nodes.map((n) => {
          // Strip out callbacks and execution state before saving
          const {
            onDelete,
            executionStatus,
            executionOutput,
            executionError,
            executionDuration,
            executionStartTime,
            ...dataWithoutCallbacks
          } = n.data;
          return {
            id: n.id,
            type: n.type,
            position: n.position,
            data: dataWithoutCallbacks,
          };
        }),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle,
          target: e.target,
          targetHandle: e.targetHandle,
        })),
      };

      if (isNew) {
        const result = await workflowsApi.create({ name: workflowName, definition });
        navigate(`/workflows/${result.id}`, { replace: true });
        return result;
      } else {
        return workflowsApi.update(id!, { name: workflowName, definition });
      }
    },
    onSuccess: () => {
      setIsDirty(false);
      toast({ title: 'Workflow saved', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    },
  });

  // Execute workflow
  const executeMutation = useMutation({
    mutationFn: () => {
      // Reset node statuses BEFORE the API call to avoid race conditions
      // with fast-completing workflows where WS events arrive before HTTP response
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            executionStatus: 'pending',
            executionOutput: undefined,
            executionError: undefined,
            executionDuration: undefined,
          },
        })),
      );
      setEdges((eds) =>
        eds.map((e) => ({ ...e, animated: false, style: undefined })),
      );
      return workflowsApi.execute(id!);
    },
    onSuccess: async (result: any) => {
      const execId = result.executionId;
      setExecutionId(execId);
      subscribe(execId);
      toast({ title: 'Workflow started', variant: 'default' });

      // For fast workflows, execution may complete before WS subscription.
      // Poll execution status to reconcile missed events (fallback only).
      setTimeout(async () => {
        try {
          const exec = await executionsApi.get(execId);
          if (exec.status === 'completed' || exec.status === 'failed') {
            // Check if WS already handled this by looking at node states
            // Only update if nodes are still pending (WS missed)
            setNodes((currentNodes) => {
              const allPending = currentNodes.every(
                (n) => !n.data.executionStatus || n.data.executionStatus === 'pending'
              );
              if (!allPending) {
                // WS already updated nodes, skip poll update
                return currentNodes;
              }
              // WS missed events — load final node states from DB
              if (exec.nodes) {
                return currentNodes.map((n) => {
                  const nodeExec = exec.nodes[n.id];
                  if (!nodeExec) return n;
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      executionStatus: nodeExec.status === 'error' ? 'error' : 'completed',
                      executionOutput: nodeExec.output,
                      executionError: nodeExec.error,
                    },
                  };
                });
              }
              return currentNodes;
            });
            // Only clear execution state if still set (WS might have cleared it)
            setExecutionId((currentId) => {
              if (currentId === execId) {
                // WS didn't clear it, so show toast and clear
                setEdges((eds) => eds.map((e) => ({ ...e, animated: false })));
                if (exec.status === 'completed') {
                  toast({ title: 'Execution completed', variant: 'success' });
                } else {
                  toast({
                    title: 'Execution failed',
                    description: exec.error || 'Unknown error',
                    variant: 'destructive',
                  });
                }
                return null;
              }
              return currentId;
            });
          }
        } catch {
          // ignore polling errors
        }
      }, 500);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to start', description: error.message, variant: 'destructive' });
    },
  });

  // Connection handler
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: 'deletable', data: { onDelete: deleteEdge } }, eds));
    },
    [setEdges, deleteEdge],
  );

  // Node click handler
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [],
  );

  // Pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Keyboard delete handler
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      deleted.forEach((node) => {
        setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id));
      });
      setSelectedNodeId(null);
      setIsDirty(true);
    },
    [setEdges],
  );

  const onEdgesDelete = useCallback(() => {
    setIsDirty(true);
  }, []);

  // Drag and drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const customIcon = event.dataTransfer.getData('application/customicon') || undefined;
      const customColor = event.dataTransfer.getData('application/customcolor') || undefined;

      const position = {
        x: event.clientX - 250,
        y: event.clientY - 100,
      };

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: { name: type, config: {}, onDelete: deleteNode, customIcon, customColor },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, deleteNode],
  );

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <header className="bg-card border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/workflows')}
            className="p-2 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <input
            type="text"
            value={workflowName}
            onChange={(e) => {
              setWorkflowName(e.target.value);
              setIsDirty(true);
            }}
            className="text-lg font-medium border-none bg-transparent focus:outline-none focus:ring-2 focus:ring-ring rounded px-2 py-1 text-foreground"
            placeholder="Workflow name"
          />
          {isDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        </div>

        <div className="flex items-center gap-2">
          {executionId && (
            <span className="text-xs text-primary animate-pulse mr-2">Running...</span>
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Save size={16} />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          {!isNew && (
            <button
              onClick={() => executeMutation.mutate()}
              disabled={executeMutation.isPending || isDirty || !!executionId}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Play size={16} />
              Run
            </button>
          )}
          {!isNew && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded transition-colors ${
                showHistory 
                  ? 'bg-accent text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title="Execution History"
            >
              <History size={16} />
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Node Palette */}
        <NodePalette />

        {/* Canvas */}
        <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Config Panel */}
        {selectedNodeId && (
          <NDVPanel
            nodeId={selectedNodeId}
            nodes={nodes}
            setNodes={setNodes}
            onClose={() => setSelectedNodeId(null)}
            onDelete={() => deleteNode(selectedNodeId)}
          />
        )}

        {/* Execution History Sidebar */}
        {showHistory && id && (
          <ExecutionHistorySidebar
            workflowId={id}
            currentExecutionId={executionId}
            onSelectExecution={(execId) => {
              // TODO: Load execution details and visualize node states
              console.log('Selected execution:', execId);
            }}
          />
        )}
      </div>

      {/* HITL Panel */}
      {hitlRequest && (
        <HITLPanel
          request={hitlRequest}
          onResolved={() => setHitlRequest(null)}
        />
      )}
    </div>
  );
}
