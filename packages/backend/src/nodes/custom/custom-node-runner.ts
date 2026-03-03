import { createRequire } from 'node:module';
import type { CustomNodeManifest, NodeRunner, NodeContext, NodeResult } from '@garage-engine/shared';

export function createCustomNodeRunner(manifest: CustomNodeManifest): NodeRunner {
  return {
    async execute(context: NodeContext): Promise<NodeResult> {
      const config = context.node.data.config;
      const $input = context.inputs.main[0];
      const $inputs = context.inputs.main;
      const helpers = context.helpers;
      const execution = context.execution;
      const nodeRequire = createRequire(import.meta.url);

      const logs: string[] = [];
      const customConsole = {
        log: (...args: unknown[]) => {
          logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
        },
        error: (...args: unknown[]) => {
          logs.push('[ERROR] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
        },
        warn: (...args: unknown[]) => {
          logs.push('[WARN] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
        },
      };

      const fn = new Function(
        'config', '$input', '$inputs', 'helpers', 'execution', 'require', 'console',
        `return (async () => { ${manifest.code} })()`,
      );

      try {
        const result = await fn(config, $input, $inputs, helpers, execution, nodeRequire, customConsole);
        return {
          data: {
            result: result ?? $input,
            logs: logs.length > 0 ? logs : undefined,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          data: {
            error: message,
            logs: logs.length > 0 ? logs : undefined,
          },
        };
      }
    },
  };
}
