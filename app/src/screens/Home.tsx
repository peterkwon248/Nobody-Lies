import type { Case } from '@engine/types'
import { TopBar } from '../components/TopBar'
import { Mark } from '../components/Mark'
import type { CaseProgress } from '../state/stores'
import { CAMPAIGN, statusChip } from '../case/catalog'

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


export function Home({
  c,
  progress,
  onOpen,
  onResume,
}: {
  c: Case
  progress: CaseProgress
  onOpen: (id: string) => void
  onResume: () => void
}) {
  const started = progress.status === 'in_progress'
  const chip = statusChip(progress.status)
  const remaining = c.budget - progress.actionsUsed

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
                <div className="v-ui" style={{ color: 'var(--fg)' }}>이어하기 · {c.title}</div>
                {/* 원본 1084행: `진행 N/M · 잔여 조사 K`. 예산 잔량이 여기 있다 */}
                <div className="v-meta" style={{ color: 'var(--fg-3)', marginTop: 2 }}>
                  진행 {progress.solved.length}/{c.chapters.length} · 잔여 조사 {remaining}
                </div>
              </div>
              <span className="v-meta" style={{ color: 'var(--accent)', fontSize: 16 }}>›</span>
            </div>
          )}

          <div className="v-caption nl-home-group">캠페인</div>
          <div className="nl-home-list">
            {CAMPAIGN.map((row) => (
              <div
                key={row.num}
                className={row.id ? 'nl-case-row nl-case-row-open' : 'nl-case-row nl-case-row-locked'}
                onClick={row.id ? () => onOpen(row.id!) : undefined}
              >
                <span className="v-num nl-case-num">{row.num}</span>
                <span className="v-title nl-case-title">{row.id ? c.title : row.title}</span>
                <span className="v-micro nl-case-est">{row.est}</span>
                {/* 난이도 배지는 중립색이다(원본 2044행 diffStyle) — 난이도가 곧 유용도 신호가 되지 않도록 */}
                <span className="pr-badge nl-case-diff">{row.diff}</span>
                {row.id ? (
                  <span className="nl-chip" style={{ color: chip.color, background: chip.background }}>
                    {chip.label}
                  </span>
                ) : (
                  <span className="nl-chip">준비 중</span>
                )}
              </div>
            ))}
          </div>

          {/* 원본 1098행 — 사건 행이 아니라 캘린더 아이콘이 붙은 단독 카드다 */}
          <div className="v-caption nl-home-group">오늘의 사건</div>
          <div className="nl-home-daily">
            <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4">
              <rect x="2.5" y="3" width="11" height="11" rx="1.5" />
              <path d="M2.5 6h11M6 2v2M10 2v2" />
            </svg>
            <span className="v-title nl-home-daily-label">오늘의 사건</span>
            <span className="v-meta" style={{ color: 'var(--fg-4)' }}>매일 새 사건 · 순위표</span>
          </div>

          {/* 원본 1104~1106행 — 점선 테두리가 '아직 없는 것'의 표시다 */}
          <div className="v-caption nl-home-group">더 보기</div>
          <div className="nl-home-more">
            {[
              { label: '방 참가', when: 'v2' },
              { label: '워크샵', when: 'v1.5' },
              { label: '협동', when: 'v2' },
            ].map((m) => (
              <div key={m.label} className="nl-home-more-card">
                <span className="v-title nl-home-more-label">{m.label}</span>
                <span className="pr-badge nl-home-more-badge">{m.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
