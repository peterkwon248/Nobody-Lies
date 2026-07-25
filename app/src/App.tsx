import { useEffect, useState } from 'react'
import type { Case } from '@engine/types'
import { loadCase } from './case/loadCase'
import {
  emptyAnnotations, load, newProgress, save,
  type CaseProgress, type PlayerAnnotations, type Stage,
} from './state/stores'
import { Home } from './screens/Home'
import { CaseDetail } from './screens/CaseDetail'
import { Prologue } from './screens/Prologue'
import { Briefing } from './screens/Briefing'
import { Statements } from './screens/Statements'
import { Report } from './screens/Report'
import { Overview } from './screens/Overview'
import { StatementList } from './screens/StatementList'
import { Shell, type View } from './shell/Shell'
import { deriveTerms } from '@engine/verifier'
import { TopBar } from './components/TopBar'

const CASE_ID = 'mountain-lodge'

/**
 * 앱 셸과 라우팅.
 *
 * ```
 * 홈 → 사건 상세 → 플레이(프롤로그 → 브리핑 → 진술 정독 → 자유 진행)
 * ```
 *
 * **진입 흐름 단계에는 사이드바가 없다.** 프로토타입도 그렇다 —
 * `isIntro = route === 'play' && stage !== 'free'` 이고 그동안 화면은 전체화면
 * 표면이다. 사이드바는 자유 진행에 들어가야 나온다. 산문과 문서의 레지스터를
 * 분리하는 장치이므로 그대로 옮긴다.
 *
 * `route` 는 화면 상태라 저장하지 않는다. 저장되는 것은 `progress.stage` 이고
 * 홈의 「이어하기」가 그 값으로 복원한다.
 */
type Route = 'home' | 'detail' | 'play'

export default function App() {
  const [c, setCase] = useState<Case | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<Route>('home')
  const [view, setView] = useState<View>('report')
  const [progress, setProgress] = useState<CaseProgress>(() =>
    load('progress', CASE_ID, newProgress(CASE_ID)),
  )
  const [annotations, setAnnotations] = useState<PlayerAnnotations>(() =>
    load('annotations', CASE_ID, emptyAnnotations()),
  )

  /**
   * 인물별 메모. 층위는 **주장** — 진술에 붙은 메모이므로 확정(물증)과 구분해 적어둔다.
   * 모순 경고를 없앴으므로 확정과 주장의 대조를 플레이어가 혼자 해야 하고,
   * 그 대조가 일어나는 자리가 여기다 (`HANDOFF-TO-CODE.md` §6).
   */
  const setMemo = (person: string, content: string) =>
    setAnnotations((a) => {
      const rest = a.notes.filter((n) => n.target !== person)
      return {
        ...a,
        notes: content.trim()
          ? [...rest, { id: `memo:${person}`, content, target: person, source: '주장' as const }]
          : rest,
      }
    })

  const setAnswer = (key: string, value: string) =>
    setProgress((p) => {
      const answers = { ...p.answers }
      if (value) answers[key] = value
      else delete answers[key]
      return { ...p, answers }
    })

  /**
   * 재개봉. 장당 1회.
   *
   * **완성을 되돌리는 것이 아니라 답을 고칠 기회다.** `solved` 에서 빼지 않는다 —
   * 빼면 그 장의 공란을 하나 지우는 순간 뒷장이 다시 잠기고, **이미 공개된 정보를
   * 회수하는 셈**이 된다 (`HANDOFF-TO-CODE.md` §5.2).
   */
  const reopen = (order: number) =>
    setProgress((p) => ({ ...p, reopensUsed: { ...p.reopensUsed, [order]: true } }))

  const markRead = (person: string) =>
    setProgress((p) =>
      p.statementsRead.includes(person)
        ? p
        : { ...p, statementsRead: [...p.statementsRead, person] },
    )

  useEffect(() => {
    loadCase(CASE_ID).then(setCase, (e: Error) => setError(e.message))
  }, [])

  /**
   * 지금 손에 있는 확보 단어. seedTerms ∪ atScene 물증 ∪ 조사로 얻은 물증.
   * 엔진의 함수를 그대로 쓴다 — 같은 계산이 두 벌 있으면 반드시 갈라진다.
   */
  const terms = c
    ? deriveTerms(c, new Set(progress.investigations.flatMap((iv) =>
        c.actions.find((a) => a.id === iv.actionId)?.gives ?? [])))
    : new Set<string>()

  /**
   * 장 자동 완성. **`장 확인` 버튼은 없다** — 공란을 다 채우면 완성되고 다음 장이 열린다.
   * **정답 여부와 무관하게** 완성된다 (`HANDOFF-TO-CODE.md` §5.2).
   *
   * 렌더 중이 아니라 여기서 판정하는 이유: 완성은 상태 전이이고, 상태 전이를
   * 렌더 안에서 일으키면 같은 전이가 두 번 일어난다.
   */
  useEffect(() => {
    if (!c) return
    const idx = progress.solved.length
    const ch = c.chapters[idx]
    if (!ch) return
    const filled = ch.blanks.every((_, i) => progress.answers[`${ch.order}:${i}`])
    if (filled) setProgress((p) => ({ ...p, solved: [...p.solved, idx] }))
  }, [c, progress.answers, progress.solved])

  useEffect(() => { save('progress', CASE_ID, progress) }, [progress])
  useEffect(() => { save('annotations', CASE_ID, annotations) }, [annotations])

  const go = (stage: Stage) =>
    setProgress((p) => ({ ...p, stage, status: p.status === 'unplayed' ? 'in_progress' : p.status }))

  if (error) {
    return (
      <div className="nl-fs">
        <TopBar title="노바디 라이즈" />
        <div className="nl-fs-body"><p className="v-body">{error}</p></div>
      </div>
    )
  }
  if (!c) return <div className="nl-fs" />

  if (route === 'home') {
    return (
      <Home
        progress={progress}
        caseTitle={c.title}
        onOpen={() => setRoute('detail')}
        onResume={() => setRoute('play')}
      />
    )
  }

  if (route === 'detail') {
    return (
      <CaseDetail
        c={c}
        progress={progress}
        onBack={() => setRoute('home')}
        onStart={() => { go(progress.stage); setRoute('play') }}
      />
    )
  }

  switch (progress.stage) {
    case 'prologue':
      return <Prologue c={c} onDone={() => go('brief')} onHome={() => setRoute('home')} />
    case 'brief':
      return <Briefing c={c} onDone={() => go('read')} onHome={() => setRoute('home')} />
    case 'read':
      return (
        <Statements
          c={c}
          read={progress.statementsRead}
          annotations={annotations}
          onMemo={setMemo}
          onRead={markRead}
          onDone={() => go('free')}
          onHome={() => setRoute('home')}
        />
      )
    default:
      return (
        <Shell
          c={c}
          progress={progress}
          annotations={annotations}
          view={view}
          onView={setView}
          onHome={() => setRoute('home')}
        >
          {view === 'overview' && <Overview c={c} />}
          {view === 'statements' && <StatementList c={c} />}
          {view === 'report' && (
            <Report
              c={c}
              answers={progress.answers}
              solved={progress.solved}
              reopened={progress.reopensUsed}
              terms={terms}
              onAnswer={setAnswer}
              onReopen={reopen}
            />
          )}
        </Shell>
      )
  }
}
