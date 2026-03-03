// DynamicPropertyForm - renders config fields from PropertyDefinition[]

interface PropertyDefinition {
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

interface DynamicPropertyFormProps {
  properties: PropertyDefinition[];
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

function shouldShowProperty(
  prop: PropertyDefinition,
  config: Record<string, any>,
): boolean {
  if (!prop.displayOptions) return true;

  if (prop.displayOptions.show) {
    for (const [key, values] of Object.entries(prop.displayOptions.show)) {
      if (!values.includes(config[key])) return false;
    }
  }

  if (prop.displayOptions.hide) {
    for (const [key, values] of Object.entries(prop.displayOptions.hide)) {
      if (values.includes(config[key])) return false;
    }
  }

  return true;
}

export function DynamicPropertyForm({ properties, config, onChange }: DynamicPropertyFormProps) {
  const inputClass = "w-full px-3 py-2 border border-input bg-background text-foreground rounded focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <>
      {properties.map((prop) => {
        if (!shouldShowProperty(prop, config)) return null;

        const value = config[prop.name] ?? prop.default ?? '';

        return (
          <div key={prop.name}>
            <label className={labelClass}>
              {prop.displayName}
              {prop.required && <span className="text-red-400 ml-1">*</span>}
            </label>

            {prop.type === 'string' && (
              <input
                type="text"
                value={String(value)}
                onChange={(e) => onChange(prop.name, e.target.value)}
                placeholder={prop.placeholder}
                className={inputClass}
              />
            )}

            {prop.type === 'number' && (
              <input
                type="number"
                value={value === '' ? '' : Number(value)}
                onChange={(e) => onChange(prop.name, e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder={prop.placeholder}
                className={inputClass}
              />
            )}

            {prop.type === 'boolean' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => onChange(prop.name, e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm text-foreground">
                  {prop.description || prop.displayName}
                </span>
              </label>
            )}

            {prop.type === 'select' && (
              <select
                value={String(value)}
                onChange={(e) => onChange(prop.name, e.target.value)}
                className={inputClass}
              >
                {!prop.required && <option value="">-- Select --</option>}
                {prop.options?.map((opt) => (
                  <option key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {prop.type === 'json' && (
              <textarea
                value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    onChange(prop.name, parsed);
                  } catch {
                    onChange(prop.name, e.target.value);
                  }
                }}
                placeholder={prop.placeholder || '{}'}
                rows={4}
                className={`${inputClass} font-mono`}
              />
            )}

            {prop.type === 'code' && (
              <textarea
                value={String(value)}
                onChange={(e) => onChange(prop.name, e.target.value)}
                placeholder={prop.placeholder || '// Code here...'}
                rows={10}
                className={`${inputClass} font-mono`}
              />
            )}

            {prop.type === 'expression' && (
              <input
                type="text"
                value={String(value)}
                onChange={(e) => onChange(prop.name, e.target.value)}
                placeholder={prop.placeholder || '{{ $input.data }}'}
                className={`${inputClass} font-mono`}
              />
            )}

            {prop.description && prop.type !== 'boolean' && (
              <p className="text-xs text-muted-foreground mt-1">{prop.description}</p>
            )}
          </div>
        );
      })}
    </>
  );
}
