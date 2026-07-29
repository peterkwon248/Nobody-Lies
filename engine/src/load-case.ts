import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { parseCase } from './schema.js'
import type { Case } from './types.js'

/**
 * 사건 파일을 **디스크에서** 읽어 `Case` 로 만든다.
 *
 * ★ 왜 `schema.ts` 에서 나왔나 ★ (2026-07-29)
 *
 * 이 함수 하나 때문에 `schema.ts` 가 `node:fs` 를 물고 있었고, 그래서
 * **파싱기 전체가 브라우저에 못 들어갔다.** `parseCase` 자체는 이미 파싱된
 * 객체를 받는 순수 함수인데 같은 파일에 살았다는 이유로 같이 막혔다.
 *
 * 걸린 자리 — 생성기의 **YAML 내보내기**다. 엔진은 방출할 때마다 쓴 것을
 * 다시 읽어 원본과 대조하는데(`cli.ts --emit --yaml`), 앱에서 `parseCase` 를
 * 못 부르면 **앱의 내보내기만 그 대조 없이** 나간다. 같은 파일이 경로에 따라
 * 다른 보증을 갖는 것은 이 저장소가 반복해서 비싸게 물린 형태다
 * (*"같은 판정 로직이 두 벌 있으면 반드시 갈라진다"*).
 *
 * 그래서 **읽는 일(Node)과 해석하는 일(순수)을 갈랐다.** `schema.ts` 는 이제
 * `./types.js` 만 import 하고 브라우저에서 그대로 돈다.
 */
export function loadCaseFile(path: string): Case {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    throw new Error(`사건 파일을 열 수 없다: ${path}`)
  }
  return parseCase(load(text), path)
}
