import { useState } from 'react'
import type { Blank, Case, Chapter } from '@engine/types'
import { josa } from '../text/josa'
import { caseNo } from '../case/catalog'
import { TermBank } from './TermBank'
import { StatusIcon } from '../components/StatusIcon'

/**
 * 보고서 — 이 게임의 메인 화면.
 *
 * **프로토타입 `추리게임.dc.html` 185~245행을 읽고 옮겼다.** 문서 헤더 스트립, 장 카드의
 * 상태별 테두리·여백, 공란 세 상태(빈칸=점선 밑줄 / 채움=accent 칩 / 잠김=회색 칩),
 * 피커의 머리말과 지우기까지 원본 구조 그대로다.
 *
 * ★ 절대 규칙 ★ (`HANDOFF-TO-CODE.md` §0.2 · §5)
 *   · 실시간 채점 없음 — 장을 완성해도 정답 여부를 알리지 않는다
 *   · 모순 경고 없음
 *   · `장 확인` 버튼 없음 — 공란을 다 채우면 **자동 완성**되고 다음 장이 열린다.
 *     **정답 여부와 무관하게** 완성된다
 *   · 잠긴 장은 **번호만 남기고 전부 가린다** — 제목·라벨·유형·개수 전부.
 *     라벨이 곧 사건 구조다. `물품·정체·협박대상` 만 봐도 숨은 범죄가 드러난다
 *   · 재개봉은 장당 1회
 *   · 채워진 공란은 **전부 같게 생긴다.** 맞았는지는 최종 채점에서만 말한다
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
  reopenOpen,
  terms,
  onAnswer,
  onReopen,
  onCloseReopen,
  onSubmit,
  onQuote,
}: {
  c: Case
  answers: Record<string, string>
  solved: number[]
  reopened: Record<number, boolean>
  reopenOpen: Record<number, boolean>
  terms: Set<string>
  onAnswer: (key: string, value: string) => void
  onReopen: (order: number) => void
  onCloseReopen: (order: number) => void
  onSubmit: () => void
  /** 확보 단어 은행의 인용. 인용문과 그 단어를 함께 넘긴다 */
  onQuote: (quote: string, term: string) => void
}) {
  // 순차 잠금. i번 장은 i-1번이 완성돼야 열린다
  const openIndex = solved.length
  const victim = c.victimProfile
  const done = solved.length === c.chapters.length

  // 원본 `narrLayoutStyle` — 좌우 2단. 오른쪽 292px 이 확보 단어 은행이다
  return (
    <div className="nl-narr">
    <div className="nl-report">
      {/* 문서 헤더 — 디지털 네이티브 공문서. 스큐어모피즘 없이 구조만 가져온다 */}
      <div className="nl-doc">
        <div className="nl-doc-top">
          <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4">
            <path d="M4 2h5l3 3v9H4z" />
            <path d="M9 2v3h3" />
          </svg>
          <span className="v-ui nl-doc-title">사건 보고서</span>
          <span className="v-num nl-doc-no">{caseNo(c.id)}</span>
          <span className="nl-fs-spacer" />
          <span className={done ? 'nl-chip nl-chip-live' : 'nl-chip'}>
            {done ? '제출 대기' : '작성 중'}
          </span>
        </div>
        <div className="nl-doc-fields">
          <Field k="사건번호" v={caseNo(c.id)} />
          <Field
            k="대상"
            v={victim ? `${victim.name}${victim.age ? ` (${victim.age})` : ''}${victim.job ? ` · ${victim.job}` : ''}` : c.victim}
          />
          <Field k="작성" v="담당 수사관" />
        </div>
      </div>

      {/* 보고서 제출 — 원본 193행. 장이 남아 있어도 누를 수 있다.
          「아직 채우지 않은 공란 N개」는 확인 모달이 말한다 */}
      <div className="nl-finish">
        <button className="nl-btn nl-btn-primary" onClick={onSubmit}>보고서 제출</button>
      </div>

      {c.chapters.map((ch, idx) => (
        <ChapterBlock
          key={ch.order}
          c={c}
          ch={ch}
          state={solved.includes(idx) ? 'done' : idx === openIndex ? 'open' : 'locked'}
          answers={answers}
          terms={terms}
          reopened={!!reopened[ch.order]}
          reopenOpen={!!reopenOpen[ch.order]}
          onAnswer={onAnswer}
          onReopen={onReopen}
          onCloseReopen={onCloseReopen}
        />
      ))}
    </div>

      <TermBank c={c} terms={terms} answers={answers} onQuote={onQuote} />
    </div>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="nl-doc-field">
      <div className="v-micro nl-doc-k">{k}</div>
      <div className="v-ui nl-doc-v">{v}</div>
    </div>
  )
}

