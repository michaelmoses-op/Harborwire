import { useEffect, useRef } from 'react';
import type { LogTone } from '../domain/types';

export interface LogLine {
  id: string;
  tone: LogTone;
  text: string;
}

export function RunLog({ lines, onClear }: { lines: LogLine[]; onClear: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = endRef.current?.parentElement;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lines]);

  return (
    <section className="runlog" aria-label="Simulation log">
      <header className="runlog-head">
        <h2>Run log</h2>
        <span>Simulated locally</span>
        <button type="button" className="btn btn-tiny" onClick={onClear}>
          Clear log
        </button>
      </header>
      <div className="runlog-lines">
        {lines.map((line) => (
          <p key={line.id} className={`log-line ${line.tone}`}>
            {line.text}
          </p>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
