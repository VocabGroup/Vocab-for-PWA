"use client";
import { useEffect, useState } from "react";
import type { AppSettings } from "./types";
import { AndroidSwitch } from "./OnboardingScreen";
import { canUseFullscreen, enterWebFullscreen, isInstalledWebApp } from "./browser-platform";

export function WebDisplaySettings({settings,updateSettings}:{settings:AppSettings;updateSettings:(patch:Partial<AppSettings>)=>void}) {
  const [status,setStatus]=useState("");const [mode,setMode]=useState({installed:false,supported:false,active:false});
  useEffect(()=>{let alive=true;const refresh=()=>{if(alive)setMode({installed:isInstalledWebApp(),supported:canUseFullscreen(),active:!!document.fullscreenElement});};queueMicrotask(refresh);document.addEventListener("fullscreenchange",refresh);return()=>{alive=false;document.removeEventListener("fullscreenchange",refresh);};},[]);
  return <section className="android-settings-section"><h3>網頁全螢幕</h3><div className="android-setting-row"><span>每次開啟時使用全螢幕</span><AndroidSwitch label="每次開啟時使用全螢幕" checked={settings.fullscreenOnLaunch ?? true} onChange={value=>{updateSettings({fullscreenOnLaunch:value});if(value)void enterWebFullscreen().then(setStatus);else if(document.fullscreenElement)void document.exitFullscreen().catch(()=>setStatus("無法離開全螢幕，請使用瀏覽器的返回或退出功能。"));}}/></div>
    <p>{mode.installed ? "已從主畫面以 App 模式開啟，不需要再次要求全螢幕。" : mode.supported ? "偏好會儲存在此瀏覽器。瀏覽器要求使用者點擊，因此下次開啟會提供進入全螢幕按鈕。" : "此瀏覽器不支援網頁全螢幕。iPhone 請使用 Safari 加入主畫面，並從主畫面開啟。"}</p>
    {!mode.installed && <button className="secondary wide" disabled={!mode.supported} onClick={()=>{if(mode.active)void document.exitFullscreen().catch(()=>setStatus("請使用瀏覽器退出全螢幕。"));else void enterWebFullscreen().then(setStatus);}}>{mode.active ? "退出全螢幕":"立即進入全螢幕"}</button>}
    <button className="android-text-button" onClick={()=>window.dispatchEvent(new Event("vocab-show-install-guide"))}>查看安裝引導</button>{status && <p role="status">{status}</p>}
  </section>;
}
