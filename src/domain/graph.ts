/**
 * Chart rules for Harborwire.
 * A "run" is a reading of the graph in dependency order.
 * This module never calls a cluster, registry, Git host, or CI provider.
 */
import { defaultConfig, getEntry } from './catalog';
import type {
  CheckItem,
  GraphEdge,
  GraphNode,
  Kind,
  LogNote,
  ResourceConfig,
  RunPlan,
  RunStep,
} from './types';

interface Wire {
  from: Kind;
  to: Kind;
  reason: string;
}

const WIRES: Wire[] = [
  {
    from: 'git',
    to: 'webhook',
    reason: 'A push on the repository emits the event this webhook carries to CI.',
  },
  {
    from: 'git',
    to: 'checkout',
    reason: 'CI clones this repository and checks out the commit that started the run.',
  },
  {
    from: 'webhook',
    to: 'checkout',
    reason: 'The webhook tells CI which commit to put in a clean workspace.',
  },
  {
    from: 'checkout',
    to: 'test',
    reason: 'Tests run against the checked-out commit.',
  },
  {
    from: 'checkout',
    to: 'lint',
    reason: 'Lint reads the same workspace the tests see.',
  },
  {
    from: 'checkout',
    to: 'compile',
    reason: 'The language build compiles that commit.',
  },
  {
    from: 'checkout',
    to: 'image-build',
    reason: 'The checkout is the Docker build context: the files the image is made from.',
  },
  {
    from: 'test',
    to: 'compile',
    reason: 'A green test run is the gate in front of the compile.',
  },
  {
    from: 'test',
    to: 'image-build',
    reason: 'A green test run is the gate in front of the image.',
  },
  {
    from: 'lint',
    to: 'compile',
    reason: 'Lint is a fast gate in front of the compile.',
  },
  {
    from: 'lint',
    to: 'image-build',
    reason: 'Lint is a fast gate in front of the image.',
  },
  {
    from: 'compile',
    to: 'image-build',
    reason: 'The image packages the compiled output from the runner.',
  },
  {
    from: 'dockerfile',
    to: 'image-build',
    reason: 'The Dockerfile is the recipe the image build executes.',
  },
  {
    from: 'image-build',
    to: 'registry',
    reason: 'This wire is the push. The image leaves the runner and is stored in the registry.',
  },
  {
    from: 'image-build',
    to: 'container',
    reason: 'docker run starts a container from the image that was just built.',
  },
  {
    from: 'registry',
    to: 'container',
    reason: 'A local container can run an image that already lives in the registry.',
  },
  {
    from: 'registry',
    to: 'deployment',
    reason: 'The Deployment’s pod template pulls this image by name and tag.',
  },
  {
    from: 'container',
    to: 'pod',
    reason: 'The pod template runs this container. A pod is what Kubernetes schedules; the container is the process inside it.',
  },
  {
    from: 'cluster',
    to: 'namespace',
    reason: 'Namespaces divide one cluster’s control plane.',
  },
  {
    from: 'cluster',
    to: 'deployment',
    reason: 'The Deployment is an object on this cluster.',
  },
  {
    from: 'namespace',
    to: 'deployment',
    reason: 'The Deployment is created inside this namespace.',
  },
  {
    from: 'namespace',
    to: 'service',
    reason: 'The Service name is unique inside this namespace.',
  },
  {
    from: 'namespace',
    to: 'ingress',
    reason: 'The Ingress is created inside this namespace.',
  },
  {
    from: 'namespace',
    to: 'pod',
    reason: 'The Pod runs in this namespace.',
  },
  {
    from: 'namespace',
    to: 'configmap',
    reason: 'ConfigMaps live in a namespace.',
  },
  {
    from: 'namespace',
    to: 'secret',
    reason: 'Secrets live in a namespace.',
  },
  {
    from: 'deployment',
    to: 'pod',
    reason: 'The Deployment creates and replaces these pods from its template.',
  },
  {
    from: 'deployment',
    to: 'service',
    reason: 'The Service selects the pods this Deployment manages.',
  },
  {
    from: 'pod',
    to: 'service',
    reason: 'The Service sends traffic to this pod.',
  },
  {
    from: 'service',
    to: 'ingress',
    reason: 'The Ingress publishes HTTP and forwards it to this Service.',
  },
  {
    from: 'configmap',
    to: 'deployment',
    reason: 'The Deployment mounts this ConfigMap into the pod template.',
  },
  {
    from: 'secret',
    to: 'deployment',
    reason: 'The Deployment references this Secret by name. The value stays out of the image and out of Git.',
  },
];

