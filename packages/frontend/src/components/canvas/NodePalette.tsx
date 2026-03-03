// Node Palette - Sidebar with draggable nodes

import { useQuery } from '@tanstack/react-query';
import {
  Webhook,
  Clock,
  Play,
  Globe,
  Code,
  GitBranch,
  Merge,
  Bot,
  UserCheck,
  Settings,
} from 'lucide-react';
import { customNodesApi } from '@/api/client';
import { resolveIcon } from '@/components/nodes/icon-resolver';

interface NodeDefinition {
  type: string;
  name: string;
  icon: React.ReactNode;
  category: string;
  customIcon?: string;
  customColor?: string;
}

const staticNodeDefinitions: NodeDefinition[] = [
  // Triggers
  { type: 'webhook-trigger', name: 'Webhook', icon: <Webhook size={16} />, category: 'Triggers' },
  { type: 'schedule-trigger', name: 'Schedule', icon: <Clock size={16} />, category: 'Triggers' },
  { type: 'manual-trigger', name: 'Manual', icon: <Play size={16} />, category: 'Triggers' },

  // Actions
  { type: 'http-request', name: 'HTTP Request', icon: <Globe size={16} />, category: 'Actions' },
  { type: 'code', name: 'Code', icon: <Code size={16} />, category: 'Actions' },

  // Logic
  { type: 'if', name: 'If', icon: <GitBranch size={16} />, category: 'Logic' },
  { type: 'switch', name: 'Switch', icon: <GitBranch size={16} />, category: 'Logic' },
  { type: 'merge', name: 'Merge', icon: <Merge size={16} />, category: 'Logic' },

  // AI
  { type: 'agent', name: 'Agent', icon: <Bot size={16} />, category: 'AI' },
  { type: 'hitl', name: 'Human Approval', icon: <UserCheck size={16} />, category: 'AI' },

  // Utility
  { type: 'set', name: 'Set', icon: <Settings size={16} />, category: 'Utility' },
];

const categoryDisplayMap: Record<string, string> = {
  triggers: 'Triggers',
  actions: 'Actions',
  logic: 'Logic',
  ai: 'AI',
  utility: 'Utility',
  custom: 'Custom',
};

const categories = ['Triggers', 'Actions', 'Logic', 'AI', 'Utility', 'Custom'];

export function NodePalette() {
  const { data: customNodesData } = useQuery({
    queryKey: ['custom-nodes'],
    queryFn: () => customNodesApi.list(),
    staleTime: 30000,
  });

  const customNodes: NodeDefinition[] = (customNodesData?.data || [])
    .filter((n: any) => n.enabled !== false)
    .map((n: any) => {
      const IconComponent = resolveIcon(n.icon);
      return {
        type: n.id,
        name: n.name,
        icon: <IconComponent size={16} />,
        category: categoryDisplayMap[n.category] || 'Custom',
        customIcon: n.icon,
        customColor: n.color,
      };
    });

  const allNodes = [...staticNodeDefinitions, ...customNodes];

  const onDragStart = (event: React.DragEvent, node: NodeDefinition) => {
    event.dataTransfer.setData('application/reactflow', node.type);
    if (node.customIcon) {
      event.dataTransfer.setData('application/customicon', node.customIcon);
    }
    if (node.customColor) {
      event.dataTransfer.setData('application/customcolor', node.customColor);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-56 bg-card border-r border-border p-4 overflow-y-auto">
      <h2 className="font-semibold text-foreground mb-4">Nodes</h2>

      {categories.map((category) => {
        const categoryNodes = allNodes.filter((n) => n.category === category);
        if (categoryNodes.length === 0) return null;

        return (
          <div key={category} className="mb-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">{category}</h3>
            <div className="space-y-1">
              {categoryNodes.map((node) => (
                <div
                  key={node.type}
                  className="flex items-center gap-2 p-2 bg-muted rounded cursor-grab hover:bg-accent transition-colors"
                  draggable
                  onDragStart={(e) => onDragStart(e, node)}
                >
                  <span className="text-muted-foreground">{node.icon}</span>
                  <span className="text-sm text-foreground">{node.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
