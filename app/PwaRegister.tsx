"use client";

import { useEffect, useRef, useState } from "react";
import { MdClose, MdIosShare, MdAddBox, MdSystemUpdateAlt, MdWifiOff } from "react-icons/md";
import { flushStateWrites } from "./device-storage";

type AppleNavigator = Navigator & { standalone?: boolean };

export function PwaRegister() {
  const [online, setOnline] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [apple, setApple] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [runtimeError, setRuntimeError] = useState("");
  const [storageStatus, setStorageStatus] = useState("");
  const [offlineReady, setOfflineReady] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const updating = useRef(false);
  const dialog = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let disposed = false;
    const standalone = window.matchMedia("(display-mode: standalone)");
    const sync = () => {
      setOnline(navigator.onLine);
      setInstalled(standalone.matches || (navigator as AppleNavigator).standalone === true);
      setApple(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    };
    const viewport = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--visible-height", `${height}px`);
      document.documentElement.style.setProperty("--visible-top", `${window.visualViewport?.offsetTop ?? 0}px`);
      document.documentElement.dataset.keyboard = String(window.innerHeight - height > 150);
    };
    const openHelp = () => setHelpOpen(true);
    const showUpdate = () => { setUpdateDismissed(false); setUpdateReady(Boolean(registration.current?.waiting)); };
    const controllerChanged = () => { if (updating.current) location.reload(); };
    const messages = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_READY") setOfflineReady(true);
    };
    Promise.resolve().then(() => { if (!disposed) { sync(); viewport(); } });
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    window.addEventListener("vocab-install-help", openHelp);
    window.addEventListener("vocab-show-update", showUpdate);
    standalone.addEventListener("change", sync);
    window.visualViewport?.addEventListener("resize", viewport); window.visualViewport?.addEventListener("scroll",viewport); window.addEventListener("resize", viewport);

    if ("serviceWorker" in navigator && window.isSecureContext && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
      navigator.serviceWorker.addEventListener("message", messages);
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(reg => {
        if (disposed) return;
        registration.current = reg;
        setUpdateReady(Boolean(reg.waiting));
        const watchWorker = (worker: ServiceWorker | null) => {
          worker?.addEventListener("statechange", () => {
            if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
          });
        };
        watchWorker(reg.installing);
        reg.addEventListener("updatefound", () => watchWorker(reg.installing));
        return navigator.serviceWorker.ready;
      }).then(reg => {
        if (reg && !disposed) reg.active?.postMessage({ type: "CHECK_OFFLINE" });
      }).catch(() => { if (!disposed) setRuntimeError("離線準備未完成，請連網重新開啟 Vocab。"); });
    }
    return () => {
      disposed = true;
      window.removeEventListener("online", sync); window.removeEventListener("offline", sync);
      window.removeEventListener("vocab-install-help", openHelp); standalone.removeEventListener("change", sync);
      window.removeEventListener("vocab-show-update", showUpdate);
      window.visualViewport?.removeEventListener("resize", viewport); window.visualViewport?.removeEventListener("scroll",viewport); window.removeEventListener("resize", viewport);
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChanged);
      navigator.serviceWorker?.removeEventListener("message", messages);
    };
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    const before = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelpOpen(false);
      if (event.key !== "Tab") return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", keyboard); before?.focus(); };
  }, [helpOpen]);

  const applyUpdate = async () => {
    try {
      await flushStateWrites();
      if (!registration.current?.waiting) { setUpdateReady(false); return; }
      updating.current = true;
      registration.current.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch { setRuntimeError("資料尚未儲存，請先下載備份後再更新。"); }
  };
  const protectStorage = async () => {
    try {
      const granted = await navigator.storage?.persist?.();
      setStorageStatus(granted ? "已取得持續儲存權限。仍建議定期備份。" : "瀏覽器未授予持續儲存權限。請定期下載備份，並避免清除網站資料。");
    } catch { setStorageStatus("此瀏覽器無法設定持續儲存，請定期下載備份。"); }
  };

  return <>
    {(!online || (updateReady && !updateDismissed) || runtimeError) && <aside className="pwa-status" aria-live="polite">
      {!online && <p><MdWifiOff aria-hidden="true" />離線使用中；AI 與線上匯入需要網路。</p>}
      {updateReady && !updateDismissed && <div><p>新版已準備好。請先儲存正在編輯的內容。<button className="icon-button" aria-label="稍後更新" onClick={() => setUpdateDismissed(true)}><MdClose /></button></p><button className="secondary" onClick={applyUpdate}><MdSystemUpdateAlt aria-hidden="true" />更新並重新開啟</button></div>}
      {runtimeError && <p role="alert">{runtimeError}<button className="icon-button" aria-label="關閉提示" onClick={() => setRuntimeError("")}><MdClose /></button></p>}
    </aside>}
    {helpOpen && <div className="install-backdrop" onClick={event => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
      <section className="install-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="install-title">
        <header><h2 id="install-title">{installed ? "已加入主畫面" : "安裝 Vocab"}</h2><button className="icon-button" aria-label="關閉安裝說明" onClick={() => setHelpOpen(false)}><MdClose size={24} /></button></header>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" width="64" height="64" alt="" />
        {installed ? <p>你正在使用主畫面版本。更新後會保留這台裝置的學習資料。</p> : apple ? <>
          <p>使用 Safari 開啟這個網址，再依照以下步驟操作：</p>
          <ol><li><MdIosShare aria-hidden="true" />開啟 Safari 選單，點選「分享」。</li><li><MdAddBox aria-hidden="true" />點選「加入主畫面」。</li><li>若有「作為網頁 App 開啟」，請開啟它，再按「加入」。</li><li>回到主畫面，點 Vocab 圖示開始使用。</li></ol>
        </> : <p>在瀏覽器選單選擇「安裝應用程式」或「加入主畫面」。iPhone／iPad 請使用 Safari 的分享選單。</p>}
        <p className="hint">{offlineReady ? "離線內容已準備完成。已保存的卡片、翻卡與文字測驗可離線使用。" : "請先連網開啟正式版，完成離線內容下載。AI、圖片辨識與線上匯入仍需要網路。"}</p>
        <p className="hint">Safari 分頁與主畫面 App 的資料可能不共用；請在同一個入口持續使用，搬移時先下載備份。</p>
        <button className="secondary wide" onClick={protectStorage}>保護本機資料</button>
        {storageStatus && <p role="status" className="hint">{storageStatus}</p>}
        <button className="primary wide" onClick={() => setHelpOpen(false)}>我知道了</button>
      </section>
    </div>}
  </>;
}
