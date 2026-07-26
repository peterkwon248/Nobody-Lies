import { useEffect, useState } from 'react'
import type { Action, Case } from '@engine/types'
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
import { FloorPlanView } from './screens/FloorPlanView'
import { ResultCard, actionState } from './screens/Investigate'
import { InvestigationLog } from './screens/InvestigationLog'
import { Suspects } from './screens/Suspects'
import { Shell, type View } from './shell/Shell'
import { deriveFacts, deriveTerms } from '@engine/verifier'
import { TopBar } from './components/TopBar'
import { Confirm, Toast } from './components/Confirm'

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
  /** 확인 모달. 화면 상태라 저장하지 않는다 */
  const [ask, setAsk] = useState<'abandon' | 'finish' | null>(null)
  /** 조사 확인 대기 · 조사 결과 카드. 화면 상태라 저장하지 않는다 */
  const [pending, setPending] = useState<Action | null>(null)
  const [result, setResult] = useState<Action | null>(null)
  const [toast, setToast] = useState<string | null>(null)
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

  /**
   * 진술 마킹. 플레이어가 만든 것이므로 `PlayerAnnotations` 로 간다.
   * **게임은 여기에 아무 의미도 부여하지 않는다** — 네 색은 플레이어의 어휘다.
   */
  const setHighlights = (highlights: PlayerAnnotations['highlights']) =>
    setAnnotations((a) => ({ ...a, highlights }))

  /**
   * 인용 → 메모.
   *
   * **층위를 인용 출처가 정한다** — 진술에서 뽑으면 `주장`, 확보 단어(물증)에서
   * 뽑으면 `확정`이다. 모순 경고를 없앴으므로 둘의 대조를 플레이어가 전부 혼자
   * 해야 하고, 층위 표시가 없으면 그 대조 자체가 불가능해진다 (`HANDOFF` §6).
   */
  const quoteToMemo = (quote: string, source: '확정' | '주장') => {
    setAnnotations((a) => ({
      ...a,
      notes: [
        ...a.notes,
        {
          id: `quote:${Date.now()}`,
          content: '',
          quote,
          source,
          at: Date.now(),
          context: VIEW_LABEL[view],
        },
      ],
    }))
    // 토스트는 **어디에 생겼는지만** 말한다. 인용문은 메모 화면에 영구히 남는다
    setToast('인용이 메모에 추가되었습니다')
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  /** 화면 이름. 메모가 「어디서 적었나」를 남긴다 (원본 `memoMeta`) */
  const VIEW_LABEL: Record<View, string> = {
    overview: '사건 개요', report: '사건 보고서', statements: '진술', map: '현장',
    log: '조사 기록', suspects: '용의자',
  }

  const addMemo = () =>
    setAnnotations((a) => ({
      ...a,
      notes: [
        ...a.notes,
        { id: `memo:${Date.now()}`, content: '', at: Date.now(), context: VIEW_LABEL[view] },
      ],
    }))

  const editMemo = (id: string, content: string) =>
    setAnnotations((a) => ({
      ...a,
      notes: a.notes.map((n) => (n.id === id ? { ...n, content } : n)),
    }))

  /** 격자 셀 마킹. 진술 마킹과 같은 어휘를 쓰되 대상이 셀이다 */
  const setCellMark = (person: string, slot: string, kind: '확인' | '의심' | '모순' | null) =>
    setAnnotations((a) => {
      const rest = a.cellMarks.filter((m) => !(m.person === person && m.slot === slot))
      return { ...a, cellMarks: kind ? [...rest, { person, slot, kind }] : rest }
    })

  /** 심증 — 같은 값을 다시 누르면 해제된다. 되돌릴 수 없는 표시는 판정처럼 느껴진다 */
  const setVerdict = (person: string, v: '제외' | '주목' | '유력') =>
    setAnnotations((a) => {
      const next = { ...a.verdicts }
      if (next[person] === v) delete next[person]
      else next[person] = v
      return { ...a, verdicts: next }
    })

  const deleteMemo = (id: string) =>
    setAnnotations((a) => ({ ...a, notes: a.notes.filter((n) => n.id !== id) }))

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
    setProgress((p) => ({
      ...p,
      reopensUsed: { ...p.reopensUsed, [order]: true },
      reopensOpen: { ...p.reopensOpen, [order]: true },
    }))

  /** 편집 완료 — 다시 잠근다. **`reopensUsed` 는 그대로 둔다**(장당 1회) */
  const closeReopen = (order: number) =>
    setProgress((p) => ({ ...p, reopensOpen: { ...p.reopensOpen, [order]: false } }))

  /**
   * 조사 실행 — 예산을 쓰는 유일한 자리.
   *
   * 확보 단어는 여기서 손대지 않는다. `deriveTerms` 가 `investigations` 에서
   * 다시 계산하므로 **같은 계산이 두 벌 생기지 않는다.**
   */
  const runInvestigation = (a: Action) => {
    setProgress((p) => ({
      ...p,
      actionsUsed: p.actionsUsed + a.cost,
      investigations: [...p.investigations, { actionId: a.id, at: Date.now() }],
    }))
    setAsk(null)
    setResult(a)
  }

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

  /** 확보한 사실. 슬롯(동기·기회·수단)이 여기서 나온다 */
  const evidence = c
    ? new Set(progress.investigations.flatMap((iv) =>
        c.actions.find((a) => a.id === iv.actionId)?.gives ?? []))
    : new Set<string>()
  const facts = c
    ? new Set(deriveFacts(c, evidence, progress.solved.length))
    : new Set<string>()

  /** 인물별 발견 단서 — 그 사람을 대상으로 한 조사에서 나온 물증 */
  const cluesByPerson = new Map<string, { text: string; action: string }[]>()
  if (c)
    for (const iv of progress.investigations) {
      const a = c.actions.find((x) => x.id === iv.actionId)
      if (a?.target?.kind !== 'person') continue
      const found = a.gives
        .map((id) => c.evidence.find((e) => e.id === id))
        .filter(Boolean)
        .map((e) => ({ text: e!.description, action: a.label }))
      if (found.length)
        cluesByPerson.set(a.target.id, [...(cluesByPerson.get(a.target.id) ?? []), ...found])
    }

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

  /** 아직 채우지 않은 공란 수. 원본 `finishUnfilled` — 제출 모달에만 뜬다 */
  const unfilled = c.chapters.reduce(
    (n, ch) => n + ch.blanks.filter((_, i) => !progress.answers[`${ch.order}:${i}`]).length,
    0,
  )

  /**
   * 사건 포기 — 진행을 통째로 버리고 처음부터. 원본 `abandon()`(2036행).
   * 플레이어가 만든 주석은 남긴다 — 진행 기록과 수명이 다르다(저장소 3분리).
   */
  const abandon = () => {
    setProgress(newProgress(CASE_ID))
    setAsk(null)
    setView('report')
    setRoute('home')
  }

  return (
    <>
      {screen()}

      {ask === 'abandon' && (
        <Confirm
          title="사건을 포기할까요?"
          body="진행 상황과 점수가 사라지고 처음부터 시작됩니다."
          confirmLabel="포기하기"
          danger
          onConfirm={abandon}
          onCancel={() => setAsk(null)}
        />
      )}

      {ask === 'finish' && (
        <Confirm
          title="이대로 사건을 종결할까요?"
          body="제출 후에는 되돌릴 수 없습니다. 완성된 보고서가 사건의 전말이 됩니다."
          note={unfilled > 0 ? `아직 채우지 않은 공란 ${unfilled}개` : undefined}
          confirmLabel="제출"
          width={420}
          onConfirm={() => setAsk(null)}
          onCancel={() => setAsk(null)}
        />
      )}

      {pending && (
        <Confirm
          title={pending.label}
          body={`조사 ${pending.cost}회를 사용합니다. 되돌릴 수 없습니다.`}
          confirmLabel="조사"
          width={380}
          onConfirm={() => runInvestigation(pending)}
          onCancel={() => setPending(null)}
        />
      )}

      {result && <ResultCard a={result} onClose={() => setResult(null)} />}

      {toast && <Toast message={toast} />}
    </>
  )

  function screen() {
    if (!c) return null

    if (route === 'home')
      return (
        <Home
          c={c}
          progress={progress}
          onOpen={() => setRoute('detail')}
          onResume={() => setRoute('play')}
        />
      )

    if (route === 'detail')
      return (
        <CaseDetail
          c={c}
          progress={progress}
          onBack={() => setRoute('home')}
          onStart={() => { go(progress.stage); setRoute('play') }}
          onAbandon={() => setAsk('abandon')}
        />
      )

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
          onAbandon={() => setAsk('abandon')}
          onAddMemo={addMemo}
          onEditMemo={editMemo}
          onDeleteMemo={deleteMemo}
        >
          {view === 'overview' && (
            <Overview
              c={c}
              /* 시각 축소는 그 공개를 여는 조사를 했을 때만. 조사 시스템(P) 이후 참이 된다 */
              firedNarrow={c.reveals?.some((r) => {
                if (!r.narrowsWindow || r.trigger.on !== 'action') return false
                const need = r.trigger.actionId
                return progress.investigations.some((iv) => iv.actionId === need)
              }) ?? false}
              highlights={annotations.highlights}
              onMark={setHighlights}
              onQuote={(q) => quoteToMemo(q, '확정')}
            />
          )}
          {view === 'suspects' && (
            <Suspects
              c={c}
              facts={facts}
              cluesByPerson={cluesByPerson}
              annotations={annotations}
              onVerdict={setVerdict}
              actionsFor={(pid) => {
                const used = new Set(progress.investigations.map((iv) => iv.actionId))
                const left = c.budget - progress.actionsUsed
                return c.actions
                  .filter((a) => a.target?.kind === 'person' && a.target.id === pid)
                  .map((a) => ({ action: a, state: actionState(c, a, used, left, progress.solved.length) }))
              }}
              onAsk={setPending}
            />
          )}
          {view === 'log' && (
            <InvestigationLog c={c} progress={progress} onAsk={setPending} />
          )}
          {view === 'map' && (
            <FloorPlanView
              c={c}
              solved={progress.solved}
              /* 조사 시스템(P) 이 붙으면 실제 수색 기록이 들어온다 */
              investigatedLocs={new Set(
                progress.investigations
                  .map((iv) => c.actions.find((a) => a.id === iv.actionId)?.target)
                  .filter((t) => t?.kind === 'location')
                  .map((t) => t!.id),
              )}
              /* 도면에서 누르면 조사가 열린다. 실행 가능한 것만 건다 */
              actionAt={(kind, id) => {
                const a = c.actions.find((x) => x.target?.kind === kind && x.target.id === id)
                if (!a) return null
                const used = new Set(progress.investigations.map((iv) => iv.actionId))
                const st = actionState(c, a, used, c.budget - progress.actionsUsed, progress.solved.length)
                return { action: a, state: st }
              }}
              onAsk={setPending}
              annotations={annotations}
              onCellMark={setCellMark}
            />
          )}
          {view === 'statements' && (
            <StatementList
              c={c}
              solved={progress.solved}
              highlights={annotations.highlights}
              onMark={setHighlights}
              onQuote={(q, person) => quoteToMemo(`“${q}” — ${person}`, '주장')}
            />
          )}
          {view === 'report' && (
            <Report
              c={c}
              answers={progress.answers}
              solved={progress.solved}
              reopened={progress.reopensUsed}
              terms={terms}
              reopenOpen={progress.reopensOpen}
              onAnswer={setAnswer}
              onReopen={reopen}
              onCloseReopen={closeReopen}
              onSubmit={() => setAsk('finish')}
              onQuote={(q) => quoteToMemo(q, '확정')}
            />
          )}
        </Shell>
      )
    }
  }
}
