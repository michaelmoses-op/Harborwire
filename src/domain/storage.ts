import { defaultConfig, getEntry } from './catalog';
import type { PipelineEdge, PipelineNode } from './flow';
import { isKind } from './types';

const KEY = 'harborwire.chart.v1';

export function saveChart(nodes: PipelineNode[], edges: PipelineEdge[]): void {
  const payload = {
    nodes: nodes.map((node) => ({
      ...node,
      selected: false,
      data: { ...node.data, status: 'idle' as const },
    })),
    edges: edges.map((edge) => ({
      ...edge,
      selected: false,
      animated: false,
    })),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // A full disk should not break the chart in front of the learner.
  }
}

export function loadChart(): { nodes: PipelineNode[]; edges: PipelineEdge[] } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { nodes?: unknown; edges?: unknown };
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    const nodes: PipelineNode[] = [];
    for (const candidate of parsed.nodes) {
      if (!candidate || typeof candidate !== 'object') return null;
      const node = candidate as PipelineNode;
      if (!node.id || !node.position || !node.data || !isKind(node.data.kind)) return null;
      const entry = getEntry(node.data.kind);
      nodes.push({
        ...node,
        type: 'pipeline',
        selected: false,
        data: {
          kind: node.data.kind,
          label: entry.title,
          status: 'idle',
          config: { ...defaultConfig(), ...node.data.config },
        },
      });
    }
    const ids = new Set(nodes.map((node) => node.id));
    const edges = (parsed.edges as PipelineEdge[]).filter(
      (edge) => edge && ids.has(edge.source) && ids.has(edge.target),
    );
    return { nodes, edges };
  } catch {
    return null;
  }
}

export function clearSavedChart(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
