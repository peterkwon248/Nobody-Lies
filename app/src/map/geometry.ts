import type { FloorPlan } from '@engine/types'

/**
 * 평면도 기하 생성기 — 프로토타입 `buildFloorplan()`(2366행)의 **순수 기하 부분**.
 *
 * 선언된 방·문·창에서 실제로 그릴 선을 뽑아낸다. 벽은 데이터에 없다 —
 * **맞닿은 방 두 개의 경계에서 계산**되고, 그 위에서 문이 뚫은 구간이 지워진다.
 * 그래서 방 하나를 옮기면 벽과 문이 저절로 따라온다.
 *
 * ★ 여기에 게임 상태를 넣지 않는다 ★
 * 조사 여부·물증·인물 위치는 화면이 얹는다. 기하가 상태를 알면 도면이
 * 「여기를 조사했다」를 선 굵기로 말하기 시작하고, 그 순간 판정이 된다.
 */

const EPS = 0.6

export type Seg = { x1: number; y1: number; x2: number; y2: number }
export type Area = FloorPlan['rooms'][number] | FloorPlan['zones'][number]

export type Geometry = {
  /** 그릴 수 있는 영역(별채 차단 반영) */
  areas: Area[]
  /** 장소 id → 대표 영역. 인물 마커가 여기 앉는다 */
  anchorOf: Map<string, Area>
  hatch: Area[]
  offsite: Area[]
  /** 외벽 두 겹 — 두꺼운 poché + 안쪽 얇은 선 */
  poche: { d: string; color: string; width: number }[]
  /** 방 경계에서 계산된 내벽. 문 구간은 빠져 있다 */
  walls: Seg[]
  doorErase: Seg[]
  doorLeaf: Seg[]
  doorArc: { d: string }[]
  doorLabels: { left: number; top: number; label: string }[]
  /** 창은 3선으로 그린다 */
  windows: Seg[]
  winLabels: { left: number; top: number; label: string }[]
  walks: (Seg & { mx: number; my: number; label: string })[]
  scale?: { x: number; x2: number; y: number; yt1: number; yt2: number }
  scaleLabel?: { left: number; top: number; text: string }
}

/** viewBox 좌표 → 퍼센트. 도면은 비율로 배치된다 */
export const pctX = (fp: FloorPlan, v: number) => (v / fp.viewBox.w) * 100
export const pctY = (fp: FloorPlan, v: number) => (v / fp.viewBox.h) * 100

/**
 * @param hidden 아직 드러나지 않은 건물 id. 별채가 1장 완성 전까지 여기 들어간다.
 *   **감추는 것이지 흐리는 것이 아니다** — 흐린 채로 두면 「저기 뭔가 있다」가 된다.
 */
