import { useEffect, useRef, useState } from 'react'
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
import { Memo } from './screens/Memo'
import { Result } from './screens/Result'
import { SuspectDetail } from './screens/SuspectDetail'
import { Relations } from './screens/Relations'
import { BoardView } from './screens/BoardView'
import { Reference } from './screens/Reference'
import { scoreCase } from './case/score'
import { Shell, type View } from './shell/Shell'
import { deriveFacts, deriveTerms } from '@engine/verifier'
import { TopBar } from './components/TopBar'
import { Confirm, Toast } from './components/Confirm'
import { QuotePicker } from './components/QuotePicker'

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

/** 메모 대상의 종류. 저장 타입과 같은 어휘를 쓴다 */
type TargetType = NonNullable<PlayerAnnotations['notes'][number]['targetType']>

/**
 * 인용 한 건. 「어디서 뽑았나」가 전부 여기 담긴다.
 *
 * **층위(`source`)를 인용 출처가 정한다** — 진술에서 뽑으면 `주장`, 확보 단어에서
 * 뽑으면 `확정`이다. 모순 경고를 없앴으므로 둘의 대조를 플레이어가 전부 혼자
 * 해야 하고, 층위 표시가 없으면 그 대조 자체가 불가능해진다 (`HANDOFF` §6).
 */
