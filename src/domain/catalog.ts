import type { Category, FieldDef, Kind, ResourceConfig } from './types';

export interface CategoryMeta {
  id: Category;
  label: string;
  color: string;
  summary: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  source: {
    id: 'source',
    label: 'Source',
    color: '#f0b429',
    summary: 'Where a change enters the pipeline.',
  },
  ci: {
    id: 'ci',
    label: 'CI',
    color: '#79a7ff',
    summary: 'A clean machine that checks the commit.',
  },
  docker: {
    id: 'docker',
    label: 'Docker',
    color: '#2cb5a0',
    summary: 'Packages the app so it runs the same everywhere.',
  },
  registry: {
    id: 'registry',
    label: 'Registry',
    color: '#e07a3d',
    summary: 'Stores images the cluster can pull.',
  },
  kubernetes: {
    id: 'kubernetes',
    label: 'Kubernetes',
    color: '#8ec9a0',
    summary: 'Keeps the packaged app running.',
  },
};

export const CATEGORY_ORDER: Category[] = ['source', 'ci', 'docker', 'registry', 'kubernetes'];

export const DEFAULT_CONFIG: ResourceConfig = {
  repo: 'harbor/buoy',
  branch: 'main',
  sha: 'a1c4e90',
  failTests: false,
  imageName: 'buoy',
  tag: '1.4.2',
  registryHost: 'registry.harborwire.dev',
  replicas: 2,
  appName: 'buoy',
  servicePort: 80,
  containerPort: 3000,
  host: 'buoy.harbor.test',
  namespace: 'prod',
  cluster: 'harbor-prod',
  configKey: 'LOG_LEVEL=info',
  secretName: 'buoy-db',
};

export function defaultConfig(): ResourceConfig {
  return { ...DEFAULT_CONFIG };
}

const repo: FieldDef = {
  key: 'repo',
  label: 'Repository',
  type: 'text',
  help: 'The project this pipeline is reading.',
};
const branch: FieldDef = {
  key: 'branch',
  label: 'Branch',
  type: 'text',
  help: 'CI checks out this branch.',
};
const sha: FieldDef = {
  key: 'sha',
  label: 'Commit',
  type: 'text',
  help: 'Short id of the commit the run is about.',
};
const failTests: FieldDef = {
  key: 'failTests',
  label: 'Simulate a failing test',
  type: 'checkbox',
  help: 'CI stops the commit here. Later stages stay dark.',
};
const imageName: FieldDef = {
  key: 'imageName',
  label: 'Image name',
  type: 'text',
  help: 'The name published to the registry.',
};
const tag: FieldDef = {
  key: 'tag',
  label: 'Tag',
  type: 'text',
  help: 'A movable name for this build, like a version.',
};
const registryHost: FieldDef = {
  key: 'registryHost',
  label: 'Registry host',
  type: 'text',
  help: 'Where the image is stored after the push.',
};
const replicas: FieldDef = {
  key: 'replicas',
  label: 'Replicas',
  type: 'number',
  min: 1,
  max: 6,
  help: 'How many copies of the pod the Deployment wants.',
};
const appName: FieldDef = {
  key: 'appName',
  label: 'App name',
  type: 'text',
  help: 'Shared name used by the Deployment and Service.',
};
const servicePort: FieldDef = {
  key: 'servicePort',
  label: 'Service port',
  type: 'number',
  min: 1,
  max: 65535,
  help: 'The stable port callers use.',
};
const containerPort: FieldDef = {
  key: 'containerPort',
  label: 'Container port',
  type: 'number',
  min: 1,
  max: 65535,
  help: 'The port the process inside the container listens on.',
};
const host: FieldDef = {
  key: 'host',
  label: 'Hostname',
  type: 'text',
  help: 'The public name the Ingress matches.',
};
const namespace: FieldDef = {
  key: 'namespace',
  label: 'Namespace',
  type: 'text',
  help: 'The naming boundary these objects live in.',
};
const cluster: FieldDef = {
  key: 'cluster',
  label: 'Cluster',
  type: 'text',
  help: 'A name for the control plane in this story.',
};
const configKey: FieldDef = {
  key: 'configKey',
  label: 'Example entry',
  type: 'text',
  help: 'Config the pod reads at runtime.',
};
const secretName: FieldDef = {
  key: 'secretName',
  label: 'Secret name',
  type: 'text',
  help: 'A reference only. Harborwire never asks for the value.',
};

