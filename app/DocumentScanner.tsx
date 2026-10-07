"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CornerEditor } from "scanic";
import { LiveDocumentCamera } from "./LiveDocumentCamera";
import { MdArrowBack, MdCameraAlt, MdPhotoLibrary, MdDeleteOutline } from "react-icons/md";

type Page = { file: File; url: string };

// Scanic is loaded only when the scanner is opened; no CDN or model upload is used.
export function DocumentScanner({ initialFile, canRecognize, onRecognize, onClose }: {
  initialFile?: File; canRecognize: boolean; onRecognize: (files: File[]) => Promise<boolean>; onClose: () => void;
}) {
  const [active, setActive] = useState<File | null>(initialFile ?? null);
  const [live, setLive] = useState(!initialFile);
  const [pages, setPages] = useState<Page[]>([]);
  const [working, setWorking] = useState(!!initialFile);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState(initialFile ? "正在本機偵測文件邊框…" : "即時框線只作預覽，拍攝後會重新偵測照片，讓你確認四角。");
  const dialog=useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<CornerEditor | null>(null);
  const source = useRef<HTMLCanvasElement | null>(null);
  const camera = useRef<HTMLInputElement>(null), photos = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const alive = useRef(true), cropLock = useRef(false);
  useEffect(() => { alive.current=true; const allocated=urls.current; return () => { alive.current=false; for (const url of allocated) URL.revokeObjectURL(url); allocated.clear(); }; }, []);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null, main=document.querySelector("main"), inert=main?.inert, overflow=document.body.style.overflow;
    if(main)main.inert=true;document.body.style.overflow="hidden";dialog.current?.focus();
    const trap=(event:KeyboardEvent)=>{if(event.key!=="Tab")return;const controls=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not([hidden]),[tabindex="0"]')??[])];const index=controls.indexOf(document.activeElement as HTMLElement);if(index<0 || (!event.shiftKey && index===controls.length-1) || (event.shiftKey && index===0)){event.preventDefault();controls[event.shiftKey ? controls.length-1:0]?.focus();}};
    document.addEventListener("keydown",trap);return()=>{document.removeEventListener("keydown",trap);if(main)main.inert=inert ?? false;document.body.style.overflow=overflow;previous?.focus({preventScroll:true});};
  },[]);

  useEffect(() => {
    if (!active) return;
    let cancelled=false, mounted:CornerEditor|null=null;
    const url=URL.createObjectURL(active);
    async function prepare() {
      try {
        if (!active!.type.startsWith("image/")) throw new Error("請選擇照片；PDF 請使用外面的檔案匯入。");
        if (active!.size>12*1024*1024) throw new Error("圖片超過 12 MB，請先縮小。");
        const image=new Image(); image.src=url; await image.decode();
        if (cancelled) return;
        // Bound full-resolution photo memory on mobile; retain up to 2000px for AI.
        const scale=Math.min(1,2000/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement("canvas"); canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const context=canvas.getContext("2d");if(!context)throw new Error("瀏覽器無法處理圖片");context.drawImage(image,0,0,canvas.width,canvas.height);
        const scanic=await import("scanic");
        if(cancelled) return;
        let corners;
        try { const result=await scanic.scanDocument(canvas,{mode:"detect",detector:"classical",maxProcessingDimension:900}); corners=result.success ? result.corners ?? undefined : undefined; }
        catch { /* Detection failure still permits manual corners. */ }
        if(cancelled || !host.current) return;
        source.current=canvas;
        mounted=scanic.createCornerEditor({container:host.current,image:canvas,corners,toolbar:{enabled:false},keyboard:false,handleHitArea:48,magnifier:{enabled:true,zoom:2},theme:{accent:getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#245dea"}});
        // Localize the four focusable drag handles for accessibility and tests.
        host.current.querySelectorAll<HTMLElement>(".scanic-handle").forEach((handle,index)=>handle.setAttribute("aria-label",["左上角","右上角","右下角","左下角"][index]));
        editor.current=mounted;setReady(true);setMessage(corners ? "已偵測邊框，請拖曳四角核對範圍。" : "未能確定文件邊框，請手動拖曳四角。 ");
      } catch(error) { if(!cancelled)setMessage(`無法開啟圖片：${error instanceof Error ? error.message : "請換一張照片重試"}`); }
      finally {URL.revokeObjectURL(url);if(!cancelled)setWorking(false);}
    }
    void prepare();
    return () => {cancelled=true;mounted?.destroy();if(editor.current===mounted)editor.current=null;source.current=null;URL.revokeObjectURL(url);};
  },[active]);

  async function crop() {
    if(!ready || !editor.current || !source.current || cropLock.current)return;
    cropLock.current=true;setWorking(true);
    try {
      const scanic=await import("scanic");
      const result=await scanic.extractDocument(source.current,editor.current.getCorners(),{output:"canvas"});
      if(!result.success || !(result.output instanceof HTMLCanvasElement))throw new Error(result.message || "無法裁切，請重新調整四角");
      const blob=await new Promise<Blob>((resolve,reject)=>result.output instanceof HTMLCanvasElement && result.output.toBlob(value=>value ? resolve(value):reject(new Error("無法輸出圖片")),"image/jpeg",0.92));
      if(!alive.current)return;
      const file=new File([blob],`scan-${Date.now()}.jpg`,{type:"image/jpeg"}), url=URL.createObjectURL(file);urls.current.add(url);
      setPages(current=>[...current,{file,url}]);setActive(null);setReady(false);setMessage("裁切已完成，可以繼續拍攝下一頁，或送交 AI 辨識。");
    } catch(error){if(alive.current)setMessage(`裁切失敗：${error instanceof Error ? error.message : "請重試"}`);}
    finally{cropLock.current=false;if(alive.current)setWorking(false);}
  }
  function choose(file?:File) {if(file){setLive(false);setActive(file);setReady(false);setWorking(true);setMessage("正在本機偵測文件邊框…");}}
  function discard() {setActive(null);setReady(false);setMessage("已取消這一頁，已裁切的頁面仍保留。");}
  async function recognize() {
    if(working || live || !pages.length || active || !canRecognize)return;
    setWorking(true);setMessage("正在依頁面順序交給 AI 辨識…");
    try {if(await onRecognize(pages.map(page=>page.file)))onClose();else setMessage("AI 辨識失敗，裁切頁面已保留，請關閉後檢查設定或再試一次。");}
    finally {if(alive.current)setWorking(false);}
  }
  return createPortal(<div ref={dialog} tabIndex={-1} className="document-scan-overlay" role="dialog" aria-modal="true" aria-labelledby="document-scan-title">
    <header><button className="icon-button" aria-label="返回掃描匯入" disabled={working} onClick={()=>{if((pages.length || active) && !window.confirm("關閉掃描器？未送出的掃描頁面將不保留。"))return;onClose();}}><MdArrowBack size={24}/></button><h2 id="document-scan-title">文件掃描</h2></header>
    <div className="document-scan-body">
      <p className="hint">裁切與拉正在手機本機處理，按「送交 AI 辨識」才會上傳。</p>
      <p role="status">{message}</p>
      {live && <LiveDocumentCamera onCapture={choose}/>}
      {active && <><div className="document-corner-host" ref={host}/><div className="document-scan-actions"><button className="secondary" disabled={working} onClick={discard}>取消這頁</button><button className="secondary" disabled={!ready || working} onClick={()=>editor.current?.reset()}>重設四角</button><button className="primary" disabled={!ready || working} onClick={()=>void crop()}>{working ? "處理中…":"裁切並保留"}</button></div></>}
      {!active && <><div className="document-scan-actions">{!live && <button className="secondary" disabled={working || pages.length>=10} onClick={()=>{setLive(true);setMessage("即時框線只作預覽，拍攝後會重新偵測照片。");}}><MdCameraAlt/>拍下一頁</button>}{live && <button className="secondary" onClick={()=>setLive(false)}>關閉即時鏡頭</button>}<button className="secondary" disabled={working || pages.length>=10} onClick={()=>camera.current?.click()}><MdCameraAlt/>改用拍照</button><button className="secondary" disabled={working || pages.length>=10} onClick={()=>photos.current?.click()}><MdPhotoLibrary/>選擇照片</button></div></>}
      <input ref={camera} data-testid="scan-next-camera" hidden type="file" accept="image/*" capture="environment" onChange={event=>{choose(event.target.files?.[0]);event.target.value="";}}/>
      <input ref={photos} data-testid="scan-next-photo" hidden type="file" accept="image/*" onChange={event=>{choose(event.target.files?.[0]);event.target.value="";}}/>
      {/* Local blob previews must not pass through a server image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!!pages.length && <section aria-label="已掃描頁面" className="document-pages"><h3>已掃描 {pages.length} 頁（最多 10 頁）</h3>{pages.map((page,index)=><article key={page.url}><img src={page.url} alt={`掃描第 ${index+1} 頁`}/><span>第 {index+1} 頁</span><button className="icon-button danger-text" disabled={working} aria-label={`刪除第 ${index+1} 頁`} onClick={()=>{URL.revokeObjectURL(page.url);urls.current.delete(page.url);setPages(current=>current.filter(item=>item!==page));}}><MdDeleteOutline size={22}/></button></article>)}</section>}
      {!canRecognize && <p className="scan-warning">可先掃描與裁切；送交辨識需要在設定啟用個人 AI API。</p>}
    </div>
    <footer><button className="primary wide" disabled={!pages.length || live || !!active || working || !canRecognize} onClick={()=>void recognize()}>送交 AI 辨識（{pages.length} 頁）</button><small>掃描功能使用 Scanic（MIT） · <a href="/licenses/scanic.txt" target="_blank" rel="noreferrer">授權聲明</a></small></footer>
  </div>,document.body);
}