const MISMATCH: Record<string, string> = {
  'image-build>deployment':
    'Wire Image build to Registry, then Registry to Deployment. Kubernetes pulls from a registry, so the runner’s local image has to be pushed first.',
  'compile>deployment':
    'Package the compile output with an image build, push that image, then point the Deployment at the tag.',
  'git>deployment':
    'The cluster runs an image CI has tested and pushed. Wire Git into Checkout, and let the pipeline reach the registry before the Deployment.',
  'service>git':
    'Draw toward the running app. A Service routes traffic to pods; the story starts at Git and moves right.',
  'ingress>service':
    'Draw the wire from Service to Ingress. Requests travel from the hostname to the Service.',
  'service>pod':
    'Draw from the Deployment or the Pod toward the Service. The Service selects pods; it does not create them.',
  'service>deployment':
    'Draw from the Deployment to the Service. The Service is the address in front of the pods.',
  'registry>image-build':
    'Draw from Image build to Registry. That wire is the push.',
  'pod>dockerfile':
    'The Dockerfile stays with the source. Image build is what turns the recipe into an image.',
  'deployment>git':
    'The chart reads from source and rolls out to the cluster. A Deployment does not write the next commit.',
  'registry>checkout':
    'Checkout starts from Git or a webhook. The registry is where images land after CI.',
  'dockerfile>registry':
    'Run the Dockerfile through Image build, then push the result to the Registry.',
  'ingress>deployment':
    'Put a Service between them. The Ingress knows a Service; the Service knows the pods.',
  'test>git':
    'Leave the commit as it is. Test reports a status, and a failure stops the downstream cards.',
  'container>registry':
    'Publish from Image build. A running container is a process, not the upload.',
};

function wireBetween(from: Kind, to: Kind): Wire | undefined {
  return WIRES.find((wire) => wire.from === from && wire.to === to);
}

export function isAllowed(from: Kind, to: Kind): boolean {
  return Boolean(wireBetween(from, to));
}

export function downstreamKinds(kind: Kind): Kind[] {
  const seen = new Set<Kind>();
  for (const wire of WIRES) {
    if (wire.from === kind) seen.add(wire.to);
  }
  return [...seen];
}

export function upstreamKinds(kind: Kind): Kind[] {
  const seen = new Set<Kind>();
  for (const wire of WIRES) {
    if (wire.to === kind) seen.add(wire.from);
  }
  return [...seen];
}

function explainMismatch(from: Kind, to: Kind): string {
  const specific = MISMATCH[`${from}>${to}`];
  if (specific) return specific;
  const source = getEntry(from);
  const target = getEntry(to);
  return `${source.title} hands off ${source.produces}. ${target.title} takes ${target.consumes}. A real pipeline has no wire between those two.`;
}

function outgoing(edges: GraphEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const list = map.get(edge.source) ?? [];
    list.push(edge.target);
    map.set(edge.source, list);
  }
  return map;
}

export function reaches(from: string, to: string, edges: GraphEdge[]): boolean {
  const next = outgoing(edges);
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    if (id === to) return true;
    seen.add(id);
    for (const neighbor of next.get(id) ?? []) stack.push(neighbor);
  }
  return false;
}

function descendantsOf(seeds: string[], edges: GraphEdge[]): Set<string> {
  const next = outgoing(edges);
  const seen = new Set<string>();
  const stack = [...seeds];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    for (const neighbor of next.get(id) ?? []) stack.push(neighbor);
  }
  return seen;
}

function ancestorsOf(seeds: string[], edges: GraphEdge[]): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const list = incoming.get(edge.target) ?? [];
    list.push(edge.source);
    incoming.set(edge.target, list);
  }
  const seen = new Set<string>();
  const stack = [...seeds];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    for (const neighbor of incoming.get(id) ?? []) stack.push(neighbor);
  }
  return seen;
}

export interface Verdict {
  ok: boolean;
  reason: string;
}