function ChapterBlock({
  c, ch, state, answers, terms, reopened, reopenOpen, onAnswer, onReopen, onCloseReopen,
}: {
  c: Case
  ch: Chapter
  state: 'done' | 'open' | 'locked'
  answers: Record<string, string>
  terms: Set<string>
  /** 재개봉을 이미 썼는가. 되돌아가지 않는다 */
  reopened: boolean
  /** 지금 재개봉해서 편집 중인가 */
  reopenOpen: boolean
  onAnswer: (key: string, value: string) => void
  onReopen: (order: number) => void
  onCloseReopen: (order: number) => void
}) {
  // 완성된 장은 접힌 채로 시작한다. 지금 쓰는 장에 시선이 가야 한다
  const [collapsed, setCollapsed] = useState(state === 'done')
  const [picker, setPicker] = useState<number | null>(null)

  // 잠긴 장은 번호만 남는다. 제목도 공란 개수도 보이지 않는다 —
  // 라벨이 곧 사건 구조이므로 개수조차 구조의 크기를 알려준다
  if (state === 'locked') {
    return (
      <section className="nl-chapter nl-chapter-locked">
        <span className="v-meta v-num nl-chapter-num">{ch.order}장</span>
        <span className="v-meta" style={{ color: 'var(--fg-4)' }}>앞 장을 완성하면 열립니다</span>
        <span className="nl-fs-spacer" />
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--fg-4)" strokeWidth="1.4">
          <rect x="3.5" y="7" width="9" height="6" rx="1" />
          <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
        </svg>
      </section>
    )
  }

  const key = (i: number) => `${ch.order}:${i}`
  const filled = ch.blanks.filter((_, i) => answers[key(i)]).length
  // **`reopened`(썼다) 가 아니라 `reopenOpen`(지금 열려 있다) 이 편집을 연다.**
  // 하나로 두면 「편집 완료」를 눌러도 계속 고칠 수 있다
  const editable = state === 'open' || reopenOpen
  const body = !collapsed

  return (
    <section className={`nl-chapter ${state === 'open' ? 'nl-chapter-open' : ''} ${collapsed ? 'nl-chapter-collapsed' : ''}`}>
      <div className="nl-chapter-head" onClick={() => setCollapsed((v) => !v)}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--fg-4)" strokeWidth="1.5" style={{ flex: 'none' }}>
          {collapsed ? <path d="M6 4l4 4-4 4" /> : <path d="M4 6l4 4 4-4" />}
        </svg>
        {/* 원본 209행 — Vector StatusIcon. 상태이지 강조가 아니다 */}
        <StatusIcon status={state === 'done' ? 'done' : 'progress'} size={16} />
        <span className="v-meta v-num nl-chapter-num">{ch.order}장</span>
        <span className="v-h3">{ch.title}</span>
        <span className="nl-fs-spacer" />
        {/* 접힌 완성 장의 우측 문구 (원본 213행 `reopenStatusLabel`) */}
        {state === 'done' && collapsed && (
          <span className="v-meta" style={{ color: 'var(--fg-4)' }}>
            {reopened ? '재개봉 사용됨' : '재개봉 가능'}
          </span>
        )}
        {/* 칩은 **열린 장에만** 뜬다 (원본 `showChip: open`) */}
        {state === 'open' && <span className="nl-chip">미확정</span>}
      </div>

      {body && (
        <>
          {/* 완성된 장에서도 남는다 — "한 번 보여주고 사라지는 텍스트는 버그다"(§0.3) */}
          {ch.opening && <p className="nl-chapter-opening">{ch.opening}</p>}

          <div className="nl-chapter-report">
            {(ch.report ?? []).map((part, n) => {
              if ('text' in part) return <span key={n}>{part.text}</span>
              const b = ch.blanks[part.blank]
              const opts = optionsFor(c, b, terms)
              const value = answers[key(part.blank)]
              const shown = value ? labelOf(opts, value) : ''
              const cls = !value ? 'nl-blank-empty' : editable ? 'nl-blank-fill' : 'nl-blank-lock'
              return (
                <span key={n} className="nl-blank-wrap">
                  <span
                    className={`nl-blank ${cls}`}
                    onClick={editable ? () => setPicker(picker === part.blank ? null : part.blank) : undefined}
                  >
                    {shown || b.label}
                  </span>
                  {/* 조사는 답이 있을 때만 붙는다. 빈칸 뒤의 '이/가' 는 받침을 누설한다 */}
                  {value && josa(shown, b.particle)}
                  {picker === part.blank && editable && (
                    <div className="v-menu nl-picker">
                      <div className="v-caption nl-picker-head">{b.label}</div>
                      {opts.map((o) => (
                        <div
                          key={o.value}
                          className="v-menu-item nl-picker-item"
                          onClick={() => { onAnswer(key(part.blank), o.value); setPicker(null) }}
                        >
                          {o.label}
                        </div>
                      ))}
                      {opts.length === 0 && (
                        <div className="v-meta nl-picker-empty">
                          아직 공개된 단어가 없습니다. 장을 확인하면 조사로 드러난 단어가 추가됩니다.
                        </div>
                      )}
                      {value && (
                        <div
                          className="v-menu-item nl-picker-item nl-picker-clear"
                          onClick={() => { onAnswer(key(part.blank), ''); setPicker(null) }}
                        >
                          지우기
                        </div>
                      )}
                    </div>
                  )}
                </span>
              )
            })}
          </div>

          {state === 'open' && (
            <div className="nl-chapter-foot">
              <span className="v-meta v-num">{filled} / {ch.blanks.length}</span>
              <span className="v-meta">공란을 모두 채우면 완성됩니다</span>
            </div>
          )}

          {/* 재개봉 — 원본 239행. 테두리 버튼 + 회전 화살표 + **경고문**.
              경고문이 규칙의 절반이다: 되돌릴 수 없다는 것을 누르기 전에 말해야 한다 */}
          {state === 'done' && !reopened && !reopenOpen && (
            <div className="nl-reopen">
              <span
                className="linklike nl-reopen-btn"
                onClick={(e) => { e.stopPropagation(); onReopen(ch.order) }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M13 8a5 5 0 11-1.5-3.5M13 2v3h-3" />
                </svg>
                재개봉
              </span>
              <span className="v-micro nl-reopen-warn">
                장당 한 번만 다시 열 수 있으며, 닫으면 더 이상 수정할 수 없습니다.
              </span>
            </div>
          )}

          {/* 재개봉 닫기 — 원본 240행. 편집을 끝내고 다시 잠근다 */}
          {state === 'done' && reopenOpen && (
            <div className="nl-reopen">
              <span
                className="linklike nl-reopen-close"
                onClick={(e) => { e.stopPropagation(); onCloseReopen(ch.order) }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
                편집 완료
              </span>
            </div>
          )}
        </>
      )}
    </section>
  )
}
