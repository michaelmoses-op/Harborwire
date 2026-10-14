import { describe, expect, it } from 'vitest';
import { defaultConfig, getEntry } from './catalog';
import { buildChecklist, buildRun, connectionVerdict } from './graph';
import { PRESETS } from './presets';
import type { GraphEdge, GraphNode, Kind, ResourceConfig } from './types';

function node(
  id: string,
  kind: Kind,
  x: number,
  y: number,
  config?: Partial<ResourceConfig>,
): GraphNode {
  return {
    id,
    kind,
    label: getEntry(kind).title,
    config: { ...defaultConfig(), ...config },
    x,
    y,
  };
}

function edge(source: string, target: string): GraphEdge {
  return { id: `${source}-${target}`, source, target };
}

describe('connection rules', () => {
  const git = node('git', 'git', 0, 0);
  const checkout = node('checkout', 'checkout', 100, 0);
  const service = node('service', 'service', 200, 0);
  const image = node('image', 'image-build', 0, 0);
  const deployment = node('deployment', 'deployment', 100, 0);

  it('accepts a checkout fed by git', () => {
    const verdict = connectionVerdict([git, checkout], [], 'git', 'checkout');
    expect(verdict.ok).toBe(true);
    expect(verdict.reason).toMatch(/clone/i);
  });

  it('refuses a service wired back to git', () => {
    const verdict = connectionVerdict([git, service], [], 'service', 'git');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason.length).toBeGreaterThan(20);
  });

  it('refuses skipping the registry on the way to a deployment', () => {
    const verdict = connectionVerdict([image, deployment], [], 'image', 'deployment');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/registry/i);
  });

  it('refuses a duplicate wire', () => {
    const verdict = connectionVerdict([git, checkout], [edge('git', 'checkout')], 'git', 'checkout');
    expect(verdict.ok).toBe(false);
  });

  it('refuses a card feeding itself', () => {
    const verdict = connectionVerdict([git], [], 'git', 'git');
    expect(verdict.ok).toBe(false);
  });
});

describe('simulation', () => {
  const chain = [
    node('git', 'git', 0, 0),
    node('checkout', 'checkout', 100, 0),
    node('test', 'test', 200, 0),
    node('dockerfile', 'dockerfile', 300, 80),
    node('image', 'image-build', 300, 0),
    node('registry', 'registry', 400, 0),
    node('deployment', 'deployment', 500, 0),
    node('service', 'service', 600, 0),
  ];
  const edges = [
    edge('git', 'checkout'),
    edge('checkout', 'test'),
    edge('test', 'image'),
    edge('dockerfile', 'image'),
    edge('image', 'registry'),
    edge('registry', 'deployment'),
    edge('deployment', 'service'),
  ];

  it('walks a healthy path from git to the service', () => {
    const plan = buildRun(chain, edges);
    expect(plan.outcome).toBe('passed');
    expect(plan.steps.map((step) => step.nodeId)).toEqual([
      'git',
      'checkout',
      'test',
      'dockerfile',
      'image',
      'registry',
      'deployment',
      'service',
    ]);
    expect(plan.steps.every((step) => step.status === 'passed')).toBe(true);
    const imageStep = plan.steps.find((step) => step.nodeId === 'image');
    expect(imageStep?.lines.join(' ')).toMatch(/docker build/);
    expect(imageStep?.lines.join(' ')).toMatch(/Dockerfile/);
    expect(plan.headline).toMatch(/Service/);
  });

  it('skips the push and the cluster when tests fail', () => {
    const failing = chain.map((item) =>
      item.id === 'test' ? node('test', 'test', 200, 0, { failTests: true }) : item,
    );
    const plan = buildRun(failing, edges);
    expect(plan.outcome).toBe('failed');
    expect(plan.steps.map((step) => step.nodeId)).toEqual(['git', 'checkout', 'test']);
    expect(plan.steps.at(-1)?.status).toBe('failed');
    expect(plan.skippedIds).toEqual(['image', 'registry', 'deployment', 'service']);
    expect(plan.skipNote).toMatch(/Registry/);
    expect(plan.headline).toMatch(/Test/);
  });

  it('warns when an image never reaches a registry', () => {
    const plan = buildRun(
      [node('git', 'git', 0, 0), node('checkout', 'checkout', 80, 0), node('image', 'image-build', 160, 0)],
      [edge('git', 'checkout'), edge('checkout', 'image')],
    );
    expect(plan.notes.some((note) => /registry/i.test(note.text))).toBe(true);
    expect(plan.outcome).toBe('partial');
  });

  it('runs a rollout that starts at the registry', () => {
    const plan = buildRun(
      [
        node('registry', 'registry', 0, 0),
        node('deployment', 'deployment', 100, 0),
        node('service', 'service', 200, 0),
      ],
      [edge('registry', 'deployment'), edge('deployment', 'service')],
    );
    expect(plan.outcome).toBe('passed');
    expect(plan.notes.some((note) => /manual rollout/i.test(note.text))).toBe(true);
    expect(plan.steps.map((step) => step.nodeId)).toEqual(['registry', 'deployment', 'service']);
  });
});

