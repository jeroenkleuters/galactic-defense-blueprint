// ORBITAL SIEGE — deterministic-ish fixed-step simulation. No DOM, no React.

import {
  ABILITIES,
  BUILD_PHASE_SECONDS,
  COLS,
  CP_MAX,
  CP_REGEN,
  DMG_TABLE,
  ENEMIES,
  MAP_ROWS,
  ROWS,
  SELL_REFUND,
  START_CREDITS,
  START_INTEGRITY,
  TILE,
  TOWERS,
  WAVES,
  type EnemyDef,
  type EnemyId,
  type TowerId,
} from "./data";

export type CellKind = "BUILDABLE" | "BLOCKED" | "PATH" | "SPAWN" | "CORE";

export interface Vec {
  x: number;
  y: number;
}

export interface Enemy {
  id: number;
  def: EnemyDef;
  pos: Vec;
  hp: number;
  shield: number;
  slowUntil: number;
  slowFactor: number;
  dead: boolean;
  leaked: boolean;
  /** distance travelled, used for "first" targeting */
  progress: number;
  hitFlash: number;
}

export interface Tower {
  id: number;
  kind: TowerId;
  tier: 0 | 1 | 2;
  cell: { cx: number; cy: number };
  pos: Vec;
  cooldown: number;
  angle: number;
  invested: number;
  targeting: TargetMode;
  kills: number;
  placedWave: number;
}

export type TargetMode = "FIRST" | "STRONGEST" | "CLOSEST";
export const TARGET_MODES: TargetMode[] = ["FIRST", "STRONGEST", "CLOSEST"];

export interface Shot {
  from: Vec;
  to: Vec;
  kind: "TRACER" | "BEAM" | "SHELL" | "PULSE";
  color: string;
  life: number;
  maxLife: number;
}

export interface Boom {
  pos: Vec;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export type Phase = "BUILD" | "WAVE" | "WON" | "LOST";

export interface GameState {
  grid: CellKind[][];
  /** flow field: for each cell, the next cell centre to walk toward */
  flow: (Vec | null)[][];
  spawns: { cx: number; cy: number }[];
  core: { cx: number; cy: number };
  towers: Tower[];
  enemies: Enemy[];
  shots: Shot[];
  booms: Boom[];
  credits: number;
  cp: number;
  integrity: number;
  waveIndex: number; // 0-based index into WAVES
  phase: Phase;
  buildTimer: number;
  waveClock: number;
  spawnCursor: number[]; // per group: how many spawned
  time: number;
  overchargeUntil: number;
  cooldowns: { orbital: number; overcharge: number };
  score: number;
  leaks: number;
  log: string[];
}

let nextId = 1;

export function parseMap() {
  const grid: CellKind[][] = [];
  const spawns: { cx: number; cy: number }[] = [];
  let core = { cx: COLS - 2, cy: ROWS - 2 };
  for (let y = 0; y < ROWS; y++) {
    const row: CellKind[] = [];
    const src = MAP_ROWS[y] ?? "";
    for (let x = 0; x < COLS; x++) {
      const ch = src[x] ?? ".";
      if (ch === "#") row.push("BLOCKED");
      else if (ch === "p") row.push("PATH");
      else if (ch === "S") {
        row.push("SPAWN");
        spawns.push({ cx: x, cy: y });
      } else if (ch === "C") {
        row.push("CORE");
        core = { cx: x, cy: y };
      } else row.push("BUILDABLE");
    }
    grid.push(row);
  }
  return { grid, spawns, core };
}

export function centreOf(cx: number, cy: number): Vec {
  return { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 };
}

/** BFS from the core across walkable cells -> flow field of next-step centres. */
export function bakeFlowField(grid: CellKind[][], core: { cx: number; cy: number }) {
  const walkable = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    const k = grid[y][x];
    return k === "PATH" || k === "SPAWN" || k === "CORE";
  };
  const dist: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(Infinity));
  const flow: (Vec | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const queue: { cx: number; cy: number }[] = [core];
  dist[core.cy][core.cx] = 0;
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist[cur.cy][cur.cx];
    const neighbours = [
      { cx: cur.cx + 1, cy: cur.cy },
      { cx: cur.cx - 1, cy: cur.cy },
      { cx: cur.cx, cy: cur.cy + 1 },
      { cx: cur.cx, cy: cur.cy - 1 },
    ];
    for (const n of neighbours) {
      if (!walkable(n.cx, n.cy)) continue;
      if (dist[n.cy][n.cx] <= d + 1) continue;
      dist[n.cy][n.cx] = d + 1;
      flow[n.cy][n.cx] = centreOf(cur.cx, cur.cy);
      queue.push(n);
    }
  }
  return flow;
}

