const assert = require('assert');
const G = require('../src/logic.js');
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('ok  -', name); } catch (e) { console.error('FAIL -', name, '\n', e.message); process.exitCode = 1; } }
function seq(arr) { let i = 0; return () => arr[i++ % arr.length]; }

t('haversine: Amsterdam to Utrecht is about 35 km', () => {
  const d = G.haversine({ lat: 52.3676, lng: 4.9041 }, { lat: 52.0907, lng: 5.1214 });
  assert(d > 33000 && d < 37000, 'got ' + d);
});
t('destinationPoint round-trips distance and bearing', () => {
  const o = { lat: 52.3791, lng: 4.9003 };
  const p = G.destinationPoint(o, 75, 800);
  assert(Math.abs(G.haversine(o, p) - 800) < 1);
  assert(Math.abs(G.bearing(o, p) - 75) < 0.5);
});
t('randomDestination stays inside the ring and is never verified', () => {
  const o = G.DEMO_ORIGIN;
  for (let i = 0; i < 500; i++) {
    const d = G.randomDestination(o, 1000);
    const real = G.haversine(o, d);
    assert(real <= 1001 && real >= 199, 'distance ' + real);
    assert.strictEqual(d.verified, false);
  }
});
t('compass labels', () => {
  assert.strictEqual(G.compassLabel(0), 'N'); assert.strictEqual(G.compassLabel(91), 'E');
  assert.strictEqual(G.compassLabel(359), 'N'); assert.strictEqual(G.compassLabel(225), 'SW');
});
t('arrival needs a real fix with usable accuracy', () => {
  const dest = { lat: 52.38, lng: 4.9 };
  assert.strictEqual(G.checkArrival(null, dest).reason, 'no-fix');
  assert.strictEqual(G.checkArrival({ lat: 52.38, lng: 4.9, accuracyM: 250 }, dest).reason, 'low-accuracy');
  assert.strictEqual(G.checkArrival({ lat: 52.38, lng: 4.9, accuracyM: 10 }, dest).ok, true);
  const far = G.destinationPoint(dest, 10, 400);
  const r = G.checkArrival({ lat: far.lat, lng: far.lng, accuracyM: 10 }, dest);
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'too-far');
});
t('level curve is monotonic and boundaries are right', () => {
  assert.strictEqual(G.levelFromXp(0).level, 1);
  assert.strictEqual(G.levelFromXp(99).level, 1);
  assert.strictEqual(G.levelFromXp(100).level, 2);
  assert.strictEqual(G.levelFromXp(300).level, 3);
  let prev = 0; for (let x = 0; x < 5000; x += 37) { const l = G.levelFromXp(x).level; assert(l >= prev); prev = l; }
});
t('rarity weights never depend on fame and legendary stays rare', () => {
  const w = G.rarityWeights('explore', { radiusM: 500, demo: true });
  assert(w.legendary < w.rare && w.rare < w.uncommon && w.uncommon < w.common);
  const far = G.rarityWeights('explore', { radiusM: 2000, demo: false });
  assert(far.rare > w.rare, 'longer, verified trips should raise rare chance');
  assert(G.rarityWeights('ghost', { sessionSec: 1200 }).legendary > G.rarityWeights('ghost', { sessionSec: 10 }).legendary);
});
t('rollCollectible respects source and prefers unowned items', () => {
  for (let i = 0; i < 300; i++) {
    const r = G.rollCollectible('explore', { radiusM: 500, demo: true });
    assert(r.item.kind !== 'badge'); assert(['explore', 'any'].includes(r.item.source));
  }
  const owned = { 'little-drift': 1 };
  const r = G.rollCollectible('ghost', {}, seq([0.0, 0.0, 0.0]), owned); // forces common
  assert.strictEqual(r.isNew, true); assert.notStrictEqual(r.item.id, 'little-drift');
});
t('recordFind updates xp, collection, history and awards First Steps', () => {
  const s0 = G.defaultState();
  const item = G.byId('cracked-compass');
  const r = G.recordFind(s0, { mode: 'explore', item, isNew: true, demo: true }, Date.now());
  assert.strictEqual(r.state.collection['cracked-compass'], 1);
  assert(r.state.collection['first-steps']);
  assert.strictEqual(r.state.discoveries.length, 1);
  assert(r.xpGained >= 20); assert.strictEqual(s0.xp, 0, 'input state must not be mutated');
  assert.strictEqual(r.state.counters.exploreFoundVerified, 0, 'demo check-in is not verified');
});
t('verified check-in pays more than demo and unlocks Boots on the Ground', () => {
  const item = G.byId('cracked-compass'), now = Date.now();
  const d = G.recordFind(G.defaultState(), { mode: 'explore', item, isNew: true, demo: true }, now);
  const v = G.recordFind(G.defaultState(), { mode: 'explore', item, isNew: true, demo: false }, now);
  assert(v.xpGained > d.xpGained); assert(v.state.collection['boots-on-ground']);
  assert(!d.state.collection['boots-on-ground']);
});
t('duplicates give less xp', () => {
  const item = G.byId('lantern-wisp'), now = Date.now();
  const a = G.recordFind(G.defaultState(), { mode: 'ghost', item, isNew: true }, now);
  const b = G.recordFind(G.defaultState(), { mode: 'ghost', item, isNew: false }, now);
  assert(b.xpGained < a.xpGained);
});
t('sessions under a minute do not count', () => {
  const r = G.finishSession(G.defaultState(), 30, Date.now());
  assert.strictEqual(r.completed, false); assert.strictEqual(r.state.counters.sessions, 0);
  const ok = G.finishSession(G.defaultState(), 90, Date.now());
  assert(ok.completed); assert(ok.state.collection['night-shift']); assert(ok.xpGained >= 30);
});
t('daily quests pay once per day and reset on a new day', () => {
  let s = G.defaultState(); const day1 = new Date(2026, 9, 10, 12).getTime(), day2 = day1 + 86400000;
  const a = G.recordGenerate(s, day1); assert.strictEqual(a.xpGained, 15);
  const b = G.recordGenerate(a.state, day1); assert.strictEqual(b.xpGained, 0);
  const c = G.recordGenerate(b.state, day2); assert.strictEqual(c.xpGained, 15);
});
t('normalizeState repairs damaged saves', () => {
  const s = G.normalizeState({ xp: -5, collection: { nope: 3, 'lantern-wisp': 2 }, settings: { radiusM: 99999 }, quest: { status: 'bogus' } });
  assert.strictEqual(s.xp, 0); assert.deepStrictEqual(s.collection, { 'lantern-wisp': 2 });
  assert.strictEqual(s.settings.radiusM, 5000); assert.strictEqual(s.quest.status, 'idle');
  assert.strictEqual(G.normalizeState(null).xp, 0);
});
t('coarse coordinates are rounded for history', () => {
  const c = G.roundCoarse({ lat: 52.379123, lng: 4.900345 });
  assert.deepStrictEqual(c, { lat: 52.379, lng: 4.9 });
});
t('parseCoords reads pasted coordinates and rejects nonsense', () => {
  assert.deepStrictEqual(G.parseCoords('52.3791, 4.9003'), { lat: 52.3791, lng: 4.9003 });
  assert.deepStrictEqual(G.parseCoords('  -33.8688 151.2093 '), { lat: -33.8688, lng: 151.2093 });
  assert.deepStrictEqual(G.parseCoords('52.3791\u00b0; 4.9003\u00b0'), { lat: 52.3791, lng: 4.9003 });
  assert.strictEqual(G.parseCoords('hello'), null); assert.strictEqual(G.parseCoords('95.0, 4.9'), null);
  assert.strictEqual(G.parseCoords('52.1, 190.5'), null);
});
t('map links carry the coordinate', () => {
  assert(G.mapsmeUrl({ lat: 52.5, lng: 4.5 }).startsWith('mapsme://map?v=1&ll=52.500000,4.500000'));
});
t('Organic Maps pin link carries the coordinate and a name', () => {
  const u = G.omapsUrl({ lat: 52.5, lng: 4.5 }, 'Quest point');
  assert.strictEqual(u, 'om://map?v=1&ll=52.500000,4.500000&n=Quest%20point');
});
console.log('\n' + n + ' tests passed' + (process.exitCode ? ' (with failures)' : ''));
