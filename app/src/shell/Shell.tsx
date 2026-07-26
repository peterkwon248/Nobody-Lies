import { useEffect, useState } from 'react'
import type { Case } from '@engine/types'
import type { CaseProgress, PlayerAnnotations } from '../state/stores'
import { DetailPanel } from './DetailPanel'

/**
 * 자유 진행 셸 — 사이드바 + 상단 헤더 + 본문 + 우측 디테일 패널.
 *
 * **프로토타입 `추리게임.dc.html` 73~168행과 914~960행을 읽고 옮겼다.**
 * `.app` 여는 태그부터 우측 패널까지 껍데기 전체가 범위다 — 한때 사이드바만 옮기고
 * 셸을 다 만들었다고 했는데, `.main` 이 시작되는 140행에서 읽기를 멈춘 탓이었다.
 *
 * 진입 흐름(프롤로그·브리핑·진술 정독)에는 셸이 없다. 산문과 문서의 레지스터를
 * 분리하기 위해서다. 셸은 **자유 진행에 들어가야** 나온다.
 *
 * ★ 셸은 게임이 말을 거는 자리가 아니다 ★ 배지·개수·강조로 "여기를 보라"를
 * 만들지 않는다. 남은 예산처럼 사실인 것만 적는다.
 */

/**
 * `result` 는 **사이드바에 없다** — 원본 `nav` 에도 없다. 보고서 제출로만 닿고,
 * 닿은 뒤에도 사이드바로 아무 화면이나 다시 열 수 있다(원본 `finishReport()` 는
 * `view` 만 바꾼다).
 */
export type View =
  | 'overview' | 'report' | 'statements' | 'suspects' | 'map' | 'relations' | 'log' | 'memo' | 'result'

/** 사이드바에 실제로 서는 항목. `result` 는 여기 없다 */
type NavView = Exclude<View, 'result'>

/** 아이콘은 프로토타입 84~118행의 인라인 SVG 그대로다 */
const ICONS: Record<NavView | 'home', React.ReactNode> = {
  home: <path d="M3 7l5-4 5 4v6H3z" />,
  overview: <><circle cx="8" cy="8" r="5.5" /><path d="M8 7.2v3.2M8 5.4v.1" /></>,
  report: <><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3M6 8h4M6 10.5h4" /></>,
  statements: <><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M2.5 6.5h11M6.5 6.5V13M10 6.5V13" /></>,
  // 원본 100행
  suspects: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" /></>,
  // 원본 104행
  map: <><path d="M2.5 4.5L6 3l4 1.5L13.5 3v9L10 13.5 6 12 2.5 13.5z" /><path d="M6 3v9M10 4.5v9" /></>,
  // 원본 113행 — 돋보기
  log: <><circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5" /></>,
  // 원본 121행 — 줄 세 개가 든 종이. 맨 아랫줄만 짧다
  memo: <><path d="M3 2.5h10v11H3z" /><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" /></>,
  // 원본 1839행 `ICONS.graph` — 점 셋과 그 사이를 잇는 선
  relations: <>
    <circle cx="4" cy="5" r="2" /><circle cx="12" cy="4" r="1.6" /><circle cx="11" cy="12" r="2" />
    <path d="M5.8 5.8l3.6 4.6M5.7 4.3l4.7-.2" />
  </>,
}

/** 화면 제목과 부제. 문구는 프로토타입 `t.nTitle`·`t.nSub` 등에서 가져왔다 */
const META: Record<View, { title: string; sub: string }> = {
  overview: { title: '사건 개요', sub: '확인된 사실만 적혀 있습니다' },
  report: { title: '사건 보고서', sub: '공란을 모두 채우면 장이 완성됩니다 · 마지막에 제출' },
  statements: { title: '진술', sub: '다섯 사람의 원문 진술' },
  suspects: { title: '용의자', sub: '확보한 사실만 채워집니다 · 심증은 내 판단일 뿐입니다' },
  map: { title: '현장', sub: '평면도에서 시간대별 주장 위치를, 도식 탭에서 주장 대조표를 봅니다' },
  // 원본 `t.navGraph` · `t.graphHint`
  relations: { title: '관계 그래프', sub: '조사로 드러난 인물·사건의 연결' },
  log: { title: '조사 기록', sub: '수행한 조사가 전문 그대로 남습니다' },
  // 원본 2831~2832행 — `t.memoTitle` · `t.annHint`
  memo: { title: '메모장', sub: '문장을 눌러 표시하거나 인용하세요' },
  /** 제목은 채점 결과로 갈리므로 App 이 `heading` 으로 덮어쓴다 (원본 2831행) */
  result: { title: '사건 종결', sub: '' },
}

