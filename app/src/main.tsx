import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/vector/styles.css'
import './styles/app.css'
import App from './App'
import { MarkDefs } from './components/Mark'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* SVG 심볼 정의는 문서에 한 번만. 화면들은 <use> 로 참조한다 */}
    <MarkDefs />
    <App />
  </StrictMode>,
)
