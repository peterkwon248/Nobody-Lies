#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────
 *  서식 기준선 대조기 — `npm run brief-check`
 * ─────────────────────────────────────────────────────────────
 *
 * **서식은 문서가 아니라 프롬프트다.** `PROSE-BRIEF.md` · `STATEMENT-BRIEF.md` 의
 * 복사 구간은 사용자의 챗봇에 그대로 붙는다(`MANIFESTO.md` §8). 그래서 그 안의
 * 숫자가 낡으면 **사용자가 받는 산문 품질이 직접 나빠진다** — 실제로 그랬다:
 * 2026-07-30에 서식이 「문단당 100~170자」라는 틀린 숫자를 들고 있었고,
 * 첫 완성본이 **레퍼런스가 아니라 그 틀린 숫자를 따라** 86~131자로 나왔다.
 *
 * ## 두 단이다
 *
 * ```
 * ① 기준선이 아직 참인가   산장을 다시 재서 voice-ref.json 과 대조
 * ② 서식이 그 값을 드나     복사 구간의 손으로 적은 숫자를 ref 와 대조
 * ```
 *
 * ①이 없으면 **서식과 ref 가 사이좋게 같이 낡는다.** 재는 함수는
 * `voice-check.mjs` 에서 가져온다 — 두 벌이 되면 반드시 갈라진다.
 *
 * ## 왜 `{{ratio}}` 치환이 아닌가 (2026-08-01 사용자 결정)
 *
 * 서식에 자리표시를 넣으면 진짜 단일 출처가 되지만, **파일을 그냥 열어 읽는
 * 사람에게 숫자 대신 `{{ratio}}` 가 보인다.** 그리고 치환을 안 거치는 경로
 * (파일을 직접 복붙)에서는 서식이 망가진 채로 나간다. 그래서 파일은 그대로 두고
 * **어긋날 때만 기계가 문다.**
 *
 * ## 복사 구간만 본다
 *
 * `Generator.jsx` 의 `copyBlock` 과 **같은 표시**(`⬇ 여기서부터 복사` ·
 * `⬆ 여기까지 복사`)로 자른다. 구간 밖의 §고친 이력은 **일부러 낡은 숫자를
 * 인용**하는 자리다 — 거기를 검사하면 검사가 거짓말이 된다.
 *
 * 뒤집으면 이 검사는 규칙 하나를 덤으로 지킨다:
 * *「옛 문구를 복사 구간 안에 인용해두면 안 된다」* (`STATEMENT-BRIEF.md` §고친 이력 ·
 * `PROSE-BRIEF.md` §문단 수 규격의 이력). 낡은 숫자를 구간 안에 남기면 **여기서 걸린다.**
 *
 * ## 양방향으로 문다
 *
 * 값이 어긋나도 실패하고, **닻(anchor)을 못 찾아도 실패한다.** 서식을 고쳐 쓰면서
 * 그 줄이 사라지면 검사는 조용히 0건을 세고 초록이 될 텐데, 그게 `port-check` 의
 * `staleAllow` 가 반대로도 무는 이유와 같다 — **안 보는 검사는 없는 검사다.**
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { measure, loadCase } from './voice-check.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TPL = join(ROOT, 'engine', 'templates')
const REF = JSON.parse(readFileSync(join(TPL, 'voice-ref.json'), 'utf8'))

const PROSE = 'PROSE-BRIEF.md'
const STMT = 'STATEMENT-BRIEF.md'

/**
 * 닻 표. **파일마다 따로 적는다** — 같은 값이 파일마다 다른 문장에 앉아 있어서
 * 한 정규식으로 둘을 덮으려 하면 엉뚱한 숫자를 문다(`(중앙값) · 209~514` 에서
 * `209` 를 중앙값으로 읽는 부류).
 *
 * `n` 은 **그 파일 복사 구간에서 기대하는 등장 횟수**다. 적은 것보다 적게 나오면
 * 서식이 바뀐 것이니 이 표도 같이 고쳐야 한다 — 그때 실패로 알린다.
 */
