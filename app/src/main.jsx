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

/** 클래식 스크립트라 `import()` 가 아니라 태그로 넣고 기다린다 */
function loadDesignSystem() {
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = DS_BUNDLE;
    s.onload = () => {
      const errs = window.VectorDesignSystem_490b73?.__errors;
      // 번들은 실패해도 예외를 던지지 않고 `__errors` 에 적어둔다. 조용히 지나가면
      // 화면이 어긋난 채로 돈다 — 콘솔에라도 남긴다
      if (errs?.length) console.error('[nobody-lies] 디자인 시스템 컴파일 실패:', errs);
      resolve();
    };
    s.onerror = () => { console.error('[nobody-lies] 디자인 시스템 번들을 못 읽었다'); resolve(); };
    document.head.appendChild(s);
  });
}

/**
 * 사건 파일. `engine/cases/mountain-lodge.yaml` 을 `npm run case` 가 뽑아 놓은 것이다.
 *
 * **렌더 전에 받는다.** 앱이 클래스 필드로 표를 만들 때 이미 있어야 「엔진 값 →
 * 앱 표」 덮어쓰기가 첫 렌더에 반영된다. 못 받으면 앱에 하드코딩된 값으로 돈다 —
 * 사건 파일이 없다고 게임이 안 열리는 것보다 낫다.
 */
function loadCase() {
  return fetch('/cases/mountain-lodge.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .catch((e) => {
      console.warn('[nobody-lies] 사건 파일을 못 읽었다 — 내장 값으로 돈다:', e.message);
      return null;
    });
}

const root = createRoot(document.getElementById('root'));

Promise.all([loadDesignSystem(), loadCase()])
  .then(([, caseData]) => root.render(<App caseData={caseData} />));
