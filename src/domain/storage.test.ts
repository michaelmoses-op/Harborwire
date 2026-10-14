import { afterEach, describe, expect, it } from 'vitest';
import { defaultConfig } from './catalog';
import type { PipelineEdge, PipelineNode } from './flow';
import { clearSavedChart, loadChart, saveChart } from './storage';

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

function chart(): { nodes: PipelineNode[]; edges: PipelineEdge[] } {
  const config = defaultConfig();
  const nodes: PipelineNode[] = [
    {
      id: 'git',
      type: 'pipeline',
      position: { x: 12, y: 24 },
      selected: true,
      data: { kind: 'git', label: 'Renamed', config, status: 'running' },
    },
    {
      id: 'checkout',
      type: 'pipeline',
      position: { x: 40, y: 24 },
      data: {
        kind: 'checkout',
        label: 'Checkout',
        config: { ...config, repo: undefined as unknown as string, tag: '9.9.9' },
        status: 'passed',
      },
    },
  ];
  const edges: PipelineEdge[] = [
    {
      id: 'git-checkout',
      source: 'git',
      target: 'checkout',
      selected: true,
      animated: true,
      data: { reason: 'CI clones this repository and checks out the commit that started the run.' },
    },
    { id: 'orphan', source: 'git', target: 'missing', data: { reason: 'nope' } },
  ];
  return { nodes, edges };
}

describe('saved charts', () => {
  afterEach(() => {
    clearSavedChart();
  });

  it('round-trips a chart and drops wires that point nowhere', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
    const { nodes, edges } = chart();
    saveChart(nodes, edges);
    const loaded = loadChart();
    expect(loaded?.nodes.map((node) => node.id)).toEqual(['git', 'checkout']);
    expect(loaded?.nodes.every((node) => node.data.status === 'idle' && node.selected !== true)).toBe(true);
    expect(loaded?.nodes[0]?.data.label).toBe('Git repository');
    expect(loaded?.nodes[1]?.data.config.repo).toBe(defaultConfig().repo);
    expect(loaded?.nodes[1]?.data.config.tag).toBe('9.9.9');
    expect(loaded?.edges.map((edge) => edge.id)).toEqual(['git-checkout']);
    expect(loaded?.edges[0]?.animated).toBe(false);
  });

  it('returns null for an empty browser and for garbage', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
    expect(loadChart()).toBeNull();
    localStorage.setItem('harborwire.chart.v1', '{');
    expect(loadChart()).toBeNull();
    localStorage.setItem('harborwire.chart.v1', JSON.stringify({ nodes: [{ id: 'x', data: { kind: 'nope' } }], edges: [] }));
    expect(loadChart()).toBeNull();
  });

  it('ignores a storage write that throws', () => {
    const broken = memoryStorage();
    broken.setItem = () => {
      throw new Error('full');
    };
    Object.defineProperty(globalThis, 'localStorage', { value: broken, configurable: true });
    expect(() => saveChart(chart().nodes, chart().edges)).not.toThrow();
  });
});
