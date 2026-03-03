// Custom Node List Page

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, ArrowLeft } from 'lucide-react';
import { customNodesApi } from '@/api/client';
import { resolveIcon } from '@/components/nodes/icon-resolver';
import { AppHeader } from '@/components/AppHeader';

export function CustomNodeList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['custom-nodes'],
    queryFn: () => customNodesApi.list(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => customNodesApi.toggle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-nodes'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customNodesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-nodes'] }),
  });

  const nodes = data?.data || [];

  const categoryBadgeColors: Record<string, string> = {
    triggers: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    actions: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    logic: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    ai: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    utility: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader />
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/workflows')}
                className="p-2 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Custom Nodes</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage custom workflow nodes built on top of the Code engine
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/custom-nodes/new')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              Create Node
            </button>
          </div>

          {isLoading ? (
            <div className="text-center text-muted-foreground py-12">Loading...</div>
          ) : nodes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground mb-4">No custom nodes yet</p>
              <button
                onClick={() => navigate('/custom-nodes/new')}
                className="text-primary hover:underline text-sm"
              >
                Create your first custom node
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {nodes.map((node: any) => {
                const IconComponent = resolveIcon(node.icon);
                return (
                  <div
                    key={node.id}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <IconComponent size={20} className="text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{node.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${categoryBadgeColors[node.category] || categoryBadgeColors.utility}`}>
                            {node.category}
                          </span>
                          {node.isBuiltin && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              built-in
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {node.description || `ID: ${node.id}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!node.isBuiltin && (
                        <button
                          onClick={() => toggleMutation.mutate(node.id)}
                          className="p-2 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
                          title={node.enabled ? 'Disable' : 'Enable'}
                        >
                          {node.enabled ? (
                            <ToggleRight size={20} className="text-green-500" />
                          ) : (
                            <ToggleLeft size={20} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/custom-nodes/${node.id}/edit`)}
                        className="p-2 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      {!node.isBuiltin && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete custom node "${node.name}"?`)) {
                              deleteMutation.mutate(node.id);
                            }
                          }}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors text-muted-foreground hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
