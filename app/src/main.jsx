import React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

/**
 * Vector 디자인 시스템 번들은 `React`·`ReactDOM` 을 **전역으로** 찾는다.
 *
 * DC export 의 `standalone.html` 은 CDN React 를 쓰므로 전역이 저절로 생기지만,
 * Vite 는 React 를 ES 모듈로 넣기 때문에 `window.React` 가 없다. 그리고
 * **번들은 모듈 최상단에서 React 를 참조한다** — `<head>` 에서 먼저 실행되면
 * 그 자리에서 컴파일에 실패하고 `ds.Button` 이 `undefined` 가 된다.
 * 래퍼가 조용히 민 `<button>` 으로 폴백하므로 **에러 없이 브라우저 기본
 * 흰 버튼이 나온다** — `ds.__errors` 를 들여다보기 전엔 단서가 없다.
 *
 * 그래서 전역을 먼저 심고, 번들은 여기서 직접 불러온다.
 * (`index.html` 의 `<script>` 태그는 그래서 지웠다. CSS 는 그대로 둔다)
 */
window.React = React;
// React 19 는 `createRoot` 를 `react-dom/client` 로 옮겼다. 번들은 옛 자리
// (`ReactDOM.createRoot`)를 보므로 합쳐서 심는다
window.ReactDOM = Object.assign({}, ReactDOM, { createRoot });

const DS_BUNDLE = '/_ds/vector-design-system-490b734e-7df2-4af7-b176-9c91211b1ef6/_ds_bundle.js';

/**
 * 클래식 스크립트라 `import()` 가 아니라 태그로 넣고 기다린다.
 *
 * ⚠ **번들 끝(2283행)에 자기 앱 마운트가 들어 있다.**
 * `ReactDOM.createRoot(document.getElementById("root")).render(<App/>)` —
 * DC export 의 `standalone.html` 은 그 한 줄로 도는 물건이라 그렇다. 우리는
 * 같은 `#root` 를 쓰므로 **두 앱이 겹쳐 렌더된다.** 사이드바 클릭이 죽은 트리로
 * 가고, 콘솔 경고 말고는 단서가 없다(우리 앱은 나중에 그려서 순서 운으로 이긴다).
 *
 * 번들은 재export 로 되돌아오므로 고칠 자리는 여기다. 로드하는 동안만
 * `createRoot` 를 빈 루트로 바꿔 그 한 줄을 삼킨다.
 */
/**
 * 번들은 실패해도 예외를 던지지 않고 `__errors` 에 적어둔다. 조용히 지나가면
 * 화면이 어긋난 채로 돈다 — 콘솔에라도 남긴다.
 *
 * **다만 전부 빨갛게 찍으면 경보가 죽는다.** 2026-07-27 기준 항상 1건이
 * 올라온다 — `ui_kits/app/Panels.jsx` 의 `StatusIcon is not defined`. 진단 결과:
 *
 * 번들은 모듈마다 `try { (() => { … })() }` 로 감싸고 **공유는 `__ds_scope`
 * 하나로만 한다.** 그런데 `ui_kits/app/*` 데모 파일에는 그 구조분해
 * (`const { StatusIcon } = __ds_scope`)를 **한 줄도 안 넣는다.** 그래서 그
 * 파일들의 프리미티브 참조는 전부 미해결 자유 변수다 — `StatusIcon` 을 쓰는
 * 데모가 **13개**인데 그중 `Panels.jsx` 만 터지는 이유는, **모듈 초기화 중에
 * 그 참조를 실제로 평가하는 유일한 파일**이라서다(`statusOpt()` 를 그 자리에서
 * 부른다). 나머지는 함수 안에 있어 렌더될 때까지 안 돈다.
 *
 * **우리 앱과 무관하다.** 우리는 내보내진 프리미티브 8개만 쓰고
 * (`App.jsx` 의 `DS()`) `ui_kits/app/*` 데모는 하나도 렌더하지 않는다.
 * 번들은 재생성 산물이라 거기서 고치면 다음 export 에 사라진다.
 *
 * 그래서 **경로로 가른다** — 우리가 쓰는 `package/src/*` 가 실패하면 진짜
 * 결함이니 `error`, 데모 파일이면 한 줄 `debug` 로 접는다. 새 결함이
 * 데모 소음에 묻히지 않게 하는 것이 목적이다.
 */