export function createGame(): GameState {
  const { grid, spawns, core } = parseMap();
  return {
    grid,
    flow: bakeFlowField(grid, core),
    spawns,
    core,
    towers: [],
    enemies: [],
    shots: [],
    booms: [],
    credits: START_CREDITS,
    cp: 4,
    integrity: START_INTEGRITY,
    waveIndex: 0,
    phase: "BUILD",
    buildTimer: BUILD_PHASE_SECONDS,
    waveClock: 0,
    spawnCursor: [],
    time: 0,
    overchargeUntil: -1,
    cooldowns: { orbital: 0, overcharge: 0 },
    score: 0,
    leaks: 0,
    log: ["Reactor grid online. Build your defenses."],
  };
}

function pushLog(s: GameState, msg: string) {
  s.log = [msg, ...s.log].slice(0, 6);
}

export function towerAt(s: GameState, cx: number, cy: number) {
  return s.towers.find((t) => t.cell.cx === cx && t.cell.cy === cy);
}

export function canPlace(s: GameState, cx: number, cy: number, kind: TowerId) {
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
  if (s.grid[cy][cx] !== "BUILDABLE") return false;
  if (towerAt(s, cx, cy)) return false;
  return s.credits >= TOWERS[kind].tiers[0].cost;
}

export function placeTower(s: GameState, cx: number, cy: number, kind: TowerId) {
  if (!canPlace(s, cx, cy, kind)) return false;
  const cost = TOWERS[kind].tiers[0].cost;
  s.credits -= cost;
  s.towers.push({
    id: nextId++,
    kind,
    tier: 0,
    cell: { cx, cy },
    pos: centreOf(cx, cy),
    cooldown: 0,
    angle: 0,
    invested: cost,
    targeting: "FIRST",
    kills: 0,
    placedWave: s.waveIndex,
  });
  return true;
}

export function upgradeCost(t: Tower) {
  if (t.tier >= 2) return null;
  return TOWERS[t.kind].tiers[t.tier + 1].cost;
}

export function upgradeTower(s: GameState, t: Tower) {
  const cost = upgradeCost(t);
  if (cost == null || s.credits < cost) return false;
  s.credits -= cost;
  t.invested += cost;
  t.tier = (t.tier + 1) as 0 | 1 | 2;
  return true;
}

export function sellTower(s: GameState, t: Tower) {
  const fullRefund = s.phase === "BUILD" && t.placedWave === s.waveIndex;
  s.credits += Math.round(t.invested * (fullRefund ? 1 : SELL_REFUND));
  s.towers = s.towers.filter((x) => x.id !== t.id);
}

export function stats(t: Tower) {
  return TOWERS[t.kind].tiers[t.tier];
}

export function startWave(s: GameState) {
  if (s.phase !== "BUILD") return;
  const bounty = Math.round(s.buildTimer * 3);
  if (bounty > 0) {
    s.credits += bounty;
    pushLog(s, `Early start bounty: +${bounty} credits.`);
  }
  s.phase = "WAVE";
  s.waveClock = 0;
  s.spawnCursor = WAVES[s.waveIndex].groups.map(() => 0);
  pushLog(s, `Wave ${s.waveIndex + 1} — ${WAVES[s.waveIndex].name}`);
}

