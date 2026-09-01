// ORBITAL SIEGE — static design data (tuning lives here, not in the sim)

export const TILE = 48;
export const COLS = 24;
export const ROWS = 14;

export type DamageType = "KINETIC" | "ENERGY" | "EXPLOSIVE" | "UTILITY";
export type ArmorClass = "LIGHT" | "ARMORED" | "SHIELDED" | "FAST";

/** Damage multiplier table: [damage type][armor class] */
export const DMG_TABLE: Record<DamageType, Record<ArmorClass, number>> = {
  KINETIC: { LIGHT: 1, ARMORED: 1.5, SHIELDED: 0.5, FAST: 1 },
  ENERGY: { LIGHT: 1, ARMORED: 0.6, SHIELDED: 1.75, FAST: 1.1 },
  EXPLOSIVE: { LIGHT: 1.25, ARMORED: 1.1, SHIELDED: 0.8, FAST: 0.5 },
  UTILITY: { LIGHT: 1, ARMORED: 1, SHIELDED: 1, FAST: 1 },
};

export type TowerId = "GATLING" | "LANCE" | "MORTAR" | "ION";

export interface TowerTier {
  damage: number;
  range: number;
  /** shots per second */
  rof: number;
  cost: number;
  splash?: number;
  slow?: number;
}

export interface TowerDef {
  id: TowerId;
  name: string;
  blurb: string;
  damageType: DamageType;
  color: string;
  projectile: "TRACER" | "BEAM" | "SHELL" | "PULSE";
  tiers: [TowerTier, TowerTier, TowerTier];
}

export const TOWERS: Record<TowerId, TowerDef> = {
  GATLING: {
    id: "GATLING",
    name: "Repeater Turret",
    blurb: "Cheap kinetic DPS. Shreds armor, useless against shields.",
    damageType: "KINETIC",
    color: "#E8623C",
    projectile: "TRACER",
    tiers: [
      { damage: 6, range: 150, rof: 4, cost: 60 },
      { damage: 10, range: 165, rof: 5, cost: 70 },
      { damage: 16, range: 180, rof: 6, cost: 130 },
    ],
  },
  LANCE: {
    id: "LANCE",
    name: "Ion Lance",
    blurb: "Hitscan energy beam. Melts shields, poor against plating.",
    damageType: "ENERGY",
    color: "#4FC3F7",
    projectile: "BEAM",
    tiers: [
      { damage: 22, range: 190, rof: 1.1, cost: 90 },
      { damage: 38, range: 205, rof: 1.2, cost: 110 },
      { damage: 62, range: 230, rof: 1.4, cost: 190 },
    ],
  },
  MORTAR: {
    id: "MORTAR",
    name: "Siege Mortar",
    blurb: "Slow arcing shells with splash. Great on clumps, misses speeders.",
    damageType: "EXPLOSIVE",
    color: "#FFB74D",
    projectile: "SHELL",
    tiers: [
      { damage: 30, range: 230, rof: 0.55, cost: 120, splash: 60 },
      { damage: 48, range: 250, rof: 0.6, cost: 140, splash: 70 },
      { damage: 78, range: 275, rof: 0.7, cost: 240, splash: 84 },
    ],
  },
  ION: {
    id: "ION",
    name: "Stasis Pylon",
    blurb: "Support field: slows everything in range, chips shields.",
    damageType: "UTILITY",
    color: "#7CFF8E",
    projectile: "PULSE",
    tiers: [
      { damage: 2, range: 130, rof: 2, cost: 70, slow: 0.35 },
      { damage: 4, range: 145, rof: 2, cost: 80, slow: 0.45 },
      { damage: 7, range: 165, rof: 2.5, cost: 150, slow: 0.6 },
    ],
  },
};

export type EnemyId = "TROOPER" | "SPEEDER" | "WALKER" | "DROID" | "DROPSHIP";

export interface EnemyDef {
  id: EnemyId;
  name: string;
  armor: ArmorClass;
  hp: number;
  shield: number;
  /** px per second */
  speed: number;
  bounty: number;
  leak: number;
  radius: number;
  color: string;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  TROOPER: {
    id: "TROOPER",
    name: "Line Trooper",
    armor: "LIGHT",
    hp: 60,
    shield: 0,
    speed: 46,
    bounty: 8,
    leak: 1,
    radius: 9,
    color: "#DCE6F0",
  },
  SPEEDER: {
    id: "SPEEDER",
    name: "Skimmer",
    armor: "FAST",
    hp: 45,
    shield: 0,
    speed: 108,
    bounty: 10,
    leak: 1,
    radius: 8,
    color: "#A0E8FF",
  },
  WALKER: {
    id: "WALKER",
    name: "Assault Walker",
    armor: "ARMORED",
    hp: 320,
    shield: 0,
    speed: 32,
    bounty: 26,
    leak: 3,
    radius: 15,
    color: "#8C9AA8",
  },
  DROID: {
    id: "DROID",
    name: "Aegis Droid",
    armor: "SHIELDED",
    hp: 90,
    shield: 140,
    speed: 42,
    bounty: 22,
    leak: 2,
    radius: 12,
    color: "#B9A6FF",
  },
  DROPSHIP: {
    id: "DROPSHIP",
    name: "Siege Dropship",
    armor: "ARMORED",
    hp: 1800,
    shield: 400,
    speed: 24,
    bounty: 180,
    leak: 8,
    radius: 22,
    color: "#4A5568",
  },
};

export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  /** seconds between spawns inside the group */
  gap: number;
  /** seconds to wait before the group starts */
  delay: number;
  lane?: number;
}

export interface WaveDef {
  index: number;
  name: string;
  reward: number;
  groups: SpawnGroup[];
}