export function connectionVerdict(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  targetId: string,
): Verdict {
  if (sourceId === targetId) {
    return {
      ok: false,
      reason: 'Draw the wire to the next stage. A card does not feed itself.',
    };
  }
  const source = nodes.find((node) => node.id === sourceId);
  const target = nodes.find((node) => node.id === targetId);
  if (!source || !target) {
    return { ok: false, reason: 'Those cards are no longer on the chart.' };
  }
  if (edges.some((edge) => edge.source === sourceId && edge.target === targetId)) {
    return { ok: false, reason: 'That wire is already on the chart.' };
  }
  const wire = wireBetween(source.kind, target.kind);
  if (!wire) {
    return { ok: false, reason: explainMismatch(source.kind, target.kind) };
  }
  if (reaches(targetId, sourceId, edges)) {
    return {
      ok: false,
      reason: 'That wire would loop the pipeline. Keep drawing downstream, toward the running app.',
    };
  }
  return { ok: true, reason: wire.reason };
}

function validEdges(nodes: GraphNode[], edges: GraphEdge[]): GraphEdge[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges.filter((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    return Boolean(source && target && isAllowed(source.kind, target.kind));
  });
}

function imageRef(config: ResourceConfig): string {
  return `${config.registryHost}/${config.imageName}:${config.tag}`;
}

function fakeDigest(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `sha256:${(hash >>> 0).toString(16).padStart(8, '0')}a17c0ffee`;
}

interface SimCtx {
  repo: string;
  branch: string;
  sha: string;
  imageRef: string | null;
  namespace: string | null;
  cluster: string | null;
  configKey: string | null;
  secretName: string | null;
}