function damageEnemy(s: GameState, e: Enemy, amount: number, type: keyof typeof DMG_TABLE) {
  const mult = DMG_TABLE[type][e.def.armor];
  let dmg = amount * mult;
  if (s.time < s.overchargeUntil) dmg *= ABILITIES.OVERCHARGE.factor;
  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, dmg);
    e.shield -= absorbed;
    dmg -= absorbed;
  }
  e.hp -= dmg;
  e.hitFlash = 0.09;
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    s.credits += e.def.bounty;
    s.score += e.def.bounty;
  }
}

function pickTarget(s: GameState, t: Tower): Enemy | null {
  const st = stats(t);
  let best: Enemy | null = null;
  let bestKey = -Infinity;
  for (const e of s.enemies) {
    if (e.dead || e.leaked) continue;
    const dx = e.pos.x - t.pos.x;
    const dy = e.pos.y - t.pos.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > st.range * st.range) continue;
    let key: number;
    if (t.targeting === "FIRST") key = e.progress;
    else if (t.targeting === "STRONGEST") key = e.hp + e.shield;
    else key = -d2;
    if (key > bestKey) {
      bestKey = key;
      best = e;
    }
  }
  return best;
}

function fire(s: GameState, t: Tower, target: Enemy) {
  const def = TOWERS[t.kind];
  const st = stats(t);
  s.shots.push({
    from: { ...t.pos },
    to: { ...target.pos },
    kind: def.projectile,
    color: def.color,
    life: def.projectile === "BEAM" ? 0.12 : 0.08,
    maxLife: def.projectile === "BEAM" ? 0.12 : 0.08,
  });

  if (st.splash) {
    s.booms.push({
      pos: { ...target.pos },
      radius: st.splash,
      life: 0.3,
      maxLife: 0.3,
      color: def.color,
    });
    for (const e of s.enemies) {
      if (e.dead || e.leaked) continue;
      const dx = e.pos.x - target.pos.x;
      const dy = e.pos.y - target.pos.y;
      if (dx * dx + dy * dy <= st.splash * st.splash) {
        const falloff = 1 - Math.min(1, Math.hypot(dx, dy) / st.splash) * 0.5;
        damageEnemy(s, e, st.damage * falloff, def.damageType);
        if (e.dead) t.kills++;
      }
    }
    return;
  }

  if (st.slow) {
    // Stasis pylon pulses the whole field, not a single target.
    for (const e of s.enemies) {
      if (e.dead || e.leaked) continue;
      const dx = e.pos.x - t.pos.x;
      const dy = e.pos.y - t.pos.y;
      if (dx * dx + dy * dy <= st.range * st.range) {
        e.slowUntil = s.time + 0.9;
        e.slowFactor = Math.min(e.slowFactor, 1 - st.slow);
        damageEnemy(s, e, st.damage, def.damageType);
        if (e.dead) t.kills++;
      }
    }
    return;
  }

  damageEnemy(s, target, st.damage, def.damageType);
  if (target.dead) t.kills++;
}

function spawnEnemy(s: GameState, kind: EnemyId, laneIndex: number) {
  const spawn = s.spawns[laneIndex % Math.max(1, s.spawns.length)] ?? s.spawns[0];
  const def = ENEMIES[kind];
  const hpScale = 1 + s.waveIndex * 0.06;
  s.enemies.push({
    id: nextId++,
    def,
    pos: centreOf(spawn.cx, spawn.cy),
    hp: Math.round(def.hp * hpScale),
    shield: Math.round(def.shield * hpScale),
    slowUntil: 0,
    slowFactor: 1,
    dead: false,
    leaked: false,
    progress: 0,
    hitFlash: 0,
  });
}

export function castOrbital(s: GameState, at: Vec) {
  const a = ABILITIES.ORBITAL;
  if (s.cp < a.cost || s.cooldowns.orbital > 0) return false;
  s.cp -= a.cost;
  s.cooldowns.orbital = a.cooldown;
  s.booms.push({ pos: { ...at }, radius: a.radius, life: 0.55, maxLife: 0.55, color: "#FF3B30" });
  for (const e of s.enemies) {
    if (e.dead || e.leaked) continue;
    if (Math.hypot(e.pos.x - at.x, e.pos.y - at.y) <= a.radius) {
      damageEnemy(s, e, a.damage, "EXPLOSIVE");
    }
  }
  pushLog(s, "Orbital strike inbound.");
  return true;
}

