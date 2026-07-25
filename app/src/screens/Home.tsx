import { TopBar } from '../components/TopBar'
import { Mark } from '../components/Mark'
import type { CaseProgress } from '../state/stores'

/**
 * 홈 — 콘텐츠 3층 구조(캠페인 / 일일 사건 / 워크샵)의 진입점.
 *
 * *"진입점이 없으면 사건 하나짜리 데모"* (`design-brief.md` §9).
 *
 * **태그라인은 프로토타입 그대로다.**
 *
 * 한때 이것을 「무고한 사람은 거짓말하지 않는다」로 바꿨다가 되돌렸다 (2026-07-25).
 * 태그라인은 규칙이 아니라 **캐치프레이즈**다 — 홈 최상단은 홍보의 자리이지 설명서의
 * 자리가 아니고, 제목 *Nobody Lies* 와 「모든 진술을 의심하라」의 **반어가 곧 후크**다.
 * 게다가 바꾼 문구는 제목의 한국어 풀이에 가까워서 홈이 같은 말을 두 번 하게 됐다.
 *
 * 규칙 자체는 게임 **안에서** 전달한다 — 지금은 자유 진행 사이드바에 상시 노출.
 * 그것으로 충분한지는 플레이테스트가 답한다. (`docs/MEMORY.md` §태그라인)
 */

const TAGLINE = '모든 진술을 의심하라'

/** 캠페인 30개가 목표지만 지금 존재하는 사건은 하나다. 나머지는 자리만 보여준다 */
const CAMPAIGN = [
  { num: '01', id: 'mountain-lodge', title: '산장 살인사건', est: '40–60분', diff: 'hard' },
  { num: '02', id: null, title: '사건 02', est: '30–40분', diff: 'normal' },
  { num: '03', id: null, title: '사건 03', est: '40–60분', diff: 'hard' },
  { num: '04', id: null, title: '사건 04', est: '20–30분', diff: 'easy' },
  { num: '05', id: null, title: '사건 05', est: '30–40분', diff: 'normal' },
  { num: '06', id: null, title: '사건 06', est: '40–60분', diff: 'hard' },
]

export function Home({
  progress,
  caseTitle,
  onOpen,
  onResume,
}: {
  progress: CaseProgress
  caseTitle: string
  onOpen: (id: string) => void
  onResume: () => void
}) {
  const started = progress.status === 'in_progress'

  return (
    <div className="nl-fs">
      <TopBar title="노바디 라이즈" showMark ruled />

      <div className="nl-fs-body nl-fs-body-top">
        <div className="nl-home">
          <div className="nl-home-head">
            <Mark size={56} radius={14} />
            <div>
              <div className="nl-home-title">노바디 라이즈</div>
              <div className="v-body nl-home-tagline">{TAGLINE}</div>
            </div>
          </div>

          {started && (
            <div className="nl-home-resume" onClick={onResume}>
              <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                <path d="M5 3.5l7 4.5-7 4.5z" />
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="v-ui" style={{ color: 'var(--fg)' }}>이어하기 · {caseTitle}</div>
                <div className="v-meta" style={{ color: 'var(--fg-3)', marginTop: 2 }}>
                  {stageLabel(progress)} · {progress.solved.length}/5장
                </div>
              </div>
              <span className="v-meta" style={{ color: 'var(--accent)', fontSize: 16 }}>›</span>
            </div>
          )}

          <div className="v-caption nl-home-group">캠페인</div>
          <div className="nl-home-list">
            {CAMPAIGN.map((c) => (
              <div
                key={c.num}
                className={c.id ? 'nl-case-row nl-case-row-open' : 'nl-case-row nl-case-row-locked'}
                onClick={c.id ? () => onOpen(c.id!) : undefined}
              >
                <span className="v-num nl-case-num">{c.num}</span>
                <span className="v-title nl-case-title">{c.id ? caseTitle : c.title}</span>
                <span className="v-micro nl-case-est">{c.est}</span>
                <span className="pr-badge">{c.diff}</span>
                <span className={c.id && started ? 'nl-chip nl-chip-live' : 'nl-chip'}>
                  {c.id ? (started ? '진행 중' : '미플레이') : '준비 중'}
                </span>
              </div>
            ))}
          </div>

          <div className="v-caption nl-home-group">오늘의 사건</div>
          <div className="nl-home-list">
            <div className="nl-case-row nl-case-row-locked">
              <span className="v-title nl-case-title">오늘의 사건</span>
              <span className="v-micro nl-case-est">매일 새 사건 · 순위표</span>
            </div>
          </div>

          <div className="v-caption nl-home-group">더 보기</div>
          <div className="nl-home-more">
            {[
              { label: '방 참가', when: 'v2' },
              { label: '워크샵', when: 'v1.5' },
              { label: '협동', when: 'v2' },
            ].map((m) => (
              <div key={m.label} className="nl-home-more-card">
                <span className="v-ui">{m.label}</span>
                <span className="v-micro" style={{ color: 'var(--fg-4)' }}>{m.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function stageLabel(p: CaseProgress): string {
  switch (p.stage) {
    case 'prologue': return '프롤로그'
    case 'brief': return '사건 브리핑'
    case 'read': return '진술 정독'
    default: return '수사 중'
  }
}
