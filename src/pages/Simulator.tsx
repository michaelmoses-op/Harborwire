import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { CATEGORIES, getEntry } from '../domain/catalog';
import {
  chartSignature,
  createEdge,
  createNode,
  loadPresetFlow,
  paintEdges,
  toGraph,
  toGraphEdges,
  type PipelineEdge,
  type PipelineNode,
} from '../domain/flow';
import { buildChecklist, buildRun, connectionVerdict } from '../domain/graph';
import { getPreset, PRESETS } from '../domain/presets';
import { loadChart, saveChart } from '../domain/storage';
import type { LogTone, ResourceConfig } from '../domain/types';
import { isKind } from '../domain/types';
import { Inspector } from '../components/Inspector';
import { Palette } from '../components/Palette';
import { PipelineNodeView } from '../components/PipelineNode';
import { RunLog, type LogLine } from '../components/RunLog';
import { Wordmark } from '../components/Wordmark';

const nodeTypes = { pipeline: PipelineNodeView };

function presetIntro(id: string): string {
  const preset = getPreset(id);
  if (!preset) return 'Chart loaded.';
  return `${preset.name}. ${preset.description} Press Run pipeline, or add cards of your own.`;
}

function readInitial(): {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  presetId: string | null;
  restored: boolean;
} {
  const preset = new URLSearchParams(window.location.search).get('preset');
  if (preset) {
    const flow = loadPresetFlow(preset);
    if (flow) return { ...flow, presetId: preset, restored: false };
  }
  const saved = loadChart();
  if (saved && saved.nodes.length > 0) {
    return { nodes: saved.nodes, edges: saved.edges, presetId: null, restored: true };
  }
  const flow = loadPresetFlow('web');
  return {
    nodes: flow?.nodes ?? [],
    edges: flow?.edges ?? [],
    presetId: 'web',
    restored: false,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function Simulator() {
  return (
    <ReactFlowProvider>
      <SimulatorInner />
    </ReactFlowProvider>
  );
}

function SimulatorInner() {
  const initial = useMemo(readInitial, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<PipelineEdge>(initial.edges);
  const [, setSearchParams] = useSearchParams();
  const [presetId, setPresetId] = useState<string | null>(initial.presetId);
  const [lines, setLines] = useState<LogLine[]>([
    {
      id: 'hello',
      tone: 'info',
      text: initial.restored
        ? 'Restored your chart from this browser.'
        : presetIntro(initial.presetId ?? 'web'),
    },
  ]);
  const [toast, setToast] = useState<string | null>(null);
  const [hoverKind, setHoverKind] = useState<typeof initial.nodes[number]['data']['kind'] | null>(null);
  const [hintId, setHintId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('');
  const [hasRun, setHasRun] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [armClear, setArmClear] = useState(false);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  const tokenRef = useRef(0);
  const cursorRef = useRef(0);
  const planRef = useRef<ReturnType<typeof buildRun> | null>(null);
  const sigRef = useRef('');
  const lineId = useRef(1);
  const presetRef = useRef(presetId);
  presetRef.current = presetId;
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropCount = useRef(0);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const fitRef = useRef(fitView);
  fitRef.current = fitView;

  useEffect(() => {
    document.title = 'Simulator · Harborwire';
  }, []);

  useEffect(() => {
    if (!initial.presetId) return;
    const current = new URLSearchParams(window.location.search).get('preset');
    if (current === initial.presetId) return;
    setSearchParams({ preset: initial.presetId }, { replace: true });
  }, [initial.presetId, setSearchParams]);

  useEffect(() => {
    setHydrated(true);
    const timer = window.setTimeout(() => {
      void fitRef.current({ padding: 0.16, duration: 450 });
    }, 60);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveChart(nodes, edges);
  }, [nodes, edges, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!armClear) return;
    const timer = window.setTimeout(() => setArmClear(false), 2400);
    return () => window.clearTimeout(timer);
  }, [armClear]);

  const push = useCallback((text: string, tone: LogTone) => {
    const id = `l${lineId.current++}`;
    setLines((prev) => [...prev, { id, text, tone }]);
  }, []);

  const markCustom = useCallback(() => {
    if (!presetRef.current) return;
    presetRef.current = null;
    setPresetId(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const resetAppearance = useCallback(() => {
    setNodes((current) =>
      current.map((node) =>
        node.data.status === 'idle' ? node : { ...node, data: { ...node.data, status: 'idle' } },
      ),
    );
    setEdges((current) => paintEdges(current, null, new Set()));
  }, [setEdges, setNodes]);

  const halt = useCallback(
    (message?: string) => {
      tokenRef.current += 1;
      cursorRef.current = 0;
      planRef.current = null;
      sigRef.current = '';
      setRunning(false);
      setPhase(message ?? '');
      resetAppearance();
    },
    [resetAppearance],
  );

  const onNodesChangeWrapped = useCallback(
    (changes: NodeChange<PipelineNode>[]) => {
      const removed = changes.some((change) => change.type === 'remove');
      const dragged = changes.some(
        (change) => change.type === 'position' && change.dragging === false && Boolean(change.position),
      );
      if (removed) halt();
      if (removed || dragged) markCustom();
      onNodesChange(changes);
    },
    [halt, markCustom, onNodesChange],
  );

  const onEdgesChangeWrapped = useCallback(
    (changes: EdgeChange<PipelineEdge>[]) => {
      if (changes.some((change) => change.type === 'remove')) {
        halt();
        markCustom();
      }
      onEdgesChange(changes);
    },
    [halt, markCustom, onEdgesChange],
  );

  const placeNode = useCallback(
    (kind: PipelineNode['data']['kind'], point?: { x: number; y: number }) => {
      const bounds = wrapRef.current?.getBoundingClientRect();
      const stagger = dropCount.current++;
      const screen = point ?? {
        x: (bounds?.left ?? 240) + (bounds?.width ?? 640) / 2 + (stagger % 5) * 26,
        y: (bounds?.top ?? 80) + (bounds?.height ?? 480) / 2 + (stagger % 4) * 22,
      };
      const position = screenToFlowPosition(screen);
      position.x -= 104;
      position.y -= 46;
      const node = { ...createNode(kind, position), selected: true };
      halt();
      markCustom();
      setNodes((current) => [...current.map((item) => ({ ...item, selected: false })), node]);
    },
    [halt, markCustom, screenToFlowPosition, setNodes],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData('application/harborwire');
      if (!isKind(kind)) return;
      placeNode(kind, { x: event.clientX, y: event.clientY });
    },
    [placeNode],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const verdict = connectionVerdict(
        toGraph(nodesRef.current),
        toGraphEdges(edgesRef.current),
        connection.source,
        connection.target,
      );
      if (!verdict.ok) {
        setToast(verdict.reason);
        return;
      }
      const edge = { ...createEdge(connection.source, connection.target, verdict.reason), selected: true };
      halt();
      markCustom();
      setEdges((current) => addEdge(edge, paintEdges(current, null, new Set()).map((item) => ({ ...item, selected: false }))));
    },
    [halt, markCustom, setEdges],
  );

  const onReconnect = useCallback(
    (oldEdge: PipelineEdge, connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const remaining = edgesRef.current.filter((edge) => edge.id !== oldEdge.id);
      const verdict = connectionVerdict(
        toGraph(nodesRef.current),
        toGraphEdges(remaining),
        connection.source,
        connection.target,
      );
      if (!verdict.ok) {
        setToast(verdict.reason);
        return;
      }
      halt();
      markCustom();
      setEdges((current) => {
        const next = reconnectEdge(oldEdge, connection, current).map((edge) =>
          edge.id === oldEdge.id ? { ...edge, data: { reason: verdict.reason } } : edge,
        );
        return paintEdges(next, null, new Set());
      });
    },
    [halt, markCustom, setEdges],
  );

  const updateConfig = useCallback(
    (id: string, key: keyof ResourceConfig, value: string | number | boolean) => {
      markCustom();
      sigRef.current = '';
      planRef.current = null;
      cursorRef.current = 0;
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          data: {
            ...node.data,
            status: 'idle',
            config: node.id === id ? { ...node.data.config, [key]: value } : node.data.config,
          },
        })),
      );
      setEdges((current) => paintEdges(current, null, new Set()));
    },
    [markCustom, setEdges, setNodes],
  );

  const play = useCallback(
    async (mode: 'all' | 'one') => {
      if (mode === 'one' && tokenRef.current > 0 && running) return;
      const my = ++tokenRef.current;
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      const signature = chartSignature(currentNodes, currentEdges);
      const restart =
        mode === 'all' ||
        signature !== sigRef.current ||
        !planRef.current ||
        cursorRef.current >= planRef.current.steps.length;

      let plan = planRef.current;
      if (restart || !plan) {
        plan = buildRun(toGraph(currentNodes), toGraphEdges(currentEdges));
        planRef.current = plan;
        sigRef.current = signature;
        cursorRef.current = 0;
        setLines(plan.notes.map((note) => ({ id: `l${lineId.current++}`, text: note.text, tone: note.tone })));
        setNodes((current) =>
          current.map((node) => ({
            ...node,
            data: {
              ...node.data,
              status: plan?.steps.some((step) => step.nodeId === node.id) ? 'queued' : 'idle',
            },
          })),
        );
        setEdges((current) => paintEdges(current, null, new Set()));
        if (plan.steps.length === 0) {
          push(plan.headline, 'info');
          setPhase(plan.headline);
          return;
        }
      }

      setRunning(true);
      setPhase(mode === 'all' ? 'Running the chart…' : 'Stepping…');
      const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const delay = motion ? (mode === 'all' ? 520 : 220) : 60;
      const done = new Set<string>();
      for (let index = 0; index < cursorRef.current; index += 1) {
        const earlier = plan.steps[index];
        if (earlier && earlier.status === 'passed') done.add(earlier.nodeId);
      }
      const last = mode === 'all' ? plan.steps.length : Math.min(plan.steps.length, cursorRef.current + 1);

      for (let index = cursorRef.current; index < last; index += 1) {
        if (tokenRef.current !== my) return;
        const step = plan.steps[index];
        if (!step) break;
        setPhase(step.title);
        setNodes((current) =>
          current.map((node) =>
            node.id === step.nodeId ? { ...node, data: { ...node.data, status: 'running' } } : node,
          ),
        );
        setEdges((current) => paintEdges(current, step.nodeId, done));
        await sleep(delay);
        if (tokenRef.current !== my) return;
        setNodes((current) =>
          current.map((node) =>
            node.id === step.nodeId ? { ...node, data: { ...node.data, status: step.status } } : node,
          ),
        );
        push(step.title, step.status === 'failed' ? 'fail' : 'ok');
        for (const line of step.lines) push(line, 'muted');
        if (step.status === 'failed') {
          const skipped = new Set(plan.skippedIds);
          setNodes((current) =>
            current.map((node) =>
              skipped.has(node.id) ? { ...node, data: { ...node.data, status: 'skipped' } } : node,
            ),
          );
          setEdges((current) => paintEdges(current, null, done));
          if (plan.skipNote) push(plan.skipNote, 'warn');
          push(plan.headline, 'fail');
          setPhase(plan.headline);
          cursorRef.current = plan.steps.length;
          setHasRun(true);
          setRunning(false);
          return;
        }
        done.add(step.nodeId);
        cursorRef.current = index + 1;
      }

      if (tokenRef.current !== my) return;
      if (cursorRef.current >= plan.steps.length) {
        push(plan.headline, plan.outcome === 'passed' ? 'ok' : 'warn');
        setPhase(plan.headline);
        setHasRun(true);
        setEdges((current) => paintEdges(current, null, done));
      }
      setRunning(false);
    },
    [push, running, setEdges, setNodes],
  );

  const stop = useCallback(() => {
    halt('Run stopped.');
    push('Run stopped. The chart stayed in the browser.', 'warn');
  }, [halt, push]);

  const clearChart = useCallback(() => {
    if (!armClear) {
      setArmClear(true);
      return;
    }
    halt();
    markCustom();
    setArmClear(false);
    setHasRun(false);
    setNodes([]);
    setEdges([]);
    setLines([
      {
        id: `l${lineId.current++}`,
        tone: 'info',
        text: 'Chart cleared. Drag a Git repository over, or load a sample from the menu.',
      },
    ]);
  }, [armClear, halt, markCustom, setEdges, setNodes]);

  const choosePreset = useCallback(
    (id: string) => {
      const flow = loadPresetFlow(id);
      if (!flow) return;
      tokenRef.current += 1;
      cursorRef.current = 0;
      planRef.current = null;
      sigRef.current = '';
      setRunning(false);
      setPresetId(id);
      presetRef.current = id;
      setHasRun(false);
      setPhase('');
      setHintId(null);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setLines([{ id: `l${lineId.current++}`, tone: 'info', text: presetIntro(id) }]);
      setSearchParams({ preset: id });
      window.setTimeout(() => {
        void fitRef.current({ padding: 0.16, duration: 400 });
      }, 40);
    },
    [setEdges, setNodes, setSearchParams],
  );

  const checks = useMemo(
    () => buildChecklist(toGraph(nodes), toGraphEdges(edges), hasRun),
    [edges, hasRun, nodes],
  );
  const currentCheck = checks.find((check) => !check.done);
  const activeHint = checks.find((check) => check.id === hintId)?.hint ?? currentCheck?.hint ?? null;
  const suggest = currentCheck?.suggest ?? null;
  const selectedNode = nodes.find((node) => node.selected) ?? null;
  const selectedEdge = selectedNode ? null : (edges.find((edge) => edge.selected) ?? null);
  const ready = checks.slice(0, -1).every((check) => check.done) && !hasRun && !running;

  return (
    <div className="sim">
      <header className="sim-top">
        <div className="sim-brand">
          <Wordmark large />
          <p className="sim-note">{phase || 'A local chart. No cluster attached.'}</p>
        </div>
        <div className="sim-actions">
          <label className="select-wrap">
            <span>Sample</span>
            <select
              aria-label="Sample charts"
              value={presetId ?? 'custom'}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'custom') return;
                choosePreset(value);
              }}
            >
              <option value="custom">Your chart</option>
              {PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-tiny" onClick={clearChart}>
            {armClear ? 'Confirm clear' : 'Clear'}
          </button>
          <button type="button" className="btn btn-line" disabled={running} onClick={() => void play('one')}>
            Step
          </button>
          <button
            type="button"
            className={running ? 'btn btn-stop' : ready ? 'btn btn-run is-ready' : 'btn btn-run'}
            onClick={() => (running ? stop() : void play('all'))}
          >
            {running ? 'Stop' : 'Run pipeline'}
          </button>
        </div>
      </header>
      <div className="sim-body">
        <Palette
          onAdd={(kind) => placeNode(kind)}
          onHover={setHoverKind}
          suggest={suggest}
          checks={checks}
          onFocusCheck={setHintId}
        />
        <div
          className="canvas-wrap"
          ref={wrapRef}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChangeWrapped}
            onEdgesChange={onEdgesChangeWrapped}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.35}
            maxZoom={1.5}
            deleteKeyCode={running ? null : ['Backspace', 'Delete']}
            connectionLineStyle={{ stroke: '#f0b429', strokeWidth: 2 }}
            connectionRadius={28}
            nodesDraggable={!running}
            nodesConnectable={!running}
            edgesReconnectable={!running}
            elementsSelectable
            proOptions={{ hideAttribution: false }}
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="#243444" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(8, 12, 16, 0.72)"
              nodeColor={(node) => CATEGORIES[getEntry((node.data as PipelineNode['data']).kind).category].color}
              nodeStrokeWidth={0}
            />
          </ReactFlow>
          {nodes.length === 0 && (
            <div className="empty-chart">
              <strong>Empty chart</strong>
              <p>Drag a resource here, or click one in the list. Start with Git repository.</p>
            </div>
          )}
          {toast && (
            <div className="toast" role="status">
              <p>{toast}</p>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
                Close
              </button>
            </div>
          )}
        </div>
        <Inspector
          node={selectedNode}
          edge={selectedEdge}
          nodes={nodes}
          hoverKind={selectedNode || selectedEdge ? null : hoverKind}
          focusedHint={selectedNode || selectedEdge ? null : activeHint}
          running={running}
          onChange={updateConfig}
        />
        <RunLog
          lines={lines}
          onClear={() =>
            setLines([
              {
                id: `l${lineId.current++}`,
                tone: 'muted',
                text: 'Log cleared. The chart is unchanged.',
              },
            ])
          }
        />
      </div>
    </div>
  );
}