export function castOvercharge(s: GameState) {
  const a = ABILITIES.OVERCHARGE;
  if (s.cp < a.cost || s.cooldowns.overcharge > 0) return false;
  s.cp -= a.cost;
  s.cooldowns.overcharge = a.cooldown;
  s.overchargeUntil = s.time + a.duration;
  pushLog(s, "Overcharge: all towers at double damage.");
  return true;
}

/** Advance the simulation by dt seconds (call with a clamped fixed step). */
export function step(s: GameState, dt: number) {
  if (s.phase === "WON" || s.phase === "LOST") return;
  s.time += dt;
  s.cp = Math.min(CP_MAX, s.cp + CP_REGEN * dt);
  s.cooldowns.orbital = Math.max(0, s.cooldowns.orbital - dt);
  s.cooldowns.overcharge = Math.max(0, s.cooldowns.overcharge - dt);

  if (s.phase === "BUILD") {
    s.buildTimer -= dt;
    if (s.buildTimer <= 0) startWave(s);
  }

  const wave = WAVES[s.waveIndex];

  if (s.phase === "WAVE") {
    s.waveClock += dt;
    wave.groups.forEach((g, gi) => {
      const spawned = s.spawnCursor[gi] ?? 0;
      if (spawned >= g.count) return;
      const due = g.delay + spawned * g.gap;
      if (s.waveClock >= due) {
        spawnEnemy(s, g.enemy, g.lane ?? gi);
        s.spawnCursor[gi] = spawned + 1;
      }
    });
  }

  // enemies
  for (const e of s.enemies) {
    if (e.dead || e.leaked) continue;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    const slowed = s.time < e.slowUntil;
    if (!slowed) e.slowFactor = 1;
    const speed = e.def.speed * (slowed ? e.slowFactor : 1);

    const cx = Math.floor(e.pos.x / TILE);
    const cy = Math.floor(e.pos.y / TILE);
    if (cx === s.core.cx && cy === s.core.cy) {
      e.leaked = true;
      s.leaks++;
      s.integrity -= e.def.leak;
      pushLog(s, `${e.def.name} reached the core (-${e.def.leak} integrity).`);
      continue;
    }
    const target = s.flow[cy]?.[cx] ?? centreOf(s.core.cx, s.core.cy);
    const dx = target.x - e.pos.x;
    const dy = target.y - e.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    const stepLen = Math.min(d, speed * dt);
    e.pos.x += (dx / d) * stepLen;
    e.pos.y += (dy / d) * stepLen;
    e.progress += stepLen;
  }

  // towers
  for (const t of s.towers) {
    t.cooldown -= dt;
    const target = pickTarget(s, t);
    if (!target) continue;
    t.angle = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
    if (t.cooldown <= 0) {
      t.cooldown = 1 / stats(t).rof;
      fire(s, t, target);
    }
  }

  // fx + cleanup
  s.shots = s.shots.filter((sh) => (sh.life -= dt) > 0);
  s.booms = s.booms.filter((b) => (b.life -= dt) > 0);
  s.enemies = s.enemies.filter((e) => !e.dead && !e.leaked);

  if (s.integrity <= 0) {
    s.integrity = 0;
    s.phase = "LOST";
    pushLog(s, "Reactor core breached. Mission failed.");
    return;
  }

  if (s.phase === "WAVE") {
    const allSpawned = wave.groups.every((g, gi) => (s.spawnCursor[gi] ?? 0) >= g.count);
    if (allSpawned && s.enemies.length === 0) {
      s.credits += wave.reward;
      s.score += wave.reward;
      s.cp = Math.min(CP_MAX, s.cp + 2);
      if (s.waveIndex >= WAVES.length - 1) {
        s.phase = "WON";
        pushLog(s, "Armada broken. Outpost holds!");
      } else {
        s.waveIndex++;
        s.phase = "BUILD";
        s.buildTimer = BUILD_PHASE_SECONDS;
        pushLog(s, `Wave cleared: +${wave.reward} credits, +2 CP.`);
      }
    }
  }
}