const CHECKS = [
  // ── 최장/최단 ────────────────────────────────────────────
  { file: PROSE, label: '최장/최단', n: 2, keys: ['ratio'], unit: '배',
    re: /최장\/최단[^\d\n]*?([\d.]+)\s*배/g },
  { file: STMT, label: '최장/최단', n: 3, keys: ['ratio'], unit: '배',
    re: /최장\/최단[^\d\n]*?([\d.]+)\s*배/g },

  // ── 문단당 글자 ──────────────────────────────────────────
  { file: PROSE, label: '문단당 글자', n: 1, keys: ['paraLo', 'paraHi'], unit: '자',
    re: /문단당[^\d\n]*?(\d+)\s*~\s*(\d+)\s*자/g },
  { file: STMT, label: '문단당 글자', n: 2, keys: ['paraLo', 'paraHi'], unit: '자',
    re: /문단당[^\d\n]*?(\d+)\s*~\s*(\d+)\s*자/g },

  // ── 중앙값 ── 앞뒤 어순이 파일마다 다르다 ────────────────
  { file: PROSE, label: '중앙값', n: 1, keys: ['median'], unit: '자',
    re: /(\d+)\s*자\s*\*{0,2}\s*\(\s*중앙값/g },
  { file: STMT, label: '중앙값', n: 1, keys: ['median'], unit: '자',
    re: /중앙값[^\S\n]{0,2}(\d+)/g },

  // ── 인물당 글자 폭 ───────────────────────────────────────
  { file: PROSE, label: '인물당 글자', n: 1, keys: ['charLo', 'charHi'], unit: '자',
    re: /\(\s*중앙값\s*\)[^\d\n]*?(\d+)\s*~\s*(\d+)/g },
  { file: STMT, label: '인물당 글자', n: 1, keys: ['charLo', 'charHi'], unit: '자',
    re: /(\d+)\s*~\s*(\d+)\s*자\s*\(\s*중앙값/g },

  // ── 아래 넷은 STATEMENT 의 실측 표에만 있다 ──────────────
  { file: STMT, label: '서로를 부른 사람', n: 1, keys: ['callers', 'people'], unit: '명',
    re: /서로를 부른 사람[^\d\n]*?(\d+)\s*\/\s*(\d+)/g },
  { file: STMT, label: '호칭', n: 1, keys: ['honor'], unit: '회',
    re: /호칭[^\d\n]*?(\d+)\s*회/g },
  { file: STMT, label: '물음표', n: 1, keys: ['question'], unit: '회',
    re: /물음표[^\d\n]*?(\d+)\s*회/g },
  { file: STMT, label: '끝맺음', n: 1, keys: ['endings', 'endingMax'], unit: '종',
    re: /끝맺음[^\d\n]*?(\d+)\s*종\s*\(\s*(\d+)\s*종/g },
]

/** `Generator.jsx` 의 `copyBlock` 과 같은 규칙. 줄 번호를 살리려고 줄로 자른다 */
function copyRegion(lines, file) {
  const s = lines.findIndex((l) => /^⬇ 여기서부터 복사/.test(l))
  const e = lines.findIndex((l) => /^⬆ 여기까지 복사/.test(l))
  if (s < 0 || e < 0 || e <= s) {
    throw new Error(`${file}: 복사 구간 표시(⬇/⬆)를 못 찾았다 — Generator.jsx 가 읽는 그 표시다`)
  }
  return { from: s + 1, to: e }   // 0-기반, to 는 배타
}

const fail = []
const note = []

// ── ① 기준선이 아직 참인가 ────────────────────────────────
const LODGE = join(ROOT, 'engine', 'cases', 'mountain-lodge.yaml')
const m = measure(loadCase(LODGE))
if (!m) {
  fail.push('mountain-lodge.yaml 에 진술이 없다 — 기준선을 잴 수 없다')
} else {
  for (const k of ['ratio', 'median', 'paraLo', 'paraHi', 'charLo', 'charHi',
                   'callers', 'honor', 'question', 'endings']) {
    if (m[k] !== REF[k]) {
      fail.push(`voice-ref.json 의 ${k} = ${REF[k]} 인데 산장 실측은 ${m[k]} 다\n` +
                '      → 손으로 고치지 말고 npm run voice-check 로 재서 맞춘다')
    }
  }
  if (m.total !== REF.people) {
    fail.push(`voice-ref.json 의 people = ${REF.people} 인데 산장은 ${m.total}명이다`)
  }
  /**
   * ⚠ **어긋났는데 「같다」고 인쇄하면 안 된다.** 첫 판이 그랬다 — 심어서 확인할 때
   * ref 를 낡게 만들었더니 실패를 내면서 동시에 「기준선이 같다」를 찍었다.
   * `voice-ref.json` 의 `endings` 5→4 정정이 **기준선을 말하는 줄이 기준선을 틀리게
   * 말한** 일이었는데, 그것을 막으려고 만든 도구가 같은 짓을 했다.
   */
  if (!fail.length) note.push(`기준선 — 산장 ${m.total}명 실측이 voice-ref.json 과 같다`)
}

// ── ② 서식이 그 값을 드나 ─────────────────────────────────
let hits = 0
for (const file of [PROSE, STMT]) {
  const lines = readFileSync(join(TPL, file), 'utf8').split(/\r?\n/)
  const { from, to } = copyRegion(lines, file)

  for (const c of CHECKS.filter((c) => c.file === file)) {
    let found = 0
    for (let i = from; i < to; i++) {
      c.re.lastIndex = 0
      for (const g of lines[i].matchAll(c.re)) {
        found++
        c.keys.forEach((key, j) => {
          const got = Number(g[j + 1])
          // 적힌 그대로 인쇄한다 — `Number('2.50')` 은 2.5 라 파일에 없는 글자가 된다
          if (got !== REF[key]) {
            fail.push(`${file}:${i + 1}  ${c.label} — 서식은 ${g[j + 1]}${c.unit}, ` +
                      `voice-ref.json 의 ${key} 는 ${REF[key]}${c.unit} 다\n` +
                      `      ${lines[i].trim().slice(0, 78)}`)
          }
        })
      }
    }
    hits += found
    if (found < c.n) {
      fail.push(`${file}  ${c.label} — 복사 구간에서 ${c.n}곳을 기대했는데 ${found}곳이다\n` +
                '      서식을 고쳐 썼으면 scripts/brief-check.mjs 의 CHECKS 표도 같이 고친다\n' +
                '      (안 보는 검사는 없는 검사다 — 그래서 못 찾아도 실패한다)')
    }
  }
}

console.log('')
for (const n of note) console.log(`  · ${n}`)
if (fail.length) {
  for (const f of fail) console.log(`\n  ✗ ${f}`)
  console.log(`\n✗ 서식 기준선 어긋남 ${fail.length}건\n`)
  process.exit(1)
}
console.log(`\n✓ 서식이 든 기준선 숫자 ${hits}곳 — voice-ref.json 과 같다 (복사 구간만)\n`)
