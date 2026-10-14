import { CATEGORIES, getEntry, subtitle } from '../domain/catalog';
import { downstreamKinds, upstreamKinds } from '../domain/graph';
import type { PipelineEdge, PipelineNode } from '../domain/flow';
import type { Kind, ResourceConfig } from '../domain/types';
import { Icon } from './Icon';

export function Inspector({
  node,
  edge,
  nodes,
  hoverKind,
  focusedHint,
  running,
  onChange,
}: {
  node: PipelineNode | null;
  edge: PipelineEdge | null;
  nodes: PipelineNode[];
  hoverKind: Kind | null;
  focusedHint: string | null;
  running: boolean;
  onChange: (id: string, key: keyof ResourceConfig, value: string | number | boolean) => void;
}) {
  if (node) return <NodePanel node={node} running={running} onChange={onChange} />;
  if (edge) return <EdgePanel edge={edge} nodes={nodes} />;
  if (hoverKind) return <KindPanel kind={hoverKind} />;
  return <IntroPanel hint={focusedHint} />;
}

function NodePanel({
  node,
  running,
  onChange,
}: {
  node: PipelineNode;
  running: boolean;
  onChange: (id: string, key: keyof ResourceConfig, value: string | number | boolean) => void;
}) {
  const entry = getEntry(node.data.kind);
  const category = CATEGORIES[entry.category];
  const incoming = upstreamKinds(entry.kind).map((kind) => getEntry(kind).title);
  const outgoing = downstreamKinds(entry.kind).map((kind) => getEntry(kind).title);
  return (
    <aside className="inspector">
      <p className="inspector-kicker" style={{ color: category.color }}>
        {category.label}
      </p>
      <h2>
        <Icon name={entry.kind} size={22} />
        {entry.title}
      </h2>
      <p className="blurb">{entry.blurb}</p>
      {node.data.status === 'skipped' && (
        <p className="callout">This stage stayed dark because an earlier gate failed.</p>
      )}
      {node.data.status === 'failed' && (
        <p className="callout is-fail">This gate stopped the commit. Downstream cards were skipped.</p>
      )}
      <p>{entry.lesson}</p>
      <p>{entry.fits}</p>
      <dl className="kv">
        <div>
          <dt>Takes</dt>
          <dd>{entry.consumes}</dd>
        </div>
        <div>
          <dt>Hands off</dt>
          <dd>{entry.produces}</dd>
        </div>
      </dl>
      <p className="watch">
        <strong>Keep in mind. </strong>
        {entry.watch}
      </p>
      <WireHints incoming={incoming} outgoing={outgoing} />
      {entry.fields.length > 0 && (
        <form
          className="fields"
          onSubmit={(event) => event.preventDefault()}
        >
          {entry.fields.map((field) => (
            <label key={field.key} className={field.type === 'checkbox' ? 'check-field' : 'field'}>
              {field.type === 'checkbox' ? (
                <>
                  <input
                    type="checkbox"
                    checked={Boolean(node.data.config[field.key])}
                    disabled={running}
                    onChange={(event) => onChange(node.id, field.key, event.target.checked)}
                  />
                  <span>
                    <strong>{field.label}</strong>
                    <small>{field.help}</small>
                  </span>
                </>
              ) : (
                <>
                  <span>{field.label}</span>
                  <input
                    type={field.type}
                    min={field.min}
                    max={field.max}
                    disabled={running}
                    value={String(node.data.config[field.key])}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (field.type === 'number') {
                        const parsed = Number(raw);
                        if (!Number.isFinite(parsed)) return;
                        const min = field.min ?? parsed;
                        const max = field.max ?? parsed;
                        onChange(node.id, field.key, Math.min(max, Math.max(min, parsed)));
                        return;
                      }
                      onChange(node.id, field.key, raw);
                    }}
                  />
                  <small>{field.help}</small>
                </>
              )}
            </label>
          ))}
        </form>
      )}
    </aside>
  );
}

function WireHints({ incoming, outgoing }: { incoming: string[]; outgoing: string[] }) {
  return (
    <div className="wire-hints">
      <p>
        <span>From</span>
        {incoming.length > 0 ? incoming.join(', ') : 'Nothing. This card starts a flow.'}
      </p>
      <p>
        <span>Toward</span>
        {outgoing.length > 0 ? outgoing.join(', ') : 'Nothing. This card is an end of the chart.'}
      </p>
    </div>
  );
}

function EdgePanel({ edge, nodes }: { edge: PipelineEdge; nodes: PipelineNode[] }) {
  const source = nodes.find((node) => node.id === edge.source);
  const target = nodes.find((node) => node.id === edge.target);
  const sourceEntry = source ? getEntry(source.data.kind) : null;
  const targetEntry = target ? getEntry(target.data.kind) : null;
  return (
    <aside className="inspector">
      <p className="inspector-kicker">Wire</p>
      <h2>
        {sourceEntry?.title ?? 'Card'}
        <span className="arrow">→</span>
        {targetEntry?.title ?? 'Card'}
      </h2>
      <p>{edge.data?.reason ?? 'This wire is a handoff between two stages.'}</p>
      {source && (
        <p className="blurb">
          {sourceEntry?.title} is showing {subtitle(source.data.kind, source.data.config)}.
        </p>
      )}
      <p className="watch">
        <strong>Keep in mind. </strong>
        Select a card to read what it is, or draw another wire from an output port to an input port.
      </p>
    </aside>
  );
}

function KindPanel({ kind }: { kind: Kind }) {
  const entry = getEntry(kind);
  const category = CATEGORIES[entry.category];
  return (
    <aside className="inspector">
      <p className="inspector-kicker" style={{ color: category.color }}>
        {category.label} · not on the chart yet
      </p>
      <h2>
        <Icon name={kind} size={22} />
        {entry.title}
      </h2>
      <p className="blurb">{entry.blurb}</p>
      <p>{entry.lesson}</p>
      <p>{entry.fits}</p>
      <p className="watch">
        <strong>Keep in mind. </strong>
        {entry.watch}
      </p>
    </aside>
  );
}

function IntroPanel({ hint }: { hint: string | null }) {
  return (
    <aside className="inspector">
      <p className="inspector-kicker">How to read this</p>
      <h2>A chart of one commit</h2>
      <p>
        Each card is a resource in a delivery pipeline. A wire is a handoff: a commit, a pass/fail signal, an image
        tag, or traffic.
      </p>
      <ol className="intro-steps">
        <li>Drop cards from the left, starting with Git repository.</li>
        <li>Drag from the right port of a card to the left port of the next one.</li>
        <li>Press Run pipeline and read the log. The chart is the whole system.</li>
      </ol>
      {hint && <p className="callout">{hint}</p>}
      <p className="watch">
        <strong>Keep in mind. </strong>
        Harborwire explains the path. It does not push an image, apply a manifest, or call a cluster.
      </p>
    </aside>
  );
}
