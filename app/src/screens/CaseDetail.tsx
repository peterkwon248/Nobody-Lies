import type { Case } from '@engine/types'
import { TopBar } from '../components/TopBar'
import type { CaseProgress } from '../state/stores'

/**
 * 사건 상세 — 홈과 플레이 사이. 시작 전에 무엇을 하게 되는지 알려준다.
 *
 * **여기서 사건 내용을 미리 말하지 않는다.** 피해자·용의자 수·예상 시간처럼
 * 브리핑에서 어차피 확정 층으로 나올 것만 보여준다. 프롤로그가 첫 서사이고
 * 그 앞에 요약이 끼면 프롤로그가 두 번째가 된다.
 */
export function CaseDetail({
  c,
  progress,
  onBack,
  onStart,
}: {
  c: Case
  progress: CaseProgress
  onBack: () => void
  onStart: () => void
}) {
  const started = progress.status === 'in_progress'

  return (
    <div className="nl-fs">
      <TopBar title={c.title} onBack={onBack} />

      <div className="nl-fs-body">
        <div className="nl-detail">
          <div className="nl-detail-badges">
            {/* 난이도는 검증기가 산출해 사건 파일에 실린 값이다. 손으로 적지 않는다 */}
            <span className="pr-badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              hard
            </span>
            <span className={started ? 'nl-chip nl-chip-live' : 'nl-chip'}>
              {started ? '진행 중' : '미플레이'}
            </span>
          </div>

          <div className="v-h1" style={{ marginBottom: 20 }}>{c.title}</div>

          <div className="nl-detail-rows">
            <Row k="조사 예산" v={`${c.budget}회`} />
            <Row k="관계인" v={`${c.people.length}명`} />
            <Row k="보고서" v={`${c.chapters.length}장 · 공란 ${c.chapters.reduce((n, ch) => n + ch.blanks.length, 0)}개`} />
            <Row k="예상 시간" v="40–60분" />
          </div>

          {!started && (
            <div className="v-meta nl-detail-note">
              아직 플레이하지 않았습니다. 시작하면 프롤로그부터 진행됩니다.
            </div>
          )}

          <button className="nl-btn nl-btn-primary" onClick={onStart}>
            {started ? '이어하기' : '수사 시작'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="nl-detail-row">
      <span className="v-meta" style={{ color: 'var(--fg-4)' }}>{k}</span>
      <span className="v-ui" style={{ color: 'var(--fg)' }}>{v}</span>
    </div>
  )
}
