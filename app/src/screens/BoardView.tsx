import { useRef, useState } from 'react'
import type { Case } from '@engine/types'
import {
  KIND_COLOR, KIND_LABEL, baseId, boardCards, cardH, cardW,
  type Card, type CardKind,
} from '../case/board'
import { ko } from '../case/loadCase'
import { suspectView } from '../case/suspect'
import type { Board, CaseProgress, PlayerAnnotations, Relation } from '../state/stores'

/**
 * 상황판 — 프로토타입 581~717행 · `PB_*` 41개 함수(1620~1825행).
 *
 * **이 게임에서 유일하게 「플레이어가 지은 것」이 남는 화면이다.** 메모는 글이고
 * 마킹은 표시지만 상황판은 배치다 — 무엇을 옆에 놓았는지가 곧 추리다.
 *
 * ★ 판은 아무것도 판정하지 않는다 ★
 * 연결선의 관계(모순·뒷받침·동일인·시간충돌·관련)는 **플레이어의 어휘**다.
 * 게임은 그것이 맞는지 틀린지 말하지 않고 채점에도 쓰지 않는다 — 심증과 같다.
 *
 * ⚠ **2층까지 옮겼다.** 판·팬/줌·서랍·카드 3단·드래그·핀·연결선·선택 툴바·
 * 미니맵(1층) + ＋생성 메뉴·그룹(영역·교집합)·자유 라벨·그룹 이동/크기(2층).
 * 남은 것은 **타임라인 밴드 · 마퀴 다중선택 · 조각 상세 팝업 · 미니맵 드래그**이고
 * `Board.times` 자리는 이미 있다. `docs/NEXT-ACTION.md` 참조.
 */

const REL: Record<Relation, string> = {
  모순: 'var(--label-red)',
  뒷받침: 'var(--status-review)',
  동일인: 'var(--accent)',
  시간충돌: 'var(--status-progress)',
  관련: 'var(--fg-2)',
}
const RELS = Object.keys(REL) as Relation[]

const SECTIONS: { kind: CardKind; title: string }[] = [
  { kind: 'person', title: '인물' },
  { kind: 'evidence', title: '물증' },
  { kind: 'quote', title: '진술' },
  { kind: 'memo', title: '메모' },
]

/** ＋생성 메뉴. 원본 `PB_TOOLS`(1639행) */
const TOOLS: { tool: Tool; label: string; color: string }[] = [
  { tool: '영역', label: '박스 (영역)', color: 'var(--border-strong)' },
  { tool: '교집합', label: '교집합 (벤다이어그램)', color: 'var(--accent)' },
  { tool: '메모', label: '메모', color: '#F2C94C' },
  { tool: '라벨', label: '텍스트 라벨', color: 'var(--fg-3)' },
]

type Tool = '영역' | '교집합' | '메모' | '라벨'
type Sel =
  | { kind: 'piece'; id: string }
  | { kind: 'group'; id: string }
  | { kind: 'label'; id: string }
  | { kind: 'bind'; id: string }
  | null
type Drag =
  | {
    kind: 'piece' | 'label' | 'group' | 'resize' | 'bind' | 'time'
    id: string; ox: number; oy: number; moved: boolean
    /** 결속·다중 이동일 때 조각별 잡은 지점 */
    offs?: Record<string, { x: number; y: number }>
  }
  | null
type Marquee = { x1: number; y1: number; x2: number; y2: number } | null
type Connect = { from: string; cx: number; cy: number } | null
type DrawShape = { x1: number; y1: number; x2: number; y2: number; shape: '영역' | '교집합' } | null

