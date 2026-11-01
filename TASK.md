從零建立「弘道祥雲仙域」仙俠 3D 作品集 MVP（Vite 8 + three 0.187.0，npm）。資料一律讀 public/works.json（不可修改內容、不可新增作品或典故）。
需求：
- package.json（vite、three 0.187.0 固定版本）、vite.config.js base:'/xianxia-portfolio/'；用 import.meta.env.BASE_URL 取 works.json。
- index.html（lang zh-Hant）、src/main.js、src/style.css。繁中 UI，仙俠配色（墨青、宣紙、硃砂、金），篆感標題用 serif 字型（系統字，不載外部字型）。
- 場景：雲海（半透明程式化雲片/霧，fog）、6 座程式化浮島（依 island.color/accent，錐體山體+頂面+小樹/石），每島上放其 works 的建築（依 buildingType 閣/樓/殿/亭/洞府 用不同簡單幾何：多層塔、屋頂、亭、洞口），環形自動排列。CSS2DRenderer 標籤顯示島名與樓閣名（島內才顯示樓閣名）。Timer 用 import { Timer } from 'three'。
- 狀態機：overview / transit / island / dialog。overview 可 OrbitControls 旋轉；點島（raycast 或標籤 button）→ 依 island.vehicle 生成簡單幾何法器（飛劍、玉如意、雲舟、紙鶴、葫蘆、傳送陣光環）沿曲線飛到該島，相機跟隨約 2.5 秒，轉場時停用 controls、忽略點擊。島內點建築→卷軸彈窗（<dialog>）：樓閣名＋類型、原作品名、cardType、accessNote、originalDescription、按鈕「查看原作品集總覽」連到 sourceOverviewUrl，並標示「個別連結待補」。關閉後焦點回原處。「返回全景」按鈕。prefers-reduced-motion 時轉場改直接切換。
- 列表模式：右上「列表模式」切換；WebGL 不可用或載入失敗時自動顯示列表（純 HTML，依島分組，40 件皆可開卷軸）。列表不依賴 three。
- 手機直式 390x844：相機距離依 aspect 調整讓 6 島全入鏡；DPR 上限 1.5（手機）/2；touch-action:none 只在 canvas；標籤/按鈕 ≥44px；卷軸可捲動、safe-area。閒置時可降低渲染。
- .github/workflows/deploy.yml：push main → npm ci → npm run build → actions/upload-pages-artifact (dist) → actions/deploy-pages，permissions pages/id-token。
- 執行 npm install 並 npm run build 確認成功。README.md 簡述。
- 補充：若作品 linkStatus=="confirmed" 且有 destinationUrl，卷軸按鈕改為「前往作品」連到 destinationUrl（新分頁 rel=noopener），不顯示「個別連結待補」；否則維持總覽連結＋待補標示。列表模式同樣處理。
