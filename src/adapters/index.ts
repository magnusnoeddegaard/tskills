import { ClaudeAdapter } from './claude.js';
import { CursorAdapter } from './cursor.js';
import { WindsurfAdapter } from './windsurf.js';
import type { ToolAdapter } from '../types.js';

export const adapters: Record<string, ToolAdapter> = {
  claude: new ClaudeAdapter(),
  cursor: new CursorAdapter(),
  copilot: new ClaudeAdapter(), // Copilot uses the same location as Claude
  windsurf: new WindsurfAdapter(),
};

export function getAdapter(name: string): ToolAdapter | undefined {
  return adapters[name.toLowerCase()];
}

export function getEnabledAdapters(tools: Record<string, boolean>): ToolAdapter[] {
  const enabled: ToolAdapter[] = [];
  const seen = new Set<string>();

  for (const [name, isEnabled] of Object.entries(tools)) {
    if (!isEnabled) continue;

    const adapter = getAdapter(name);
    if (!adapter) continue;

    // Avoid duplicates (claude and copilot share the same adapter)
    const key = adapter.name;
    if (seen.has(key)) continue;

    seen.add(key);
    enabled.push(adapter);
  }

  return enabled;
}
