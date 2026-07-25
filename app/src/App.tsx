import { useEffect, useState } from 'react'
import type { Case } from '@engine/types'
import { loadCase } from './case/loadCase'
import {
  emptyAnnotations, load, newProgress, save,
  type CaseProgress, type PlayerAnnotations, type Stage,
} from './state/stores'
import { Prologue } from './screens/Prologue'
import { Briefing } from './screens/Briefing'

const CASE_ID = 'mountain-lodge'

/**
 * 진입 흐름 — `design-brief.md` §4.01. **화면 순서가 곧 게임 구조다.**
 *
 * ```
 * 프롤로그 → 브리핑 → 진술 정독 → (1장 해금) → 자유 진행
 * ```
 *
 * 서술문(보고서)은 첫 화면이 아니다. 진술을 읽기 전에는 어떤 공란도 채울 수 없고,
 * 답을 알 수 없는 문제를 먼저 보여주면 방향 감각을 잃는다.
 */
export default function App() {
  const [c, setCase] = useState<Case | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  if (error) return <div className="screen screen-doc"><p className="doc-value">{error}</p></div>
  if (!c) return <div className="screen" />

  switch (progress.stage) {
    case 'prologue':
      return <Prologue c={c} onDone={() => go('brief')} />
    case 'brief':
      return <Briefing c={c} onDone={() => go('read')} />
    default:
      return (
        <div className="screen screen-doc">
          <header className="doc-head">
            <div className="doc-kicker">다음 단계</div>
            <h1 className="doc-title">진술 정독</h1>
          </header>
          <p className="doc-value">
            진술 원문이 아직 사건 파일에 없다. 프로토타입에 하드코딩돼 있고,
            산문 이관(A-2)이 끝나야 이 화면이 선다.
          </p>
          <div className="doc-foot">
            <button className="reader-next" onClick={() => go('prologue')}>
              프롤로그부터 다시
            </button>
          </div>
        </div>
      )
  }
}
