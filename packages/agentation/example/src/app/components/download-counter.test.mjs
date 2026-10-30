import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseDownloadCounter, resumeDownloadCounter, tickDownloadCounter } from './download-counter.ts';
const total = 24358220, now = 1800000000000;
test('new visitors have varied starting points with room for larger increments', () => {
  assert.equal(resumeDownloadCounter(total, null, now, 0).displayed, total - 400000);
  assert.equal(resumeDownloadCounter(total, null, now, 1).displayed, total - 900000);
});
test('reload resumes the displayed value and makes bounded progress', () => {
  const cached = { version: 1, displayed: total - 60000, verifiedTotal: total, updatedAt: now };
  assert.equal(resumeDownloadCounter(total, cached, now, 1).displayed, cached.displayed);
  assert.equal(resumeDownloadCounter(total, cached, now + 5000, 1).displayed, cached.displayed);
  assert.equal(resumeDownloadCounter(total, cached, now + 86400000, 1).displayed, cached.displayed);
});
test('never exceeds the verified total or goes backward on a stale server snapshot', () => {
  const cached = { version: 1, displayed: total + 100, verifiedTotal: total + 101, updatedAt: now };
  assert.equal(resumeDownloadCounter(total, cached, now + 10000, 0).displayed, cached.displayed);
});
test('ignores corrupt storage', () => {
  for (const value of [null, '{', '{}', '{"version":1,"displayed":20,"verifiedTotal":10,"updatedAt":1}']) assert.equal(parseDownloadCounter(value), null);
});

test('migrates an exhausted old counter once and preserves its new value on reload', () => {
  const old = { version: 1, displayed: total, verifiedTotal: total, updatedAt: now };
  const migrated = resumeDownloadCounter(total, old, now, 0.5);
  assert.equal(migrated.displayed, total - 650000);
  assert.equal(resumeDownloadCounter(total, migrated, now + 1000, 0).displayed, migrated.displayed);
});
test('keeps headroom after a full day of continuous ticks', () => {
  let state = resumeDownloadCounter(total, null, now, 0);
  const start = state.displayed;
  for (let seconds = 2; seconds <= 86400; seconds += 2) state = tickDownloadCounter(state, now + seconds * 1000, 0.9);
  assert.ok(state.displayed > start);
  assert.ok(total - state.displayed > 40000);
});
test('paces multiple tabs and stays within the verified total', () => {
  const state = resumeDownloadCounter(total, null, now, 0);
  const tick = tickDownloadCounter(state, now + 1500, 0.9);
  assert.ok(tick.displayed - state.displayed > 1);
  assert.equal(tickDownloadCounter(tick, now + 1600, 0.9), tick);
  assert.equal(tickDownloadCounter({...tick, displayed: total - 1}, now + 3000, 0.9).displayed, total);
});
