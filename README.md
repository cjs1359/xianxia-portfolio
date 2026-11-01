# 弘道祥雲仙域

以 Vite 8、three.js 0.187.0 建立的繁中仙俠作品集。作品資料僅讀取 `public/works.json`，不更動原作品內容。

## 開發

使用 Node.js 22.12 以上版本：

```sh
npm install
npm run dev
npm run build
npm run preview
```

選取浮島後乘法器入境，點樓閣開啟作品卷軸；可返回全景或切換列表模式。列表由原生 HTML 建立，不依賴 three.js，3D 模組或 WebGL 失敗時自動顯示。若資料本身無法讀取，顯示重試入口。支援減少動態效果、鍵盤操作、原生 dialog 與焦點返回。

部署路徑為 `/xianxia-portfolio/`，作品資料使用 `import.meta.env.BASE_URL` 載入。推送 `main` 後 GitHub Actions 執行 `npm ci`、建置並部署 GitHub Pages；儲存庫 Pages 來源需設定 GitHub Actions。
