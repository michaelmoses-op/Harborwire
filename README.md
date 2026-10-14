# Harborwire

Harborwire is a browser simulator for learning how CI/CD, Docker, and Kubernetes fit together. Drag resources onto a chart, wire them from a Git commit to a running Service, and play the pipeline. Nothing connects to a real cluster, registry, or CI provider.

## Run

```bash
npm install
npm run dev
```

Open the printed URL. The landing page introduces the path from commit to pod. The simulator is the chart.

## Scripts

- `npm run dev` — local app
- `npm run build` — typecheck and production build
- `npm test` — chart rules and simulation order

## What a run is

Pressing **Run pipeline** walks the chart in dependency order and writes a log: checkout, test, image build, push, deploy, expose. If Test is set to fail, downstream cards go dark and the log explains why the image was never pushed. Digests, webhooks, and rollouts are narrated, not performed.

Sample charts:

- Healthy pipeline — buoy, from Git to Ingress
- Failing tests — the same chart, stopped at Test
- Registry rollout — an image that is already published
