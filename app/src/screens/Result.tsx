import { useState } from 'react'
import type { Case } from '@engine/types'
import type { CaseProgress } from '../state/stores'
import { blankKey, scoreCase } from '../case/score'
import { personColor } from '../case/people'
import { josa } from '../text/josa'

/**
 * 채점·결말 — 프로토타입 422~478행.
 *
 * **여기가 게임이 처음으로 입을 여는 자리다.** 그 전까지는 실시간 채점도 모순
 * 경고도 없다(`HANDOFF-TO-CODE.md` §0.2). 그래서 이 화면의 형식이 곧 이 게임이
 * 플레이어에게 무슨 말을 하기로 했는지의 전부다.
 *
 * ★ 점수를 앞에 두지 않는다 ★
 * 맨 위는 **이야기**다 — 내가 재구성한 것과 실제. 숫자(정확도·세 축 막대)는 맨
 * 아래 구분선 밑에 있다. 원본의 순서가 그렇고, 뒤집으면 이 게임은 퀴즈가 된다.
 *
 * 틀린 것이 하나도 없으면 **「내가 재구성한 이야기」를 아예 그리지 않는다** —
 * 같은 문장이 두 번 나올 뿐이고, 비교할 것이 없는데 비교 화면을 세우면
 * 「어딘가 틀렸나」를 찾게 만든다.
 */

export function Result({
  c,
  progress,
  onHome,
}: {
  c: Case
  progress: CaseProgress
  onHome: () => void
}) {
  const [fold, setFold] = useState(false)

  // 값 → 표시 이름. 인물 id·장소 id·시각 id 를 사람이 읽는 말로 되돌린다
  const names = new Map<string, string>()
  c.people.forEach((p) => names.set(p.id, p.name))
  c.locations.forEach((l) => names.set(l.id, l.label))
  c.slots.forEach((s) => names.set(s.id, s.label))
  const labelOf = (v: string) => names.get(v) ?? v

  // 인물 색. 원본 `pColor`(2233행) — 답이 사람이면 그 사람의 색으로 쓴다
  const colors = new Map<string, string>()
  c.people.forEach((p, i) => colors.set(p.id, personColor(i)))

  const s = scoreCase(c, progress, labelOf)

  /**
   * 서술문 한 벌. `mine` 은 내가 넣은 값(안 넣었으면 정답), `real` 은 정답.
   * 원본 `mkNarr`(2237행) 그대로 — **한 문장 안에서 맞은 칸과 틀린 칸이 섞인다.**
   * 장 단위로 O/X 를 매기지 않는 이유가 그것이다.
   */
  const narration = (mode: 'mine' | 'real') =>
    c.chapters.map((ch) => ({
      order: ch.order,
      runs: (ch.report ?? []).map((part, n) => {
        if ('text' in part) return { key: n, text: part.text }
        const b = ch.blanks[part.blank]
        const mine = progress.answers[blankKey(ch.order, part.blank)] || null
        const ok = mine === b.answer
        const value = mode === 'real' ? b.answer : (mine ?? b.answer)
        const shown = labelOf(value)
        return {
          key: n,
          blank: true as const,
          // 내 이야기에서 **틀린 칸만** 붉다. 실제 쪽은 전부 제 색으로 선다
          color: mode === 'mine' && !ok ? 'var(--g-contradict)' : (colors.get(value) ?? 'var(--accent)'),
          text: shown + josa(shown, b.particle),
        }
      }),
    }))

  const story = (mode: 'mine' | 'real', muted?: boolean) => (
    <div className="nl-res-story">
      {narration(mode).map((sec) => (
        <p key={sec.order} className={muted ? 'nl-res-p nl-res-p-mine' : 'nl-res-p'}>
          {sec.runs.map((r) =>
            'blank' in r
              ? <span key={r.key} className="nl-res-blank" style={{ color: r.color }}>{r.text}</span>
              : <span key={r.key}>{r.text}</span>,
          )}
        </p>
      ))}
    </div>
  )

  return (
    <div className="nl-res">
      <div className="nl-res-title">
        {/* 제목은 **지목이 맞았는가**로 갈린다. 완성 여부가 아니다 (원본 2254행) */}
        <span className="v-h1">{s.accused ? '사건의 전말' : '미완의 조서'}</span>
        {s.stuck && <span className="nl-res-stuck-badge">난이도</span>}
      </div>

      {s.stuck && (
        <div className="v-body nl-res-stuck">
          조사 예산을 모두 소진했지만 사건을 종결하지 못했습니다.
        </div>
      )}

      {s.corrections.length > 0 ? (
        <>
          <div className="nl-res-block">
            <div className="v-micro nl-res-cap nl-res-cap-mine">내가 재구성한 이야기</div>
            {story('mine', true)}
          </div>

          <div className="nl-res-real">
            <div className="v-micro nl-res-cap nl-res-cap-real">실제</div>
            {story('real')}

            {/* 바로잡기는 **접혀 있다.** 펼치는 것은 플레이어의 선택이고,
                펼치기 전까지 이 화면은 이야기 두 벌로 끝난다 */}
            <div className="nl-res-fold">
              <div className="nl-res-fold-head" onClick={() => setFold((v) => !v)}>
                <span className="nl-res-fold-chev">{fold ? '▾' : '▸'}</span>
                <span className="v-micro nl-res-cap">
                  {fold ? '바로잡기 접기' : `바로잡기 ${s.corrections.length}곳`}
                </span>
              </div>

              {fold && (
                <div className="nl-res-corrections">
                  {s.corrections.map((cor, i) => (
                    <div key={i} className="nl-res-cor">
                      <span className="v-micro nl-res-cor-label">{cor.label}</span>
                      <span className="nl-res-cor-mine">{cor.mine ?? '미입력'}</span>
                      <span className="nl-res-cor-arrow">→</span>
                      <span className="nl-res-cor-right">{cor.right}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="nl-res-allright">{story('real')}</div>
      )}

      <div className="nl-res-score">
        <div className="nl-res-nom">
          <span className="v-ui nl-res-nom-label">범인 특정</span>
          <span
            className="nl-res-nom-result"
            style={{ color: s.accused ? 'var(--g-confirm)' : 'var(--g-contradict)' }}
          >
            {s.accused ? '성공' : '실패'}
          </span>
        </div>

        <div className="nl-res-bars">
          {s.domains.map((d) => (
            <div key={d.domain} className="nl-res-bar-row">
              <span className="v-meta nl-res-bar-label">{d.domain}</span>
              <span className="nl-res-bar-track">
                <span
                  className="nl-res-bar-fill"
                  style={{ width: `${d.total ? (d.correct / d.total) * 100 : 0}%` }}
                />
              </span>
              <span className="v-num nl-res-bar-num">{d.correct}/{d.total}</span>
            </div>
          ))}
        </div>

        <div className="nl-res-metrics">
          {/* 예산은 `Case.budget` 이다. 원본의 하드코딩 5는 낡은 값 */}
          <Metric k="사용한 조사" v={`${s.spent} / ${c.budget}`} />
          <Metric k="정확도" v={`${s.correct} / ${s.total}`} />
          {/* 원본도 '—' 다. 경과 시간을 세지 않는다 — 세는 순간 속도가 점수가 된다 */}
          <Metric k="소요 시간" v="—" />
        </div>

        <button className="nl-btn" onClick={onHome}>홈으로</button>
      </div>
    </div>
  )
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="nl-res-metric">
      <div className="v-micro nl-res-metric-k">{k}</div>
      <div className="v-num nl-res-metric-v">{v}</div>
    </div>
  )
}