const NAV: { group: string; items: { id: NavView; label: string }[] }[] = [
  { group: '사건', items: [
    { id: 'overview', label: '사건 개요' },
    { id: 'report', label: '보고서' },
  ] },
  { group: '단서', items: [
    { id: 'statements', label: '진술' },
    { id: 'suspects', label: '용의자' },
    { id: 'map', label: '현장' },
    // 원본 순서 그대로 — [단서] 의 마지막이다 (navStatements · navProfile · navMap · navGraph)
    { id: 'relations', label: '관계 그래프' },
  ] },
  // 원본 111행 — 조사 기록·상황판·메모·표기 안내가 여기 산다
  { group: '도구', items: [
    { id: 'log', label: '조사 기록' },
    { id: 'memo', label: '메모' },
  ] },
]

function NavIcon({ id }: { id: NavView | 'home' }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      {ICONS[id]}
    </svg>
  )
}

/**
 * 패널 토글 아이콘. 원본 81행(좌) · 161행(우) 그대로.
 *
 * **채워진 `rect` 가 핵심이다** — 어느 쪽 패널인지 알려주는 것이 그 반투명 면이고,
 * 한때 `<path>` 선 하나로 줄여 그려서 좌·우 구분이 사라졌다.
 */
function PanelIcon({ side }: { side: 'left' | 'right' }) {
  const x = side === 'left' ? 7 : 11
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="3" width="14" height="12" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <line x1={x} y1="3.6" x2={x} y2="14.4" stroke="currentColor" strokeWidth="1.6" />
      <rect
        x={side === 'left' ? 2.8 : 11.2}
        y="3.8" width="4" height="10.4" rx="2.4"
        fill="currentColor" opacity="0.18"
      />
    </svg>
  )
}

