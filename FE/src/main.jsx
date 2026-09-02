import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Khởi tạo ứng dụng React ở phần tử root và bật StrictMode để phát hiện lỗi khi phát triển.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