export interface CatalogEntry {
  kind: Kind;
  category: Category;
  title: string;
  blurb: string;
  lesson: string;
  fits: string;
  consumes: string;
  produces: string;
  watch: string;
  fields: FieldDef[];
}

const ENTRIES: CatalogEntry[] = [
  {
    kind: 'git',
    category: 'source',
    title: 'Git repository',
    blurb: 'The commit the pipeline is reacting to.',
    lesson:
      'Git stores the change. A pipeline starts when a branch moves, usually because someone pushed. The rest of the chart is about that one commit.',
    fits: 'Put this at the far left. Checkout, or a webhook that leads to checkout, is the next card.',
    consumes: 'a push from a developer',
    produces: 'a commit on a branch',
    watch: 'The cluster never reads the repo directly. It runs an image that CI built from the commit.',
    fields: [repo, branch, sha],
  },
  {
    kind: 'webhook',
    category: 'source',
    title: 'Webhook',
    blurb: 'A push event that wakes CI up.',
    lesson:
      'The Git host sends a small HTTP message when the branch moves. CI uses it to queue a workflow for that commit. Polling the repo can do the same job more slowly.',
    fits: 'Sit it between Git repository and Checkout when you want the event to be visible.',
    consumes: 'a push event',
    produces: 'a queued CI run',
    watch: 'A webhook is a doorbell. The work happens in the stages after checkout.',
    fields: [],
  },
  {
    kind: 'checkout',
    category: 'ci',
    title: 'Checkout',
    blurb: 'A clean copy of the commit on the runner.',
    lesson:
      'CI clones the repo onto a short-lived machine and checks out the exact commit. Tests and builds read that workspace, so they are not affected by files left on a laptop.',
    fits: 'This is the first CI stage. Fan out from here into Test and Lint.',
    consumes: 'a commit',
    produces: 'a workspace',
    watch: 'Later stages should hang off this workspace. Building from a different commit than you tested is a classic mix-up.',
    fields: [],
  },
  {
    kind: 'test',
    category: 'ci',
    title: 'Test',
    blurb: 'The gate that decides if the commit may proceed.',
    lesson:
      'Tests run the app in the CI workspace and report pass or fail. A failure is the pipeline working: the bad commit stops before an image is pushed.',
    fits: 'Place it after Checkout. Wire it onward to Compile or Image build so it can block them.',
    consumes: 'a workspace',
    produces: 'a pass or fail signal',
    watch: 'Turn on “Simulate a failing test” and run again. The registry card should stay dark.',
    fields: [failTests],
  },
  {
    kind: 'lint',
    category: 'ci',
    title: 'Lint',
    blurb: 'A fast check for style and easy mistakes.',
    lesson:
      'Lint reads the workspace and flags patterns the team has agreed to avoid. It is cheap, and it is not a substitute for tests that exercise behavior.',
    fits: 'Run it beside Test, both fed by Checkout.',
    consumes: 'a workspace',
    produces: 'a style signal',
    watch: 'A green lint run does not mean the feature works.',
    fields: [],
  },
  {
    kind: 'compile',
    category: 'ci',
    title: 'Compile',
    blurb: 'Turns source into build output.',
    lesson:
      'This is the language build: tsc, go build, mvn package. It produces files on the runner. It does not produce the container the cluster will run.',
    fits: 'After the gates, and before Image build, which copies the output into an image.',
    consumes: 'a workspace',
    produces: 'build output on the runner',
    watch: 'People say “build” for both this step and the Docker build. On this chart they are different cards.',
    fields: [],
  },
  {
    kind: 'dockerfile',
    category: 'docker',
    title: 'Dockerfile',
    blurb: 'The recipe for an image.',
    lesson:
      'A Dockerfile lists the base image, the files to copy, and the command to start. It lives in Git next to the code. By itself it does nothing until an image build runs it.',
    fits: 'Wire it into Image build, alongside the checkout that supplies the files.',
    consumes: 'instructions you edit',
    produces: 'an image recipe',
    watch: 'Keep config you want to change without a rebuild out of the image. That belongs in a ConfigMap or Secret.',
    fields: [],
  },
  {
    kind: 'image-build',
    category: 'docker',
    title: 'Image build',
    blurb: 'Runs the Dockerfile and tags an image.',
    lesson:
      'docker build reads the Dockerfile and the workspace, stacks filesystem layers, and tags the result. The image is still local to the CI runner.',
    fits: 'Feed it from Checkout or Compile, and from the Dockerfile. Its output wire goes to the Registry.',
    consumes: 'a workspace and a Dockerfile',
    produces: 'a local image tag',
    watch: 'Kubernetes nodes cannot see the runner’s disk. The next handoff is a push.',
    fields: [imageName, tag, registryHost],
  },
  {
    kind: 'container',
    category: 'docker',
    title: 'Container',
    blurb: 'A running process from an image.',
    lesson:
      'docker run starts a container: one process (plus its children) with the image’s filesystem. It lives and dies with the machine it was started on.',
    fits: 'Useful as a bridge. Wire an image to this card, then this card to a Pod to see what Kubernetes wraps.',
    consumes: 'an image',
    produces: 'a running process on one machine',
    watch: 'A Pod is the Kubernetes object. The container is the process inside it.',
    fields: [imageName, tag, containerPort],
  },
  {
    kind: 'registry',
    category: 'registry',
    title: 'Registry',
    blurb: 'The shared shelf for images.',
    lesson:
      'A registry stores images by name, tag, and digest. docker push uploads layers. The cluster pulls the same tag later. The digest is the immutable id; the tag is a name people move.',
    fits: 'Between Image build and Deployment. That single wire stands in for the push.',
    consumes: 'a local image',
    produces: 'a pushed image reference',
    watch: 'If the tag already exists here, a rollout can deploy it without rebuilding.',
    fields: [registryHost, imageName, tag],
  },
  {
    kind: 'cluster',
    category: 'kubernetes',
    title: 'Cluster',
    blurb: 'The control plane and the machines it schedules onto.',
    lesson:
      'A cluster is an API plus a set of nodes. You send it objects (Deployments, Services) and it works to make the nodes match. Harborwire draws the API. It does not call one.',
    fits: 'To the side of the Deployment. Wire it to a Namespace, or straight to a Deployment.',
    consumes: 'API objects',
    produces: 'a place for those objects to live',
    watch: 'The cluster pulls images. It does not clone your Git repo.',
    fields: [cluster],
  },
  {
    kind: 'namespace',
    category: 'kubernetes',
    title: 'Namespace',
    blurb: 'A folder inside one cluster.',
    lesson:
      'Namespaces keep names apart: prod and dev can both have a Service called buoy. They also scope quotas and access. They are not a security boundary strong enough to replace a separate cluster.',
    fits: 'Under the cluster, and upstream of the Deployment and Service.',
    consumes: 'a cluster',
    produces: 'a naming boundary',
    watch: 'The Deployment, Service, and ConfigMap in this story share the prod namespace.',
    fields: [namespace],
  },
  {
    kind: 'deployment',
    category: 'kubernetes',
    title: 'Deployment',
    blurb: 'Keeps N copies of a pod running.',
    lesson:
      'You give a Deployment a pod template and a replica count. It starts pods, and when the image tag changes it replaces them in a rolling update: new pods become Ready, then old ones stop.',
    fits: 'After the Registry. The image field in the template is the tag you pushed.',
    consumes: 'an image reference',
    produces: 'managed pods',
    watch: 'A Deployment has no public address. Pair it with a Service.',
    fields: [appName, replicas, namespace],
  },
  {
    kind: 'pod',
    category: 'kubernetes',
    title: 'Pod',
    blurb: 'One or more containers the scheduler places together.',
    lesson:
      'A Pod is the unit Kubernetes runs. Containers in a pod share a network and can be restarted together. You usually do not create pods by hand; a Deployment creates them from its template.',
    fits: 'Downstream of the Deployment. A Service can select it.',
    consumes: 'a pod template',
    produces: 'running containers on a node',
    watch: 'A bare pod disappears when its node goes away. The Deployment is what brings a replacement back.',
    fields: [appName, containerPort],
  },
  {
    kind: 'service',
    category: 'kubernetes',
    title: 'Service',
    blurb: 'A stable address in front of changing pods.',
    lesson:
      'Pods come and go during a rollout, and their IPs change. A Service keeps one virtual IP and a DNS name, and forwards to whichever pods currently match its selector.',
    fits: 'After the Deployment. Ingress can publish it further.',
    consumes: 'pods with matching labels',
    produces: 'a stable address',
    watch: 'The Service port and the container port are often different. The Service is doing the translation.',
    fields: [appName, servicePort, containerPort],
  },
  {
    kind: 'ingress',
    category: 'kubernetes',
    title: 'Ingress',
    blurb: 'An HTTP route from a hostname to a Service.',
    lesson:
      'An Ingress rule says “requests for this host and path go to that Service.” A controller (and a load balancer in front of the cluster) implements the rule. DNS and certificates sit outside the object.',
    fits: 'At the far right, fed by the Service.',
    consumes: 'a Service',
    produces: 'an HTTP route',
    watch: 'The Ingress does not select pods itself. It only knows the Service.',
    fields: [host, servicePort],
  },
  {
    kind: 'configmap',
    category: 'kubernetes',
    title: 'ConfigMap',
    blurb: 'Runtime config, kept out of the image.',
    lesson:
      'A ConfigMap holds files or environment values the pod mounts when it starts. You can change it without rebuilding the image. The app has to read it for that to matter.',
    fits: 'Beside the Deployment, with a wire into the pod template.',
    consumes: 'keys you edit',
    produces: 'env or files in the pod',
    watch: 'A running process may not notice the change until the pod restarts.',
    fields: [configKey, namespace],
  },
  {
    kind: 'secret',
    category: 'kubernetes',
    title: 'Secret',
    blurb: 'A named reference to a credential.',
    lesson:
      'A Secret is how a pod receives a password or a token at runtime. The value stays in the cluster’s secret store. It should not be baked into the image or committed next to the Dockerfile.',
    fits: 'Wire the name into the Deployment. This chart stores the name only.',
    consumes: 'a name',
    produces: 'a mount or env var inside the pod',
    watch: 'Harborwire will not ask you for a real password. If a tutorial does, treat that as a smell.',
    fields: [secretName, namespace],
  },
];