export function Shell({
  c,
  progress,
  annotations,
  view,
  onView,
  onHome,
  onAbandon,
  onAddMemo,
  onEditMemo,
  onDeleteMemo,
  editing,
  onEditing,
  heading,
  children,
}: {
  c: Case
  progress: CaseProgress
  annotations: PlayerAnnotations
  view: View
  onView: (v: View) => void
  onHome: () => void
  onAbandon: () => void
  onAddMemo: () => void
  onEditMemo: (id: string, content: string) => void
  onDeleteMemo: (id: string) => void
  /** 편집 중인 메모. 우측 패널과 메모장이 같은 값을 본다 (원본 `editMemoId`) */
  editing: string | null
  onEditing: (id: string | null) => void
  /** 상단 제목 덮어쓰기. 결말 화면만 쓴다 — 제목이 채점 결과다 */
  heading?: { title: string; sub: string }
  children: React.ReactNode
}) {
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const remaining = c.budget - progress.actionsUsed

  return (
    <div className="app" data-surface="vector">
      {leftOpen && (
        <div className="sidebar">
          <div className="ws-row">
            <div className="ws-switch">
              <span className="ws-name">{c.title}</span>
            </div>
            <span className="nl-fs-spacer" />
            <button className="iconbtn" onClick={() => setLeftOpen(false)} title="사이드바 접기">
              <PanelIcon side="left" />
            </button>
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
                    {/* 원본 114행 `logBadge` — 수행한 조사 수. 사실이지 재촉이 아니다 */}
                    {it.id === 'log' && progress.investigations.length > 0 && (
                      <span className="count">{progress.investigations.length}</span>
                    )}
                    {/* 원본 122행 `memoBadge` — 내가 적은 개수다. 게임이 세는 것이 아니다 */}
                    {it.id === 'memo' && annotations.notes.length > 0 && (
                      <span className="count">{annotations.notes.length}</span>
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
            <div className="v-micro nl-side-note">
              범인만 거짓말을 할 수 있다. 무고한 사람은 거짓말하지 않는다.
              다만 자기 비밀은 말하지 않는다.
            </div>
            {/* 원본 135행 — 사이드바 맨 아래 빨간 링크 */}
            <div className="linklike nl-side-abandon" onClick={onAbandon}>사건 포기</div>
          </div>
        </div>
      )}

      <div className="main">
        <div className="viewheader">
          {!leftOpen && (
            <button className="iconbtn" onClick={() => setLeftOpen(true)} title="사이드바 펼치기" style={{ marginRight: 8 }}>
              <PanelIcon side="left" />
            </button>
          )}
          <div className="viewtitle">
            <h1>{(heading ?? META[view]).title}</h1>
            <span className="v-meta" style={{ marginLeft: 6, color: 'var(--fg-4)' }}>
              {(heading ?? META[view]).sub}
            </span>
          </div>
          <span className="spacer" />
          <span className="toolbar-icons nl-toolbar">
            {/* 교차 참조 — 보고서를 쓰면서 오른쪽에서 진술을 확인한다 */}
            <button
              className="iconbtn"
              onClick={() => setRightOpen((v) => !v)}
              title="교차 참조"
              style={rightOpen ? { color: 'var(--accent)' } : undefined}
            >
              <PanelIcon side="right" />
            </button>
            {/* 원본 162행은 톱니바퀴가 아니라 **슬라이더**다 */}
            <button className="iconbtn" onClick={() => setSettings((v) => !v)} title="설정">
              <svg
                width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M20 7h-9" />
                <path d="M14 17H5" />
                <circle cx="17" cy="17" r="3" />
                <circle cx="7" cy="7" r="3" />
              </svg>
            </button>
            {settings && <SettingsPanel />}
          </span>
        </div>

        <div className="nl-view">{children}</div>
      </div>

      {rightOpen && (
        <DetailPanel
          c={c}
          annotations={annotations}
          onClose={() => setRightOpen(false)}
          onAddMemo={onAddMemo}
          onEditMemo={onEditMemo}
          onDeleteMemo={onDeleteMemo}
          editing={editing}
          onEditing={onEditing}
        />
      )}
    </div>
  )
}

/**
 * 설정.
 *
 * 프로토타입에는 **언어(한국어/EN)** 도 있는데 넣지 않았다. 사건 파일의 `Text.en` 이
 * 대부분 비어 있어서(번역 전) 지금 붙이면 절반만 번역된 화면이 된다. 어휘가 고정이라
 * 번역은 싸지만(`SYSTEM-DECISIONS.md` §7) 아직 하지 않은 일이다. 번역이 들어오면
 * 여기에 한 줄 더 붙인다.
 *
 * 닫기는 톱니바퀴를 다시 누르는 것이다 — 테마를 바꾼 뒤 패널이 남아 있어야
 * 바뀐 것을 그 자리에서 볼 수 있다.
 */
function SettingsPanel() {
  const [light, setLight] = useState(document.documentElement.dataset.theme === 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark'
  }, [light])

  return (
    <div className="panel nl-settings">
      <div className="panel-caption">테마</div>
      {/* Vector 의 .seg-toggle 은 자식에 `st` / `st active` 를 요구한다.
          한때 `on` 이라고 써서 스타일이 하나도 안 붙었다 — 클래스 이름은 계약이다 */}
      <div className="seg-toggle">
        <span className={light ? 'st' : 'st active'} onClick={() => setLight(false)}>어둡게</span>
        <span className={light ? 'st active' : 'st'} onClick={() => setLight(true)}>밝게</span>
      </div>
    </div>
  )
}
