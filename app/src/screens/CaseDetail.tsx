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
  onAbandon,
}: {
  c: Case
  progress: CaseProgress
  onBack: () => void
  onStart: () => void
  onAbandon: () => void
}) {
  const started = progress.status === 'in_progress'

  return (
    <div className="nl-fs">
      <TopBar title={c.title} onBack={onBack} backLabel="사건 목록" />

      <div className="nl-fs-body">
        <div className="nl-detail">
          <div className="nl-detail-badges">
            {/* 난이도는 검증기가 산출한다. 아직 사건 파일에 실리지 않아 손으로 적는다 */}
            <span className="pr-badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              hard
            </span>
            <span className={started ? 'nl-chip nl-chip-live' : 'nl-chip'}>
              {started ? '진행 중' : '미플레이'}
            </span>
          </div>

          <div className="v-h1" style={{ marginBottom: 20 }}>{c.title}</div>

          {/* 원본 2053행의 4행 그대로. `보고서` 행만 우리가 더한 것이라 판단 보류 중이다 */}
          <div className="nl-detail-rows">
            <Row k="난이도" v="hard" />
            <Row k="조사 예산" v={`${c.budget}`} />
            <Row k="예상 소요" v="40–60분" />
            <Row k="용의자" v={`${c.people.length}명`} />
            <Row k="보고서" v={`${c.chapters.length}장 · 공란 ${c.chapters.reduce((n, ch) => n + ch.blanks.length, 0)}개`} />
          </div>

          {!started && (
            <div className="v-meta nl-detail-note">
              아직 플레이하지 않은 사건입니다. 시작하면 프롤로그부터 진행됩니다.
            </div>
          )}

          {/* 원본 1131~1134행 — 협동은 v2 라 비활성으로 자리만 있다 */}
          <div className="nl-detail-actions">
            <button className="nl-btn nl-btn-primary nl-detail-primary" onClick={onStart}>
              {started ? '이어하기' : '혼자 시작'}
            </button>
            <button className="nl-btn nl-detail-room" disabled>
              방 만들기 · v2
            </button>
          </div>

          {/* 원본 1135행 — 진행 중일 때만, 하단 중앙 */}
          {started && (
            <div className="nl-detail-abandon">
              <span className="linklike nl-side-abandon" onClick={onAbandon}>사건 포기</span>
            </div>
          )}
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
