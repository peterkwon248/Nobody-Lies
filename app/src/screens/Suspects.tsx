import type { Action, Case, PersonId } from '@engine/types'
import { ko } from '../case/loadCase'
import { initialOf, personColor, relationOf } from '../case/people'
import { suspectView } from '../case/suspect'
import type { CaseProgress, PlayerAnnotations } from '../state/stores'

/**
 * 용의자 — 프로토타입 837~871행.
 *
 * ★ 프로필은 유죄를 판정하지 않는다 ★
 * 「기회 있음 ✓」 같은 것은 금지다 (`MEMORY.md` §절대 규칙). 슬롯에 들어가는 것은
 * **조사로 확보한 사실의 내용**뿐이고, 못 얻었으면 점선 + 「미확인」이다.
 *
 * 다섯 카드는 완전히 같게 생긴다. 다른 것은 **플레이어가 찍은 심증**뿐이고
 * 그건 게임의 판정이 아니라 자기 메모다 — 점수와 무관하다.
 *
 * 슬롯은 프로토타입의 손관리 `CLUE_MAP` 을 베끼지 않고 **엔진의 `Fact` 에서
 * 도출한다.** `kind`(동기·기회·수단) × `subject`(인물)가 이미 그 구조다.
 * 손으로 관리하면 사건을 고칠 때 갈라진다.
 */

/**
 * 심증 셋. 색은 원본 `verdictMeta()`(1869행) 그대로 —
 * 제외 `--fg-4` · 주목 `--g-suspect`(= `--status-progress`) · 유력 `--g-contradict`(= `--label-red`).
 *
 * 상세 모달도 이 배열을 쓴다. 심증 색이 두 곳에서 갈리면 같은 사람이 화면마다
 * 다른 색으로 보인다.
 */
export const VERDICTS: { key: '제외' | '주목' | '유력'; color: string }[] = [
  { key: '제외', color: 'var(--fg-4)' },
  { key: '주목', color: 'var(--g-suspect)' },
  { key: '유력', color: 'var(--g-contradict)' },
]

