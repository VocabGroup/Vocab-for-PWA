# Vocab PWA

Vocab for PWA：iPhone／iPad／Android 可安裝的網頁版，目標逐頁對齊 Vocab for Android **3.1.1**。採 MIT 授權；Scanic 的 MIT 聲明位於 `public/licenses/scanic.txt`。

**尚未完整 1:1 還原 Android**。已移植亮／暗主題、SRS 四級排程、撤銷、日期與連續天數、單字庫、多卡編輯、3D 翻卡、測驗、四種 AI 供應商、Google／劍橋查詢、八個設定入口、掃描及部分匯入流程。文法、文章、作文與部分原生互動仍未完成。第三方辭典可能拒絕伺服器查詢；不會將其他來源冒稱為劍橋結果。

資料優先保存於 IndexedDB，首次開啟會移轉舊版 localStorage 資料。讀取失敗不會以空資料覆蓋；儲存失敗會顯示備份提示。完整 PWA 備份排除私人 API Key；Android 第 1–8 版 JSON 備份可匯入，文法／作文／補簽等未完成編輯器的資料保留於 `androidArchive`，並可再匯出 Android 相容備份。**保留資料不代表對應功能已完成**。Android 相容備份不含 PWA 特有的設定與測驗紀錄，搬移網頁版本請使用「下載完整備份」。

正式版透過 HTTPS 分享網址即可安裝，無須 Apple 開發者會員。iPhone／iPad 使用 Safari 開啟 → 分享 → 加入主畫面；若有「作為網頁 App 開啟」，請啟用它。安裝說明位於設定。網站與主畫面入口的儲存空間可能不同，搬移入口前請備份。

離線內容會在首次連網開啟正式版時下載。建置會產生版本化的 `offline-assets.json` 和 service worker，下載全部 JS／CSS 成功後才啟用離線版本；新版等待使用者確認再重新開啟。AI、圖片辨識與線上匯入需要網路；離線語音取決於裝置與已安裝的聲音。開發模式不註冊 service worker。

PWA 平台限制：跨 App 浮動視窗、原生 Widget、APK 安裝不能移植。掃描使用 Scanic 進行本機即時邊框偵測、拍攝、手動四角調整與透視裁切，可收集多頁後明確提交 AI；不是 Apple 原生 VisionKit。相機需要 HTTPS（本機 localhost 除外）。提醒僅在 App 開啟時檢查，不能保證背景定時通知。瀏覽器可能清理本機資料，請定期備份。

首次手機瀏覽器入口提供 Android Releases 或 Safari 安裝動畫；獨立 App 模式略過引導。全螢幕偏好位於「設定 → 外觀」，但瀏覽器 API 仍需使用者點擊，不支援的 iPhone 瀏覽器請加入主畫面。動畫可在 `/install-preview` 預覽。

```bash
npm ci
npm run dev
```

正式檢查：

```bash
npm run lint
npm test
npx playwright install chromium webkit
npm run test:browser
```

`npm test` 驗證資料與學習規則、TypeScript 及正式建置；瀏覽器測試涵蓋 iPhone 尺寸的 WebKit 與手機 Chromium、備份往返、舊資料移轉、滑動評分及離線重新開啟。WebKit 模擬不等於實體 iPhone Safari 測試，正式交付仍需在真機確認相機、檔案下載、語音、鍵盤與主畫面安裝。

驗證限制：Playwright 1.63 WebKit 的斷網重新導覽有已知問題 [#42775](https://github.com/microsoft/playwright/issues/42775)，此項保留真實斷網斷言並標記預期失敗，其餘 WebKit 流程照常驗證。Chromium 已驗證離線重開；WebKit 離線不可宣稱通過，升級修正版本後須移除此標記，並補上實體 iPhone 測試。

建置後使用 `npm start` 在本機預覽正式 Worker 與靜態資源，不會部署或公開網站。此入口也避開 Vinext 0.0.50 的 Windows 靜態快取路徑問題（磁碟反斜線與 URL 路徑不同）。

Cloudflare Pages 使用 Advanced Mode：建置指令 `npm run build:pages`，輸出目錄 `dist/pages`，Functions 相容性旗標 `nodejs_compat`，相容日期 `2026-10-07`。輸出包含單一 `_worker.js`、靜態資源與離線快取清單。請只部署此輸出，不要上傳整個工作區。免費網址為 Cloudflare 提供的 `*.pages.dev`，不等於免費取得自訂頂級網域。

發布前閱讀 [SECURITY.md](SECURITY.md)，執行 `npm audit` 與 `npm audit --omit=dev`。目前正式依賴已無已知套件警示；開發／建置工具的上游 `braces` 仍有 8 項連帶警示。已加入可重現的本機深度／AST 防護及攻擊輸入測試，保留原套件版本與警示，不冒稱上游已修補或零風險。一般安裝及開發／建置／檢查會自動套用；使用 `--ignore-scripts` 後若直接執行其他工具，須先執行 `node scripts/guard-braces.mjs`。不要盲目使用 `npm audit fix --force`，也不要在不受信任的 PR 建置提供部署金鑰。
