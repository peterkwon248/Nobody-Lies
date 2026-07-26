import type { Case } from '@engine/types'
import { TopBar } from '../components/TopBar'
import type { CaseProgress } from '../state/stores'
import { statusChip } from '../case/catalog'

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
  onReview,
  onAbandon,
}: {
  c: Case
  progress: CaseProgress
  onBack: () => void
  onStart: () => void
  /** 다시 보기 — 끝낸 사건의 결말로 바로 들어간다 (원본 `reviewCase()`, 2030행) */
  onReview: () => void
  onAbandon: () => void
}) {
  const started = progress.status === 'in_progress'
  const cleared = progress.status === 'cleared'
  const chip = statusChip(progress.status)

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
            <span className="nl-chip" style={{ color: chip.color, background: chip.background }}>
              {chip.label}
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

          {/* 원본 2054행 — **미플레이일 때만**. 끝낸 사건에 「아직 플레이하지 않은」은 거짓말이다 */}
          {progress.status === 'unplayed' && (
            <div className="v-meta nl-detail-note">
              아직 플레이하지 않은 사건입니다. 시작하면 프롤로그부터 진행됩니다.
            </div>
          )}

          {/* 원본 1131~1134행 — 협동은 v2 라 비활성으로 자리만 있다 */}
          <div className="nl-detail-actions">
            {/* 원본 2055~2056행 — 세 갈래다. 끝낸 사건은 결말로 바로 들어간다(`reviewCase()`) */}
            <button
              className="nl-btn nl-btn-primary nl-detail-primary"
              onClick={cleared ? onReview : onStart}
            >
              {cleared ? '다시 보기' : started ? '이어하기' : '혼자 시작'}
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
