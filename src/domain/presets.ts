import type { Kind, ResourceConfig } from './types';

export interface PresetNode {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  config?: Partial<ResourceConfig>;
}

export interface PresetEdge {
  source: string;
  target: string;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  nodes: PresetNode[];
  edges: PresetEdge[];
}

const healthy: Preset = {
  id: 'web',
  name: 'Healthy pipeline',
  description: 'buoy goes from a Git commit to a Service.',
  nodes: [
    { id: 'git', kind: 'git', x: 0, y: 180 },
    { id: 'checkout', kind: 'checkout', x: 300, y: 180 },
    { id: 'test', kind: 'test', x: 600, y: 0 },
    { id: 'lint', kind: 'lint', x: 600, y: 340 },
    { id: 'compile', kind: 'compile', x: 920, y: 160 },
    { id: 'dockerfile', kind: 'dockerfile', x: 920, y: 420 },
    { id: 'image', kind: 'image-build', x: 1260, y: 240 },
    { id: 'registry', kind: 'registry', x: 1600, y: 240 },
    { id: 'cluster', kind: 'cluster', x: 1260, y: 520 },
    { id: 'namespace', kind: 'namespace', x: 1600, y: 520 },
    { id: 'deployment', kind: 'deployment', x: 1960, y: 320 },
    { id: 'configmap', kind: 'configmap', x: 1960, y: 560 },
    { id: 'pod', kind: 'pod', x: 2300, y: 150 },
    { id: 'service', kind: 'service', x: 2300, y: 390 },
    { id: 'ingress', kind: 'ingress', x: 2640, y: 390 },
  ],
  edges: [
    { source: 'git', target: 'checkout' },
    { source: 'checkout', target: 'test' },
    { source: 'checkout', target: 'lint' },
    { source: 'test', target: 'compile' },
    { source: 'lint', target: 'compile' },
    { source: 'compile', target: 'image' },
    { source: 'dockerfile', target: 'image' },
    { source: 'image', target: 'registry' },
    { source: 'registry', target: 'deployment' },
    { source: 'cluster', target: 'namespace' },
    { source: 'namespace', target: 'deployment' },
    { source: 'namespace', target: 'service' },
    { source: 'deployment', target: 'pod' },
    { source: 'deployment', target: 'service' },
    { source: 'service', target: 'ingress' },
    { source: 'configmap', target: 'deployment' },
  ],
};

const failing: Preset = {
  id: 'red',
  name: 'Failing tests',
  description: 'The same chart, with Test set to fail.',
  nodes: healthy.nodes.map((node) =>
    node.id === 'test' ? { ...node, config: { failTests: true } } : { ...node },
  ),
  edges: healthy.edges.map((edge) => ({ ...edge })),
};

const rollout: Preset = {
  id: 'rollout',
  name: 'Registry rollout',
  description: 'The image is already published. Update the Deployment.',
  nodes: [
    { id: 'cluster', kind: 'cluster', x: 0, y: 40 },
    { id: 'namespace', kind: 'namespace', x: 320, y: 40 },
    { id: 'registry', kind: 'registry', x: 0, y: 250 },
    { id: 'configmap', kind: 'configmap', x: 320, y: 460 },
    { id: 'deployment', kind: 'deployment', x: 640, y: 230 },
    { id: 'pod', kind: 'pod', x: 980, y: 80 },
    { id: 'service', kind: 'service', x: 980, y: 310 },
    { id: 'ingress', kind: 'ingress', x: 1320, y: 310 },
  ],
  edges: [
    { source: 'cluster', target: 'namespace' },
    { source: 'namespace', target: 'deployment' },
    { source: 'namespace', target: 'service' },
    { source: 'registry', target: 'deployment' },
    { source: 'configmap', target: 'deployment' },
    { source: 'deployment', target: 'pod' },
    { source: 'deployment', target: 'service' },
    { source: 'service', target: 'ingress' },
  ],
};

export const PRESETS: Preset[] = [healthy, failing, rollout];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
