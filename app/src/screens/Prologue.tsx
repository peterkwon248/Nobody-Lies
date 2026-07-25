import type { Case } from '@engine/types'
import { Reader } from '../components/Reader'
import { TopBar } from '../components/TopBar'
import { ko } from '../case/loadCase'

/**
 * 프롤로그 — 진입 흐름 1단계.
 *
 * **새 정보는 0이다.** 프롤로그는 브리핑과 진술에 이미 존재하는 사실만 다룬다
 * (`design-brief.md` §프롤로그 절대 규칙). 분위기를 위해 한 줄을 더하면 조사로
 * 얻어야 할 정보가 무료로 풀리고 검증기가 계산한 난이도가 무너진다.
 *
 * 그 규칙은 **사건 파일**이 지킨다. 이 화면은 담긴 것을 그대로 읽을 뿐이다.
 */
export function Prologue({ c, onDone }: { c: Case; onDone: () => void }) {
  // 프롤로그가 없는 사건도 있다(일일 사건 등). 흐름을 막지 않는다
  const paragraphs = (c.prologue ?? []).map(ko).filter(Boolean)
  const body = paragraphs.length ? paragraphs : [c.incident.description]

  return (
    <div className="nl-fs">
      <TopBar title={c.title} />
      <div className="nl-fs-body">
        <Reader kicker={c.title} paragraphs={body} onDone={onDone} doneLabel="계속" />
      </div>
    </div>
  )
}