/** 15 authored waves: teach -> pressure -> mixed -> boss. */
export const WAVES: WaveDef[] = [
  { index: 1, name: "Probe", reward: 40, groups: [{ enemy: "TROOPER", count: 6, gap: 1.1, delay: 0 }] },
  {
    index: 2,
    name: "Ranging Fire",
    reward: 45,
    groups: [{ enemy: "TROOPER", count: 10, gap: 0.9, delay: 0 }],
  },
  {
    index: 3,
    name: "Outriders",
    reward: 55,
    groups: [
      { enemy: "TROOPER", count: 8, gap: 1, delay: 0 },
      { enemy: "SPEEDER", count: 4, gap: 0.7, delay: 5 },
    ],
  },
  {
    index: 4,
    name: "First Plating",
    reward: 65,
    groups: [
      { enemy: "TROOPER", count: 10, gap: 0.8, delay: 0 },
      { enemy: "WALKER", count: 1, gap: 1, delay: 6 },
    ],
  },
  {
    index: 5,
    name: "Shield Screen",
    reward: 80,
    groups: [
      { enemy: "DROID", count: 3, gap: 2, delay: 0 },
      { enemy: "TROOPER", count: 10, gap: 0.7, delay: 4 },
    ],
  },
  {
    index: 6,
    name: "Fast Column",
    reward: 85,
    groups: [
      { enemy: "SPEEDER", count: 12, gap: 0.5, delay: 0 },
      { enemy: "TROOPER", count: 8, gap: 0.8, delay: 8 },
    ],
  },
  {
    index: 7,
    name: "Walker Push",
    reward: 100,
    groups: [
      { enemy: "WALKER", count: 3, gap: 3, delay: 0 },
      { enemy: "TROOPER", count: 12, gap: 0.6, delay: 5 },
    ],
  },
  {
    index: 8,
    name: "Combined Arms",
    reward: 110,
    groups: [
      { enemy: "DROID", count: 4, gap: 1.8, delay: 0 },
      { enemy: "SPEEDER", count: 8, gap: 0.5, delay: 3 },
      { enemy: "WALKER", count: 2, gap: 2.5, delay: 9 },
    ],
  },
  {
    index: 9,
    name: "Aegis Wall",
    reward: 125,
    groups: [
      { enemy: "DROID", count: 8, gap: 1.2, delay: 0 },
      { enemy: "TROOPER", count: 14, gap: 0.5, delay: 6 },
    ],
  },
  {
    index: 10,
    name: "Vanguard Dropship",
    reward: 180,
    groups: [
      { enemy: "DROPSHIP", count: 1, gap: 1, delay: 0 },
      { enemy: "TROOPER", count: 14, gap: 0.6, delay: 2 },
      { enemy: "SPEEDER", count: 8, gap: 0.5, delay: 10 },
    ],
  },
  {
    index: 11,
    name: "Hammer",
    reward: 150,
    groups: [
      { enemy: "WALKER", count: 5, gap: 2, delay: 0 },
      { enemy: "DROID", count: 6, gap: 1.2, delay: 4 },
    ],
  },
  {
    index: 12,
    name: "Blitz",
    reward: 160,
    groups: [
      { enemy: "SPEEDER", count: 22, gap: 0.32, delay: 0 },
      { enemy: "DROID", count: 5, gap: 1.5, delay: 7 },
    ],
  },
  {
    index: 13,
    name: "Grind",
    reward: 180,
    groups: [
      { enemy: "TROOPER", count: 26, gap: 0.4, delay: 0 },
      { enemy: "WALKER", count: 4, gap: 2.2, delay: 5 },
      { enemy: "DROID", count: 6, gap: 1.4, delay: 10 },
    ],
  },
  {
    index: 14,
    name: "Twin Column",
    reward: 200,
    groups: [
      { enemy: "WALKER", count: 6, gap: 1.8, delay: 0 },
      { enemy: "SPEEDER", count: 16, gap: 0.35, delay: 4 },
      { enemy: "DROID", count: 8, gap: 1.1, delay: 8 },
    ],
  },
  {
    index: 15,
    name: "Orbital Siege",
    reward: 400,
    groups: [
      { enemy: "DROPSHIP", count: 2, gap: 14, delay: 0 },
      { enemy: "WALKER", count: 6, gap: 2, delay: 3 },
      { enemy: "DROID", count: 10, gap: 1, delay: 8 },
      { enemy: "SPEEDER", count: 18, gap: 0.35, delay: 14 },
    ],
  },
];

/**
 * Map layout. `.` buildable, `#` blocked rock, `p` path, `S` spawn, `C` core.
 * Two lanes merge into one approach to the reactor core.
 */
export const MAP_ROWS: string[] = [
  "########################",
  "Sppppppppppp#...........",
  "...........p#...........",
  "..##.......p#....####...",
  "..##.......p#....####...",
  "...........pppppppppp...",
  "..............#.....p...",
  "Sppppppppp....#.....p...",
  ".........p....#.....p...",
  ".........p#####.....p...",
  ".........ppppppppppppp..",
  "..####...............p..",
  "..####...............pC.",
  "########################",
];

export const START_CREDITS = 260;
export const START_INTEGRITY = 20;
export const CP_MAX = 10;
export const CP_REGEN = 1 / 2.5; // per second
export const BUILD_PHASE_SECONDS = 15;
export const SELL_REFUND = 0.6;

export const ABILITIES = {
  ORBITAL: { name: "Orbital Strike", cost: 6, damage: 260, radius: 100, cooldown: 12 },
  OVERCHARGE: { name: "Overcharge", cost: 4, factor: 2, duration: 6, cooldown: 18 },
} as const;