export function BoardView({
  c,
  progress,
  terms,
  facts,
  annotations,
  onBoard,
}: {
  c: Case
  progress: CaseProgress
  terms: Set<string>
  /** 확보한 사실. 상세 팝업의 동기·기회·수단이 여기서 나온다 */
  facts: Set<string>
  annotations: PlayerAnnotations
  onBoard: (next: Board) => void
}) {
  const b = annotations.board
  const cards = boardCards(c, terms, annotations.notes, b)
  const byId = new Map(cards.map((x) => [x.id, x]))
  const cardOf = (id: string): Card | undefined => byId.get(id) ?? byId.get(baseId(id))

  // 화면 상태는 저장하지 않는다 — 다시 열면 처음 화면이다
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [lock, setLock] = useState(false)
  const [drawer, setDrawer] = useState(true)
  const [sel, setSel] = useState<Sel>(null)
  const [drag, setDrag] = useState<Drag>(null)
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null)
  const [connect, setConnect] = useState<Connect>(null)
  const [picker, setPicker] = useState<{ a: string; b: string; x: number; y: number } | null>(null)
  /** 다음에 판을 누르면 무엇이 생기나. 한 번 쓰면 풀린다 (원본 `tool`) */
  const [tool, setTool] = useState<Tool | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [draw, setDraw] = useState<DrawShape>(null)
  /** 여러 개 고른 상태. 마퀴(Shift+드래그)나 Shift+클릭으로 모은다 */
  const [msel, setMsel] = useState<string[]>([])
  const [marquee, setMarquee] = useState<Marquee>(null)
  const [timeline, setTimeline] = useState(true)
  /** 강조한 시간대. 그 밴드의 조각만 밝고 나머지는 흐려진다 (원본 `hlTimeId`) */
  const [hlTime, setHlTime] = useState<string | null>(null)
  /** 펼쳐 본 조각. 「상세」로 열고 ✕ 로 닫는다 (원본 `detailId`) */
  const [detail, setDetail] = useState<string | null>(null)
  const [detailFull, setDetailFull] = useState(false)
  const canvas = useRef<HTMLDivElement>(null)

  const set = (patch: Partial<Board>) => onBoard({ ...b, ...patch })
  const sizeOf = (id: string) => b.size[id] ?? 'full'
  const wOf = (id: string) => cardW(sizeOf(id))
  const hOf = (id: string) => cardH(sizeOf(id), cardOf(id)?.kind ?? 'person')
  const centerOf = (id: string) => {
    const p = b.placed[id]
    return { x: p.x + wOf(id) / 2, y: p.y + hOf(id) / 2 }
  }

  /** 화면 좌표 → 판 좌표. 원본 `PB_toWorld` */
  const toWorld = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom }
  }
  /** 원본 `PB_clampPan` — 오른쪽·아래로는 얼마든지, 왼쪽·위로는 40까지 */
  const clamp = (x: number, y: number) => ({ x: Math.min(40, x), y: Math.min(40, y) })
  const setZ = (z: number) => { if (!lock) setZoom(Math.max(0.5, Math.min(1.6, z))) }

  /** 새 조각. 이미 있으면 `#2` 를 붙인다 (원본 `PB_freshId`) */
  const freshId = (base: string) => {
    if (!b.placed[base]) return base
    let n = 2
    while (b.placed[`${base}#${n}`]) n++
    return `${base}#${n}`
  }

  const addPiece = (id: string) => {
    const nid = freshId(id)
    set({ placed: { ...b.placed, [nid]: { x: 300 + Math.random() * 160, y: 180 + Math.random() * 180 } } })
    setSel({ kind: 'piece', id: nid })
  }

  const removePiece = (id: string) => {
    const placed = { ...b.placed }
    delete placed[id]
    set({ placed, strings: b.strings.filter((s) => s.a !== id && s.b !== id) })
    setSel(null)
  }

  const cycleSize = (id: string) =>
    set({ size: { ...b.size, [id]: sizeOf(id) === 'full' ? 'chip' : 'full' } })

  const togglePin = (id: string) => {
    const pins = { ...b.pins }
    if (pins[id]) delete pins[id]
    else pins[id] = true
    set({ pins })
  }

  const newMemo = (x: number, y: number) => {
    const id = `m${Date.now()}`
    set({
      memoText: { ...b.memoText, [id]: '' },
      memoOrder: [...b.memoOrder, id],
      placed: { ...b.placed, [id]: { x, y } },
    })
    setSel({ kind: 'piece', id })
  }

  /**
   * 교집합 안에 든 조각 — 원본 `PB_inVennOverlap`.
   *
   * 두 원 **둘 다**에 들어야 한다. 겹친 자리에 놓았다는 것이 곧 「이 둘의
   * 공통점이다」라는 플레이어의 말이고, 그래서 테두리가 accent 로 바뀐다.
   * 원의 반지름은 상자의 32%(가로) · 50%(세로), 중심은 32%/68% 지점.
   */
  const inVennOverlap = (id: string) =>
    b.groups.some((g) => {
      if (g.shape !== '교집합') return false
      const cc = centerOf(id)
      const rx = g.w * 0.32
      const ry = g.h * 0.5
      const cy = g.y + g.h / 2
      const ins = (cx: number) =>
        ((cc.x - cx) ** 2) / (rx * rx) + ((cc.y - cy) ** 2) / (ry * ry) <= 1
      return ins(g.x + g.w * 0.32) && ins(g.x + g.w * 0.68)
    })

  /** 영역 안에 든 조각. 중심이 기준이다 (원본 `PB_regionMembers`) */
  const membersOf = (g: Board['groups'][number]) =>
    Object.keys(b.placed).filter((id) => {
      if (!cardOf(id)) return false
      const cc = centerOf(id)
      return cc.x >= g.x && cc.x <= g.x + g.w && cc.y >= g.y && cc.y <= g.y + g.h
    })

  // ── 포인터 ────────────────────────────────────────────────────────
  const onCanvasDown = (e: React.PointerEvent) => {
    setSel(null); setPicker(null); setAddOpen(false)
    // 도구가 들려 있으면 판을 누르는 것이 곧 생성이다 (원본 `PB_onBgDown`)
    if (tool === '영역' || tool === '교집합') {
      const w = toWorld(e)
      setDraw({ x1: w.x, y1: w.y, x2: w.x, y2: w.y, shape: tool })
      return
    }
    if (tool === '메모') { const w = toWorld(e); newMemo(w.x, w.y); setTool(null); return }
    if (tool === '라벨') {
      const w = toWorld(e)
      const id = `l${Date.now()}`
      set({ labels: [...b.labels, { id, x: w.x, y: w.y, text: '' }] })
      setSel({ kind: 'label', id }); setTool(null)
      return
    }
    // Shift+드래그는 팬이 아니라 **범위 선택**이다 (원본 `PB_onBgDown`)
    if (e.shiftKey && !lock) {
      const w = toWorld(e)
      setMarquee({ x1: w.x, y1: w.y, x2: w.x, y2: w.y })
      setMsel([])
      return
    }
    setMsel([])
    if (lock) return
    setPanning({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const onCanvasMove = (e: React.PointerEvent) => {
    if (drag) {
      const w = toWorld(e)
      if (!drag.moved) setDrag({ ...drag, moved: true })
      const nx = Math.max(0, w.x - drag.ox)
      const ny = Math.max(0, w.y - drag.oy)
      if (drag.kind === 'time') {
        // 시간 마커는 **가로로만** 움직인다. 세로로 흔들리면 시간축이 아니다
        set({ times: b.times.map((t) => (t.id === drag.id
          ? { ...t, x: Math.max(40, w.x - drag.ox) } : t)) })
      } else if (drag.kind === 'bind' && drag.offs) {
        const placed = { ...b.placed }
        for (const [id, o] of Object.entries(drag.offs))
          if (placed[id]) placed[id] = { x: Math.max(0, w.x - o.x), y: Math.max(0, w.y - o.y) }
        set({ placed })
      } else if (drag.kind === 'label') {
        set({ labels: b.labels.map((l) => (l.id === drag.id ? { ...l, x: nx, y: ny } : l)) })
      } else if (drag.kind === 'group') {
        // 영역을 옮기면 **안에 든 조각도 같이 간다.** 안 그러면 묶은 것이 풀린다
        const g = b.groups.find((x) => x.id === drag.id)!
        const dx = nx - g.x
        const dy = ny - g.y
        const placed = { ...b.placed }
        for (const id of membersOf(g))
          placed[id] = { x: placed[id].x + dx, y: placed[id].y + dy }
        set({
          groups: b.groups.map((x) => (x.id === drag.id ? { ...x, x: nx, y: ny } : x)),
          placed,
        })
      } else if (drag.kind === 'resize') {
        set({ groups: b.groups.map((x) => (x.id === drag.id
          ? { ...x, w: Math.max(80, w.x - x.x), h: Math.max(60, w.y - x.y) } : x)) })
      } else {
        set({ placed: { ...b.placed, [drag.id]: { x: nx, y: ny } } })
      }
      return
    }
    if (draw) { const w = toWorld(e); setDraw({ ...draw, x2: w.x, y2: w.y }); return }
    if (marquee) { const w = toWorld(e); setMarquee({ ...marquee, x2: w.x, y2: w.y }); return }
    if (connect) {
      const w = toWorld(e)
      setConnect({ ...connect, cx: w.x, cy: w.y })
      return
    }
    if (panning) setPan(clamp(e.clientX - panning.x, e.clientY - panning.y))
  }

  const onCanvasUp = (e: React.PointerEvent) => {
    if (drag) {
      if (!drag.moved) {
        const bind = bindOf(drag.id)
        setSel(bind
          ? { kind: 'bind', id: bind.id }
          : { kind: drag.kind === 'resize' ? 'group' : drag.kind, id: drag.id } as Sel)
      }
      setDrag(null)
      return
    }
    if (marquee) {
      // 스치기만 해도 잡힌다 — 완전히 감쌀 필요는 없다 (원본 `PB_onCanvasUp`)
      const x0 = Math.min(marquee.x1, marquee.x2)
      const y0 = Math.min(marquee.y1, marquee.y2)
      const x1 = Math.max(marquee.x1, marquee.x2)
      const y1 = Math.max(marquee.y1, marquee.y2)
      setMsel(Object.keys(b.placed).filter((id) => {
        if (!cardOf(id)) return false
        const p = b.placed[id]
        return p.x + wOf(id) >= x0 && p.x <= x1 && p.y + hOf(id) >= y0 && p.y <= y1
      }))
      setMarquee(null); setSel(null)
      return
    }
    if (draw) {
      // 작게 그리면 기본 크기로. 원본 `tiny` — 툭 찍어도 쓸 만한 영역이 생긴다
      const x = Math.min(draw.x1, draw.x2)
      const y = Math.min(draw.y1, draw.y2)
      const rw = Math.abs(draw.x2 - draw.x1)
      const rh = Math.abs(draw.y2 - draw.y1)
      const tiny = rw < 40 && rh < 30
      const id = `g${Date.now()}`
      set({ groups: [...b.groups, {
        id, x, y,
        w: tiny ? 220 : rw,
        h: tiny ? 140 : rh,
        shape: draw.shape,
        label: draw.shape === '교집합' ? '교집합' : '용의선상',
      }] })
      setDraw(null); setTool(null); setSel({ kind: 'group', id })
      return
    }
    if (connect) {
      // 놓은 자리 아래에 조각이 있으면 잇는다. 원본 `PB_onCanvasUp` 의 히트 판정
      const w = toWorld(e)
      const hit = Object.keys(b.placed).find((id) => {
        if (id === connect.from) return false
        const p = b.placed[id]
        return w.x >= p.x && w.x <= p.x + wOf(id) && w.y >= p.y && w.y <= p.y + hOf(id)
      })
      if (hit) {
        const rest = b.strings.filter(
          (s) => !((s.a === connect.from && s.b === hit) || (s.a === hit && s.b === connect.from)),
        )
        set({ strings: [...rest, { a: connect.from, b: hit, rel: '관련' as Relation }] })
        const pa = b.placed[connect.from]
        const pb = b.placed[hit]
        setPicker({ a: connect.from, b: hit, x: (pa.x + pb.x) / 2 + 90, y: (pa.y + pb.y) / 2 + 22 })
      }
      setConnect(null)
      return
    }
    setPanning(null)
  }

  const bindOf = (id: string) => b.binds.find((x) => x.mem.includes(id))

  /**
   * 이 x 좌표가 어느 시간대에 드나. 원본 `PB_bandOf`.
   *
   * **마커의 90px 앞부터** 그 시간대다 — 카드를 마커에 딱 맞춰 놓지 않아도
   * 되도록. 첫 마커보다 왼쪽은 첫 시간대로 떨어진다.
   */
  const bandOf = (cx: number): string | null => {
    const ts = [...b.times].sort((p, q) => p.x - q.x)
    if (!ts.length) return null
    let owner = ts[0].id
    for (const t of ts) if (cx >= t.x - 90) owner = t.id
    return owner
  }

  const addTime = () => {
    const xs = b.times.map((t) => t.x)
    const id = `t${Date.now()}`
    set({ times: [...b.times, { id, x: (xs.length ? Math.max(...xs) : 200) + 250, label: '새 시간' }] })
  }

  const onPieceDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation()
    // Shift+클릭은 고르기다. 이미 고른 것을 다시 누르면 빠진다
    if (e.shiftKey) {
      setMsel((m) => {
        const base = m.length === 0 && sel?.kind === 'piece' && sel.id !== id ? [sel.id] : m
        return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
      })
      setSel(null)
      return
    }
    if (b.pins[id]) { setSel({ kind: 'piece', id }); return }
    const w = toWorld(e)
    const bind = bindOf(id)
    if (bind) {
      // 결속된 조각을 끌면 **전부 같이** 온다. 그게 묶은 이유다
      const offs: Record<string, { x: number; y: number }> = {}
      for (const mid of bind.mem)
        if (b.placed[mid]) offs[mid] = { x: w.x - b.placed[mid].x, y: w.y - b.placed[mid].y }
      setDrag({ kind: 'bind', id, ox: 0, oy: 0, moved: false, offs })
      return
    }
    const p = b.placed[id]
    setDrag({ kind: 'piece', id, ox: w.x - p.x, oy: w.y - p.y, moved: false })
  }

  const onGrabDown = (
    kind: 'label' | 'group' | 'resize' | 'time',
    id: string,
    at: { x: number; y: number },
    e: React.PointerEvent,
  ) => {
    e.stopPropagation()
    const w = toWorld(e)
    setDrag({ kind, id, ox: w.x - at.x, oy: w.y - at.y, moved: false })
  }

  const placedCount = (cardId: string) =>
    Object.keys(b.placed).filter((id) => baseId(id) === cardId).length

  const pieces = Object.keys(b.placed).filter((id) => cardOf(id))

  return (
    <div className="nl-pb">
      <div className="nl-pb-bar">
        <span className="v-ui" style={{ color: 'var(--fg)' }}>상황판</span>
        <span className="v-meta" style={{ color: 'var(--fg-4)' }}>
          서랍에서 끌어다 놓고, 오른쪽 손잡이를 끌어 이으세요
        </span>
        <span className="nl-fs-spacer" />
        {/* 원본 588~592행 — 고르면 다음에 판을 누르는 자리에 생긴다 */}
        <div className="nl-pb-add">
          <span
            className={tool ? 'nl-pb-chip nl-pb-chip-on' : 'nl-pb-chip'}
            onClick={() => setAddOpen((v) => !v)}
          >
            ＋ 생성{tool ? ` · ${tool}` : ''}
          </span>
          {addOpen && (
            <div className="v-menu nl-pb-add-menu">
              {TOOLS.map((t) => (
                <div
                  key={t.tool}
                  className="v-menu-item"
                  onClick={() => { setTool(t.tool); setAddOpen(false) }}
                >
                  <span className="nl-pb-rel-dot" style={{ background: t.color }} />{t.label}
                </div>
              ))}
            </div>
          )}
        </div>
        <span
          className={timeline ? 'nl-pb-chip nl-pb-chip-on' : 'nl-pb-chip'}
          onClick={() => { setTimeline((v) => !v); setHlTime(null) }}
        >
          타임라인
        </span>
        <span
          className={lock ? 'nl-pb-chip nl-pb-chip-on' : 'nl-pb-chip'}
          onClick={() => setLock((v) => !v)}
          title="화면 이동·줌 잠금"
        >
          화면 고정
        </span>
        <div className="nl-pb-zoom">
          <button className="iconbtn" onClick={() => setZ(zoom - 0.1)}>−</button>
          <span className="v-micro nl-pb-zoom-pct">{Math.round(zoom * 100)}%</span>
          <button className="iconbtn" onClick={() => setZ(zoom + 0.1)}>+</button>
          <button className="iconbtn nl-pb-btn-wide" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1) }}>
            홈
          </button>
          <button
            className="iconbtn nl-pb-btn-wide nl-pb-btn-danger"
            title="빈 판으로 초기화"
            onClick={() => {
              onBoard({
                ...b, placed: {}, size: {}, strings: [], memoText: {}, memoOrder: [],
                pins: {}, groups: [], labels: [],
              })
              setSel(null); setPicker(null); setTool(null)
            }}
          >
            초기화
          </button>
        </div>
      </div>

      <div className="nl-pb-wrap">
        {drawer ? (
          <div className="nl-pb-drawer">
            <div className="nl-pb-drawer-head">
              <span className="v-micro nl-pb-cap">올릴 것</span>
              <span className="nl-fs-spacer" />
              <div className="nl-pb-drawer-x" onClick={() => setDrawer(false)} title="서랍 닫기">‹</div>
            </div>
            {SECTIONS.map((s) => {
              const items = cards.filter((x) => x.kind === s.kind)
              return (
                <div key={s.kind} className="nl-pb-sec">
                  <div className="nl-pb-sec-head">
                    <span className="nl-pb-sec-dot" style={{ background: KIND_COLOR[s.kind] }} />
                    <span className="v-micro nl-pb-cap">{s.title}</span>
                  </div>
                  {items.length === 0 ? (
                    <div className="nl-pb-locked">조사 전 · 없음</div>
                  ) : (
                    items.map((it) => {
                      const n = placedCount(it.id)
                      return (
                        <div key={it.id} className="nl-pb-draw-row" onClick={() => addPiece(it.id)}>
                          <span className="v-meta nl-pb-draw-label">{it.label}</span>
                          <span className="nl-fs-spacer" />
                          {n > 0 && <span className="nl-pb-draw-badge">{n}</span>}
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="nl-pb-drawer-open" onClick={() => setDrawer(true)} title="서랍 열기">›</div>
        )}

        <div
          className="nl-pb-canvas"
          style={{ cursor: panning ? 'grabbing' : lock ? 'default' : 'grab' }}
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={onCanvasUp}
        >
          <div
            ref={canvas}
            className="nl-pb-world"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {/* 타임라인 — 원본 620~630행. 판 맨 위 56px 띠가 시간축이고,
                조각을 그 안에 올려두면 그 시간대에 속한다 */}
            {timeline && (
              <>
                <div className="nl-pb-tl-band" style={{ top: lock ? 0 : -pan.y / zoom }}>
                  <span className="v-micro nl-pb-tl-cap">시간 →</span>
                  <span
                    className="nl-pb-tl-add"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={addTime}
                  >
                    ＋시간
                  </span>
                  {[...b.times].sort((p, q) => p.x - q.x).map((t) => {
                    const active = hlTime === t.id
                    return (
                      <div
                        key={t.id}
                        className="nl-pb-tl-marker"
                        style={{ left: t.x }}
                        onPointerDown={(e) => onGrabDown('time', t.id, { x: t.x, y: 0 }, e)}
                      >
                        <span
                          className={active ? 'nl-pb-tl-tick nl-pb-tl-tick-on' : 'nl-pb-tl-tick'}
                          title="시간 강조"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => setHlTime(active ? null : t.id)}
                        />
                        <input
                          className="nl-pb-tl-input"
                          value={t.label}
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => set({ times: b.times.map((x) =>
                            x.id === t.id ? { ...x, label: e.target.value } : x) })}
                        />
                        <span
                          className="nl-pb-tl-del"
                          title="삭제"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            set({ times: b.times.filter((x) => x.id !== t.id) })
                            if (hlTime === t.id) setHlTime(null)
                          }}
                        >
                          삭제
                        </span>
                      </div>
                    )
                  })}
                </div>
                {/* 세로 안내선. 시간축이 판 아래까지 이어진다는 표시 */}
                {b.times.map((t) => (
                  <div key={t.id} className="nl-pb-tl-guide" style={{ left: t.x }} />
                ))}
              </>
            )}

            {/* 그룹 — 조각보다 **아래**에 깔린다. 묶는 것이지 덮는 것이 아니다 */}
            {b.groups.map((g) => {
              const on = sel?.kind === 'group' && sel.id === g.id
              const bc = on ? 'var(--accent)' : 'var(--border-strong)'
              const venn = g.shape === '교집합'
              return (
                <div
                  key={g.id}
                  className={venn ? 'nl-pb-group nl-pb-group-venn' : 'nl-pb-group'}
                  style={{
                    left: g.x, top: g.y, width: g.w, height: g.h,
                    ...(venn ? {} : { border: `1.5px ${on ? 'solid' : 'dashed'} ${bc}` }),
                  }}
                >
                  {venn && (
                    <>
                      <span className="nl-pb-venn-c" style={{ left: 0, borderColor: bc }} />
                      <span className="nl-pb-venn-c" style={{ right: 0, borderColor: bc }} />
                    </>
                  )}
                  {membersOf(g).length === 0 && <span className="nl-pb-group-empty">비어 있음</span>}

                  <span
                    className="nl-pb-grip nl-pb-grip-move"
                    title="이동"
                    onPointerDown={(e) => onGrabDown('group', g.id, g, e)}
                  >
                    ⠿
                  </span>
                  <div className={venn ? 'nl-pb-group-lw nl-pb-group-lw-venn' : 'nl-pb-group-lw'}>
                    <input
                      className="nl-pb-group-label"
                      value={g.label}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => set({ groups: b.groups.map((x) =>
                        x.id === g.id ? { ...x, label: e.target.value } : x) })}
                    />
                    {on && (
                      <span
                        className="nl-pb-group-del"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => { set({ groups: b.groups.filter((x) => x.id !== g.id) }); setSel(null) }}
                      >
                        삭제
                      </span>
                    )}
                  </div>
                  <span
                    className="nl-pb-grip nl-pb-grip-resize"
                    title="크기"
                    onPointerDown={(e) => onGrabDown('resize', g.id, { x: g.x + g.w, y: g.y + g.h }, e)}
                  >
                    ◢
                  </span>
                </div>
              )
            })}

            {marquee && (
              <div
                className="nl-pb-marquee"
                style={{
                  left: Math.min(marquee.x1, marquee.x2), top: Math.min(marquee.y1, marquee.y2),
                  width: Math.abs(marquee.x2 - marquee.x1), height: Math.abs(marquee.y2 - marquee.y1),
                }}
              />
            )}

            {draw && (
              <div
                className="nl-pb-group nl-pb-draw"
                style={{
                  left: Math.min(draw.x1, draw.x2), top: Math.min(draw.y1, draw.y2),
                  width: Math.abs(draw.x2 - draw.x1), height: Math.abs(draw.y2 - draw.y1),
                }}
              />
            )}

            <svg className="nl-pb-svg" width="2600" height="1600">
              {b.strings.map((s, i) => {
                if (!b.placed[s.a] || !b.placed[s.b]) return null
                const p = centerOf(s.a)
                const q = centerOf(s.b)
                return (
                  <line
                    key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                    stroke={REL[s.rel]} strokeWidth={1.5}
                  />
                )
              })}
              {connect && b.placed[connect.from] && (
                <line
                  x1={centerOf(connect.from).x} y1={centerOf(connect.from).y}
                  x2={connect.cx} y2={connect.cy}
                  stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 3"
                />
              )}
            </svg>

            {b.strings.map((s, i) => {
              if (!b.placed[s.a] || !b.placed[s.b]) return null
              const p = centerOf(s.a)
              const q = centerOf(s.b)
              return (
                <div
                  key={i}
                  className="nl-pb-rel"
                  style={{ left: (p.x + q.x) / 2, top: (p.y + q.y) / 2, color: REL[s.rel] }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setPicker({ a: s.a, b: s.b, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + 16 })}
                >
                  {s.rel}
                </div>
              )
            })}

            {/* 자유 라벨 — 원본 652~655행. 판에 직접 쓰는 글씨다 */}
            {b.labels.map((l) => {
              const on = sel?.kind === 'label' && sel.id === l.id
              return (
                <div
                  key={l.id}
                  className="nl-pb-freelabel"
                  style={{ left: l.x, top: l.y, zIndex: on ? 20 : 6 }}
                  onPointerDown={(e) => onGrabDown('label', l.id, l, e)}
                >
                  <input
                    className="nl-pb-lbl-input"
                    value={l.text}
                    placeholder="라벨"
                    onPointerDown={(e) => { if (on) e.stopPropagation() }}
                    onChange={(e) => set({ labels: b.labels.map((x) =>
                      x.id === l.id ? { ...x, text: e.target.value } : x) })}
                  />
                  {on && (
                    <span
                      className="nl-pb-lbl-del"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => { set({ labels: b.labels.filter((x) => x.id !== l.id) }); setSel(null) }}
                    >
                      삭제
                    </span>
                  )}
                </div>
              )
            })}

            {pieces.map((id) => {
              const card = cardOf(id)!
              const p = b.placed[id]
              const size = sizeOf(id)
              const bind = bindOf(id)
              // 교집합에 놓인 것도 선택과 **같은 표시**를 받는다 (원본 `on`)
              const on = (sel?.kind === 'piece' && sel.id === id)
                || (sel?.kind === 'bind' && bind?.id === sel.id)
                || msel.includes(id)
                || inVennOverlap(id)
              const isMemo = card.kind === 'memo'
              // 띠 안(y < 56)에 올려둔 조각은 그 시간대에 속한다 (원본 `laned`)
              const laned = timeline && p.y < 56
              const own = laned ? bandOf(p.x + cardW(size) / 2) : null
              const timeLabel = own ? (b.times.find((t) => t.id === own)?.label ?? '') : ''
              // 시간대를 강조하면 **다른 시간대가 흐려진다.** 지우지 않는다
              const dim = hlTime !== null && laned && own !== hlTime
              return (
                <div
                  key={id}
                  className="nl-pb-piece"
                  style={{
                    left: p.x, top: p.y, zIndex: on ? 20 : 5, width: cardW(size),
                    opacity: dim ? 0.32 : 1, transition: 'opacity .15s',
                  }}
                  onPointerDown={(e) => onPieceDown(id, e)}
                >
                  {size === 'chip' ? (
                    <div className="nl-pb-card nl-pb-chip-card" style={on ? { borderColor: 'var(--accent)' } : undefined}>
                      <span className="nl-pb-ini" style={{ background: card.color }}>{card.ini}</span>
                      <span className="v-ui nl-pb-chip-label">{card.label}</span>
                    </div>
                  ) : (
                    <div className="nl-pb-card" style={on ? { borderColor: 'var(--accent)' } : undefined}>
                      <div className="nl-pb-card-head">
                        <span className="nl-pb-type-dot" style={{ background: KIND_COLOR[card.kind] }} />
                        <span className="v-micro nl-pb-cap">{KIND_LABEL[card.kind]}</span>
                        {laned && timeLabel && (
                          <span className="v-micro" style={{ color: 'var(--accent)' }}>· {timeLabel}</span>
                        )}
                      </div>
                      {isMemo ? (
                        <textarea
                          className="nl-pb-memo"
                          value={b.memoText[id] ?? ''}
                          placeholder="메모…"
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => set({ memoText: { ...b.memoText, [id]: e.target.value } })}
                        />
                      ) : (
                        <>
                          <div className="nl-pb-card-row">
                            <span className="nl-pb-ini" style={{ background: card.color }}>{card.ini}</span>
                            <div style={{ minWidth: 0 }}>
                              <div className="v-ui nl-pb-card-label">{card.label}</div>
                              {card.sub && <div className="v-micro nl-pb-card-sub">{card.sub}</div>}
                            </div>
                          </div>
                          {card.quote && <div className="v-meta nl-pb-quote">{card.quote}</div>}
                        </>
                      )}
                    </div>
                  )}

                  {b.pins[id] && <span className="nl-pb-pin" title="고정됨">📌</span>}

                  {/* 오른쪽 손잡이를 끌면 선이 따라 나온다 (원본 pb-zone-r) */}
                  <span
                    className="nl-pb-handle"
                    title="끌어서 연결"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const w = toWorld(e)
                      setConnect({ from: id, cx: w.x, cy: w.y })
                    }}
                  />
                </div>
              )
            })}

            {/* 조각 상세 — 원본 687~696행. 카드가 작아도 내용은 다 읽을 수 있어야 한다 */}
            {detail && b.placed[detail] && cardOf(detail) && (() => {
              const card = cardOf(detail)!
              const p = b.placed[detail]
              const pid = detail.startsWith('p_') || detail.startsWith('q_')
                ? baseId(detail).slice(2) : null
              const person = pid ? c.people.find((x) => x.id === pid) : undefined
              const isProfile = detail.startsWith('p_')
              const view = person && isProfile
                ? suspectView(c, progress, facts, person.id) : null
              const term = detail.startsWith('e_')
                ? c.terms?.find((t) => t.word === baseId(detail).slice(2)) : undefined
              const full = person ? (person.statement?.paragraphs ?? []).map(ko).join('\n\n') : ''

              return (
                <div
                  className="nl-pb-detail"
                  style={{ left: p.x + cardW(sizeOf(detail)) + 12, top: p.y }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="nl-pb-detail-head">
                    <span className="nl-pb-type-dot" style={{ background: KIND_COLOR[card.kind] }} />
                    <span className="v-micro nl-pb-cap">{KIND_LABEL[card.kind]}</span>
                    <span className="nl-fs-spacer" />
                    <span className="nl-pb-detail-x" onClick={() => setDetail(null)}>✕</span>
                  </div>
                  <div className="v-title" style={{ color: 'var(--fg)', marginBottom: 4 }}>{card.label}</div>
                  {card.sub && <div className="v-meta nl-pb-detail-sub">{card.sub}</div>}

                  {isProfile && person && (
                    <>
                      <div className="v-micro nl-pb-cap">본인 주장</div>
                      <div className="v-meta nl-pb-detail-body">{ko(person.claimSummary)}</div>
                    </>
                  )}

                  {view && view.clues.length > 0 && (
                    <>
                      <div className="v-micro nl-pb-cap">발견된 단서</div>
                      <div className="nl-pb-detail-clues">
                        {view.clues.map((cl, n) => (
                          <div key={n} className="nl-pb-detail-clue">
                            <span style={{ color: 'var(--accent)', flex: 'none' }}>·</span>
                            <span className="v-meta" style={{ color: 'var(--fg-2)' }}>{cl.text}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {term && <div className="v-meta nl-pb-detail-body">{ko(term.note)}</div>}
                  {card.quote && !isProfile && (
                    <div className="v-meta nl-pb-detail-body" style={{ fontStyle: 'italic' }}>{card.quote}</div>
                  )}

                  {view && (
                    <div className="nl-pb-detail-slots">
                      {view.slots.map((s) => (
                        <div key={s.kind} className="nl-pb-detail-slot">
                          <span className="v-micro nl-pb-detail-slot-k">{s.label}</span>
                          {s.fact ? (
                            <span className="v-meta" style={{ color: 'var(--fg-2)' }}>{s.fact.content}</span>
                          ) : (
                            <>
                              <span className="nl-pb-detail-dash" />
                              <span className="v-micro" style={{ color: 'var(--fg-4)', flex: 'none' }}>미확인</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {full && (
                    <div className="nl-pb-detail-full">
                      <div className="nl-pb-detail-fulltoggle" onClick={() => setDetailFull((v) => !v)}>
                        <span style={{ transform: detailFull ? 'rotate(90deg)' : 'none' }}>▸</span>
                        진술 전문
                      </div>
                      {detailFull && <div className="v-meta nl-pb-detail-fulltext">{full}</div>}
                    </div>
                  )}
                </div>
              )
            })()}

            {picker && (
              <div
                className="v-menu nl-pb-relpicker"
                style={{ left: picker.x, top: picker.y }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {RELS.map((r) => (
                  <div
                    key={r}
                    className="v-menu-item"
                    onClick={() => {
                      set({ strings: b.strings.map((s) =>
                        s.a === picker.a && s.b === picker.b ? { ...s, rel: r } : s) })
                      setPicker(null)
                    }}
                  >
                    <span className="nl-pb-rel-dot" style={{ background: REL[r] }} />{r}
                  </div>
                ))}
                <div className="nl-pb-relpicker-sep" />
                <div
                  className="v-menu-item nl-pb-rel-del"
                  onClick={() => {
                    set({ strings: b.strings.filter((s) => !(s.a === picker.a && s.b === picker.b)) })
                    setPicker(null)
                  }}
                >
                  연결 삭제
                </div>
              </div>
            )}
          </div>

          {/* 선택 툴바 — 원본 1769~1771행 */}
          {sel?.kind === 'piece' && b.placed[sel.id] && (
            <div className="nl-pb-toolbar" onPointerDown={(e) => e.stopPropagation()}>
              <span onClick={() => cycleSize(sel.id)}>{sizeOf(sel.id) === 'chip' ? '크게' : '작게'}</span>
              {/* 메모는 카드 안에서 이미 다 읽힌다 — 펼칠 것이 없다 (원본 1771행) */}
              {cardOf(sel.id)?.kind !== 'memo' && (
                <span onClick={() => { setDetail(sel.id); setDetailFull(false) }}>상세</span>
              )}
              <span onClick={() => addPiece(baseId(sel.id))}>복제</span>
              <span onClick={() => togglePin(sel.id)}>{b.pins[sel.id] ? '고정 해제' : '고정'}</span>
              <span className="nl-pb-del" onClick={() => removePiece(sel.id)}>삭제</span>
            </div>
          )}

          {/* 묶기 바 — 원본 708~711행. 둘 이상 골라야 뜬다 */}
          {(msel.length >= 2 || sel?.kind === 'bind') && (
            <div className="nl-pb-mselbar" onPointerDown={(e) => e.stopPropagation()}>
              {sel?.kind === 'bind' ? (
                <>
                  <span className="v-ui nl-pb-mselbar-n">
                    {b.binds.find((x) => x.id === sel.id)?.mem.length ?? 0}개 결속
                  </span>
                  <span
                    className="nl-pb-mselbar-btn"
                    onClick={() => { set({ binds: b.binds.filter((x) => x.id !== sel.id) }); setSel(null) }}
                  >
                    해제
                  </span>
                </>
              ) : (
                <>
                  <span className="v-ui nl-pb-mselbar-n">{msel.length}개 선택</span>
                  <span
                    className="nl-pb-mselbar-btn"
                    onClick={() => {
                      const id = `b${Date.now()}`
                      set({ binds: [...b.binds, { id, mem: msel.filter((x) => b.placed[x]) }] })
                      setMsel([]); setSel({ kind: 'bind', id })
                    }}
                  >
                    묶기
                  </span>
                </>
              )}
            </div>
          )}

          {/* 미니맵 — 원본 704~707행. 누르면 그 자리로 화면이 옮겨간다 */}
          <div
            className="nl-pb-minimap"
            onPointerDown={(e) => {
              e.stopPropagation()
              if (lock) return
              const r = e.currentTarget.getBoundingClientRect()
              const cv = canvas.current!.parentElement!.getBoundingClientRect()
              const wx = ((e.clientX - r.left) / r.width) * 2600
              const wy = ((e.clientY - r.top) / r.height) * 1600
              setPan(clamp(cv.width / 2 - wx * zoom, cv.height / 2 - wy * zoom))
            }}
          >
            {pieces.map((id) => {
              const p = b.placed[id]
              return (
                <span
                  key={id}
                  className="nl-pb-mm-dot"
                  style={{
                    left: `${(p.x / 2600) * 100}%`, top: `${(p.y / 1600) * 100}%`,
                    background: cardOf(id)!.color,
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
