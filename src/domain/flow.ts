import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { defaultConfig, getEntry } from './catalog';
import { connectionVerdict } from './graph';
import { getPreset, type Preset } from './presets';
import type { GraphEdge, GraphNode, PipelineData, ResourceConfig } from './types';

export type PipelineNode = Node<PipelineData, 'pipeline'>;
export type PipelineEdge = Edge<{ reason: string }>;

export function createNode(
  kind: PipelineData['kind'],
  position: { x: number; y: number },
  id?: string,
  config?: Partial<ResourceConfig>,
): PipelineNode {
  const entry = getEntry(kind);
  return {
    id: id ?? `${kind}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'pipeline',
    position,
    data: {
      kind,
      label: entry.title,
      config: { ...defaultConfig(), ...config },
      status: 'idle',
    },
  };
}

export function createEdge(source: string, target: string, reason: string, id?: string): PipelineEdge {
  return {
    id: id ?? `e-${source}-${target}-${Math.random().toString(36).slice(2, 6)}`,
    source,
    target,
    type: 'smoothstep',
    className: 'hw-edge',
    interactionWidth: 18,
    data: { reason },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#6f8b9a' },
  };
}

export function toGraph(nodes: PipelineNode[]): GraphNode[] {
  return nodes.map((node) => ({
    id: node.id,
    kind: node.data.kind,
    label: node.data.label,
    config: node.data.config,
    x: node.position.x,
    y: node.position.y,
  }));
}

export function toGraphEdges(edges: PipelineEdge[]): GraphEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
}

export function presetToFlow(preset: Preset): { nodes: PipelineNode[]; edges: PipelineEdge[] } {
  const nodes = preset.nodes.map((node) => createNode(node.kind, { x: node.x, y: node.y }, node.id, node.config));
  const graphNodes = toGraph(nodes);
  const edges: PipelineEdge[] = [];
  for (const edge of preset.edges) {
    const verdict = connectionVerdict(graphNodes, toGraphEdges(edges), edge.source, edge.target);
    edges.push(createEdge(edge.source, edge.target, verdict.reason, `${edge.source}-${edge.target}`));
  }
  return { nodes, edges };
}

export function loadPresetFlow(id: string): { nodes: PipelineNode[]; edges: PipelineEdge[] } | null {
  const preset = getPreset(id);
  if (!preset) return null;
  return presetToFlow(preset);
}

export function paintEdges(
  edges: PipelineEdge[],
  activeTarget: string | null,
  doneSourceIds: Set<string>,
): PipelineEdge[] {
  return edges.map((edge) => {
    const live = activeTarget !== null && edge.target === activeTarget;
    const settled = doneSourceIds.has(edge.source);
    const color = live ? '#f0b429' : settled ? '#3dbea7' : '#6f8b9a';
    return {
      ...edge,
      animated: Boolean(live),
      className: live ? 'hw-edge live' : settled ? 'hw-edge done' : 'hw-edge',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
    };
  });
}

export function chartSignature(nodes: PipelineNode[], edges: PipelineEdge[]): string {
  const nodePart = nodes
    .map((node) => `${node.id}:${node.data.kind}:${JSON.stringify(node.data.config)}`)
    .sort()
    .join('|');
  const edgePart = edges
    .map((edge) => `${edge.source}>${edge.target}`)
    .sort()
    .join('|');
  return `${nodePart}#${edgePart}`;
}
