#!/usr/bin/env node
/**
 * 테스터용 **단일 HTML** 조립기.
 *
 * `vite.single.config.ts` 가 뽑은 `app/dist-single/{app.js,app.css}` 에
 * 디자인 시스템(CSS 다섯 장 + 번들 JS)과 사건 JSON 을 합쳐 파일 하나로 만든다.
 * 결과물은 **더블클릭하면 도는 게임**이다 — 서버도 인터넷도 필요 없다.
 *
 * ## 번들러가 못 잡는 둘
 *
 * 앱은 두 가지를 **런타임에 네트워크로** 가져온다. 정적 분석에 안 잡히므로
 * 여기서 가로챌 조각을 심는다.
 *
 *   1. `_ds_bundle.js`  `main.jsx` 가 `<script src=…>` 를 만들어 head 에 붙인다.
 *      → `appendChild` 를 감싸 같은 자리에서 **인라인 스크립트로 바꿔 실행**한다.
 *        순서가 중요하다: `main.jsx` 는 붙이기 전에 `createRoot` 를 빈 것으로
 *        바꿔두고(번들 끝에 자기 앱 마운트가 들어 있다) `onload` 에서 되돌린다.
 *        인라인 스크립트는 삽입 즉시 동기 실행되므로 그 사이에 들어간다.
 *
 *   2. `/cases/<id>.json`  `main.jsx` 의 `loadCase()` 가 `fetch` 한다.
 *      → `fetch` 를 감싸 내장 사건으로 답한다. **못 받으면 앱은 조용히
 *        하드코딩 값으로 도는데**, 그건 엔진 정본보다 낡았다(영문이 옛 이름으로
 *        렌더되던 결함이 그 경로였다). 그래서 폴백에 기대지 않고 심는다.
 *
 * ## 왜 문자열 리터럴이 아니라 `<script type="text/plain">` 인가
 *
 * 62만 자 JS 를 JS 문자열로 넣으려면 escape 를 한 벌 더 씌워야 하고, 한 군데만
 * 어긋나도 조용히 다른 코드가 된다. 태그 안에 원문 그대로 두고 `textContent` 로
 * 읽으면 escape 대상이 `</script` 하나뿐이다.
 *
 * 사용: node scripts/bundle-single.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'app', 'dist-single')
const PUB = join(ROOT, 'app', 'public')
const DS = '_ds/vector-design-system-490b734e-7df2-4af7-b176-9c91211b1ef6'
const OUT = join(ROOT, 'out', 'nobody-lies-tester.html')

/** 이 사건을 담는다. 늘리려면 여기 이름을 더한다 — `?case=<이름>` 으로 열린다 */
const CASES = ['mountain-lodge']

const read = (p) => {
  if (!existsSync(p)) {
    console.error(`\n  없다: ${p}\n  먼저 'npm run tester' 로 돌려라 (빌드가 앞에 붙어 있다)\n`)
    process.exit(1)
  }
  return readFileSync(p, 'utf8')
}

/**
 * `</script` 만 막으면 된다. JS·JSON 둘 다 `<\/script` 를 같은 뜻으로 읽으므로
 * 내용은 바뀌지 않는다.
 */
const safe = (s) => s.replace(/<\/script/gi, '<\\/script')

// ── 디자인 시스템 스타일 다섯 장 (index.html 이 `<link>` 로 걸던 그 순서) ──
const DS_CSS = [
  `${DS}/colors_and_type.css`,
  `${DS}/ui_kits/app/app.css`,
  `${DS}/ui_kits/app/sidebar-hover-actions.css`,
  `${DS}/ui_kits/app/numeric-typography.css`,
  `${DS}/styles.css`,
].map((f) => read(join(PUB, f))).join('\n')

const APP_CSS = read(join(DIST, 'app.css'))
const APP_JS = read(join(DIST, 'app.js'))
const DS_JS = read(join(PUB, `${DS}/_ds_bundle.js`))
const MARK = read(join(PUB, 'mark.svg'))

const caseTags = CASES.map((id) =>
  `<script type="application/json" data-case="${id}">${safe(read(join(PUB, `cases/${id}.json`)))}</script>`,
).join('\n')

