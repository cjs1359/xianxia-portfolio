# Code Review — src/main.js / src/world.js / src/style.css

## 1) 卷軸與列表模式的連結顯示
檢查結果：`renderLinks()`（src/main.js:19-39）與 `openWork()` 的 accessNote 處理已經正確：
- `linkStatus === 'confirmed'` 時，`work.links` 全部渲染為 `<a class="work-link" target="_blank" rel="noopener noreferrer">`。
- `requiresLogin` 為真時，額外附加「需登入／授權」提示段落。
- 非 confirmed（僅 `overview-only`，即 qingshi-01）才顯示「查看原作品集總覽 ↗」連到 `sourceOverviewUrl` ＋「個別連結待補」。
- `accessNote` 為 `null` 時，`access.hidden = !work.accessNote` 會把該行隱藏（省略）。
- 列表模式與 3D 卷軸共用同一個 `openWork`/`renderLinks`，行為一致。

本輪未變更此邏輯（已正確）；但發現並修正一個相關的**樣式缺陷**：
- **Bug**：`style.css` 原本只定義 `#source{...}`（按鈕外觀：inline-flex、min-height 48px、硃砂底色），但 `main.js` 實際建立的連結是 `class="work-link"`，兩者選擇器對不上，導致所有卷軸內的「前往作品 / 開啟網頁 / 查看原作品集總覽」連結完全沒有按鈕樣式，只是裸文字連結，且未保證 ≥44px 的可觸控高度。
- **修正**：把 `#source` 選擇器改為 `.work-link`，並調整 margin 讓多個連結並排時有間距（style.css）。

## 2) 手機直式 390×844 全景入鏡
檢查結果：`world.js` 的 `overview()`（原第 57 行）用固定常數 `d = aspect<1 ? 105 : 73` 當作相機距離比例因子，但相機是透視相機、FOV 固定在垂直 43°，直式窄螢幕的「水平視角」會比垂直視角窄很多（390/844 時水平半視角僅約 10.3°）。換算後原本的距離（約 130 單位）遠小於要把 6 島（環半徑 23 ＋ 最大島半徑 7）完整框進水平視野所需的距離（約 170–190 單位），因此左右兩側的浮島與標籤會被切出畫面。

- **修正**：改為依實際水平/垂直視角（取較窄者）與目標包覆半徑 `R = ORBIT_RADIUS + 9` 反推所需相機距離，並保留原本的視角方向比例 `(.38, .62, 1)`，加 12% 安全邊距。直式與橫式都重新計算，橫式结果與原先數值相近（未明顯改變既有視覺），直式則確實拉遠相機以容納全部 6 島與標籤，且距離仍在 `controls.maxDistance=230` 範圍內。

## 3) 快速 bug 檢查
- **轉場禁點**：`enter()`、`setList()`、`#back` 按鈕與 canvas 的 `pointerup` 處理都在進入前檢查 `state`（排除 `transit`/`dialog`），且 `travel()` 開始時立刻隱藏所有標籤，三者疊加下轉場中不可能誤觸。確認無問題，未修改。
- **焦點返回**：`dialog.addEventListener('close', ...)` 一律還原 `previousState` 並 `opener?.focus()`，涵蓋「✕ 按鈕關閉」「點擊 backdrop 關閉」「Esc 關閉」三種路徑，皆觸發同一個 `close` 事件。確認無問題，未修改。
- **新發現**：`dialog` 沒有設定 `overflow-y`，預設 `overflow:visible`，當卷軸內容超過 `max-height: calc(100svh - 48px)` 時內容會直接溢出到視窗外而非產生捲軸，違反需求「卷軸可捲動」。
  - **修正**：`dialog` 加上 `overflow-y:auto`。

## 未改動
- `public/works.json` 內容未變更。
- 未新增任何檔案（本檔除外）。
