import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_ORDER, defaultConfig, getEntry, listEntries, subtitle } from './catalog';
import { downstreamKinds, upstreamKinds } from './graph';
import { KINDS, isKind, type Kind } from './types';

describe('catalog', () => {
  it('has one entry for every resource kind', () => {
    const kinds = listEntries().map((entry) => entry.kind);
    expect(kinds).toEqual([...KINDS]);
    expect(new Set(kinds).size).toBe(KINDS.length);
  });

  it('gives every card teaching copy and a palette category', () => {
    for (const entry of listEntries()) {
      expect(CATEGORY_ORDER).toContain(entry.category);
      expect(CATEGORIES[entry.category].color).toMatch(/^#/);
      expect(entry.blurb.length).toBeGreaterThan(8);
      expect(entry.lesson.length).toBeGreaterThan(40);
      expect(entry.fits.length).toBeGreaterThan(20);
      expect(entry.consumes.length).toBeGreaterThan(3);
      expect(entry.produces.length).toBeGreaterThan(3);
      expect(entry.watch.length).toBeGreaterThan(20);
      expect(subtitle(entry.kind, defaultConfig()).length).toBeGreaterThan(0);
    }
  });

  it('recognizes only real kinds', () => {
    expect(isKind('git')).toBe(true);
    expect(isKind('Dockerfile')).toBe(false);
    expect(isKind(null)).toBe(false);
    for (const kind of KINDS) expect(getEntry(kind).kind).toBe(kind);
  });

  it('gives sources outputs and gives ingress no downstream card', () => {
    expect(upstreamKinds('git')).toEqual([]);
    expect(downstreamKinds('git').length).toBeGreaterThan(0);
    expect(downstreamKinds('ingress')).toEqual([]);
    expect(upstreamKinds('ingress')).toContain('service');
    const seen = new Set<Kind>();
    for (const kind of KINDS) {
      for (const next of downstreamKinds(kind)) seen.add(next);
      for (const prev of upstreamKinds(kind)) seen.add(prev);
    }
    for (const kind of KINDS) expect(seen.has(kind)).toBe(true);
  });
});