type Quote = {
  quote: string
  who?: string
  source: '확정' | '주장'
  targetType: TargetType
  target: string | null
}

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
  /**
   * 메모장의 화면 상태. **App 이 쥔다** — 인용이 새 메모를 만들면 그 메모를
   * 펼친 채로 메모장을 열어야 하고(원본 `editMemoId`), 필터가 걸려 있으면
   * 방금 만든 메모가 안 보일 수 있어 「전체」로 되돌려야 한다(원본 `memoFilter: 'all'`).
   */
  const [editing, setEditing] = useState<string | null>(null)
  const [memoFilter, setMemoFilter] = useState<TargetType | '전체'>('전체')
  const [memoSort, setMemoSort] = useState<'최신순' | '대상순'>('최신순')
  const [memoQuery, setMemoQuery] = useState('')
  /** 담을 곳을 묻는 중인 인용. 「인용 모으기」가 둘 이상일 때만 값이 있다 */
  const [picking, setPicking] = useState<Quote | null>(null)
  /** 열려 있는 인물 상세 (원본 `openProfile`) */
  const [openProfile, setOpenProfile] = useState<string | null>(null)
  /** 「출처 보기」로 뛰어간 조사. 조사 기록에서 잠깐 표시된다 (원본 `hlLog`) */
  const [hlLog, setHlLog] = useState<string | null>(null)
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
          ? [...rest, {
            id: `memo:${person}`,
            content,
            targetType: '인물' as const,
            target: person,
            source: '주장' as const,
          }]
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
   * 인용 → 메모. **세 갈래다** (원본 `routeQuote`, 2634행).
   *
   * ```
   * 「인용 모으기」 켜둔 메모  0개 → 새 메모를 만들고 메모장을 연다
   *                          1개 → 묻지 않고 거기 이어 붙인다 (제자리에 머문다)
   *                        2개+ → 어디에 담을지 묻는다
   * ```
   *
   * 켜둔 개수가 이미 플레이어의 대답이라 어느 갈래도 되묻지 않는다.
   */
  const routeQuote = (q: Quote) => {
    const pins = annotations.notes.filter((n) => n.pinned)
    if (pins.length >= 2) setPicking(q)
    else if (pins.length === 1) appendQuote(pins[0].id, q)
    else newMemoFromQuote(q)
  }

  /** 인용문 한 줄. 이어 붙일 때는 본문에 섞이므로 따옴표와 화자를 문장에 적는다 */
  const quoteLine = (q: Quote) => `“${q.quote}”${q.who ? ` — ${q.who}` : ''}`

  const appendQuote = (id: string, q: Quote) => {
    setAnnotations((a) => ({
      ...a,
      notes: a.notes.map((n) =>
        n.id === id
          ? { ...n, content: (n.content ? `${n.content}\n\n` : '') + quoteLine(q) }
          : n,
      ),
    }))
    setPicking(null)
    // 토스트는 **어디에 생겼는지만** 말한다. 인용문은 메모장에 영구히 남는다
    setToast('인용이 메모에 추가되었습니다')
  }

  /**
   * 새 메모로. **메모장으로 이동한다** — 인용은 「적을 것이 생겼다」는 뜻이고,
   * 그 자리를 안 열어주면 토스트만 뜨고 사라진 것처럼 보인다.
   */
  const newMemoFromQuote = (q: Quote, withToast = false) => {
    const id = `quote:${Date.now()}`
    setAnnotations((a) => ({
      ...a,
      notes: [
        ...a.notes,
        {
          id,
          content: '',
          quote: q.quote,
          quoteWho: q.who,
          source: q.source,
          targetType: q.targetType,
          target: q.target ?? undefined,
          at: Date.now(),
          context: VIEW_LABEL[view],
        },
      ],
    }))
    setPicking(null)
    setEditing(id)
    setMemoFilter('전체')
    setView('memo')
    if (withToast) setToast('인용이 메모에 추가되었습니다')
  }

  /**
   * 개요·보고서 본문의 인용 — 원본 `quoteBriefToMemo`(2684행).
   *
   * **모으기를 거치지 않는다.** 진술 문장·확보 단어와 달리 여기는 사건 서술을
   * 통째로 떠오는 자리라 원본도 항상 새 메모를 만든다.
   */
  const quoteBrief = (text: string) =>
    newMemoFromQuote(
      { quote: text, source: '확정', targetType: '없음', target: null },
      true,
    )

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  /** 원본 1895행 — 2.2초 뒤 표시가 꺼진다. 계속 켜두면 그게 「여길 봐」가 된다 */
  useEffect(() => {
    if (!hlLog) return
    const t = setTimeout(() => setHlLog(null), 2200)
    return () => clearTimeout(t)
  }, [hlLog])

  /**
   * 「신규」 소멸 — 원본 `setView()`(1825행)가 **용의자 화면을 떠날 때** 부른다.
   *
   * 들어갈 때가 아니라 나갈 때다. 들어가자마자 지우면 카드를 열어보기도 전에
   * 배지가 사라진다.
   */
  const seenRef = useRef<View>(view)
  useEffect(() => {
    const left = seenRef.current === 'suspects' && view !== 'suspects'
    seenRef.current = view
    if (!left) return
    setAnnotations((a) => {
      const ids = progress.investigations.map((iv) => iv.actionId)
      const next = [...new Set([...a.seenClues, ...ids])]
      return next.length === a.seenClues.length ? a : { ...a, seenClues: next }
    })
  }, [view, progress.investigations])

  /** 출처 보기 — 조사 기록으로 뛰고 그 카드를 표시한다 (원본 `goToLog`) */
  const jumpToLog = (actionId: string) => {
    setOpenProfile(null)
    setView('log')
    setHlLog(actionId)
  }

  /** 화면 이름. 메모가 「어디서 적었나」를 남긴다 (원본 `memoMeta`) */
  const VIEW_LABEL: Record<View, string> = {
    overview: '사건 개요', report: '사건 보고서', statements: '진술', map: '현장',
    log: '조사 기록', suspects: '용의자', memo: '메모장', relations: '관계 그래프',
    board: '상황판', reference: '상태 레퍼런스',
    // 원본 `ctxMap`(2685행)에 result 가 없다 — 결말에서 적은 메모는 시각만 남는다
    result: '',
  }

  const addMemo = () => {
    const id = `memo:${Date.now()}`
    setAnnotations((a) => ({
      ...a,
      notes: [
        ...a.notes,
        { id, content: '', targetType: '없음' as const, at: Date.now(), context: VIEW_LABEL[view] },
      ],
    }))
    setEditing(id)
    setMemoFilter('전체')
  }

  /** 인물 상세의 ＋새 메모 — 그 사람을 대상으로 열린다 (원본 `addMemoForPerson`, 1872행) */
  const addMemoForPerson = (pid: string) => {
    const id = `memo:${Date.now()}`
    setAnnotations((a) => ({
      ...a,
      notes: [
        ...a.notes,
        {
          id, content: '', targetType: '인물' as const, target: pid,
          at: Date.now(), context: VIEW_LABEL[view],
        },
      ],
    }))
    setEditing(id)
    setMemoFilter('전체')
  }

  /** 대상 지정. 종류를 바꾸면 대상도 함께 바뀐다 — 「인물: 물자국」이 남지 않도록 */
  const setMemoTarget = (id: string, targetType: TargetType, target: string | null) =>
    setAnnotations((a) => ({
      ...a,
      notes: a.notes.map((n) =>
        n.id === id ? { ...n, targetType, target: target ?? undefined } : n,
      ),
    }))

  /** 인용 모으기 토글. 켠 것이 둘 이상이면 다음 인용부터 어디에 담을지 묻는다 */
  const toggleMemoPin = (id: string) =>
    setAnnotations((a) => ({
      ...a,
      notes: a.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
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

  const deleteMemo = (id: string) => {
    setAnnotations((a) => ({ ...a, notes: a.notes.filter((n) => n.id !== id) }))
    setEditing((e) => (e === id ? null : e))
  }

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

  /**
   * 최종 제출 — 원본 `finishReport()`(2029행).
   *
   * **화면만 바꾼다.** 원본도 `view: 'result'` 하나뿐이다 — 사이드바는 살아 있고,
   * 결말을 본 뒤 보고서로 돌아가 무엇을 어떻게 적었는지 다시 볼 수 있다.
   *
   * ★ 제출은 클리어를 정하지 않는다 ★ 원본 `caseStatus()` 는 `allSealed()` 하나만
   * 본다 — **다섯 장을 다 채우면 그 순간 클리어**이고, 제출은 조서를 닫는 행위다.
   * 그래서 상태 전이는 아래 자동 완성 자리에 있다.
   */
  const finish = () => {
    setProgress((p) => ({ ...p, clearedAt: Date.now() }))
    setAsk(null)
    setView('result')
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
    if (filled)
      setProgress((p) => {
        const solved = [...p.solved, idx]
        // 마지막 장이 차면 그 자리에서 클리어다 (원본 `caseStatus()` = `allSealed()`).
        // **정답 여부는 보지 않는다** — 틀린 채로도 조서는 완성된다
        return {
          ...p,
          solved,
          status: solved.length === c.chapters.length ? 'cleared' : p.status,
        }
      })
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
          onConfirm={finish}
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

      {/* 인물 상세 — 원본 1171~1218행. 조사 확인 모달(95)보다 아래(90)에 뜬다 */}
      {openProfile && (() => {
        const i = c.people.findIndex((p) => p.id === openProfile)
        if (i < 0) return null
        return (
          <SuspectDetail
            c={c}
            person={c.people[i]}
            index={i}
            progress={progress}
            annotations={annotations}
            facts={facts}
            actions={actionsForPerson(openProfile)}
            onVerdict={setVerdict}
            onAddMemo={addMemoForPerson}
            onJump={jumpToLog}
            onAsk={setPending}
            onClose={() => setOpenProfile(null)}
          />
        )
      })()}

      {result && <ResultCard a={result} onClose={() => setResult(null)} />}

      {/* 인용 피커 — 원본 1257~1266행. 확보 단어 다이얼로그 위에 뜬다 */}
      {picking && (
        <QuotePicker
          notes={annotations.notes}
          onPick={(id) => appendQuote(id, picking)}
          onNew={() => newMemoFromQuote(picking)}
          onCancel={() => setPicking(null)}
        />
      )}

      {toast && <Toast message={toast} />}
    </>
  )

  /** 이 사람을 대상으로 한 조사와 그 상태. 카드와 상세 모달이 같이 쓴다 */
  function actionsForPerson(pid: string) {
    if (!c) return []
    const used = new Set(progress.investigations.map((iv) => iv.actionId))
    const left = c.budget - progress.actionsUsed
    return c.actions
      .filter((a) => a.target?.kind === 'person' && a.target.id === pid)
      .map((a) => ({ action: a, state: actionState(c, a, used, left, progress.solved.length) }))
  }

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
          /* 원본 `reviewCase()`(2030행) — 자유 진행의 결말 화면으로 바로 */
          onReview={() => { setView('result'); setRoute('play') }}
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
          editing={editing}
          onEditing={setEditing}
          /* 결말의 제목은 채점 결과다 — 지목이 맞았나 하나로 갈린다 (원본 2254행) */
          heading={
            view === 'result'
              ? {
                title: scoreCase(c, progress, (v) => v).accused ? '사건의 전말' : '미완의 조서',
                sub: '',
              }
              : undefined
          }
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
              onQuote={quoteBrief}
            />
          )}
          {view === 'suspects' && (
            <Suspects
              c={c}
              progress={progress}
              facts={facts}
              annotations={annotations}
              onVerdict={setVerdict}
              onOpen={setOpenProfile}
              actionsFor={actionsForPerson}
              onAsk={setPending}
            />
          )}
          {view === 'log' && (
            <InvestigationLog c={c} progress={progress} onAsk={setPending} highlight={hlLog} />
          )}
          {view === 'relations' && (
            <Relations c={c} progress={progress} onAsk={setPending} />
          )}
          {view === 'board' && (
            <BoardView
              c={c}
              progress={progress}
              terms={terms}
              facts={facts}
              annotations={annotations}
              onBoard={(board) => setAnnotations((a) => ({ ...a, board }))}
            />
          )}
          {view === 'reference' && <Reference />}
          {view === 'result' && (
            <Result c={c} progress={progress} onHome={() => setRoute('home')} />
          )}
          {view === 'memo' && (
            <Memo
              c={c}
              annotations={annotations}
              terms={terms}
              editing={editing}
              onEditing={setEditing}
              onAdd={addMemo}
              onEdit={editMemo}
              onDelete={deleteMemo}
              onTarget={setMemoTarget}
              onPin={toggleMemoPin}
              filter={memoFilter}
              onFilter={setMemoFilter}
              sort={memoSort}
              onSort={setMemoSort}
              query={memoQuery}
              onQuery={setMemoQuery}
            />
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
              onQuote={(q, person, pid) =>
                routeQuote({ quote: q, who: person, source: '주장', targetType: '진술', target: pid })}
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
              onQuote={(q, term) =>
                routeQuote({ quote: q, source: '확정', targetType: '물증', target: term })}
            />
          )}
        </Shell>
      )
    }
  }
}
