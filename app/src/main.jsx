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

createRoot(document.getElementById('root')).render(<App />);