const BY_KIND = new Map(ENTRIES.map((entry) => [entry.kind, entry]));

export function getEntry(kind: Kind): CatalogEntry {
  const entry = BY_KIND.get(kind);
  if (!entry) throw new Error(`Unknown kind ${kind}`);
  return entry;
}

export function listEntries(): CatalogEntry[] {
  return ENTRIES;
}

export function subtitle(kind: Kind, config: ResourceConfig): string {
  switch (kind) {
    case 'git':
      return `${config.repo} · ${config.branch}`;
    case 'webhook':
      return 'Push event';
    case 'checkout':
      return 'Clean workspace';
    case 'test':
      return config.failTests ? 'Set to fail' : 'Unit tests';
    case 'lint':
      return 'Static checks';
    case 'compile':
      return 'Language build';
    case 'dockerfile':
      return 'node:20-alpine';
    case 'image-build':
      return `${config.imageName}:${config.tag}`;
    case 'container':
      return `port ${config.containerPort}`;
    case 'registry':
      return config.registryHost;
    case 'cluster':
      return config.cluster;
    case 'namespace':
      return config.namespace;
    case 'deployment':
      return `${config.replicas} replica${config.replicas === 1 ? '' : 's'}`;
    case 'pod':
      return config.appName;
    case 'service':
      return `:${config.servicePort} → :${config.containerPort}`;
    case 'ingress':
      return config.host;
    case 'configmap':
      return config.configKey;
    case 'secret':
      return config.secretName;
    default:
      return '';
  }
}
