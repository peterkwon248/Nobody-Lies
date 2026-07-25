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

  const markRead = (person: string) =>
    setProgress((p) =>
      p.statementsRead.includes(person)
        ? p
        : { ...p, statementsRead: [...p.statementsRead, person] },
    )

  useEffect(() => {
    loadCase(CASE_ID).then(setCase, (e: Error) => setError(e.message))
  }, [])

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
        <div className="nl-fs">
          <TopBar title={c.title} onBack={() => setRoute('home')} />
          <div className="nl-fs-body">
            <div className="nl-brief">
              <div className="v-h1" style={{ marginBottom: 6 }}>보고서</div>
              <div className="v-body nl-brief-sub">
                진술을 다 읽었습니다. 다음은 보고서 화면(5장 20공란)과 인게임 사이드바입니다 — 아직 만들지 않았습니다.
              </div>
              <button className="nl-btn" onClick={() => go('read')}>진술 다시 읽기</button>
            </div>
          </div>
        </div>
      )
  }
}