function reportDsErrors(errs) {
  if (!errs?.length) return;
  const real = errs.filter((e) => !String(e.path || '').startsWith('ui_kits/app/'));
  const demo = errs.filter((e) => String(e.path || '').startsWith('ui_kits/app/'));
  if (real.length) console.error('[nobody-lies] 디자인 시스템 컴파일 실패:', real);
  if (demo.length) {
    console.debug(
      `[nobody-lies] DS 데모 파일 ${demo.length}건 컴파일 실패 (앱은 안 쓴다):`,
      demo.map((e) => e.path).join(' · '),
    );
  }
}

function loadDesignSystem() {
  return new Promise((resolve) => {
    const real = window.ReactDOM.createRoot;
    window.ReactDOM.createRoot = () => ({ render() {}, unmount() {} });
    const done = () => { window.ReactDOM.createRoot = real; };
    const s = document.createElement('script');
    s.src = DS_BUNDLE;
    s.onload = () => {
      done();
      reportDsErrors(window.VectorDesignSystem_490b73?.__errors);
      resolve();
    };
    s.onerror = () => { done(); console.error('[nobody-lies] 디자인 시스템 번들을 못 읽었다'); resolve(); };
    document.head.appendChild(s);
  });
}

/**
 * 사건 파일. `engine/cases/*.yaml` 을 `npm run case` 가 뽑아 놓은 것이다.
 *
 * **렌더 전에 받는다.** 앱이 클래스 필드로 표를 만들 때 이미 있어야 「엔진 값 →
 * 앱 표」 덮어쓰기가 첫 렌더에 반영된다. 못 받으면 앱에 하드코딩된 값으로 돈다 —
 * 사건 파일이 없다고 게임이 안 열리는 것보다 낫다.
 *
 * ── 어느 사건을 읽나 (2026-07-29) ────────────────────────────────
 *
 *   /              → mountain-lodge (기본)
 *   /?case=gen-7   → /cases/gen-7.json
 *
 * **경로 하나만 읽던 것을 열었다.** 생성 사건을 앱에 물려봐야 무엇이 깨지는지
 * 화면이 알려준다 — 소스를 읽어 추측하면 틀린다(2026-07-29에 두 번 틀렸다).
 *
 * ⚠ 이름은 파일명 조각으로만 쓴다. 경로 구분자와 점을 막아 상위 디렉터리로
 * 새는 것을 차단한다.
 */
const CASE_DEFAULT = 'mountain-lodge';

function caseName() {
  try {
    const raw = new URLSearchParams(window.location.search).get('case');
    if (!raw) return CASE_DEFAULT;
    return /^[A-Za-z0-9_-]+$/.test(raw) ? raw : CASE_DEFAULT;
  } catch {
    return CASE_DEFAULT;
  }
}

function loadCase() {
  const name = caseName();
  return fetch('/cases/' + name + '.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((c) => {
      if (name !== CASE_DEFAULT) console.info('[nobody-lies] 사건 파일:', name);
      return c;
    })
    .catch((e) => {
      console.warn(`[nobody-lies] 사건 '${name}' 을 못 읽었다 — 내장 값으로 돈다:`, e.message);
      return null;
    });
}

/**
 * 에러 경계 — **흰 화면을 문장으로 바꾼다.**
 *
 * 이 저장소가 두 번 데인 자리다. `relChip()` 이 CSS 문자열을 돌려줘서 진술
 * 화면이 통째로 언마운트됐을 때, 그리고 2026-07-29 에 생성 사건을 처음 물렸을
 * 때 — 둘 다 **단서가 「빈 화면」뿐이었다.** 콘솔에는 React 의 「에러 경계를
 * 고려하라」는 안내만 남고 정작 무엇이 터졌는지는 안 보인다.
 *
 * 사건 파일이 바뀌면 렌더가 깨질 수 있다는 것이 이 앱의 상수다(사건마다 인물·
 * 장·장소 수가 다르다). 그러면 **깨진 이유가 화면에 있어야 한다.**
 */
class Boundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    console.error('[nobody-lies] 렌더 실패:', err, info?.componentStack);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <pre
        style={{
          margin: 0,
          padding: '24px',
          font: '13px/1.6 ui-monospace, monospace',
          color: '#EB5757',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {'렌더 실패\n\n' + (this.state.err?.stack || String(this.state.err))}
      </pre>
    );
  }
}

const root = createRoot(document.getElementById('root'));

Promise.all([loadDesignSystem(), loadCase()])
  .then(([, caseData]) => root.render(
    <Boundary>
      <App caseData={caseData} />
    </Boundary>,
  ));
