import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CATEGORIES, getEntry, subtitle } from '../domain/catalog';
import type { PipelineNode } from '../domain/flow';

const STATUS_LABEL = {
  idle: '',
  queued: 'Queued',
  running: 'Running',
  passed: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
} as const;

export function PipelineNodeView({ data, selected }: NodeProps<PipelineNode>) {
  const entry = getEntry(data.kind);
  const category = CATEGORIES[entry.category];
  const armed = data.kind === 'test' && data.config.failTests;
  return (
    <div
      className={[
        'hw-node',
        `status-${data.status}`,
        selected ? 'is-selected' : '',
        armed ? 'is-armed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--cat' as string]: category.color }}
    >
      <Handle type="target" position={Position.Left} aria-label="Input" />
      <div className="hw-kicker">
        <span>{category.label}</span>
        {data.status !== 'idle' && <em>{STATUS_LABEL[data.status]}</em>}
      </div>
      <div className="hw-title">{entry.title}</div>
      <div className="hw-sub">{subtitle(data.kind, data.config)}</div>
      <Handle type="source" position={Position.Right} aria-label="Output" />
    </div>
  );
}
