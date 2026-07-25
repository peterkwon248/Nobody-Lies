import type { Case } from '@engine/types'
import { ko } from '../case/loadCase'
import { victimLine } from './Briefing'
import { MarkedText } from '../marks/MarkedText'
import { refOf, type Highlight } from '../marks/marks'

/**
 * 사건 개요 — 브리핑에서 본 **확정 층**을 언제든 다시 볼 수 있는 자리.
 *
 * *"한 번 보여주고 사라지는 텍스트는 버그다"* (`HANDOFF-TO-CODE.md` §0.3).
 * 브리핑과 프롤로그는 진입 흐름에서 한 번 지나가므로 그 내용이 사는 화면이 따로 있어야 한다.
 *
 * **프로토타입 824~835행을 읽고 옮겼다.** 한때 여기가 표 두 개뿐이었다 —
 * 프롤로그 재수록·인용 툴바·갱신 배지·이전 값 취소선이 통째로 빠져 있었다
 * (2026-07-25 전수 대조).
 */
export function Overview({
  c,
  firedNarrow,
  highlights,
  onMark,
  onQuote,
}: {
  c: Case
  /** 시각을 좁히는 공개가 이미 일어났는가. 조사 시스템이 붙으면 참이 된다 */
  firedNarrow: boolean
  highlights: Highlight[]
  onMark: (next: Highlight[]) => void
  onQuote: (quote: string) => void
}) {
  const window = c.slots.find((s) => s.isWindow)
  const prologue = (c.prologue ?? []).map(ko).filter(Boolean)

  // 시각 축소. `narrowsWindow` 를 가진 공개가 발동하면 값이 바뀌고 옛 값이 취소선으로 남는다.
  //
  // ⚠ **좁혀진 값의 라벨이 데이터에 없다.** 엔진 주석이 직접 적어놨듯
  // "격자 슬롯은 t2(3~8시)가 최소 단위이고 3~5시라는 정밀도는 narration 이 갖는다."
  // 프로토타입은 `새벽 3시 ~ 5시` 를 하드코딩한다. 조사 시스템이 붙기 전에
  // 사건 파일에 자리를 만들어야 한다 — 지금은 슬롯 라벨로 떨어진다.
  const narrow = c.reveals?.find((r) => r.narrowsWindow)
  const narrowed = firedNarrow && narrow?.narrowsWindow
    ? narrow.narrowsWindow.map((id) => c.slots.find((s) => s.id === id)?.label).filter(Boolean).join(' ~ ')
    : ''

  return (
    <div className="nl-ov">
      <div className="v-caption nl-ov-kicker">{c.title}</div>

      {/* 프롤로그 재수록 — 원본 827행. 드래그하면 인용·복사할 수 있다 */}
      {prologue.map((p, i) => (
        <MarkedText
          key={i}
          text={p}
          textRef={refOf('__prologue', i)}
          highlights={highlights}
          onMark={onMark}
          onQuote={onQuote}
          className="nl-mk-p nl-ov-p"
        />
      ))}

      <div className="nl-ov-brief">
        <div className="v-caption nl-ov-cap">사건 브리핑</div>
        <div className="nl-brief-rows">
          <Row k="피해자" v={victimLine(c)} onQuote={onQuote} />
          <Row
            k="사망 추정"
            v={narrowed || window?.label || '미확정'}
            prev={narrowed ? window?.label : undefined}
            badge={narrowed ? '1장 완성으로 갱신' : undefined}
            onQuote={onQuote}
          />
          <Row k="시신" v={ko(c.incident.bodyState) || '미확인'} onQuote={onQuote} />
          <Row k="현장" v={ko(c.incident.sceneState) || '미확인'} onQuote={onQuote} />
          <Row k="개요" v={c.incident.description} onQuote={onQuote} />
        </div>

        <div className="nl-brief-rows">
          {c.people.map((p) => (
            <div key={p.id} className="nl-brief-row">
              <span className="v-meta nl-brief-k">관계인</span>
              <span className="v-body nl-brief-v nl-brief-person">
                <span>{p.name}</span>
                <span className="v-micro" style={{ color: 'var(--fg-4)' }}>{p.age} · {p.job}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * 개요 한 줄. 원본 831행.
 *
 * **갱신 배지와 취소선이 핵심이다** — 조사로 사실이 바뀌면 옛 값을 지우지 않고
 * 취소선으로 남긴다. 무엇이 언제 바뀌었는지가 곧 수사의 자취다.
 */
function Row({
  k, v, prev, badge, onQuote,
}: {
  k: string
  v: string
  prev?: string
  badge?: string
  onQuote: (quote: string) => void
}) {
  return (
    <div className="nl-brief-row nl-ov-row">
      <span className="v-meta nl-ov-k">{k}</span>
      <div className="nl-ov-v">
        <span className="v-body" style={{ color: 'var(--fg-2)' }}>{v}</span>
        {badge && <span className="nl-ov-badge">{badge}</span>}
        {prev && <span className="v-micro nl-ov-prev">이전 추정 {prev}</span>}
      </div>
      <span className="nl-ov-tools">
        <span className="nl-ov-tool" title="인용 메모" onClick={() => onQuote(`“${v}”`)}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M5 4H3v3h2V4zM5 4c0 2-.5 3-2 3.5M11 4H9v3h2V4zM11 4c0 2-.5 3-2 3.5" />
          </svg>
        </span>
        <span className="nl-ov-tool" title="복사" onClick={() => void navigator.clipboard?.writeText(v)}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="5" y="5" width="8" height="8" rx="1" />
            <path d="M3 10V3h7" />
          </svg>
        </span>
      </span>
    </div>
  )
}
