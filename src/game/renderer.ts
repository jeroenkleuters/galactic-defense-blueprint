// ORBITAL SIEGE — canvas renderer. Placeholder "programmer art" per the brief:
// flat tiles, capsule enemies with nose triangles, circle bases + barrel rects.

import { COLS, ROWS, TILE, TOWERS, type TowerId } from "./data";
import { stats, type GameState, type Tower } from "./engine";

const C = {
  void: "#0B0F14",
  buildable: "#3E3520",
  buildableAlt: "#463B24",
  path: "#241D16",
  blocked: "#151A20",
  grid: "rgba(255,255,255,0.05)",
  core: "#7CFF8E",
  spawn: "#4FC3F7",
  hp: "#7CFF8E",
  shield: "#4FC3F7",
  alert: "#FF3B30",
};

export interface ViewInput {
  hoverCell: { cx: number; cy: number } | null;
  buildKind: TowerId | null;
  selected: Tower | null;
  aimingOrbital: boolean;
  orbitalRadius: number;
  pointer: { x: number; y: number } | null;
}

export function draw(ctx: CanvasRenderingContext2D, s: GameState, view: ViewInput) {
  const w = COLS * TILE;
  const h = ROWS * TILE;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, w, h);

  // terrain
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const kind = s.grid[y]![x]!;
      let fill = C.buildable;
      if (kind === "BUILDABLE") fill = (x + y) % 2 === 0 ? C.buildable : C.buildableAlt;
      else if (kind === "BLOCKED") fill = C.blocked;
      else fill = C.path;
      ctx.fillStyle = fill;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);

      if (kind === "SPAWN") {
        ctx.fillStyle = "rgba(79,195,247,0.25)";
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.strokeStyle = C.spawn;
        ctx.strokeRect(x * TILE + 3.5, y * TILE + 3.5, TILE - 7, TILE - 7);
      }
      if (kind === "CORE") {
        const cx = x * TILE + TILE / 2;
        const cy = y * TILE + TILE / 2;
        const pulse = 0.6 + 0.4 * Math.sin(s.time * 3);
        ctx.fillStyle = `rgba(124,255,142,${0.25 + 0.2 * pulse})`;
        ctx.beginPath();
        ctx.arc(cx, cy, TILE * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.core;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, TILE * 0.34, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // build ghost
  if (view.buildKind && view.hoverCell) {
    const { cx, cy } = view.hoverCell;
    const kind = s.grid[cy]?.[cx];
    const occupied = s.towers.some((t) => t.cell.cx === cx && t.cell.cy === cy);
    const def = TOWERS[view.buildKind];
    const legal = kind === "BUILDABLE" && !occupied && s.credits >= def.tiers[0].cost;
    const px = cx * TILE + TILE / 2;
    const py = cy * TILE + TILE / 2;
    ctx.fillStyle = legal ? "rgba(124,255,142,0.18)" : "rgba(255,59,48,0.2)";
    ctx.fillRect(cx * TILE, cy * TILE, TILE, TILE);
    ctx.strokeStyle = legal ? C.core : C.alert;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(px, py, def.tiers[0].range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // selected tower range
  if (view.selected) {
    const st = stats(view.selected);
    ctx.strokeStyle = "rgba(232,98,60,0.8)";
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(view.selected.pos.x, view.selected.pos.y, st.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // orbital aim reticle
  if (view.aimingOrbital && view.pointer) {
    ctx.strokeStyle = C.alert;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(view.pointer.x, view.pointer.y, view.orbitalRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,59,48,0.12)";
    ctx.fill();
  }

  // towers
  for (const t of s.towers) {
    const def = TOWERS[t.kind];
    ctx.save();
    ctx.translate(t.pos.x, t.pos.y);
    ctx.fillStyle = "#1B222B";
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.rotate(t.angle);
    ctx.fillStyle = def.color;
    ctx.fillRect(0, -4, 22, 8);
    ctx.restore();
    // tier chevrons
    for (let i = 0; i <= t.tier; i++) {
      ctx.fillStyle = def.color;
      ctx.fillRect(t.pos.x - 8 + i * 8, t.pos.y + 16, 5, 3);
    }
  }

  // enemies
  for (const e of s.enemies) {
    const { pos, def } = e;
    const angle = Math.atan2(
      (s.flow[Math.floor(pos.y / TILE)]?.[Math.floor(pos.x / TILE)]?.y ?? pos.y) - pos.y,
      (s.flow[Math.floor(pos.y / TILE)]?.[Math.floor(pos.x / TILE)]?.x ?? pos.x + 1) - pos.x,
    );
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.fillStyle = e.hitFlash > 0 ? "#FFFFFF" : def.color;
    if (def.armor === "FAST") {
      ctx.beginPath();
      ctx.moveTo(def.radius * 1.6, 0);
      ctx.lineTo(-def.radius, def.radius * 0.6);
      ctx.lineTo(-def.radius, -def.radius * 0.6);
      ctx.closePath();
      ctx.fill();
    } else if (def.armor === "ARMORED") {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * def.radius * 1.2;
        const py = Math.sin(a) * def.radius;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(def.radius * 1.5, 0);
      ctx.lineTo(def.radius * 0.4, def.radius * 0.55);
      ctx.lineTo(def.radius * 0.4, -def.radius * 0.55);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (e.shield > 0) {
      ctx.strokeStyle = "rgba(79,195,247,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, def.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // hp bar
    const maxHp = Math.round(def.hp * (1 + s.waveIndex * 0.06));
    const bw = def.radius * 2.4;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(pos.x - bw / 2, pos.y - def.radius - 10, bw, 3);
    ctx.fillStyle = C.hp;
    ctx.fillRect(pos.x - bw / 2, pos.y - def.radius - 10, bw * Math.max(0, e.hp / maxHp), 3);
  }

  // shots
  for (const sh of s.shots) {
    const a = sh.life / sh.maxLife;
    ctx.globalAlpha = a;
    ctx.strokeStyle = sh.color;
    if (sh.kind === "BEAM") ctx.lineWidth = 3;
    else if (sh.kind === "PULSE") ctx.lineWidth = 1;
    else ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sh.from.x, sh.from.y);
    ctx.lineTo(sh.to.x, sh.to.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // explosions
  for (const b of s.booms) {
    const p = 1 - b.life / b.maxLife;
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, b.radius * (0.4 + 0.6 * p), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = (1 - p) * 0.25;
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
