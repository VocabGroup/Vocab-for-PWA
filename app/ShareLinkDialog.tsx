"use client";
/* eslint-disable @next/next/no-img-element -- QR is generated locally, contains no remote tracking. */
import {useState} from "react";
import QRCode from "qrcode/lib/browser";
import type {FolderShare} from "./folder-sharing";
import {publishShare,type PublishedShare} from "./share-links";
export function ShareLinkDialog({share,onClose}:{share:FolderShare;onClose:()=>void}){
  const [published,setPublished]=useState<PublishedShare|null>(null),[qr,setQr]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  return <div className="nested-dialog-backdrop"><section className="nested-dialog share-dialog" role="dialog" aria-modal="true" aria-label="分享網址與 QR Code"><header><h3>分享網址與 QR Code</h3><button disabled={busy} onClick={onClose}>關閉</button></header><div className="form">
    {published?<><img src={qr} width={240} height={240} alt="分享 QR Code" style={{maxWidth:"100%",height:"auto",alignSelf:"center"}}/><label>分享網址<input readOnly value={published.url} onFocus={e=>e.target.select()}/></label><p>到期：{new Date(published.expiresAt).toLocaleString("zh-TW")}</p><p>讀取不會延長期限；關閉前可撤銷本次分享。</p><button onClick={()=>navigator.clipboard.writeText(published.url).catch(()=>setError("無法直接複製，請選取上方網址手動複製"))}>複製網址</button><button disabled={busy} onClick={async()=>{if(!confirm("確定撤銷？之後無法使用這個連結。"))return;setBusy(true);try{const r=await fetch(`/api/shares/${published.id}`,{method:"DELETE",headers:{Authorization:`Bearer ${published.deleteToken}`},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error("撤銷失敗");onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>撤銷連結</button></>:<><p>將上傳 {share.decks.length} 個資料夾、{share.decks.reduce((n,d)=>n+d.cards.length,0)} 個單字到雲端。</p><p>任何持有連結的人都可以讀取。7 天後自動刪除，不上傳學習進度、API Key 或聊天紀錄。若已選擇包含個人筆記，筆記也會上傳。</p><button disabled={busy} onClick={async()=>{setBusy(true);setError("");try{const p=await publishShare(share);setPublished(p);setQr(await QRCode.toDataURL(p.url,{width:320,margin:4,errorCorrectionLevel:"M"}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?"上傳中…":"同意上傳並產生連結"}</button></>}{error&&<p role="alert">{error}</p>}
  </div></section></div>;
}
