import type { ReactNode } from 'react';
import type { Kind } from '../domain/types';

export type IconName = Kind;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[name]}
    </svg>
  );
}

const GLYPHS: Record<IconName, ReactNode> = {
  git: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="12" r="2" />
      <path d="M6 8v8M8 7.2c4 0 5 3.4 7 4.8" />
    </>
  ),
  webhook: (
    <>
      <path d="M13 3 6 13h6l-1 8 8-12h-6l0-6z" />
    </>
  ),
  checkout: (
    <>
      <path d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5v-9z" />
      <path d="m4 8.5 8 4.5 8-4.5M12 13v9" />
    </>
  ),
  test: (
    <>
      <path d="M9 3h6M10 3v5L5.5 16a4 4 0 0 0 3.4 6h6.2a4 4 0 0 0 3.4-6L14 8V3" />
      <path d="M8.5 14h7" />
    </>
  ),
  lint: (
    <>
      <path d="M5 6h14M5 12h9M5 18h11" />
      <path d="m16 15 2 2 3-4" />
    </>
  ),
  compile: (
    <>
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13 6l-2 12" />
    </>
  ),
  dockerfile: (
    <>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h4M8.5 12h7M8.5 16h5" />
    </>
  ),
  'image-build': (
    <>
      <path d="M12 4 4 8l8 4 8-4-8-4z" />
      <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
    </>
  ),
  container: (
    <>
      <path d="M4 8h16v10H4z" />
      <path d="M4 12h16M8 8V6M12 8V6M16 8V6" />
    </>
  ),
  registry: (
    <>
      <path d="M4 10h16v9H4zM4 14h16M9 10V6h6v4" />
    </>
  ),
  cluster: (
    <>
      <path d="m12 3 7 4v6l-7 4-7-4V7l7-4z" />
      <path d="m12 7 4 2.2v3.6L12 15l-4-2.2V9.2L12 7z" />
    </>
  ),
  namespace: (
    <>
      <path d="M4 7h6l2 2h8v9H4z" />
    </>
  ),
  deployment: (
    <>
      <path d="M12 4 5 8l7 4 7-4-7-4zM5 12l7 4 7-4" />
      <path d="M8 18h8M14 16l2 2-2 2" />
    </>
  ),
  pod: (
    <>
      <rect x="5" y="6" width="14" height="12" rx="5" />
      <path d="M9 12h6" />
    </>
  ),
  service: (
    <>
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="7" r="2" />
      <circle cx="18" cy="17" r="2" />
      <path d="M8 12h6M14 12l2.2-3.5M14 12l2.2 3.5" />
    </>
  ),
  ingress: (
    <>
      <path d="M4 12h10" />
      <path d="m11 8 4 4-4 4" />
      <path d="M18 5v14" />
    </>
  ),
  configmap: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="8" cy="7" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="10" cy="17" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  secret: (
    <>
      <circle cx="8" cy="14" r="3.2" />
      <path d="M11 12.2 18 6.5l2 2-2 1.2 1.4 1.4-1.6.4" />
    </>
  ),
};
