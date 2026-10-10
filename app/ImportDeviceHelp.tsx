"use client";

import { useState, useSyncExternalStore } from "react";
import { ANDROID_RELEASES_URL, detectBrowserPlatform } from "./browser-platform";

const subscribeToDevice = () => () => {};
const deviceSnapshot = () => JSON.stringify([navigator.userAgent, navigator.platform, navigator.maxTouchPoints]);
const serverDeviceSnapshot = () => "";

export function ImportDeviceHelp({ onPaste, onFile }: { onPaste: () => void; onFile: () => void }) {
  const device = useSyncExternalStore(subscribeToDevice, deviceSnapshot, serverDeviceSnapshot);
  const [expanded, setExpanded] = useState(false);
  if (!device) return null;
  const [userAgent, navigatorPlatform, maxTouchPoints] = JSON.parse(device) as [string, string, number];
  const platform = detectBrowserPlatform(userAgent, navigatorPlatform, maxTouchPoints);
  const chromium = /Chrome\/|Edg\//.test(userAgent);

  const ios = platform === "ios-safari" || platform === "ios-other";
  const title = ios ? "iPhone／iPad 匯入方式" : platform === "android" ? "Android 匯入方式" : "電腦匯入方式";
  const description = ios
    ? "遇到 Quizlet 拒絕讀取時，可研究搭配免費 Userscripts 在 Safari 讀取。Vocab 專用腳本尚未提供，安裝工具不會自動啟用匯入。"
    : platform === "android"
      ? "建議使用 Vocab 安卓版的內建瀏覽器匯入；想留在網頁版，也可以貼上文字或選擇匯出檔案。"
      : "可以使用 QuickCards 匯出工具取得 JSON，再回到 Vocab 選擇檔案匯入。這不是 Vocab 的自動匯入擴充功能，網站也可能限制工具讀取。";
  const steps = ios ? [
    ...(platform === "ios-other" ? ["請先用 Safari 開啟 Vocab；Userscripts 是 Safari 延伸功能，不會在目前這個瀏覽器中執行。"] : []),
    "從 App Store 安裝 Userscripts，開啟 App 一次，再到 Safari 的延伸功能設定啟用。",
    "專用腳本仍在準備與驗證中，目前沒有可安裝的 Vocab 腳本。不要開放所有網站，也不需要提供 Quizlet 密碼或登入 Cookie。",
    "目前可先把有權取得的單字文字貼回 Vocab，或選擇 CSV、TSV、TXT、JSON 檔案匯入。主畫面 PWA 不會因為安裝延伸功能就自動取得讀取權限。",
  ] : platform === "android" ? [
    "前往 GitHub Releases，下載最新正式版中的 APK 安裝檔。",
    "Android 若要求允許此來源安裝，請確認檔案來自 VocabGroup/Vocab-for-Android，再自行決定是否允許。",
    "在安卓版的線上單字集匯入功能貼上連結。需要登入或人機驗證的頁面仍可能無法自動讀取。",
    "留在網頁版時可改用文字或檔案匯入；網頁版與安卓版的學習資料不會自動同步。",
  ] : [
    chromium ? "從 Chrome 線上應用程式商店查看 QuickCards，確認權限後自行安裝；Edge 可使用相容的 Chrome 擴充功能。" : "查看 QuickCards 官方安裝說明，確認你的瀏覽器是否支援；不要把 Chrome 擴充功能安裝到不相容的瀏覽器。",
    "開啟你有權存取的 Quizlet 單字集，使用工具匯出 JSON。若工具也遭拒絕讀取，請改用平台提供的匯出或文字。",
    "回到 Vocab，按「選擇檔案」，選取匯出檔，檢查預覽後再確認匯入。",
    "Vocab 專用的一鍵傳回擴充功能尚未提供；QuickCards 是第三方工具，不是 Vocab 的一部分。",
  ];
  const href = ios ? "https://apps.apple.com/tw/app/userscripts/id1463298887" : platform === "android" ? ANDROID_RELEASES_URL : chromium
    ? "https://chromewebstore.google.com/detail/quickcards/kjbjdolelcchfcmainniifnpkgikjfkc"
    : "https://github.com/ImGajeed76/quick-cards/tree/main/extension#install";
  const linkLabel = ios ? "安裝免費 Userscripts" : platform === "android" ? "下載 Vocab 安卓版" : chromium ? "查看／安裝 QuickCards" : "查看 QuickCards 安裝說明";

  return <section className="import-device-help" aria-label="此裝置的匯入方法">
    <h3>{title}</h3>
    <p>{description}</p>
    <div className="import-help-actions">
      <button type="button" className="secondary" aria-expanded={expanded} aria-controls="import-device-instructions" onClick={() => setExpanded(!expanded)}>{expanded ? "收起使用方法" : "使用方法"}</button>
      <a className="secondary" href={href} target="_blank" rel="noopener noreferrer">{linkLabel}</a>
    </div>
    {expanded && <div id="import-device-instructions"><ol>{steps.map(step => <li key={step}>{step}</li>)}</ol><div className="import-help-actions"><button type="button" className="secondary" onClick={onPaste}>改用貼上文字</button><button type="button" className="secondary" onClick={onFile}>改用檔案匯入</button></div></div>}
  </section>;
}
