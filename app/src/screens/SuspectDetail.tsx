import type { Action, Case, Person, PersonId } from '@engine/types'
import { ko } from '../case/loadCase'
import { initialOf, personColor, relationOf } from '../case/people'
import { suspectView } from '../case/suspect'
import type { CaseProgress, PlayerAnnotations } from '../state/stores'
import { VERDICTS } from './Suspects'

/**
 * 인물 상세 — 프로토타입 1171~1218행. 용의자 카드를 누르면 열린다.
 *
 * 카드(837~871행)와 **같은 것을 더 넓게** 본다. 카드에 없는 것은 셋뿐이다:
 * 조사 결과 **전문**, 이 인물에 대한 **메모 본문**, 그리고 「출처 보기 ↗」.
 *
 * ★ 왼쪽은 주장, 오른쪽은 확정 ★
 * 왼쪽 열(300px)은 본인 진술과 심증 — **미확정**이다. 오른쪽은 조사로 나온 것 —
 * **확정**이다. 머리말이 그렇게 적혀 있고(`주장 · 미확정` / `확정 · 물증`),
 * 두 층을 섞지 않는 것이 이 게임의 뼈대다 (`HANDOFF` §6).
 *
 * 「신규」는 **마지막으로 용의자 화면을 떠난 뒤** 도착한 것에 붙는다.
 * 재촉이 아니라 「그동안 뭐가 왔나」에 대한 답이다.
 */