function narrate(
  node: GraphNode,
  ctx: SimCtx,
  upstream: Kind[],
): { lines: string[]; status: 'passed' | 'failed' } {
  const config = node.config;
  switch (node.kind) {
    case 'git': {
      ctx.repo = config.repo || ctx.repo;
      ctx.branch = config.branch || ctx.branch;
      ctx.sha = config.sha || ctx.sha;
      return {
        status: 'passed',
        lines: [
          `Branch ${ctx.branch} at ${ctx.sha}.`,
          'A push of this commit is the event the rest of the pipeline reacts to.',
        ],
      };
    }
    case 'webhook':
      return {
        status: 'passed',
        lines: [
          `The Git host sends a push event for ${ctx.branch}.`,
          'CI queues a workflow for that commit. Harborwire is not receiving a real hook.',
        ],
      };
    case 'checkout':
      return {
        status: 'passed',
        lines: [
          `git checkout ${ctx.sha} in a clean workspace of ${ctx.repo}.`,
          'Test, lint, and image build read this workspace.',
        ],
      };
    case 'test':
      if (config.failTests) {
        return {
          status: 'failed',
          lines: [
            `npm test — ${ctx.repo}@${ctx.sha}.`,
            '1 failed: GET /healthz expected 200, got 500 (simulated).',
            'CI stops this commit so the image is not pushed and the cluster is left alone.',
          ],
        };
      }
      return {
        status: 'passed',
        lines: [
          `npm test — ${ctx.repo}@${ctx.sha}.`,
          '48 passed. This commit may move downstream.',
        ],
      };
    case 'lint':
      return {
        status: 'passed',
        lines: [
          `eslint . on ${ctx.repo}@${ctx.sha}.`,
          'No violations (simulated). The tests still decide whether the commit is safe.',
        ],
      };
    case 'compile':
      return {
        status: 'passed',
        lines: [
          'npm run build — TypeScript writes dist/ (simulated).',
          'The output stays on the runner until an image build copies it.',
        ],
      };
    case 'dockerfile':
      return {
        status: 'passed',
        lines: [
          'FROM node:20-alpine, copy the app, start the server.',
          'The file is source. Image build is what executes it.',
        ],
      };
    case 'image-build': {
      const ref = imageRef(config);
      ctx.imageRef = ref;
      return {
        status: 'passed',
        lines: [
          `docker build -t ${ref} .`,
          upstream.includes('dockerfile')
            ? `Recipe: the connected Dockerfile. Context: ${ctx.repo}@${ctx.sha}.`
            : 'No Dockerfile card is connected. A real build needs one in the context. This run assumes a Node image that starts the buoy server.',
          'The tagged image is on the CI runner until something pushes it.',
        ],
      };
    }
    case 'container': {
      const ref = ctx.imageRef ?? imageRef(config);
      return {
        status: 'passed',
        lines: [
          `docker run --rm -p ${config.containerPort}:${config.containerPort} ${ref}`,
          'One process on one machine. A Pod is the Kubernetes version of this idea, and the scheduler can place it again.',
        ],
      };
    }
    case 'registry': {
      if (ctx.imageRef) {
        const ref = ctx.imageRef;
        return {
          status: 'passed',
          lines: [
            `docker push ${ref}`,
            `Accepted by ${config.registryHost}. Simulated digest ${fakeDigest(ref)}.`,
            'Cluster nodes can pull this tag because the push happened.',
          ],
        };
      }
      const ref = imageRef(config);
      ctx.imageRef = ref;
      return {
        status: 'passed',
        lines: [
          `${ref} is already in ${config.registryHost}. This run does not rebuild it.`,
          `Simulated digest ${fakeDigest(ref)}.`,
          'A rollout can point a Deployment at this tag directly.',
        ],
      };
    }
    case 'cluster':
      ctx.cluster = config.cluster || ctx.cluster;
      return {
        status: 'passed',
        lines: [
          `Cluster ${ctx.cluster} would admit the objects wired into it.`,
          'This simulation does not contact an API server.',
        ],
      };
    case 'namespace':
      ctx.namespace = config.namespace || ctx.namespace;
      return {
        status: 'passed',
        lines: [
          ctx.cluster
            ? `Namespace ${ctx.namespace} on ${ctx.cluster}.`
            : `Namespace ${ctx.namespace}.`,
          'The Deployment and Service in this story share that name boundary.',
        ],
      };
    case 'configmap':
      ctx.configKey = config.configKey;
      return {
        status: 'passed',
        lines: [
          `Data ${config.configKey}.`,
          'Mounted into the pod as environment. Changing it does not rebuild the image.',
        ],
      };
    case 'secret':
      ctx.secretName = config.secretName;
      return {
        status: 'passed',
        lines: [
          `The Deployment may mount Secret ${config.secretName} when the pod starts.`,
          'The value is not on this chart. It stays out of Git and out of the image.',
        ],
      };
    case 'deployment': {
      const ref = ctx.imageRef ?? imageRef(config);
      const ns = ctx.namespace ?? config.namespace;
      const where = ctx.cluster ? `${ns} on ${ctx.cluster}` : ns;
      const lines = [
        `Pod template image is ${ref}.`,
        `${config.replicas} replica${config.replicas === 1 ? '' : 's'} in ${where}. New pods become Ready, then old pods stop.`,
      ];
      if (ctx.configKey) lines.push(`Environment includes ${ctx.configKey} from the connected ConfigMap.`);
      if (ctx.secretName) lines.push(`The template references Secret ${ctx.secretName}.`);
      lines.push('The Deployment keeps the pods running. A Service is what gives them an address.');
      return { status: 'passed', lines };
    }
    case 'pod': {
      const ref = ctx.imageRef ?? imageRef(config);
      return {
        status: 'passed',
        lines: [
          `Kubelet pulls ${ref} and starts the container on port ${config.containerPort}.`,
          'The Deployment restarts it if it exits. The scheduler placed the pod; you did not pick a machine.',
        ],
      };
    }
    case 'service':
      return {
        status: 'passed',
        lines: [
          `ClusterIP ${config.appName} listens on ${config.servicePort} and forwards to container port ${config.containerPort}.`,
          'The address stays put while pods are replaced.',
        ],
      };
    case 'ingress':
      return {
        status: 'passed',
        lines: [
          `Host ${config.host} forwards HTTP to Service ${config.appName}:${config.servicePort}.`,
          'DNS and the certificate live outside the cluster. This card is the routing rule.',
        ],
      };
    default:
      return { status: 'passed', lines: ['This card is on the chart.'] };
  }
}