describe('presets', () => {
  function asGraph(presetId: string) {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) throw new Error(presetId);
    const nodes = preset.nodes.map((item) => node(item.id, item.kind, item.x, item.y, item.config));
    const edges: GraphEdge[] = [];
    for (const item of preset.edges) {
      const verdict = connectionVerdict(nodes, edges, item.source, item.target);
      expect({
        ok: verdict.ok,
        wire: `${presetId} ${item.source}->${item.target}`,
        reason: verdict.reason,
      }).toMatchObject({ ok: true });
      edges.push(edge(item.source, item.target));
    }
    return { nodes, edges };
  }

  it('uses only legal wires', () => {
    for (const preset of PRESETS) asGraph(preset.id);
  });

  it('marks the healthy chart ready to run', () => {
    const { nodes, edges } = asGraph('web');
    const checks = buildChecklist(nodes, edges, false);
    expect(checks.filter((check) => check.id !== 'run').every((check) => check.done)).toBe(true);
    expect(checks.at(-1)?.done).toBe(false);
    expect(buildRun(nodes, edges).outcome).toBe('passed');
  });

  it('stops the failing-test chart before the registry', () => {
    const { nodes, edges } = asGraph('red');
    const plan = buildRun(nodes, edges);
    expect(plan.outcome).toBe('failed');
    expect(plan.skippedIds).toContain('registry');
    expect(plan.skippedIds).toContain('deployment');
    expect(plan.steps.some((step) => step.nodeId === 'registry')).toBe(false);
  });

  it('reaches a service from the rollout chart', () => {
    const { nodes, edges } = asGraph('rollout');
    expect(buildRun(nodes, edges).outcome).toBe('passed');
  });

  it('uses unique ids and only wires that exist', () => {
    for (const preset of PRESETS) {
      const ids = preset.nodes.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of preset.edges) {
        expect(ids).toContain(item.source);
        expect(ids).toContain(item.target);
      }
    }
  });
});

describe('checklist', () => {
  it('lights each stage only after that handoff exists', () => {
    const git = node('git', 'git', 0, 0);
    const checkout = node('checkout', 'checkout', 1, 0);
    const test = node('test', 'test', 2, 0);
    const dockerfile = node('dockerfile', 'dockerfile', 3, 1);
    const image = node('image', 'image-build', 3, 0);
    const registry = node('registry', 'registry', 4, 0);
    const deployment = node('deployment', 'deployment', 5, 0);
    const service = node('service', 'service', 6, 0);
    const stages = [git, checkout, test, dockerfile, image, registry, deployment, service];
    const wires: GraphEdge[] = [];

    const done = (hasRun = false) =>
      buildChecklist(stages, wires, hasRun)
        .filter((item) => item.done)
        .map((item) => item.id);

    expect(done()).toEqual(['source']);
    wires.push(edge('git', 'checkout'));
    expect(done()).toEqual(['source', 'checkout']);
    wires.push(edge('checkout', 'test'));
    expect(done()).toEqual(['source', 'checkout', 'test']);
    wires.push(edge('dockerfile', 'image'), edge('test', 'image'));
    expect(done()).toContain('dockerfile');
    wires.push(edge('image', 'registry'));
    expect(done()).toContain('registry');
    wires.push(edge('registry', 'deployment'));
    expect(done()).toContain('deploy');
    wires.push(edge('deployment', 'service'));
    expect(done()).toEqual(['source', 'checkout', 'test', 'dockerfile', 'registry', 'deploy', 'expose']);
    expect(done(true)).toContain('run');
  });

  it('accepts a webhook between git and checkout', () => {
    const nodes = [
      node('git', 'git', 0, 0),
      node('hook', 'webhook', 1, 0),
      node('checkout', 'checkout', 2, 0),
    ];
    const edges = [edge('git', 'hook'), edge('hook', 'checkout')];
    const checkout = buildChecklist(nodes, edges, false).find((item) => item.id === 'checkout');
    expect(checkout?.done).toBe(true);
  });
});

