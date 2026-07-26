import { useState } from 'react'
import type { Case, Person } from '@engine/types'
import { ko } from '../case/loadCase'
import { MarkedText } from '../marks/MarkedText'
import { refOf, type Highlight } from '../marks/marks'
import { initialOf, personColor, relationOf } from '../case/people'

/**
 * 진술 — 다섯 사람의 원문을 언제든 다시 읽는 자리.
 *
 * **프로토타입 `추리게임.dc.html` 325~380행을 읽고 옮겼다.** D안 조판 —
 * 좌측 172px 고정 레일 + 우측 아코디언. `HANDOFF-TO-CODE.md` §8.1 이 1차 범위에
 * *"진술 정독 · D안 조판. 좌측 레일 + 본문"* 이라고 명시해둔 화면이다.
 *
 * 한때 여기가 카드 5개 세로 나열이었다 — 덜 옮긴 게 아니라 다른 화면을 만든
 * 것이었고, 2026-07-25 전수 대조에서 드러났다.
 *
 * 정독 단계가 지나가도 진술은 남는다. 이 게임의 배제가 전적으로 진술에 기대므로
 * **여기가 가장 자주 돌아오게 되는 화면**이다.
 *
 * ★ 게임은 여기서 아무 말도 하지 않는다 ★
 * 강조·모순 표시·유용도 구분 전부 없다. 다섯 사람의 행은 완전히 같게 생긴다 —
 * 색선은 화자를 가리킬 뿐 중요도를 가리키지 않는다.
 */

/** 첫 문장을 N자로 자른 미리보기. 원본 2673행(42자) */
function preview(text: string, n: number): string {
  const first = text.split(/(?<=[.?!])\s/)[0] ?? text
  return first.length > n ? first.slice(0, n) + '…' : first
}

export function StatementList({
  c,
  solved,
  highlights,
  onMark,
  onQuote,
}: {
  c: Case
  /** 완성된 장의 인덱스. 추가 진술이 여기서 열린다 */
  solved: number[]
  highlights: Highlight[]
  onMark: (next: Highlight[]) => void
  /**
   * 인용. **이름과 id 를 둘 다 넘긴다** — 메모는 「— 서지안」을 적어야 하고
   * 대상 지정은 `p.id` 여야 한다. 이름만 넘기면 메모장에서 그 사람의 진술로
   * 묶을 수가 없다 (원본 `quoteSelToMemo` 는 `sel.pid` 를 쓴다)
   */
  onQuote: (quote: string, person: string, personId: string) => void
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setOpen((v) => ({ ...v, [id]: !v[id] }))

  return (
    <div className="nl-stmts">
      {/* 좌측 레일 — 원본 328~336행. sticky 라 본문을 스크롤해도 따라온다 */}
      <div className="nl-stmt-rail">
        <div className="v-micro nl-stmt-rail-cap">진술 · 눌러서 펼치기</div>
        {c.people.map((p, i) => (
          <div
            key={p.id}
            className={open[p.id] ? 'nl-stmt-rail-row nl-stmt-rail-row-on' : 'nl-stmt-rail-row'}
            onClick={() => toggle(p.id)}
          >
            <span className="nl-stmt-rail-line" style={{ background: personColor(i) }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="nl-stmt-rail-name"
                style={open[p.id] ? { color: personColor(i) } : undefined}
              >
                {p.name}
              </div>
              <div className="nl-stmt-rail-rel">{relationOf(c, p)}</div>
            </div>
            {open[p.id] && <span className="nl-stmt-rail-dot" />}
          </div>
        ))}
        <div className="v-micro nl-stmt-rail-hint">
          <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flex: 'none' }}>
            <path d="M2.5 5h7M2.5 8h11M2.5 11h9" />
          </svg>
          문장을 드래그하면 표시·인용할 수 있습니다.
        </div>
      </div>

      {/* 우측 본문 — 원본 338~377행 */}
      <div className="nl-stmt-body">
        {c.people.map((p, i) => (
          <div key={p.id} className="nl-stmt-row">
            <div className="nl-stmt-head" onClick={() => toggle(p.id)}>
              <span className="nl-stmt-bar" style={{ background: personColor(i) }} />
              <span className="nl-avatar nl-stmt-av" style={{ background: personColor(i) }}>
                {initialOf(p.name)}
              </span>
              <div className="nl-stmt-who">
                <span className="nl-stmt-name">{p.name}</span>
                <span className="v-micro nl-stmt-meta">
                  {[p.sex, p.age, p.job].filter(Boolean).join(' · ')}
                </span>
              </div>
              <RelationChip label={relationOf(c, p)} />
              {!open[p.id] && (
                <span className="v-meta nl-stmt-preview">
                  {preview(ko(p.statement?.paragraphs?.[0]), 42)}
                </span>
              )}
              <span className="nl-fs-spacer" />
              <svg
                width="15" height="15" viewBox="0 0 16 16" fill="none"
                stroke="var(--fg-4)" strokeWidth="1.5"
                style={{ flex: 'none', transform: open[p.id] ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <path d="M5 6.5L8 9.5l3-3" />
              </svg>
            </div>

            {open[p.id] && (
              <div className="nl-stmt-text">
                {(p.statement?.paragraphs ?? []).map((t, n) => (
                  <MarkedText
                    key={n}
                    text={ko(t)}
                    textRef={refOf(p.id, n)}
                    highlights={highlights}
                    onMark={onMark}
                    onQuote={(q) => onQuote(q, p.name, p.id)}
                  />
                ))}

                {/* 추가 진술 — 원본 362~375행. 장을 완성하면 도착한다.
                    accent 좌측선이 「나중에 온 것」의 표시다 */}
                {addedFor(c, p, solved).map((a, n) => (
                  <div key={n} className="nl-stmt-added">
                    <div className="nl-stmt-added-head">
                      <span className="nl-stmt-added-tag">추가 진술</span>
                      <span className="v-micro" style={{ color: 'var(--fg-4)' }}>
                        {a.chapter}장 {a.title} · 공개됨
                      </span>
                    </div>
                    <MarkedText
                      text={a.content}
                      textRef={refOf(p.id, `add${n}`)}
                      highlights={highlights}
                      onMark={onMark}
                      onQuote={(q) => onQuote(q, p.name, p.id)}
                      className="nl-mk-p nl-stmt-added-p"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** 관계 칩 3종. 원본 `relChip`(2651~2656행) — 색은 셋 다 다르지만 유죄와 무관하다 */
function RelationChip({ label }: { label: string }) {
  const kind = label === '산장 거주' ? 'onsite' : label.includes('불참') ? 'absent' : 'arrive'
  return <span className={`nl-relchip nl-relchip-${kind}`}>{label}</span>
}

/** 완성된 장이 연 추가 진술. 엔진의 `reveals[].addClaims` 가 원천이다 */
function addedFor(c: Case, p: Person, solved: number[]) {
  const out: { content: string; chapter: number; title: string }[] = []
  for (const r of c.reveals ?? []) {
    const t = r.trigger
    if (t.on !== 'chapterComplete') continue
    const ch = c.chapters.find((x) => x.order === t.chapterOrder)
    if (!ch) continue
    // solved 는 인덱스 배열이고 trigger 는 order 다. 장 목록에서 위치를 찾아 맞춘다
    if (!solved.includes(c.chapters.indexOf(ch))) continue
    for (const cl of r.addClaims ?? [])
      if (cl.speaker === p.id)
        out.push({ content: cl.content, chapter: ch.order, title: ch.title })
  }
  return out
}