function topoOrder(ids: string[], edges: GraphEdge[], nodes: Map<string, GraphNode>): string[] {
  const indegree = new Map(ids.map((id) => [id, 0]));
  for (const edge of edges) {
    if (!indegree.has(edge.target) || !indegree.has(edge.source)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const ready = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  const sortReady = () => {
    ready.sort((a, b) => {
      const left = nodes.get(a);
      const right = nodes.get(b);
      return (left?.x ?? 0) - (right?.x ?? 0) || (left?.y ?? 0) - (right?.y ?? 0) || a.localeCompare(b);
    });
  };
  while (ready.length > 0) {
    sortReady();
    const id = ready.shift();
    if (!id) break;
    order.push(id);
    for (const edge of edges) {
      if (edge.source !== id) continue;
      const next = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, next);
      if (next === 0) ready.push(edge.target);
    }
  }
  return order;
}

function upstreamKindsOf(id: string, edges: GraphEdge[], nodes: Map<string, GraphNode>): Kind[] {
  const kinds: Kind[] = [];
  for (const edge of edges) {
    if (edge.target !== id) continue;
    const source = nodes.get(edge.source);
    if (source) kinds.push(source.kind);
  }
  return kinds;
}

export function buildRun(nodes: GraphNode[], edges: GraphEdge[]): RunPlan {
  if (nodes.length === 0) {
    return {
      outcome: 'empty',
      headline: 'The chart is empty.',
      notes: [
        {
          tone: 'info',
          text: 'Drag a Git repository onto the chart. Then wire Checkout, Test, Image build, Registry, Deployment, and Service.',
        },
      ],
      steps: [],
      skippedIds: [],
      skipNote: null,
    };
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const legal = validEdges(nodes, edges);
  const notes: LogNote[] = [
    {
      tone: 'muted',
      text: 'Harborwire simulation. Nothing is sent to a cluster, registry, or CI provider.',
    },
  ];

  for (const edge of edges) {
    if (legal.includes(edge)) continue;
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) {
      notes.push({
        tone: 'warn',
        text: 'A wire points at a card that is not on the chart, so the run ignores it.',
      });
      continue;
    }
    notes.push({
      tone: 'warn',
      text: `Ignored ${source.label} → ${target.label}. ${explainMismatch(source.kind, target.kind)}`,
    });
  }

  const triggers = nodes.filter((node) => node.kind === 'git' || node.kind === 'webhook');
  let seeds: string[];
  if (triggers.length > 0) {
    seeds = triggers.map((node) => node.id);
  } else {
    const indegree = new Map(nodes.map((node) => [node.id, 0]));
    for (const edge of legal) indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    const connected = new Set(legal.flatMap((edge) => [edge.source, edge.target]));
    seeds = nodes
      .filter((node) => connected.has(node.id) && (indegree.get(node.id) ?? 0) === 0)
      .map((node) => node.id);
    if (seeds.length === 0) seeds = nodes.map((node) => node.id);
    notes.push({
      tone: 'info',
      text: 'No Git trigger is wired, so this run starts from the cards you placed, like a manual rollout.',
    });
  }

  const downstream = descendantsOf(seeds, legal);
  const included = ancestorsOf([...downstream], legal);
  const includedIds = [...included];
  const subEdges = legal.filter((edge) => included.has(edge.source) && included.has(edge.target));

  const outsiders = nodes.filter((node) => !included.has(node.id));
  for (const node of outsiders.slice(0, 5)) {
    notes.push({
      tone: 'muted',
      text: `${node.label} is on the chart and not part of this run. Wire it into the path if it should participate.`,
    });
  }
  if (outsiders.length > 5) {
    notes.push({
      tone: 'muted',
      text: `${outsiders.length - 5} other cards are on the chart and not part of this run.`,
    });
  }

  const order = topoOrder(includedIds, subEdges, byId);
  if (order.length !== includedIds.length) {
    notes.push({
      tone: 'warn',
      text: 'A loop is hiding in the chart, so the run follows only the part it can order.',
    });
  }

  const imageBuilds = order.filter((id) => byId.get(id)?.kind === 'image-build');
  if (
    imageBuilds.length > 0 &&
    imageBuilds.every((id) => {
      const down = descendantsOf([id], subEdges);
      return ![...down].some((next) => byId.get(next)?.kind === 'registry');
    })
  ) {
    notes.push({
      tone: 'warn',
      text: 'Image build has no wire to a Registry. Cluster nodes pull images from a registry, not from the CI runner’s disk.',
    });
  }

  const failingTests = order.filter((id) => {
    const node = byId.get(id);
    return node?.kind === 'test' && node.config.failTests;
  });
  if (failingTests.length > 0) {
    notes.push({
      tone: 'warn',
      text: 'Test is set to fail. Stages downstream of that gate will be skipped.',
    });
  }

  const defaults = defaultConfig();
  const ctx: SimCtx = {
    repo: defaults.repo,
    branch: defaults.branch,
    sha: defaults.sha,
    imageRef: null,
    namespace: null,
    cluster: null,
    configKey: null,
    secretName: null,
  };

  const steps: RunStep[] = [];
  const skippedIds: string[] = [];
  const failedIds: string[] = [];
  let stopped = false;

  for (const id of order) {
    const node = byId.get(id);
    if (!node) continue;
    const afterFailure = failedIds.some((failedId) => reaches(failedId, id, subEdges) && failedId !== id);
    if (stopped) {
      if (afterFailure) skippedIds.push(id);
      continue;
    }
    if (afterFailure) {
      skippedIds.push(id);
      continue;
    }
    const narration = narrate(node, ctx, upstreamKindsOf(id, subEdges, byId));
    steps.push({
      nodeId: id,
      title: node.label,
      lines: narration.lines,
      status: narration.status,
    });
    if (narration.status === 'failed') {
      failedIds.push(id);
      stopped = true;
    }
  }

  const skipNote =
    skippedIds.length > 0
      ? `Stopping the pipeline. These stages never ran: ${skippedIds
          .map((id) => byId.get(id)?.label)
          .filter(Boolean)
          .join(', ')}.`
      : null;

  const passedKinds = new Set(
    steps.filter((step) => step.status === 'passed').map((step) => byId.get(step.nodeId)?.kind),
  );
  let outcome: RunPlan['outcome'] = 'partial';
  let headline = 'The run finished before a Deployment.';
  if (steps.some((step) => step.status === 'failed')) {
    outcome = 'failed';
    const failed = steps.find((step) => step.status === 'failed');
    headline = `The commit stopped at ${failed?.title ?? 'a gate'}.`;
  } else if (passedKinds.has('service')) {
    outcome = 'passed';
    headline = 'The commit made it to the Service.';
  } else if (passedKinds.has('deployment')) {
    outcome = 'passed';
    headline = 'The commit made it onto the Deployment.';
  } else if (steps.length === 0) {
    outcome = 'empty';
    headline = 'Nothing is wired into a run yet.';
  }

  return { outcome, headline, notes, steps, skippedIds, skipNote };
}

function idsOf(nodes: GraphNode[], kind: Kind): string[] {
  return nodes.filter((node) => node.kind === kind).map((node) => node.id);
}

function reachesAny(starts: string[], goals: string[], edges: GraphEdge[]): boolean {
  if (starts.length === 0 || goals.length === 0) return false;
  const goalSet = new Set(goals);
  const seen = descendantsOf(starts, edges);
  for (const id of seen) {
    if (goalSet.has(id)) return true;
  }
  return false;
}

export function buildChecklist(nodes: GraphNode[], edges: GraphEdge[], hasRun: boolean): CheckItem[] {
  const legal = validEdges(nodes, edges);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const dockerfileWired = legal.some((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    return source?.kind === 'dockerfile' && target?.kind === 'image-build';
  });

  const items: CheckItem[] = [
    {
      id: 'source',
      label: 'Source',
      hint: 'Drag Git repository onto the chart. The commit is the start of the story.',
      done: nodes.some((node) => node.kind === 'git'),
      suggest: 'git',
    },
    {
      id: 'checkout',
      label: 'Checkout',
      hint: 'Wire Git to Checkout. CI works from a clean copy of that commit.',
      done: reachesAny(idsOf(nodes, 'git'), idsOf(nodes, 'checkout'), legal),
      suggest: 'checkout',
    },
    {
      id: 'test',
      label: 'Test',
      hint: 'Wire Checkout to Test. A red test is how a bad commit gets stopped.',
      done: reachesAny(idsOf(nodes, 'checkout'), idsOf(nodes, 'test'), legal),
      suggest: 'test',
    },
    {
      id: 'dockerfile',
      label: 'Dockerfile',
      hint: 'Connect Dockerfile to Image build. The file is the recipe; the build runs it.',
      done: dockerfileWired,
      suggest: 'dockerfile',
    },
    {
      id: 'registry',
      label: 'Registry',
      hint: 'Wire Image build to Registry. That wire is the docker push.',
      done: reachesAny(idsOf(nodes, 'image-build'), idsOf(nodes, 'registry'), legal),
      suggest: 'registry',
    },
    {
      id: 'deploy',
      label: 'Deploy',
      hint: 'Wire Registry to Deployment. The cluster pulls the tag you pushed.',
      done: reachesAny(idsOf(nodes, 'registry'), idsOf(nodes, 'deployment'), legal),
      suggest: 'deployment',
    },
    {
      id: 'expose',
      label: 'Expose',
      hint: 'Wire Deployment to Service so the pods get a stable address.',
      done: reachesAny(idsOf(nodes, 'deployment'), idsOf(nodes, 'service'), legal),
      suggest: 'service',
    },
    {
      id: 'run',
      label: 'Run',
      hint: 'Press Run pipeline and read the log from top to bottom.',
      done: hasRun,
      suggest: null,
    },
  ];
  return items;
}
