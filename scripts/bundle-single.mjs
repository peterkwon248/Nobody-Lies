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
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'app', 'dist-single')
const PUB = join(ROOT, 'app', 'public')
const DS = '_ds/vector-design-system-490b734e-7df2-4af7-b176-9c91211b1ef6'
const OUT = join(ROOT, 'out', 'nobody-lies-tester.html')

/**
 * 담을 사건. **`engine/cases/*.yaml` 이 정본 목록이다 — 손으로 적지 않는다.**
 *
 * ★ 여기 `['mountain-lodge']` 한 줄이 박혀 있었다 ★ (2026-07-31)
 * 사건이 넷이 된 뒤에도 그대로라 **테스터에게는 산장 하나만 나갔다.** 번들러는
 * 원래부터 N건을 담게 만들어져 있었고(사건마다 `<script data-case>` + fetch 가로채기)
 * **목록만 안 자랐다.** 「늘리려면 여기 이름을 더한다」는 주석이 그걸 사람에게
 * 맡겼는데, 사람이 잊었다. 이제 파일이 곧 목록이다.
 */
const CASES = readdirSync(join(ROOT, 'engine', 'cases'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => f.replace(/\.yaml$/, ''))
  .sort()

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
const DS_CSS_RAW = [
  `${DS}/colors_and_type.css`,
  `${DS}/ui_kits/app/app.css`,
  `${DS}/ui_kits/app/sidebar-hover-actions.css`,
  `${DS}/ui_kits/app/numeric-typography.css`,
  `${DS}/styles.css`,
].map((f) => read(join(PUB, f))).join('\n')

const APP_CSS_RAW = read(join(DIST, 'app.css'))
const APP_JS = read(join(DIST, 'app.js'))
const DS_JS = read(join(PUB, `${DS}/_ds_bundle.js`))
const MARK = read(join(PUB, 'mark.svg'))

/**
 * ─────────────────────────────────────────────────────────────────
 *  바깥 호스트 — **「인터넷 필요 없음」을 참으로 만드는 자리** (2026-07-30)
 * ─────────────────────────────────────────────────────────────────
 *
 * 아래 절대경로 검사는 **`/` 로 시작하는 것만** 보고 `https://` 는 안 봤다.
 * 그래서 DS 스타일의 `@import url("https://cdn.jsdelivr.net/…pretendard…")`
 * 가 **초록불 아래로 그대로 통과했고**, 이 파일이 두 줄(7행·아래 완료 문구)에서
 * *"서버·인터넷 필요 없음"* 이라고 말하는 동안 **폰트 하나를 네트워크로 받고
 * 있었다.** 검사가 못 보는 부류가 있으면 초록불의 뜻이 줄어든다.
 *
 * ★ 세어보니 「CDN 둘」이 아니라 **하나**였다 ★ `docs/NEXT-ACTION.md` 가
 * `code.iconify.design` 도 물고 있다고 적었는데, 실측하면 그것은 DS 번들
 * **주석 안의 안내문**(`// <script src="…iconify-icon.min.js"></script>`)이다.
 * `api.vector.app`·`idp.example.com`·`vector.app` 셋도 DS 데모 화면의
 * placeholder·`<code>` 문자열이다. **넷 다 요청을 만들지 않는다** — `fetch(`·
 * `import(`·`.src=` 어디에도 안 붙어 있는 것을 확인했다.
 *
 * 그래서 **CSS 만 본다.** CSS 의 `url(...)` 은 그 자체로 요청이고, JS 의
 * `https://` 는 대개 글자다 — JS 까지 훑으면 위 넷이 매번 걸려서 **검사가
 * 거짓말이 된다**(검증기 §9-3e 를 경고로 내린 것과 같은 판단).
 */
const EXT_URL = /url\(\s*["']?(https?:\/\/[^"')\s]+)["']?\s*\)/gi
const stripped = []
/**
 * 바깥 `@import` 를 뺀다. **빼는 이유**: 오프라인에서는 이 요청이 조용히 실패하고
 * 폰트가 폴백으로 떨어진다 — 즉 **지금도 이미 폴백으로 렌더된다.** 요청만 남아
 * 있어서 「인터넷 필요 없음」이 거짓이었을 뿐이다. 빼면 그 문장이 참이 되고
 * 렌더가 **온·오프라인에서 같아진다**(조용히 갈리지 않는다).
 *
 * 폴백 스택은 한글까지 덮는다 — `Apple SD Gothic Neo`(iOS·macOS) ·
 * `Malgun Gothic`(Windows). Pretendard 와 자모 폭이 다르지만 깨지지 않는다.
 *
 * ⚠ **Vercel 로 나가는 앱은 안 건드린다** — 이 파일은 단일 HTML 조립기뿐이고,
 * `app/dist` 와 `app/public` 의 CSS 는 그대로다. 온라인 배포본은 Pretendard 를
 * 계속 받는다.
 */
const stripExternalImports = (css) =>
  css.replace(/@import\s+url\(\s*["']?(https?:\/\/[^"')\s]+)["']?\s*\)\s*;/gi, (_m, u) => {
    stripped.push(u)
    return `/* 단일 HTML: 바깥 @import 를 뺐다 (오프라인) — ${u} */`
  })

const DS_CSS = stripExternalImports(DS_CSS_RAW)
const APP_CSS = stripExternalImports(APP_CSS_RAW)

/**
 * 빼고 나서 **다시 센다.** `@import` 말고도 `src: url(https://…)`(@font-face) ·
 * `background: url(https://…)` 이 남을 수 있고, 그것들은 위 치환이 안 건드린다.
 * 남았으면 **조립을 멈춘다** — 지금까지 이 부류가 통과한 이유가 검사의 부재였다.
 */
const extLeft = [...new Set(
  [...DS_CSS.matchAll(EXT_URL), ...APP_CSS.matchAll(EXT_URL)].map((m) => m[1]),
)]
if (extLeft.length) {
  console.error(`\n  ✗ 스타일이 바깥 호스트를 물고 있다 (${extLeft.length}건) — 「인터넷 필요 없음」이 거짓이 된다`)
  for (const u of extLeft) console.error(`    ${u}`)
  console.error('    @import 면 자동으로 빠진다. @font-face 의 src 나 background 면 파일을 받아 data: 로 심어야 한다\n')
  process.exit(1)
}

/**
 * `index` 도 같이 싣는다 — 홈 목록이 `fetch('/cases/index.json')` 으로 읽는다.
 * 아래 fetch 가로채기가 `cases/<이름>.json` 을 통째로 받으므로 **같은 길로 지나간다**.
 * 안 실으면 브라우저에서는 홈에 넷이 뜨고 **테스터 파일에서만 하나가 뜬다.**
 */
const caseTags = [...CASES, 'index'].map((id) =>
  `<script type="application/json" data-case="${id}">${safe(read(join(PUB, `cases/${id}.json`)))}</script>`,
).join('\n')

/**
 * 절대 경로가 남아 있으면 `file://` 에서 조용히 404 가 나고, 앱은 폴백으로
 * 계속 돈다 — **화면이 조금 다른 채로.** 조립 전에 센다.
 *
 * 둘은 예외다. 위 조각이 가로채는 자리라 번들에 남아 있는 것이 정상이고,
 * **사라지면 오히려 조각이 헛돌고 있다는 뜻**이다.
 */
/**
 * `/cases/index.json` 이 셋째다 (2026-07-31 · 홈 목록).
 *
 * 앞의 `/cases/` 는 `'/cases/' + name + '.json'` 처럼 **조립되는** 접두라 조각으로
 * 남는데, 홈 목록은 `fetch('/cases/index.json')` 이라 **경로가 통째로** 남는다.
 * 가로채기 정규식(`cases\/([A-Za-z0-9_-]+)\.json`)이 `index` 를 그대로 받고
 * 위 `caseTags` 가 `data-case="index"` 를 싣는다 — **가로채는 자리라 남는 게 정상**이다.
 *
 * 이 목록이 **양방향으로 문다**: 선언했는데 번들에 없으면 그것도 실패다
 * (`missing`). 조각이 헛도는 것을 그렇게 잡는다.
 */
const HOOKED = [/_ds_bundle\.js$/, /^\/cases\/$/, /^\/cases\/index\.json$/]
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
console.log(`    더블클릭하면 돈다 — 서버·인터넷 필요 없음. 진행은 브라우저에 저장된다`)
/**
 * **뺀 것을 말한다.** 조용히 빼면 「초록불의 뜻이 줄어드는」 그 부류를 내가
 * 다시 만드는 것이다 — 다음 사람은 테스터 화면의 글꼴이 배포본과 다른 이유를
 * 모른 채 찾게 된다.
 */
if (stripped.length) {
  console.log(`    글꼴: 바깥 @import ${stripped.length}건을 뺐다 → 시스템 한글 글꼴로 렌더된다`)
  for (const u of stripped) console.log(`      ${u}`)
  console.log(`      (Vercel 배포본은 그대로 Pretendard 를 받는다. 테스터 파일만 다르다)`)
}
console.log('')
