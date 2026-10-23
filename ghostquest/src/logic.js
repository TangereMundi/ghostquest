/* GhostQuest game logic. Pure functions only (no DOM), so it can be tested in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GQ = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var R_EARTH = 6371008.8;
  var rad = function (d) { return d * Math.PI / 180; };
  var deg = function (r) { return r * 180 / Math.PI; };
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* ---------- geography ---------- */
  function haversine(a, b) {
    var dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function bearing(a, b) {
    var p1 = rad(a.lat), p2 = rad(b.lat), dl = rad(b.lng - a.lng);
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }
  function destinationPoint(o, brg, distM) {
    var d = distM / R_EARTH, t = rad(brg), p1 = rad(o.lat), l1 = rad(o.lng);
    var p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
    var l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return { lat: deg(p2), lng: ((deg(l2) + 540) % 360) - 180 };
  }
  var POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function compassLabel(b) { return POINTS[Math.round((((b % 360) + 360) % 360) / 22.5) % 16]; }
  function clampRadius(m) { return clamp(Math.round(Number(m) || 500), 50, 5000); }
  function walkMinutes(m) { return Math.max(1, Math.round(m / 83)); } // ~5 km/h

  /* A generated coordinate is only a coordinate. It is never marked verified or safe. */
  function randomDestination(origin, radiusM, rng, minFrac) {
    rng = rng || Math.random;
    var mf = minFrac == null ? 0.2 : minFrac;
    var r = radiusM * Math.sqrt(mf * mf + (1 - mf * mf) * rng()); // uniform by area inside the ring
    var brg = rng() * 360;
    var p = destinationPoint(origin, brg, r);
    return { lat: p.lat, lng: p.lng, distanceM: r, bearingDeg: brg, verified: false };
  }

  /* Arrival counts only with a real position fix of usable accuracy. */
  function checkArrival(pos, dest, opts) {
    var thr = (opts && opts.thresholdM) || 30;
    if (!pos || pos.accuracyM == null || isNaN(pos.accuracyM)) return { ok: false, reason: 'no-fix' };
    if (pos.accuracyM > 100) return { ok: false, reason: 'low-accuracy', accuracyM: pos.accuracyM };
    var d = haversine(pos, dest);
    var allowed = thr + Math.min(pos.accuracyM, 50);
    return { ok: d <= allowed, reason: d <= allowed ? 'arrived' : 'too-far', distanceM: d, allowedM: allowed };
  }

  function formatDistance(m) {
    return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 2 : 1) + ' km';
  }
  /* Accepts "52.3791, 4.9003", "52.3791 4.9003" or "52.3791;4.9003" (dot decimals). Returns null if invalid. */
  function parseCoords(str) {
    var m = String(str || '').replace(/[\u00b0]/g, '').match(/(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
    if (!m) return null;
    var lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat: lat, lng: lng };
  }
  function mapsmeUrl(p, name) { return 'mapsme://map?v=1&ll=' + p.lat.toFixed(6) + ',' + p.lng.toFixed(6) + '&n=' + encodeURIComponent(name || 'GhostQuest destination'); }
  function omapsUrl(p, name) { return 'om://map?v=1&ll=' + p.lat.toFixed(6) + ',' + p.lng.toFixed(6) + '&n=' + encodeURIComponent(name || 'GhostQuest destination'); }
  function formatCoord(p) { return p.lat.toFixed(5) + ', ' + p.lng.toFixed(5); }
  function roundCoarse(p) { return { lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 }; }
  function osmUrl(p) {
    return 'https://www.openstreetmap.org/?mlat=' + p.lat.toFixed(6) + '&mlon=' + p.lng.toFixed(6) + '#map=17/' + p.lat.toFixed(6) + '/' + p.lng.toFixed(6);
  }
  function appleMapsUrl(p) { return 'https://maps.apple.com/?ll=' + p.lat.toFixed(6) + ',' + p.lng.toFixed(6) + '&dirflg=w'; }

  /* ---------- progression ---------- */
  function xpForLevel(l) { return 50 * (l - 1) * l; } // L2=100, L3=300, L4=600 ...
  function levelFromXp(xp) {
    var l = 1;
    while (xpForLevel(l + 1) <= xp) l++;
    var base = xpForLevel(l), next = xpForLevel(l + 1);
    return { level: l, into: xp - base, needed: next - base, pct: clamp((xp - base) / (next - base), 0, 1) };
  }
  function addXp(state, n) {
    var before = levelFromXp(state.xp).level;
    state.xp = Math.max(0, Math.round(state.xp + n));
    var after = levelFromXp(state.xp).level;
    return after > before ? after : null;
  }

  /* ---------- collectibles ---------- */
  var RARITIES = ['common', 'uncommon', 'rare', 'legendary'];
  var RARITY_BONUS_XP = { common: 0, uncommon: 10, rare: 25, legendary: 60 };

  /* kind: ghost | artefact | badge. source: explore | ghost | any | badge.
     Badges are earned by rule, never rolled. Rarity is set here, never by likes or fame. */
  var COLLECTIBLES = [
    { id: 'lantern-wisp', name: 'Lantern Wisp', kind: 'ghost', rarity: 'common', source: 'ghost', blurb: 'A small flame of light that drifts ahead of anyone carrying a lamp.' },
    { id: 'little-drift', name: 'Little Drift', kind: 'ghost', rarity: 'common', source: 'any', blurb: 'Curious and shy. It follows at exactly seven steps behind.' },
    { id: 'moss-whisperer', name: 'Moss Whisperer', kind: 'ghost', rarity: 'uncommon', source: 'explore', blurb: 'Speaks only to people who stand still beside old stone.' },
    { id: 'veil-walker', name: 'Veil Walker', kind: 'ghost', rarity: 'rare', source: 'ghost', blurb: 'Crosses between the worlds whenever a gateway stays open.' },
    { id: 'hooded-warden', name: 'The Hooded Warden', kind: 'ghost', rarity: 'legendary', source: 'any', blurb: 'Keeper of the moonlit gate. Rarely seen, never forgotten.' },
    { id: 'cracked-compass', name: 'Cracked Compass', kind: 'artefact', rarity: 'common', source: 'explore', blurb: 'The needle points toward whatever you have not found yet.' },
    { id: 'cartographers-candle', name: "Cartographer's Candle", kind: 'artefact', rarity: 'uncommon', source: 'explore', blurb: 'Burns without heat and lights only the unmapped corners.' },
    { id: 'moonstone-shard', name: 'Moonstone Shard', kind: 'artefact', rarity: 'uncommon', source: 'ghost', blurb: 'Cold to the touch and slightly brighter after midnight.' },
    { id: 'rusted-gate-key', name: 'Rusted Gate Key', kind: 'artefact', rarity: 'rare', source: 'any', blurb: 'Opens nothing in this world. Fits one door in the other.' },
    { id: 'first-steps', name: 'First Steps', kind: 'badge', rarity: 'common', source: 'badge', blurb: 'Complete your first exploration discovery.' },
    { id: 'night-shift', name: 'Night Shift', kind: 'badge', rarity: 'common', source: 'badge', blurb: 'Finish an investigation of at least one minute.' },
    { id: 'both-worlds', name: 'Both Worlds', kind: 'badge', rarity: 'uncommon', source: 'badge', blurb: 'Record a discovery in exploration and in ghost hunting.' },
    { id: 'collector', name: 'Collector', kind: 'badge', rarity: 'uncommon', source: 'badge', blurb: 'Hold five different ghosts or artefacts.' },
    { id: 'boots-on-ground', name: 'Boots on the Ground', kind: 'badge', rarity: 'rare', source: 'badge', blurb: 'Check in at a destination with a real location fix, not a demo check-in.' }
  ];
  function byId(id) { for (var i = 0; i < COLLECTIBLES.length; i++) if (COLLECTIBLES[i].id === id) return COLLECTIBLES[i]; return null; }

  /* Rarity depends on what the player did: how far they explored, whether the check-in was real, how long they investigated. */
  function rarityWeights(source, ctx) {
    ctx = ctx || {};
    var w = { common: 62, uncommon: 25, rare: 11, legendary: 2 };
    if (source === 'explore') {
      if (ctx.radiusM >= 1000) { w.common -= 9; w.uncommon += 6; w.rare += 3; }
      if (ctx.radiusM >= 2000) { w.common -= 2; w.rare += 1; w.legendary += 1; }
      if (ctx.demo === false) { w.rare = Math.round(w.rare * 1.5); w.legendary = Math.round(w.legendary * 1.5); }
    } else if (source === 'ghost') {
      var m = (ctx.sessionSec || 0) / 60;
      if (m >= 5) { w.common -= 8; w.uncommon += 5; w.rare += 3; }
      if (m >= 15) { w.common -= 4; w.rare += 2; w.legendary += 2; }
    }
    return w;
  }
  function pickWeighted(weights, rng) {
    var total = 0, k;
    for (k in weights) total += weights[k];
    var x = rng() * total;
    for (var i = 0; i < RARITIES.length; i++) {
      x -= weights[RARITIES[i]] || 0;
      if (x < 0) return RARITIES[i];
    }
    return 'common';
  }
  function rollCollectible(source, ctx, rng, owned) {
    rng = rng || Math.random; owned = owned || {};
    var rarity = pickWeighted(rarityWeights(source, ctx), rng);
    var idx = RARITIES.indexOf(rarity), pool = [];
    while (idx >= 0 && !pool.length) {
      pool = COLLECTIBLES.filter(function (c) {
        return c.kind !== 'badge' && c.rarity === RARITIES[idx] && (c.source === 'any' || c.source === source);
      });
      idx--;
    }
    var fresh = pool.filter(function (c) { return !owned[c.id]; });
    var from = fresh.length ? fresh : pool;
    var item = from[Math.floor(rng() * from.length) % from.length];
    return { item: item, isNew: !owned[item.id] };
  }

  /* ---------- state ---------- */
  var DEMO_ORIGIN = { lat: 52.3791, lng: 4.9003 }; // example start point for the demo radar only
  function defaultState() {
    return {
      v: 1, xp: 0, collection: {}, discoveries: [], sessions: [], notes: [],
      counters: { exploreGen: 0, exploreFound: 0, exploreFoundVerified: 0, ghostFound: 0, sessions: 0 },
      settings: { radiusM: 500 },
      quest: { status: 'idle', dest: null, origin: null, source: 'demo', radiusM: 500 },
      daily: { key: '', gen: 0, find: 0, inv: 0, paid: {} }
    };
  }
  function normalizeState(raw) {
    var d = defaultState();
    if (!raw || typeof raw !== 'object') return d;
    var s = clone(d), k;
    if (typeof raw.xp === 'number' && raw.xp >= 0) s.xp = Math.round(raw.xp);
    if (raw.collection && typeof raw.collection === 'object') for (k in raw.collection) if (byId(k) && raw.collection[k] > 0) s.collection[k] = Math.round(raw.collection[k]);
    if (Array.isArray(raw.discoveries)) s.discoveries = raw.discoveries.slice(0, 200);
    if (Array.isArray(raw.sessions)) s.sessions = raw.sessions.slice(0, 30);
    if (Array.isArray(raw.notes)) s.notes = raw.notes.filter(function (n) { return n && typeof n.text === 'string'; }).slice(0, 100);
    if (raw.counters) for (k in s.counters) if (typeof raw.counters[k] === 'number') s.counters[k] = raw.counters[k];
    if (raw.settings && raw.settings.radiusM) s.settings.radiusM = clampRadius(raw.settings.radiusM);
    if (raw.settings && raw.settings.phone === true) s.settings.phone = true;
    if (raw.quest && typeof raw.quest === 'object') {
      var q = raw.quest;
      if (['idle', 'ready', 'navigating', 'arrived', 'cancelled'].indexOf(q.status) >= 0) s.quest.status = q.status;
      if (q.dest && typeof q.dest.lat === 'number') s.quest.dest = q.dest;
      if (q.origin && typeof q.origin.lat === 'number') s.quest.origin = q.origin;
      if (q.source === 'gps' || q.source === 'demo' || q.source === 'manual') s.quest.source = q.source;
      s.quest.radiusM = clampRadius(q.radiusM || 500);
    }
    if (raw.daily && typeof raw.daily === 'object') {
      s.daily = { key: String(raw.daily.key || ''), gen: raw.daily.gen | 0, find: raw.daily.find | 0, inv: raw.daily.inv | 0, paid: raw.daily.paid || {} };
    }
    return s;
  }

  /* ---------- daily quests ---------- */
  var DAILY = [
    { id: 'gen', label: 'Generate a destination', need: 1, xp: 15 },
    { id: 'find', label: 'Record a discovery', need: 1, xp: 25 },
    { id: 'inv', label: 'Finish an investigation', need: 1, xp: 25 }
  ];
  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function rollDaily(state, now) {
    var k = dayKey(now);
    if (state.daily.key !== k) state.daily = { key: k, gen: 0, find: 0, inv: 0, paid: {} };
  }
  function touchDaily(state, kind, now) {
    rollDaily(state, now);
    state.daily[kind] = (state.daily[kind] || 0) + 1;
    var gained = 0, levelUp = null;
    DAILY.forEach(function (q) {
      if (q.id === kind && state.daily[q.id] >= q.need && !state.daily.paid[q.id]) {
        state.daily.paid[q.id] = true; gained += q.xp;
        levelUp = addXp(state, q.xp) || levelUp;
      }
    });
    return { xp: gained, levelUp: levelUp };
  }

  /* ---------- badges ---------- */
  function ownedCount(state) {
    var n = 0;
    for (var id in state.collection) { var c = byId(id); if (c && c.kind !== 'badge') n++; }
    return n;
  }
  function badgeRules(state) {
    var c = state.counters;
    return {
      'first-steps': c.exploreFound >= 1,
      'night-shift': c.sessions >= 1,
      'both-worlds': c.exploreFound >= 1 && c.ghostFound >= 1,
      'collector': ownedCount(state) >= 5,
      'boots-on-ground': c.exploreFoundVerified >= 1
    };
  }
  function awardBadges(state) {
    var rules = badgeRules(state), fresh = [];
    for (var id in rules) if (rules[id] && !state.collection[id]) { state.collection[id] = 1; fresh.push(byId(id)); }
    return fresh;
  }

  /* ---------- events ---------- */
  var BASE_XP = { explore: 60, exploreDemo: 20, ghost: 25 };
  function recordGenerate(state, now) {
    var s = clone(state);
    s.counters.exploreGen++;
    var d = touchDaily(s, 'gen', now);
    return { state: s, xpGained: d.xp, levelUp: d.levelUp };
  }
  /* find: { mode:'explore'|'ghost', item, isNew, demo, coords?, note? } */
  function recordFind(state, find, now) {
    var s = clone(state);
    var base = find.mode === 'ghost' ? BASE_XP.ghost : (find.demo ? BASE_XP.exploreDemo : BASE_XP.explore);
    var xp = Math.round((find.isNew ? base : base / 2) + (find.isNew ? RARITY_BONUS_XP[find.item.rarity] : 0));
    s.collection[find.item.id] = (s.collection[find.item.id] || 0) + 1;
    if (find.mode === 'ghost') s.counters.ghostFound++;
    else { s.counters.exploreFound++; if (!find.demo) s.counters.exploreFoundVerified++; }
    s.discoveries.unshift({
      ts: now, mode: find.mode, id: find.item.id, title: find.item.name, rarity: find.item.rarity,
      demo: !!find.demo, isNew: !!find.isNew, coords: find.coords || null
    });
    if (s.discoveries.length > 200) s.discoveries.length = 200;
    var levelUp = addXp(s, xp);
    var d = touchDaily(s, 'find', now);
    xp += d.xp; levelUp = d.levelUp || levelUp;
    var badges = awardBadges(s);
    badges.forEach(function (b) { var l = addXp(s, 20 + RARITY_BONUS_XP[b.rarity]); xp += 20 + RARITY_BONUS_XP[b.rarity]; levelUp = l || levelUp; });
    return { state: s, xpGained: xp, levelUp: levelUp, newBadges: badges };
  }
  /* A session counts only if it lasted at least a minute. */
  function finishSession(state, durationSec, now) {
    var s = clone(state);
    if (durationSec < 60) return { state: s, completed: false, xpGained: 0, levelUp: null, newBadges: [] };
    s.counters.sessions++;
    var xp = 30, levelUp = addXp(s, 30);
    var d = touchDaily(s, 'inv', now);
    xp += d.xp; levelUp = d.levelUp || levelUp;
    var badges = awardBadges(s);
    badges.forEach(function (b) { var l = addXp(s, 20 + RARITY_BONUS_XP[b.rarity]); xp += 20 + RARITY_BONUS_XP[b.rarity]; levelUp = l || levelUp; });
    return { state: s, completed: true, xpGained: xp, levelUp: levelUp, newBadges: badges };
  }

  function shareText(item, count) {
    return 'I found ' + item.name + ' (' + item.rarity + ' ' + item.kind + ') in GhostQuest!' + (count > 1 ? ' x' + count : '');
  }

  return {
    haversine: haversine, bearing: bearing, destinationPoint: destinationPoint, compassLabel: compassLabel,
    clampRadius: clampRadius, walkMinutes: walkMinutes, randomDestination: randomDestination, checkArrival: checkArrival,
    formatDistance: formatDistance, parseCoords: parseCoords, mapsmeUrl: mapsmeUrl, omapsUrl: omapsUrl, formatCoord: formatCoord, roundCoarse: roundCoarse, osmUrl: osmUrl, appleMapsUrl: appleMapsUrl,
    xpForLevel: xpForLevel, levelFromXp: levelFromXp, addXp: addXp,
    RARITIES: RARITIES, COLLECTIBLES: COLLECTIBLES, byId: byId, rarityWeights: rarityWeights, rollCollectible: rollCollectible,
    DEMO_ORIGIN: DEMO_ORIGIN, defaultState: defaultState, normalizeState: normalizeState,
    DAILY: DAILY, dayKey: dayKey, rollDaily: rollDaily, touchDaily: touchDaily,
    badgeRules: badgeRules, awardBadges: awardBadges, recordGenerate: recordGenerate, recordFind: recordFind, finishSession: finishSession,
    shareText: shareText, clone: clone
  };
});
