import type { Action, Case, Fact, PersonId } from '@engine/types'
import { ko } from '../case/loadCase'
import { initialOf, personColor, relationOf } from '../case/people'
import type { PlayerAnnotations } from '../state/stores'

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

const VERDICTS: { key: '제외' | '주목' | '유력'; color: string }[] = [
  { key: '제외', color: 'var(--fg-3)' },
  { key: '주목', color: 'var(--g-suspect)' },
  { key: '유력', color: 'var(--g-contradict)' },
]

const SLOTS: { label: string; kind: Fact['kind'] }[] = [
  { label: '동기', kind: 'motive' },
  { label: '기회', kind: 'opportunity' },
  { label: '수단', kind: 'means' },
]

export function Suspects({
  c,
  facts,
  cluesByPerson,
  annotations,
  onVerdict,
  actionsFor,
  onAsk,
}: {
  c: Case
  /** 지금까지 확보한 사실. 엔진 `deriveFacts` 의 결과 */
  facts: Set<string>
  /** 인물별로 조사에서 나온 것. `조사 라벨 → 물증 설명` */
  cluesByPerson: Map<PersonId, { text: string; action: string }[]>
  annotations: PlayerAnnotations
  onVerdict: (person: PersonId, v: '제외' | '주목' | '유력') => void
  /** 이 사람을 대상으로 한 조사와 상태. 원본 buildProfiles 15~19행 */
  actionsFor: (person: PersonId) => { action: Action; state: string }[]
  onAsk: (a: Action) => void
}) {
  return (
    <div className="nl-sus">
      {c.people.map((p, i) => {
        const clues = cluesByPerson.get(p.id) ?? []
        const memos = annotations.notes.filter((n) => n.target === p.id && n.content.trim())
        const verdict = annotations.verdicts[p.id]
        const color = personColor(i)

        return (
          <div key={p.id} className="nl-sus-card">
            <span className="nl-sus-rail" style={{ background: color }} />
            <div className="nl-sus-body">
              <div className="nl-sus-head">
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
                {SLOTS.map((s) => {
                  const f = c.facts.find(
                    (x) => x.kind === s.kind && x.subject === p.id
                      && x.revealedBy.length > 0 && facts.has(x.id),
                  )
                  return (
                    <div key={s.kind} className="nl-sus-slot">
                      <span className="v-meta nl-sus-slot-k">{s.label}</span>
                      {f ? (
                        <span className="v-meta nl-sus-slot-v">{f.content}</span>
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
