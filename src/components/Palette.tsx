import { CATEGORIES, CATEGORY_ORDER, listEntries } from '../domain/catalog';
import type { CheckItem, Kind } from '../domain/types';
import { Icon } from './Icon';

export function Palette({
  onAdd,
  onHover,
  suggest,
  checks,
  onFocusCheck,
}: {
  onAdd: (kind: Kind) => void;
  onHover: (kind: Kind | null) => void;
  suggest: Kind | null;
  checks: CheckItem[];
  onFocusCheck: (id: string) => void;
}) {
  const doneCount = checks.filter((check) => check.done).length;
  const current = checks.find((check) => !check.done);
  return (
    <aside className="palette">
      <div className="palette-head">
        <h2>Resources</h2>
        <p>Click a card or drag it onto the chart. Output is the right port. Input is the left.</p>
      </div>
      <div className="palette-scroll">
        {CATEGORY_ORDER.map((category) => (
          <section key={category} className="pal-group">
            <h3 style={{ color: CATEGORIES[category].color }}>{CATEGORIES[category].label}</h3>
            {listEntries()
              .filter((entry) => entry.category === category)
              .map((entry) => (
                <button
                  key={entry.kind}
                  type="button"
                  className={entry.kind === suggest ? 'pal-item is-hot' : 'pal-item'}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/harborwire', entry.kind);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => onAdd(entry.kind)}
                  onMouseEnter={() => onHover(entry.kind)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(entry.kind)}
                  onBlur={() => onHover(null)}
                >
                  <span className="pal-icon" style={{ color: CATEGORIES[category].color }}>
                    <Icon name={entry.kind} size={18} />
                  </span>
                  <span className="pal-text">
                    <strong>{entry.title}</strong>
                    <em>{entry.blurb}</em>
                  </span>
                </button>
              ))}
          </section>
        ))}
      </div>
      <div className="guide">
        <div className="guide-head">
          <span>Path</span>
          <span>
            {doneCount}/{checks.length}
          </span>
        </div>
        <ol>
          {checks.map((check, index) => (
            <li key={check.id}>
              <button
                type="button"
                className={[
                  'guide-row',
                  check.done ? 'is-done' : '',
                  !check.done && current?.id === check.id ? 'is-now' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onFocusCheck(check.id)}
              >
                <span className="guide-index">{check.done ? '✓' : index + 1}</span>
                {check.label}
              </button>
            </li>
          ))}
        </ol>
        {current && <p className="guide-hint">{current.hint}</p>}
      </div>
    </aside>
  );
}
