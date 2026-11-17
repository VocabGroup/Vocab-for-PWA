"use client";
/* eslint-disable @next/next/no-img-element -- QR is generated locally. */
import {useEffect,useEffectEvent,useRef,useState} from "react";
import QRCode from "qrcode/lib/browser";
import {MdClose,MdContentCopy,MdShare} from "react-icons/md";
import {shareFolderFile,type FolderShare} from "./folder-sharing";
import {publishShare,type PublishedShare} from "./share-links";
import {useShareDialogFocus} from "./use-share-dialog-focus";

export function ShareLinkDialog({share,onClose}:{share:FolderShare;onClose:()=>void}){
 const [published,setPublished]=useState<PublishedShare|null>(null),[qr,setQr]=useState(""),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const request=useRef<AbortController|null>(null);
 useShareDialogFocus(true,onClose);
 async function publish(){
  request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError("");
  try{const result=await publishShare(share,controller.signal);if(controller.signal.aborted)return;setPublished(result);const data=await QRCode.toDataURL(result.url,{width:320,margin:4,errorCorrectionLevel:"M"});if(!controller.signal.aborted)setQr(data);}
  catch(e){if(!controller.signal.aborted)setError((e as Error).message);}finally{if(!controller.signal.aborted)setBusy(false);}
 }
 const start=useEffectEvent(publish);
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(active)void start();});return()=>{active=false;request.current?.abort();};},[]);
 return <div className="nested-dialog-backdrop"><section className="nested-dialog share-dialog share-link-dialog" role="dialog" aria-modal="true" aria-label="分享網址與 QR Code">
  <header><h3>{share.kind==="course"?"分享課程":"分享資料夾"}</h3><button className="icon-button" aria-label="關閉" onClick={onClose}><MdClose size={24}/></button></header>
  <div className="form"><div className="share-material-summary"><strong>{share.title||`${share.decks.length} 個資料夾`}</strong><span>{share.decks.reduce((n,d)=>n+d.cards.length,0)} 個單字</span></div>
  {published?<>{qr&&<img className="share-link-qr" src={qr} width={240} height={240} alt="分享 QR Code"/>}<label><span>分享網址</span><input readOnly value={published.url} onFocus={e=>e.target.select()}/></label><div className="share-expiry"><strong>7 天分享</strong><span>到期：{new Date(published.expiresAt).toLocaleString("zh-TW")}</span></div><button className="primary" onClick={()=>navigator.clipboard.writeText(published.url).catch(()=>setError("請選取上方網址手動複製"))}><MdContentCopy size={20}/>複製網址</button></>:busy?<p role="status"><span className="spinner"/>上傳並產生連結中…</p>:<button className="primary" onClick={()=>void publish()}>重試產生連結</button>}
  {error&&<p role="alert">{error}</p>}
  <button className="secondary" onClick={()=>void shareFolderFile(share).catch(e=>{if(e.name!=="AbortError")setError(e.message);})}><MdShare size={20}/>分享／下載 JSON</button></div>
 </section></div>;
}
