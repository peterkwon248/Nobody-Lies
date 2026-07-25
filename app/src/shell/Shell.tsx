import type { Case } from '@engine/types'
import type { CaseProgress } from '../state/stores'

/**
 * 자유 진행 셸 — 사이드바 + 본문.
 *
 * 진입 흐름(프롤로그·브리핑·진술 정독)에는 셸이 없다. 산문과 문서의 레지스터를
 * 분리하기 위해서다. 셸은 **자유 진행에 들어가야** 나온다.
 *
 * ★ 사이드바는 게임이 말을 거는 자리가 아니다 ★ 배지·개수·강조로 "여기를 보라"를
 * 만들지 않는다. 남은 예산처럼 사실인 것만 적는다.
 */

export type View = 'overview' | 'report' | 'statements'

/** 아이콘은 프로토타입 `추리게임.dc.html` 84~118행의 인라인 SVG 그대로다 */
const ICONS: Record<View | 'home', React.ReactNode> = {
  home: <path d="M3 7l5-4 5 4v6H3z" />,
  overview: <><circle cx="8" cy="8" r="5.5" /><path d="M8 7.2v3.2M8 5.4v.1" /></>,
  report: <><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3M6 8h4M6 10.5h4" /></>,
  statements: <><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M2.5 6.5h11M6.5 6.5V13M10 6.5V13" /></>,
}

const NAV: { group: string; items: { id: View; label: string }[] }[] = [
  { group: '사건', items: [
    { id: 'overview', label: '사건 개요' },
    { id: 'report', label: '보고서' },
  ] },
  { group: '단서', items: [
    { id: 'statements', label: '진술' },
  ] },
]

function NavIcon({ id }: { id: View | 'home' }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      {ICONS[id]}
    </svg>
  )
}

export function Shell({
  c,
  progress,
  view,
  onView,
  onHome,
  children,
}: {
  c: Case
  progress: CaseProgress
  view: View
  onView: (v: View) => void
  onHome: () => void
  children: React.ReactNode
}) {
  const remaining = c.budget - progress.actionsUsed

  return (
    <div className="app" data-surface="vector">
      <div className="sidebar">
        <div className="ws-row">
          <div className="ws-switch">
            <span className="ws-name">{c.title}</span>
          </div>
        </div>

        <div className="nav">
          <div className="nav-item" onClick={onHome}>
            <NavIcon id="home" />
            <span>홈</span>
          </div>

          {NAV.map((g) => (
            <div key={g.group}>
              <div className="nav-caption">{g.group}</div>
              {g.items.map((it) => (
                <div
                  key={it.id}
                  className={view === it.id ? 'nav-item active' : 'nav-item'}
                  onClick={() => onView(it.id)}
                >
                  <NavIcon id={it.id} />
                  <span>{it.label}</span>
                  {it.id === 'report' && (
                    <span className="count">
                      {progress.solved.length}/{c.chapters.length}장
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="nl-side-foot">
          <div className="nl-side-status">
            {/* 난이도는 검증기가 산출해 사건 파일에 실린 값이다. 손으로 적지 않는다 */}
            <span className="pr-badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              hard
            </span>
            {/* 남은 예산은 사실이다. 어디에 쓰라는 말은 하지 않는다 */}
            <span className="v-meta">
              잔여 조사 · <b className="v-num" style={{ color: 'var(--fg-2)' }}>{remaining} / {c.budget}</b>
            </span>
          </div>
          {/* 이 게임의 규칙 그 자체. 모르면 아무도 배제할 수 없어 퍼즐이 안 풀린다 */}
          <div className="v-micro nl-side-note">
            범인만 거짓말을 할 수 있다. 무고한 사람은 거짓말하지 않는다.
            다만 자기 비밀은 말하지 않는다.
          </div>
        </div>
      </div>

      <div className="main">{children}</div>
    </div>
  )
}