describe('narration', () => {
  it('carries the image tag from the build into the push', () => {
    const plan = buildRun(
      [
        node('image', 'image-build', 0, 0, { imageName: 'buoy', tag: '9.9.9', registryHost: 'registry.harborwire.dev' }),
        node('registry', 'registry', 1, 0),
      ],
      [edge('image', 'registry')],
    );
    const text = plan.steps.flatMap((step) => step.lines).join('\n');
    expect(text).toContain('docker build -t registry.harborwire.dev/buoy:9.9.9 .');
    expect(text).toContain('docker push registry.harborwire.dev/buoy:9.9.9');
    expect(text).toMatch(/sha256:[0-9a-f]+a17c0ffee/);
    expect(buildRun(
      [
        node('image', 'image-build', 0, 0, { imageName: 'buoy', tag: '9.9.9' }),
        node('registry', 'registry', 1, 0),
      ],
      [edge('image', 'registry')],
    )).toEqual(plan);
  });

  it('mentions config and the secret name, and never a secret value', () => {
    const plan = buildRun(
      [
        node('config', 'configmap', 0, 0, { configKey: 'LOG_LEVEL=debug' }),
        node('secret', 'secret', 0, 1, { secretName: 'buoy-db' }),
        node('deploy', 'deployment', 1, 0),
      ],
      [edge('config', 'deploy'), edge('secret', 'deploy')],
    );
    const text = plan.steps.flatMap((step) => [step.title, ...step.lines]).join('\n');
    expect(text).toContain('LOG_LEVEL=debug');
    expect(text).toContain('buoy-db');
    expect(text.toLowerCase()).not.toMatch(/password|apikey|api-key|begin private/);
  });

  it('names an illegal wire and a dangling wire instead of following them', () => {
    const plan = buildRun(
      [node('service', 'service', 0, 0), node('git', 'git', 1, 0)],
      [edge('service', 'git'), { id: 'dangling', source: 'service', target: 'missing' }],
    );
    const notes = plan.notes.map((note) => note.text).join('\n');
    expect(notes).toMatch(/Ignored Service → Git repository/);
    expect(notes).toMatch(/not on the chart/);
    expect(plan.steps.map((step) => step.nodeId)).toEqual(['git']);
  });

  it('keeps a finished lint result when a later test fails', () => {
    const plan = buildRun(
      [
        node('git', 'git', 0, 0),
        node('checkout', 'checkout', 10, 0),
        node('lint', 'lint', 20, 0),
        node('test', 'test', 30, 0, { failTests: true }),
        node('image', 'image-build', 40, 0),
      ],
      [
        edge('git', 'checkout'),
        edge('checkout', 'lint'),
        edge('checkout', 'test'),
        edge('test', 'image'),
      ],
    );
    expect(plan.steps.map((step) => `${step.nodeId}:${step.status}`)).toEqual([
      'git:passed',
      'checkout:passed',
      'lint:passed',
      'test:failed',
    ]);
    expect(plan.skippedIds).toEqual(['image']);
    const stepped = new Set(plan.steps.map((step) => step.nodeId));
    for (const id of plan.skippedIds) expect(stepped.has(id)).toBe(false);
  });

  it('says when a card was left off the run', () => {
    const plan = buildRun(
      [node('git', 'git', 0, 0), node('pod', 'pod', 50, 50)],
      [],
    );
    expect(plan.notes.some((note) => note.text.startsWith('Pod is on the chart'))).toBe(true);
    expect(plan.outcome).toBe('partial');
  });
});