/**
 * 절대 경로가 남아 있으면 `file://` 에서 조용히 404 가 나고, 앱은 폴백으로
 * 계속 돈다 — **화면이 조금 다른 채로.** 조립 전에 센다.
 *
 * 둘은 예외다. 위 조각이 가로채는 자리라 번들에 남아 있는 것이 정상이고,
 * **사라지면 오히려 조각이 헛돌고 있다는 뜻**이다.
 */
const HOOKED = [/_ds_bundle\.js$/, /^\/cases\/$/]
const leaks = [...new Set([...APP_JS.matchAll(/["'](\/(?:assets|cases|_ds|mark)[^"']*)["']/g)].map((m) => m[1]))]
const unhandled = leaks.filter((l) => !HOOKED.some((re) => re.test(l)))
const missing = HOOKED.filter((re) => !leaks.some((l) => re.test(l)))

if (unhandled.length) {
  console.error(`\n  ✗ 번들에 절대 경로가 남았다 (${unhandled.length}건) — file:// 에서 못 받는다`)
  for (const l of unhandled.slice(0, 10)) console.error(`    ${l}`)
  process.exit(1)
}
if (missing.length) {
  console.error(`\n  ✗ 가로챌 자리가 번들에 없다 (${missing.length}건) — 조각이 헛돈다`)
  for (const re of missing) console.error(`    ${re}`)
  console.error('    main.jsx 가 경로를 바꿨는지 본다\n')
  process.exit(1)
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#08090A">
<title>노바디 라이즈 — 산장 살인사건</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${Buffer.from(MARK).toString('base64')}">

<!-- 디자인 시스템 토큰·스타일 -->
<style>${DS_CSS}</style>
<!-- 앱 스타일 -->
<style>${APP_CSS}</style>

<!-- 런타임에 네트워크로 받던 것들. 아래 조각이 여기서 꺼내 쓴다 -->
<script type="text/plain" data-ds-bundle>${safe(DS_JS)}</script>
${caseTags}

<script>
/**
 * 단일 파일용 조각. 모듈 스크립트는 defer 라 이 클래식 스크립트가 먼저 돈다.
 */
(function () {
  var pick = function (sel) { var el = document.querySelector(sel); return el ? el.textContent : null; };

  // ── 사건 파일 — fetch('/cases/<id>.json') 에 내장 값으로 답한다 ──
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = String(input && input.url ? input.url : input);
    var m = url.match(/cases\\/([A-Za-z0-9_-]+)\\.json$/);
    if (m) {
      var body = pick('script[data-case="' + m[1] + '"]');
      if (body) {
        return Promise.resolve(new Response(body, {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }));
      }
    }
    return origFetch ? origFetch(input, init)
      : Promise.reject(new Error('이 파일에 없는 사건이다: ' + url));
  };

  // ── 디자인 시스템 번들 — <script src> 를 인라인 실행으로 바꾼다 ──
  var origAppend = document.head.appendChild.bind(document.head);
  document.head.appendChild = function (node) {
    var src = node && node.tagName === 'SCRIPT' ? String(node.src || node.getAttribute('src') || '') : '';
    if (src.indexOf('_ds_bundle.js') === -1) return origAppend(node);
    var el = document.createElement('script');
    el.textContent = pick('script[data-ds-bundle]');
    origAppend(el);                                   // 클래식 스크립트라 삽입 즉시 동기 실행
    setTimeout(function () { if (node.onload) node.onload(); }, 0);
    return node;
  };
})();
</script>
</head>
<body>
<div id="root"></div>
<script type="module">${safe(APP_JS)}</script>
</body>
</html>
`

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, html, 'utf8')

const mb = (statSync(OUT).size / 1024 / 1024).toFixed(2)
console.log(`\n  ✓ ${OUT.replace(ROOT + '\\', '').replace(ROOT + '/', '')}  ${mb} MB  ·  사건 ${CASES.length}건`)
console.log(`    더블클릭하면 돈다 — 서버·인터넷 필요 없음. 진행은 브라우저에 저장된다\n`)