export function Suspects({
  c,
  progress,
  facts,
  annotations,
  onVerdict,
  onOpen,
  actionsFor,
  onAsk,
}: {
  c: Case
  progress: CaseProgress
  /** 지금까지 확보한 사실. 엔진 `deriveFacts` 의 결과 */
  facts: Set<string>
  annotations: PlayerAnnotations
  onVerdict: (person: PersonId, v: '제외' | '주목' | '유력') => void
  /** 카드를 누르면 상세 모달이 열린다 (원본 `onOpen`, 1882행) */
  onOpen: (person: PersonId) => void
  /** 이 사람을 대상으로 한 조사와 상태. 원본 buildProfiles 15~19행 */
  actionsFor: (person: PersonId) => { action: Action; state: string }[]
  onAsk: (a: Action) => void
}) {
  return (
    <div className="nl-sus">
      {c.people.map((p, i) => {
        // 카드와 상세가 **같은 계산**을 본다 — 원본 `buildProfiles()` 하나가 둘 다 먹인다
        const { clues, slots } = suspectView(c, progress, facts, p.id)
        // 「신규」는 마지막으로 이 화면을 떠난 뒤 도착한 것에 붙는다 (원본 `cl.isNew`·`sl.isNew`)
        const seen = new Set(annotations.seenClues)
        const memos = annotations.notes.filter(
          (n) => n.targetType === '인물' && n.target === p.id && n.content.trim(),
        )
        const verdict = annotations.verdicts[p.id]
        const color = personColor(i)

        return (
          <div key={p.id} className="nl-sus-card">
            <span className="nl-sus-rail" style={{ background: color }} />
            <div className="nl-sus-body">
              {/* 머리를 누르면 상세가 열린다. 심증 칩·조사 버튼은 카드에서 바로 눌러야
                  하므로 카드 전체를 클릭 영역으로 두지 않는다 */}
              <div className="nl-sus-head nl-sus-head-open" onClick={() => onOpen(p.id)}>
                <span className="nl-avatar nl-sus-av" style={{ background: color }}>
                  {initialOf(p.name)}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="v-title" style={{ color: 'var(--fg)' }}>{p.name}</div>
                  <div className="v-micro" style={{ color: 'var(--fg-4)' }}>
                    {[p.sex, p.age, p.job, relationOf(c, p)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {memos.length > 0 && (
                  <span className="nl-sus-memo-count">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M3 12l.8-3L10 2.8l2.4 2.4L6.2 11.4z" />
                    </svg>
                    {memos.length}
                  </span>
                )}
              </div>

              {/* 심증 — 내 판단일 뿐, 점수와 무관하다 */}
              <div className="nl-sus-verdict">
                <span className="v-micro" style={{ color: 'var(--fg-4)', marginRight: 2 }}>심증</span>
                {VERDICTS.map((v) => {
                  const on = verdict === v.key
                  return (
                    <span
                      key={v.key}
                      className={on ? 'nl-vchip nl-vchip-on' : 'nl-vchip'}
                      style={on ? { borderColor: v.color, color: v.color } : undefined}
                      onClick={() => onVerdict(p.id, v.key)}
                    >
                      <span className="nl-vdot" style={{ background: v.color }} />
                      {v.key}
                    </span>
                  )
                })}
              </div>

              <div className="v-micro nl-sus-cap">본인 주장</div>
              <div className="v-meta nl-sus-claim">{ko(p.claimSummary)}</div>

              <div className="v-micro nl-sus-cap">발견된 단서</div>
              {clues.length ? (
                <div className="nl-sus-clues">
                  {clues.map((cl, n) => (
                    <div key={n} className="nl-sus-clue">
                      <span className="nl-sus-bullet" />
                      <div style={{ minWidth: 0 }}>
                        <span className="v-meta" style={{ color: 'var(--fg-2)' }}>{cl.text}</span>
                        {!seen.has(cl.actionId) && <span className="nl-pd-new">신규</span>}
                        <div className="v-micro" style={{ color: 'var(--fg-4)', marginTop: 1 }}>{cl.action}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="v-meta nl-sus-none">아직 조사로 확보한 단서가 없습니다.</div>
              )}

              {/* 인물 조사 — 원본은 프로필 카드에서 실행한다. 소지품·통화내역.
                  세 상태(가능·잔여 부족·완료)만 사실로 표시한다 */}
              <div className="nl-sus-acts">
                {actionsFor(p.id).map(({ action, state }) => (
                  <button
                    key={action.id}
                    className={`nl-sus-act nl-sus-act-${state}`}
                    disabled={state !== 'ok'}
                    onClick={state === 'ok' ? () => onAsk(action) : undefined}
                  >
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

              {/* 동기 · 기회 · 수단.
                  ★ **조사로 얻은 사실만** 들어간다 ★
                  무료 사실(`revealedBy` 가 빈 것 = 진술에서 이미 읽은 것)을 넣으면
                  조사 0회에 세라만 두 칸이 차서 **다섯 중 하나만 채워진 카드**가
                  된다. 그게 곧 범인 표시다 — 2026-07-25 화면을 보고 잡았다.
                  프로토타입이 슬롯을 조사 기록에서만 채운 이유가 이것이다. */}
              <div className="nl-sus-slots">
                {slots.map((s) => {
                  const f = s.fact
                  return (
                    <div key={s.kind} className="nl-sus-slot">
                      <span className="v-meta nl-sus-slot-k">{s.label}</span>
                      {f ? (
                        <span className="v-meta nl-sus-slot-v">
                          {f.content}
                          {s.actionId && !seen.has(s.actionId) && <span className="nl-pd-new">신규</span>}
                        </span>
                      ) : (
                        <>
                          <span className="nl-sus-dash" />
                          <span className="v-micro" style={{ color: 'var(--fg-4)', flex: 'none' }}>미확인</span>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
