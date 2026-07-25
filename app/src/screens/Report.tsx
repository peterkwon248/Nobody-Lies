import { useState } from 'react'
import type { Blank, Case, Chapter } from '@engine/types'
import { josa } from '../text/josa'

/**
 * 보고서 — 이 게임의 메인 화면.
 *
 * 공란은 목록이 아니라 **문장 안에** 있다. 플레이어가 채우는 것은 칸이 아니라
 * 문장이고, 다 채우면 그 문장이 자기가 쓴 사건 기록이 된다.
 *
 * ★ 절대 규칙 ★ (`HANDOFF-TO-CODE.md` §0.2 · §5)
 *   · 실시간 채점 없음 — 장을 완성해도 정답 여부를 알리지 않는다
 *   · 모순 경고 없음
 *   · `장 확인` 버튼 없음 — 공란을 다 채우면 **자동 완성**되고 다음 장이 열린다
 *   · **정답 여부와 무관하게** 완성되고 다음 장이 열린다
 *   · 잠긴 장은 **번호만 남기고 전부 가린다** — 제목·라벨·유형·개수 전부.
 *     라벨이 곧 사건 구조다. `물품·정체·협박대상` 만 봐도 숨은 범죄가 드러난다
 *   · 재개봉은 장당 1회. 이미 공개된 정보는 회수하지 않는다
 */

type Opt = { value: string; label: string }

/**
 * 공란의 후보.
 *
 * `discovered` 는 지금까지 확보한 단어에서, `closed` 는 사건의 고정 어휘에서 온다.
 * 어느 어휘인지는 **라벨이 정한다** — 라벨이 고정 어휘인 이유가 이것이다.
 */
function optionsFor(c: Case, b: Blank, terms: Set<string>): Opt[] {
  if (b.candidates === 'discovered')
    return [...terms].sort().map((t) => ({ value: t, label: t }))
  switch (b.label) {
    case '장소':
      return c.locations.map((l) => ({ value: l.id, label: l.label }))
    case '시각':
      return c.slots.map((s) => ({ value: s.id, label: s.label }))
    default:
      return c.people.map((p) => ({ value: p.id, label: p.name }))
  }
}

const labelOf = (opts: Opt[], value: string) =>
  opts.find((o) => o.value === value)?.label ?? value

export function Report({
  c,
  answers,
  solved,
  reopened,
  terms,
  onAnswer,
  onReopen,
}: {
  c: Case
  answers: Record<string, string>
  solved: number[]
  reopened: Record<number, boolean>
  terms: Set<string>
  onAnswer: (key: string, value: string) => void
  onReopen: (order: number) => void
}) {
  // 순차 잠금. i번 장은 i-1번이 완성돼야 열린다
  const openIndex = solved.length

  return (
    <div className="nl-report">
      <header className="nl-report-head">
        <div className="v-caption" style={{ color: 'var(--fg-4)' }}>사건 보고서</div>
        <h1 className="v-h2" style={{ margin: '6px 0 0' }}>{c.title}</h1>
        <div className="v-meta" style={{ color: 'var(--fg-4)', marginTop: 6 }}>
          공란을 모두 채우면 장이 완성됩니다 · 마지막에 제출
        </div>
      </header>

      {c.chapters.map((ch, idx) => {
        const state = solved.includes(idx) ? 'done' : idx === openIndex ? 'open' : 'locked'
        return (
          <ChapterBlock
            key={ch.order}
            c={c}
            ch={ch}
            state={state}
            answers={answers}
            terms={terms}
            reopened={!!reopened[ch.order]}
            onAnswer={onAnswer}
            onReopen={onReopen}
          />
        )
      })}
    </div>
  )
}

function ChapterBlock({
  c, ch, state, answers, terms, reopened, onAnswer, onReopen,
}: {
  c: Case
  ch: Chapter
  state: 'done' | 'open' | 'locked'
  answers: Record<string, string>
  terms: Set<string>
  reopened: boolean
  onAnswer: (key: string, value: string) => void
  onReopen: (order: number) => void
}) {
  const [picker, setPicker] = useState<number | null>(null)

  // 잠긴 장은 번호만 남는다. 제목도 공란 개수도 보이지 않는다 —
  // 라벨이 곧 사건 구조이므로 개수조차 구조의 크기를 알려준다
  if (state === 'locked') {
    return (
      <section className="nl-chapter nl-chapter-locked">
        <div className="nl-chapter-num v-num">{ch.order}장</div>
        <div className="v-meta" style={{ color: 'var(--fg-4)' }}>앞 장을 완성하면 열립니다</div>
      </section>
    )
  }

  const key = (i: number) => `${ch.order}:${i}`
  const filled = ch.blanks.filter((_, i) => answers[key(i)]).length
  const editable = state === 'open' || (state === 'done' && reopened)
  // 장 확인 버튼은 없다 — 공란을 다 채우면 자동 완성된다.
  // 그 판정은 App 의 effect 가 한다(렌더 중에 상태를 바꾸지 않는다)

  return (
    <section className={state === 'done' ? 'nl-chapter nl-chapter-done' : 'nl-chapter'}>
      <div className="nl-chapter-head">
        <span className="nl-chapter-num v-num">{ch.order}장</span>
        <span className="v-title">{ch.title}</span>
        <span className="nl-fs-spacer" />
        {state === 'done' ? (
          <>
            <span className="nl-chip">완성</span>
            {!reopened && (
              <span className="linklike" onClick={() => onReopen(ch.order)}>재개봉 (1회)</span>
            )}
          </>
        ) : (
          <span className="v-meta v-num" style={{ color: 'var(--fg-4)' }}>
            {filled} / {ch.blanks.length}
          </span>
        )}
      </div>

      {/* 완성된 장에서도 남는다 — "한 번 보여주고 사라지는 텍스트는 버그다"(§0.3) */}
      {ch.opening && <p className="nl-chapter-opening">{ch.opening}</p>}

      <p className="nl-chapter-report">
        {(ch.report ?? []).map((part, n) => {
          if ('text' in part) return <span key={n}>{part.text}</span>
          const b = ch.blanks[part.blank]
          const opts = optionsFor(c, b, terms)
          const value = answers[key(part.blank)]
          const shown = value ? labelOf(opts, value) : ''
          return (
            <span key={n} className="nl-blank-wrap">
              <button
                className={value ? 'nl-blank nl-blank-filled' : 'nl-blank'}
                disabled={!editable}
                onClick={() => setPicker(picker === part.blank ? null : part.blank)}
              >
                {shown || b.label}
              </button>
              {/* 조사는 답이 있을 때만 붙는다. 빈칸 뒤의 '이/가' 는 받침을 누설한다 */}
              {value && josa(shown, b.particle)}
              {picker === part.blank && editable && (
                <span className="v-menu nl-picker">
                  {opts.length === 0 && (
                    <span className="v-meta nl-picker-empty">아직 확보한 단어가 없습니다</span>
                  )}
                  {opts.map((o) => (
                    <span
                      key={o.value}
                      className="v-menu-item nl-picker-item"
                      onClick={() => { onAnswer(key(part.blank), o.value); setPicker(null) }}
                    >
                      {o.label}
                    </span>
                  ))}
                  {value && (
                    <span
                      className="v-menu-item nl-picker-item nl-picker-clear"
                      onClick={() => { onAnswer(key(part.blank), ''); setPicker(null) }}
                    >
                      지우기
                    </span>
                  )}
                </span>
              )}
            </span>
          )
        })}
      </p>
    </section>
  )
}
