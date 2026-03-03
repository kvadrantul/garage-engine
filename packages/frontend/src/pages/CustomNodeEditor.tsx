// Custom Node Editor Page - Constructor for creating/editing custom nodes

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Play, Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { customNodesApi } from '@/api/client';
import { resolveIcon, getAvailableIcons } from '@/components/nodes/icon-resolver';

interface PropertyDef {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'json' | 'code' | 'expression';
  default?: unknown;
  required?: boolean;
  description?: string;
  options?: { label: string; value: unknown }[];
  placeholder?: string;
}

const CATEGORIES = [
  { value: 'actions', label: 'Actions' },
  { value: 'triggers', label: 'Triggers' },
  { value: 'logic', label: 'Logic' },
  { value: 'ai', label: 'AI' },
  { value: 'utility', label: 'Utility' },
];

const COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
];

const PROPERTY_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
  { value: 'json', label: 'JSON' },
  { value: 'code', label: 'Code' },
  { value: 'expression', label: 'Expression' },
];

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CustomNodeEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id;

  // Form state
  const [nodeId, setNodeId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [category, setCategory] = useState('actions');
  const [icon, setIcon] = useState('Settings');
  const [color, setColor] = useState('blue');
  const [properties, setProperties] = useState<PropertyDef[]>([]);
  const [code, setCode] = useState('// Access config values via config.propertyName\n// Access input via $input\n// Return the output value\n\nreturn $input;');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [editingPropertyIndex, setEditingPropertyIndex] = useState<number | null>(null);

  // Test state
  const [showTest, setShowTest] = useState(false);
  const [testInput, setTestInput] = useState('null');
  const [testConfig, setTestConfig] = useState('{}');
  const [testResult, setTestResult] = useState<unknown>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Load existing node
  const { data: existingNode } = useQuery({
    queryKey: ['custom-node', id],
    queryFn: () => customNodesApi.get(id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (existingNode) {
      setNodeId(existingNode.id);
      setName(existingNode.name);
      setDescription(existingNode.description || '');
      setVersion(existingNode.version || '1.0.0');
      setCategory(existingNode.category || 'actions');
      setIcon(existingNode.icon || 'Settings');
      setColor(existingNode.color || 'blue');
      setProperties(existingNode.properties || []);
      setCode(existingNode.code || '');

      // Build test config from properties defaults
      const defaultConfig: Record<string, unknown> = {};
      for (const p of existingNode.properties || []) {
        if (p.default !== undefined) defaultConfig[p.name] = p.default;
      }
      setTestConfig(JSON.stringify(defaultConfig, null, 2));
    }
  }, [existingNode]);

  // Auto-generate ID from name (only for new nodes)
  useEffect(() => {
    if (isNew && name) {
      setNodeId(slugify(name));
    }
  }, [name, isNew]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const manifest = {
        id: nodeId,
        name,
        description,
        version,
        category,
        icon,
        color,
        inputs: [{ name: 'main', type: 'main' as const }],
        outputs: [{ name: 'main', type: 'main' as const }],
        properties,
        code,
      };

      if (isNew) {
        return customNodesApi.create(manifest);
      } else {
        return customNodesApi.update(id!, manifest);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-nodes'] });
      if (isNew) {
        navigate(`/custom-nodes/${nodeId}/edit`, { replace: true });
      }
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      // For new unsaved nodes, we need to save first
      let testNodeId = id || nodeId;
      if (isNew) {
        await saveMutation.mutateAsync();
        testNodeId = nodeId;
      }

      let parsedInput: unknown;
      let parsedConfig: Record<string, unknown>;
      try {
        parsedInput = JSON.parse(testInput);
      } catch {
        throw new Error('Invalid test input JSON');
      }
      try {
        parsedConfig = JSON.parse(testConfig);
      } catch {
        throw new Error('Invalid test config JSON');
      }

      return customNodesApi.test(testNodeId, { input: parsedInput, config: parsedConfig });
    },
    onSuccess: (data) => {
      setTestResult(data.result);
      setTestError(null);
    },
    onError: (error: Error) => {
      setTestError(error.message);
      setTestResult(null);
    },
  });

  // Property management
  const addProperty = () => {
    setProperties([
      ...properties,
      {
        name: '',
        displayName: '',
        type: 'string',
        required: false,
        description: '',
        placeholder: '',
      },
    ]);
    setEditingPropertyIndex(properties.length);
  };

  const updateProperty = (index: number, updates: Partial<PropertyDef>) => {
    setProperties(properties.map((p, i) => (i === index ? { ...p, ...updates } : p)));
  };

  const removeProperty = (index: number) => {
    setProperties(properties.filter((_, i) => i !== index));
    setEditingPropertyIndex(null);
  };

  const moveProperty = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= properties.length) return;
    const newProps = [...properties];
    [newProps[index], newProps[newIndex]] = [newProps[newIndex], newProps[index]];
    setProperties(newProps);
  };

  const inputClass = "w-full px-3 py-2 border border-input bg-background text-foreground rounded focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  const IconPreview = resolveIcon(icon);
  const availableIcons = getAvailableIcons();

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/custom-nodes')}
            className="p-2 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold text-foreground">
            {isNew ? 'Create Custom Node' : `Edit: ${name || nodeId}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTest(!showTest)}
            className={`flex items-center gap-2 px-3 py-2 rounded transition-colors text-sm ${
              showTest ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Play size={14} />
            Test
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !nodeId || !name}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
          >
            <Save size={14} />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Error/Success */}
      {saveMutation.isError && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-sm text-red-500">
          {(saveMutation.error as Error).message}
        </div>
      )}
      {saveMutation.isSuccess && (
        <div className="bg-green-500/10 border-b border-green-500/30 px-4 py-2 text-sm text-green-600 dark:text-green-400">
          Saved successfully
        </div>
      )}

      {/* Main content - two columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: metadata + properties */}
        <div className="w-96 border-r border-border overflow-y-auto p-4 space-y-4 shrink-0">
          {/* Basic info */}
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Node"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>ID (slug)</label>
            <input
              type="text"
              value={nodeId}
              onChange={(e) => setNodeId(slugify(e.target.value))}
              placeholder="my-custom-node"
              disabled={!isNew}
              className={`${inputClass} ${!isNew ? 'opacity-60' : ''}`}
            />
            <p className="text-xs text-muted-foreground mt-1">Used as the node type identifier</p>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this node does..."
              rows={2}
              className={inputClass}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Icon + Color */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Icon</label>
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className={`${inputClass} flex items-center gap-2 text-left`}
              >
                <IconPreview size={16} />
                <span>{icon}</span>
              </button>
              {showIconPicker && (
                <div className="mt-1 p-2 border border-border rounded bg-card grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
                  {availableIcons.map(({ name: iconName, icon: IC }) => (
                    <button
                      key={iconName}
                      onClick={() => { setIcon(iconName); setShowIconPicker(false); }}
                      className={`p-2 rounded hover:bg-accent transition-colors ${icon === iconName ? 'bg-accent ring-1 ring-primary' : ''}`}
                      title={iconName}
                    >
                      <IC size={16} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className={labelClass}>Color</label>
              <div className="flex gap-1 mt-1">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    className={`w-6 h-6 rounded-full ${c.class} ${color === c.value ? 'ring-2 ring-offset-2 ring-offset-background ring-primary' : ''}`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Properties section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Properties</label>
              <button
                onClick={addProperty}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus size={12} />
                Add Field
              </button>
            </div>

            {properties.length === 0 ? (
              <p className="text-xs text-muted-foreground">No properties defined yet</p>
            ) : (
              <div className="space-y-1">
                {properties.map((prop, index) => (
                  <div key={index} className="border border-border rounded overflow-hidden">
                    {/* Property header */}
                    <button
                      onClick={() => setEditingPropertyIndex(editingPropertyIndex === index ? null : index)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical size={12} className="text-muted-foreground" />
                        {editingPropertyIndex === index ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span className="text-sm font-medium text-foreground">
                          {prop.displayName || prop.name || 'New Property'}
                        </span>
                        <span className="text-xs text-muted-foreground">({prop.type})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {index > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveProperty(index, 'up'); }}
                            className="p-1 hover:bg-accent rounded text-xs text-muted-foreground"
                          >
                            ↑
                          </button>
                        )}
                        {index < properties.length - 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveProperty(index, 'down'); }}
                            className="p-1 hover:bg-accent rounded text-xs text-muted-foreground"
                          >
                            ↓
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeProperty(index); }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </button>

                    {/* Property editor */}
                    {editingPropertyIndex === index && (
                      <div className="p-3 space-y-2 bg-background">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className={labelClass}>Name (key)</label>
                            <input
                              type="text"
                              value={prop.name}
                              onChange={(e) => updateProperty(index, { name: e.target.value.replace(/\s/g, '') })}
                              placeholder="fieldName"
                              className={inputClass}
                            />
                          </div>
                          <div className="flex-1">
                            <label className={labelClass}>Display Name</label>
                            <input
                              type="text"
                              value={prop.displayName}
                              onChange={(e) => updateProperty(index, { displayName: e.target.value })}
                              placeholder="Field Name"
                              className={inputClass}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className={labelClass}>Type</label>
                            <select
                              value={prop.type}
                              onChange={(e) => updateProperty(index, { type: e.target.value as PropertyDef['type'] })}
                              className={inputClass}
                            >
                              {PROPERTY_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1 flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer pb-2">
                              <input
                                type="checkbox"
                                checked={prop.required || false}
                                onChange={(e) => updateProperty(index, { required: e.target.checked })}
                                className="rounded border-input"
                              />
                              <span className="text-xs text-foreground">Required</span>
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>Default Value</label>
                          <input
                            type="text"
                            value={prop.default !== undefined ? String(prop.default) : ''}
                            onChange={(e) => {
                              let val: unknown = e.target.value;
                              if (prop.type === 'number') val = Number(val) || 0;
                              if (prop.type === 'boolean') val = val === 'true';
                              updateProperty(index, { default: val || undefined });
                            }}
                            placeholder="Default value"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Placeholder</label>
                          <input
                            type="text"
                            value={prop.placeholder || ''}
                            onChange={(e) => updateProperty(index, { placeholder: e.target.value || undefined })}
                            placeholder="Placeholder text"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Description</label>
                          <input
                            type="text"
                            value={prop.description || ''}
                            onChange={(e) => updateProperty(index, { description: e.target.value || undefined })}
                            placeholder="Help text for the user"
                            className={inputClass}
                          />
                        </div>

                        {/* Options for select type */}
                        {prop.type === 'select' && (
                          <div>
                            <label className={labelClass}>Options</label>
                            {(prop.options || []).map((opt, optIdx) => (
                              <div key={optIdx} className="flex gap-2 mb-1">
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) => {
                                    const newOpts = [...(prop.options || [])];
                                    newOpts[optIdx] = { ...newOpts[optIdx], label: e.target.value };
                                    updateProperty(index, { options: newOpts });
                                  }}
                                  placeholder="Label"
                                  className={`${inputClass} flex-1`}
                                />
                                <input
                                  type="text"
                                  value={String(opt.value)}
                                  onChange={(e) => {
                                    const newOpts = [...(prop.options || [])];
                                    newOpts[optIdx] = { ...newOpts[optIdx], value: e.target.value };
                                    updateProperty(index, { options: newOpts });
                                  }}
                                  placeholder="Value"
                                  className={`${inputClass} flex-1`}
                                />
                                <button
                                  onClick={() => {
                                    const newOpts = (prop.options || []).filter((_, i) => i !== optIdx);
                                    updateProperty(index, { options: newOpts });
                                  }}
                                  className="p-2 text-muted-foreground hover:text-red-600"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const newOpts = [...(prop.options || []), { label: '', value: '' }];
                                updateProperty(index, { options: newOpts });
                              }}
                              className="text-xs text-primary hover:underline"
                            >
                              + Add option
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: code editor + test */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Code editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/30 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase">Code</span>
                <span className="text-xs text-muted-foreground">
                  Available: config.*, $input, $inputs, helpers, execution, require()
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-full px-4 py-3 bg-background text-foreground font-mono text-sm resize-none focus:outline-none"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Test panel */}
          {showTest && (
            <div className="border-t border-border shrink-0 max-h-[40%] overflow-auto">
              <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase">Test</span>
                <button
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Play size={12} />
                  {testMutation.isPending ? 'Running...' : 'Run Test'}
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className={labelClass}>Input (JSON)</label>
                    <textarea
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      rows={3}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={labelClass}>Config (JSON)</label>
                    <textarea
                      value={testConfig}
                      onChange={(e) => setTestConfig(e.target.value)}
                      rows={3}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                {testError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                    <div className="text-sm font-medium text-red-500 mb-1">Error</div>
                    <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap">{testError}</pre>
                  </div>
                )}

                {testResult !== null && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                    <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Output</div>
                    <pre className="text-xs text-foreground font-mono whitespace-pre-wrap max-h-40 overflow-auto">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
