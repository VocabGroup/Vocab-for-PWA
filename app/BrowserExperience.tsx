"use client";
import { useEffect, useState, type ReactNode } from "react";
import { MdAndroid, MdClose, MdFullscreen } from "react-icons/md";
import { SafariInstallAnimation } from "./SafariInstallAnimation";
export { SafariInstallAnimation } from "./SafariInstallAnimation";
import type { AppSettings } from "./types";
import { ANDROID_RELEASES_URL, canUseFullscreen, detectBrowserPlatform, enterWebFullscreen, isInstalledWebApp, type BrowserPlatform } from "./browser-platform";

export const WEB_ENTRY_KEY="vocab-web-entry-v1";

export function BrowserExperience({settings,updateSettings,children}:{settings:AppSettings;updateSettings:(patch:Partial<AppSettings>)=>void;children:ReactNode}) {
  const [environment,setEnvironment]=useState<{platform:BrowserPlatform;installed:boolean;remembered:boolean;fullscreen:boolean}|null>(null);
  const [launchHandled,setLaunchHandled]=useState(false),[notice,setNotice]=useState("");
  useEffect(()=>{let cancelled=false;queueMicrotask(()=>{if(cancelled)return;let remembered=false;try{remembered=localStorage.getItem(WEB_ENTRY_KEY)==="browser";}catch{}setEnvironment({platform:detectBrowserPlatform(navigator.userAgent,navigator.platform,navigator.maxTouchPoints),installed:isInstalledWebApp(),remembered,fullscreen:canUseFullscreen()});});return()=>{cancelled=true;};},[]);
  useEffect(()=>{const show=()=>{if(environment?.installed){setNotice("已從主畫面開啟，不需要再次安裝。");return;}if(environment?.platform==="desktop"){setNotice("此安裝引導適用於 Android、iPhone 與 iPad。");return;}setLaunchHandled(true);setEnvironment(current=>current ? {...current,remembered:false}:current);};window.addEventListener("vocab-show-install-guide",show);return()=>window.removeEventListener("vocab-show-install-guide",show);},[environment]);
  async function copyAddress(){try{if(!navigator.clipboard)throw new Error("unavailable");await navigator.clipboard.writeText(location.href);setNotice("網址已複製，請開啟 Safari 貼上。");}catch{setNotice("無法複製，請從網址列手動複製到 Safari。");}}
  function continueBrowser() {
    // Request synchronously from this click, before persistence/other async work.
    const request=enterWebFullscreen();
    try{localStorage.setItem(WEB_ENTRY_KEY,"browser");}catch{setNotice("瀏覽器無法記住選擇，下次可能會再次顯示引導。");}
    setEnvironment(current=>current ? {...current,remembered:true}:current);setLaunchHandled(true);updateSettings({fullscreenOnLaunch:true});
    void request.then(message=>{if(message)setNotice(message);});
  }
  if(!environment)return <main className="loading"><span className="spinner" aria-label="確認瀏覽器"/></main>;
  const guide=!environment.installed && !environment.remembered && environment.platform!=="desktop";
  if(guide)return <main className="browser-entry"><section className="browser-entry-card"><span className="entry-brand">Vocab</span>
    {environment.platform==="android" ? <><MdAndroid className="entry-platform-icon" size={50}/><h1>選擇適合你的 Vocab</h1><p>你正在使用 Android，可以安裝安卓版，或直接使用網頁版。</p><a className="primary android-button-link" href={ANDROID_RELEASES_URL} target="_blank" rel="noopener noreferrer">前往 GitHub 安裝安卓版</a><p className="hint">開啟 Releases，選擇最新版本的 APK。網頁資料不會自動同步到安卓版，可使用備份轉移。</p></> : environment.platform==="ios-other" ? <><h1>請使用 Safari 開啟並安裝</h1><p>將此網址複製到 Safari，再依教學加入主畫面，之後就能像 App 一樣開啟。</p><button className="primary wide" onClick={()=>void copyAddress()}>複製網址，在 Safari 開啟</button><p className="hint">網頁無法保證替你切換到 Safari，請手動開啟。</p></> : <><h1>把 Vocab 加入主畫面</h1><p>依照下方教學安裝，之後從主畫面圖示開啟。</p><SafariInstallAnimation/></>}
    {notice && <p role="status">{notice}</p>}<button className="secondary wide" onClick={continueBrowser}>{environment.platform==="android" ? "繼續使用網頁版":"繼續使用瀏覽器"}</button><small>預設開啟全螢幕偏好，可到「設定 → 外觀」調整。瀏覽器可能要求再次點擊，或不支援全螢幕。</small>
  </section></main>;
  const launch=environment.remembered && !environment.installed && environment.fullscreen && (settings.fullscreenOnLaunch ?? true) && !launchHandled;
  return <>{children}{launch && <aside className="fullscreen-launch" role="dialog" aria-label="全螢幕開啟"><p>已開啟全螢幕偏好，請點一下進入。</p><button className="primary" onClick={()=>{const request=enterWebFullscreen();setLaunchHandled(true);void request.then(setNotice);}}><MdFullscreen size={22}/>進入全螢幕</button><button className="secondary" onClick={()=>setLaunchHandled(true)}>這次先用視窗模式</button></aside>}{notice && <div className="browser-notice" role="status"><span>{notice}</span><button className="icon-button" aria-label="關閉瀏覽器提示" onClick={()=>setNotice("")}><MdClose size={20}/></button></div>}</>;
}
