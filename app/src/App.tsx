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
  // 주석은 아직 쓰이지 않지만 저장소를 처음부터 나눠둔다 — 나중에 나누면 저장 구조를 뜯는다
  const [annotations] = useState<PlayerAnnotations>(() =>
    load('annotations', CASE_ID, emptyAnnotations()),
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
      return <Prologue c={c} onDone={() => go('brief')} />
    case 'brief':
      return <Briefing c={c} onDone={() => go('read')} />
    default:
      return (
        <div className="nl-fs">
          <TopBar title={c.title} onBack={() => setRoute('home')} />
          <div className="nl-fs-body">
            <div className="nl-brief">
              <div className="v-h1" style={{ marginBottom: 6 }}>진술 정독</div>
              <div className="v-body nl-brief-sub">
                진술 원문이 아직 사건 파일에 없습니다. 프로토타입에 하드코딩돼 있고,
                산문 이관(A-2)이 끝나야 이 화면이 섭니다.
              </div>
              <button className="nl-btn" onClick={() => go('prologue')}>프롤로그부터 다시</button>
            </div>
          </div>
        </div>
      )
  }
}