export function buildGeometry(fp: FloorPlan, hidden: Set<string> = new Set()): Geometry {
  const visible = (b?: string) => !b || !hidden.has(b)

  const areas: Area[] = [
    ...fp.rooms.filter((r) => visible(r.building)),
    ...fp.zones,
  ]

  const anchorOf = new Map<string, Area>()
  for (const a of areas)
    if (a.primary && a.loc && !anchorOf.has(a.loc)) anchorOf.set(a.loc, a)

  const hatch = areas.filter((a) => 'hatch' in a && a.hatch)
  const offsite = areas.filter((a) => 'offsite' in a && a.offsite)

  // 외벽 — 두꺼운 선 + 3px 안쪽의 얇은 선. 도면의 poché 관습이다
  const poche: Geometry['poche'] = []
  for (const b of fp.buildings) {
    if (hidden.has(b.id)) continue
    poche.push({
      d: `M${b.x} ${b.y} H${b.x + b.w} V${b.y + b.h} H${b.x} Z`,
      color: b.poche ?? 'var(--fg-3)',
      width: 6,
    })
    poche.push({
      d: `M${b.x + 3} ${b.y + 3} H${b.x + b.w - 3} V${b.y + b.h - 3} H${b.x + 3} Z`,
      color: 'var(--border)',
      width: 1,
    })
  }

  // ── 내벽: 같은 건물 안에서 맞닿은 방 쌍의 경계 ──────────────────────
  type Edge = { o: 'v' | 'h'; c: number; a: number; b: number }
  const edges: Edge[] = []
  const rooms = fp.rooms.filter((r) => visible(r.building))
  const byBuilding = new Map<string, typeof rooms>()
  for (const r of rooms) {
    const k = r.building ?? ''
    byBuilding.set(k, [...(byBuilding.get(k) ?? []), r])
  }

  for (const rs of byBuilding.values())
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++) {
        const A = rs[i], B = rs[j]
        // 세로로 맞닿는가
        if (Math.abs(A.x + A.w - B.x) < EPS || Math.abs(B.x + B.w - A.x) < EPS) {
          const c = Math.abs(A.x + A.w - B.x) < EPS ? B.x : A.x
          const a = Math.max(A.y, B.y), b = Math.min(A.y + A.h, B.y + B.h)
          if (b - a > EPS) edges.push({ o: 'v', c, a, b })
        }
        // 가로로 맞닿는가
        if (Math.abs(A.y + A.h - B.y) < EPS || Math.abs(B.y + B.h - A.y) < EPS) {
          const c = Math.abs(A.y + A.h - B.y) < EPS ? B.y : A.y
          const a = Math.max(A.x, B.x), b = Math.min(A.x + A.w, B.x + B.w)
          if (b - a > EPS) edges.push({ o: 'h', c, a, b })
        }
      }

  // 내부 문이 뚫은 구간을 벽에서 잘라낸다
  const innerDoors: Edge[] = fp.doors.filter((d) => !d.ext).map((d) => {
    const o: 'v' | 'h' = Math.abs(d.x1 - d.x2) < EPS ? 'v' : 'h'
    return {
      o,
      c: o === 'v' ? d.x1 : d.y1,
      a: o === 'v' ? Math.min(d.y1, d.y2) : Math.min(d.x1, d.x2),
      b: o === 'v' ? Math.max(d.y1, d.y2) : Math.max(d.x1, d.x2),
    }
  })

  const walls: Seg[] = []
  for (const e of edges) {
    let parts: [number, number][] = [[e.a, e.b]]
    for (const dr of innerDoors) {
      if (dr.o !== e.o || Math.abs(dr.c - e.c) >= EPS) continue
      const next: [number, number][] = []
      for (const [a, b] of parts) {
        if (dr.b <= a + EPS || dr.a >= b - EPS) { next.push([a, b]); continue }
        if (a < dr.a - EPS) next.push([a, dr.a])
        if (dr.b < b - EPS) next.push([dr.b, b])
      }
      parts = next
    }
    for (const [a, b] of parts) {
      if (b - a <= EPS) continue
      walls.push(e.o === 'v' ? { x1: e.c, y1: a, x2: e.c, y2: b } : { x1: a, y1: e.c, x2: b, y2: e.c })
    }
  }

  // ── 문: 문짝 + 스윙 아크 ────────────────────────────────────────────
  const doorErase: Seg[] = [], doorLeaf: Seg[] = []
  const doorArc: { d: string }[] = []
  const doorLabels: Geometry['doorLabels'] = []

  for (const d of fp.doors) {
    if (!visible(d.building)) continue
    if (d.open) continue  // 늘 열린 통로는 문짝을 안 그린다
    const p1 = { x: d.x1, y: d.y1 }, p2 = { x: d.x2, y: d.y2 }
    const hinge = d.hinge === 'p1' ? p1 : p2
    const free = d.hinge === 'p1' ? p2 : p1
    const dvx = free.x - hinge.x, dvy = free.y - hinge.y
    const R = Math.hypot(dvx, dvy)
    const swing = d.swing ?? 1
    const open = { x: hinge.x + swing * -dvy, y: hinge.y + swing * dvx }

    const aF = Math.atan2(free.y - hinge.y, free.x - hinge.x)
    const aO = Math.atan2(open.y - hinge.y, open.x - hinge.x)
    let dd = aO - aF
    while (dd <= -Math.PI) dd += 2 * Math.PI
    while (dd > Math.PI) dd -= 2 * Math.PI

    // 외벽에 난 문은 벽을 먼저 지우고 그린다
    if (d.ext) doorErase.push({ x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 })
    doorLeaf.push({ x1: hinge.x, y1: hinge.y, x2: free.x, y2: free.y })
    doorArc.push({ d: `M${free.x} ${free.y} A${R} ${R} 0 0 ${dd > 0 ? 1 : 0} ${open.x} ${open.y}` })
    if (d.label && d.lx !== undefined && d.ly !== undefined)
      doorLabels.push({ left: pctX(fp, d.lx), top: pctY(fp, d.ly), label: d.label })
  }

  // ── 창: 법선 방향으로 -3·0·+3 세 줄 ─────────────────────────────────
  const windows: Seg[] = []
  const winLabels: Geometry['winLabels'] = []
  for (const w of fp.windows) {
    if (!visible(w.building)) continue
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1
    const L = Math.hypot(dx, dy) || 1
    const nx = -dy / L, ny = dx / L
    for (const o of [-3, 0, 3])
      windows.push({ x1: w.x1 + nx * o, y1: w.y1 + ny * o, x2: w.x2 + nx * o, y2: w.y2 + ny * o })
    if (w.label && w.lx !== undefined && w.ly !== undefined)
      winLabels.push({ left: pctX(fp, w.lx), top: pctY(fp, w.ly), label: w.label })
  }

  const walks = fp.walks.filter((w) => visible(w.building)).map((w) => ({
    x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
    mx: pctX(fp, (w.x1 + w.x2) / 2),
    my: pctY(fp, (w.y1 + w.y2) / 2),
    label: w.min !== undefined ? `${w.min}분` : '',
  }))

  const s = fp.scale
  return {
    areas, anchorOf, hatch, offsite, poche, walls,
    doorErase, doorLeaf, doorArc, doorLabels, windows, winLabels, walks,
    ...(s ? {
      scale: { x: s.x, x2: s.x + s.len, y: s.y, yt1: s.y - 4, yt2: s.y + 4 },
      scaleLabel: { left: pctX(fp, s.x), top: pctY(fp, s.y + 18), text: `0 ─ ${s.label ?? ''}` },
    } : {}),
  }
}

/**
 * 한 장소 안에 여러 인물이 설 때의 자리. 3열로 흩는다.
 * 원본 2480행 — 겹쳐 그리면 누가 있는지 안 보인다.
 */
export function markerSpot(a: Area, indexInArea: number): { x: number; y: number } {
  const col = indexInArea % 3
  const row = Math.floor(indexInArea / 3)
  return {
    x: a.x + a.w / 2 + (col - 1) * a.w * 0.18,
    y: a.y + a.h * 0.6 + row * a.h * 0.12,
  }
}
