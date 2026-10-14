export const KINDS = [
  'git',
  'webhook',
  'checkout',
  'test',
  'lint',
  'compile',
  'dockerfile',
  'image-build',
  'container',
  'registry',
  'cluster',
  'namespace',
  'deployment',
  'pod',
  'service',
  'ingress',
  'configmap',
  'secret',
] as const;

export type Kind = (typeof KINDS)[number];

const KIND_SET = new Set<string>(KINDS);

export function isKind(value: unknown): value is Kind {
  return typeof value === 'string' && KIND_SET.has(value);
}

export type Category = 'source' | 'ci' | 'docker' | 'registry' | 'kubernetes';

export type Status = 'idle' | 'queued' | 'running' | 'passed' | 'failed' | 'skipped';

export type LogTone = 'info' | 'ok' | 'warn' | 'fail' | 'muted';

export interface ResourceConfig {
  repo: string;
  branch: string;
  sha: string;
  failTests: boolean;
  imageName: string;
  tag: string;
  registryHost: string;
  replicas: number;
  appName: string;
  servicePort: number;
  containerPort: number;
  host: string;
  namespace: string;
  cluster: string;
  configKey: string;
  secretName: string;
}

export interface PipelineData extends Record<string, unknown> {
  kind: Kind;
  label: string;
  config: ResourceConfig;
  status: Status;
}

export interface FieldDef {
  key: keyof ResourceConfig;
  label: string;
  type: 'text' | 'number' | 'checkbox';
  help: string;
  min?: number;
  max?: number;
}

export interface GraphNode {
  id: string;
  kind: Kind;
  label: string;
  config: ResourceConfig;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface LogNote {
  tone: LogTone;
  text: string;
}

export interface RunStep {
  nodeId: string;
  title: string;
  lines: string[];
  status: 'passed' | 'failed';
}

export type RunOutcome = 'empty' | 'passed' | 'failed' | 'partial';

export interface RunPlan {
  outcome: RunOutcome;
  headline: string;
  notes: LogNote[];
  steps: RunStep[];
  skippedIds: string[];
  skipNote: string | null;
}

export interface CheckItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  suggest: Kind | null;
}