export function SuspectDetail({
  c,
  person,
  index,
  progress,
  annotations,
  facts,
  actions,
  onVerdict,
  onAddMemo,
  onJump,
  onAsk,
  onClose,
}: {
  c: Case
  person: Person
  index: number
  progress: CaseProgress
  annotations: PlayerAnnotations
  facts: Set<string>
  actions: { action: Action; state: string }[]
  onVerdict: (p: PersonId, v: '제외' | '주목' | '유력') => void
  onAddMemo: (p: PersonId) => void
  /** 「출처 보기 ↗」 — 조사 기록으로 뛰고 그 카드를 잠깐 표시한다 */
  onJump: (actionId: string) => void
  onAsk: (a: Action) => void
  onClose: () => void
}) {
  const color = personColor(index)
  const { clues, slots, narrations } = suspectView(c, progress, facts, person.id)
  const seen = new Set(annotations.seenClues)
  const verdict = annotations.verdicts[person.id]
  const vmeta = VERDICTS.find((v) => v.key === verdict)
  const memos = annotations.notes.filter(
    (n) => n.targetType === '인물' && n.target === person.id,
  )

  return (
    <div className="nl-scrim nl-scrim-profile" onClick={onClose}>
      <div className="nl-pd" onClick={(e) => e.stopPropagation()}>
        <div className="nl-pd-head">
          <span className="nl-pd-rail" style={{ background: color }} />
          {/* 심증을 찍으면 아바타에 링이 생긴다. 제외는 흐려진다 (원본 `avStyle`) */}
          <span
            className="nl-avatar nl-pd-av"
            style={{
              background: color,
              boxShadow: vmeta ? `0 0 0 2px var(--bg-app), 0 0 0 4px ${vmeta.color}` : undefined,
              opacity: verdict === '제외' ? 0.55 : undefined,
            }}
          >
            {initialOf(person.name)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="v-h3" style={{ color: 'var(--fg)' }}>{person.name}</div>
            <div className="v-micro" style={{ color: 'var(--fg-4)' }}>
              {[person.sex, person.age, person.job, relationOf(c, person)].filter(Boolean).join(' · ')}
            </div>
          </div>
          {vmeta && (
            <span
              className="nl-pd-verdict-badge"
              style={{ borderColor: vmeta.color, color: vmeta.color }}
            >
              {vmeta.key}
            </span>
          )}
          <button className="iconbtn" onClick={onClose}>
            <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="nl-pd-cols">
          {/* ── 왼쪽 · 주장 ── */}
          <div className="nl-pd-left">
            <div className="v-micro nl-pd-cap">심증</div>
            <div className="nl-pd-verdicts">
              {VERDICTS.map((v) => {
                const on = verdict === v.key
                return (
                  <span
                    key={v.key}
                    className={on ? 'nl-vchip nl-vchip-on' : 'nl-vchip'}
                    style={on ? { borderColor: v.color, color: v.color } : undefined}
                    onClick={() => onVerdict(person.id, v.key)}
                  >
                    <span className="nl-vdot" style={{ background: v.color }} />
                    {v.key}
                  </span>
                )
              })}
            </div>
            <div className="v-micro nl-pd-hint">내 판단일 뿐 · 점수 무관</div>

            <div className="v-micro nl-pd-cap">
              본인 주장 · <span style={{ color: 'var(--status-progress)' }}>주장 · 미확정</span>
            </div>
            <div className="nl-pd-claim">
              <span className="nl-pd-claim-bar" style={{ background: color }} />
              <div className="v-body nl-pd-claim-text">“{ko(person.claimSummary)}”</div>
            </div>

            <div className="v-micro nl-pd-cap">유죄 요건</div>
            <div className="nl-pd-slots">
              {slots.map((s) => (
                <div key={s.kind} className="nl-pd-slot">
                  <span className="v-meta nl-pd-slot-k">{s.label}</span>
                  {s.fact ? (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="v-meta" style={{ color: 'var(--fg-2)' }}>{s.fact.content}</span>
                      {s.actionId && !seen.has(s.actionId) && <span className="nl-pd-new">신규</span>}
                      {s.actionId && (
                        <span className="linklike nl-pd-jump" onClick={() => onJump(s.actionId!)}>
                          출처 보기 ↗
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="nl-pd-dash" />
                      <span className="v-micro" style={{ color: 'var(--fg-4)', flex: 'none' }}>미확인</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── 오른쪽 · 확정 ── */}
          <div className="nl-pd-right">
            <div className="v-micro nl-pd-cap">
              발견된 단서 · <span style={{ color: 'var(--g-confirm)' }}>확정 · 물증</span>
            </div>
            {clues.length ? (
              <div className="nl-pd-clues">
                {clues.map((cl, n) => (
                  <div key={n} className="nl-pd-clue" onClick={() => onJump(cl.actionId)}>
                    <span className="nl-pd-clue-dot" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span className="v-meta" style={{ color: 'var(--fg-2)' }}>{cl.text}</span>
                      {!seen.has(cl.actionId) && <span className="nl-pd-new">신규</span>}
                      <div className="v-micro nl-pd-clue-action">{cl.action} ↗</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="v-meta nl-pd-none">아직 조사로 확보한 단서가 없습니다.</div>
            )}

            {/* 조사 결과 전문. 조사 기록과 같은 것을 여기서도 읽는다 —
                *"한 번 보여주고 사라지는 텍스트는 버그다"* (§0.3) */}
            {narrations.length > 0 && (
              <div className="nl-pd-narrs">
                {narrations.map((n) => (
                  <div key={n.actionId} className="nl-pd-narr">
                    <span className="nl-pd-narr-bar" style={{ background: n.color }} />
                    <div className="nl-pd-narr-head">
                      <span className="v-ui" style={{ color: 'var(--fg)' }}>{n.title}</span>
                      <span className="v-micro" style={{ color: 'var(--fg-4)' }}>{n.label}</span>
                    </div>
                    <div className="nl-pd-narr-body">{n.body}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="nl-pd-sec">
              <div className="v-micro nl-pd-cap">조사</div>
              <div className="nl-pd-acts">
                {actions.map(({ action, state }) => (
                  <button
                    key={action.id}
                    className={`nl-sus-act nl-sus-act-${state}`}
                    disabled={state !== 'ok'}
                    onClick={state === 'ok' ? () => onAsk(action) : undefined}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flex: 'none' }}>
                      <circle cx="7" cy="7" r="4" />
                      <path d="M10 10l3.5 3.5" />
                    </svg>
                    <span style={{ flex: 1, textAlign: 'left' }}>{action.label}</span>
                    <span className="v-micro" style={{ color: 'var(--fg-4)' }}>
                      {state === 'used' ? '조사 완료'
                        : state === 'nobudget' ? '잔여 부족'
                        : state === 'locked' ? `${action.availableAfter}장 완성 후`
                        : `비용 ${action.cost}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="nl-pd-sec nl-pd-memo-head">
              <span className="v-micro nl-pd-cap" style={{ flex: 1, marginBottom: 0 }}>내 메모</span>
              <span className="linklike nl-memo-new" onClick={() => onAddMemo(person.id)}>＋ 새 메모</span>
            </div>
            {memos.length ? (
              <div className="nl-pd-memos">
                {memos.map((m) => (
                  <div key={m.id} className="nl-pd-memo">
                    {m.quote && <div className="v-meta nl-pd-memo-q">“{m.quote}”</div>}
                    <div className="v-meta nl-pd-memo-c">{m.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="v-meta nl-pd-none">이 인물에 대한 메모가 아직 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
