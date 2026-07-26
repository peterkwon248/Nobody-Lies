import React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

/**
 * Vector 디자인 시스템 번들은 `React` 를 **전역으로** 찾는다
 * (`_ds_bundle.js` 안에서 `React.createElement` 를 그냥 참조한다).
 *
 * DC export 의 `standalone.html` 은 CDN React 를 쓰므로 전역이 저절로 생기지만,
 * Vite 는 React 를 ES 모듈로 넣기 때문에 `window.React` 가 없다. 그러면
 * `StatusIcon`·`Button` 이 첫 렌더에서 `ReferenceError: React is not defined`
 * 로 터지고 **화면이 통째로 비어 나온다** — 콘솔에는 경고만 찍혀서
 * 「빈 화면」 말고는 단서가 없다.
 *
 * 번들은 React 를 함수 **안에서** 참조하므로 첫 렌더 전에만 심어주면 된다.
 */
window.React = React;
window.ReactDOM = ReactDOM;

/**
 * 사건 파일을 먼저 받아 온다. `engine/cases/mountain-lodge.yaml` 을
 * `npm run case` 가 뽑아 놓은 것이다 (빌드·dev 양쪽에 걸려 있다).
 *
 * **렌더 전에 받는다.** 앱이 클래스 필드로 표를 만들 때 이미 있어야
 * 「엔진 값 → 앱 표」 덮어쓰기가 첫 렌더에 반영된다. 나중에 받아서
 * setState 로 밀면 한 프레임 동안 옛 값이 보인다.
 *
 * 못 받으면 앱에 하드코딩된 값으로 그냥 돈다 — 사건 파일이 없다고
 * 게임이 안 열리는 것보다 낫다. 콘솔에 남긴다.
 */
const root = createRoot(document.getElementById('root'));

fetch('/cases/mountain-lodge.json')
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
  .catch((e) => { console.warn('[nobody-lies] 사건 파일을 못 읽었다 — 내장 값으로 돈다:', e.message); return null; })
  .then((caseData) => root.render(<App caseData={caseData} />));
