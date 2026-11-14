"use client";
/* eslint-disable @next/next/no-img-element -- QR is generated locally. */
import {useState} from "react";
import QRCode from "qrcode/lib/browser";
import {MdClose,MdContentCopy,MdShare,MdDeleteOutline} from "react-icons/md";
import type {FolderShare} from "./folder-sharing";
import {publishShare,type PublishedShare} from "./share-links";
import {WorkflowSteps} from "./EditorialUi";
import {useShareDialogFocus} from "./use-share-dialog-focus";

export function ShareLinkDialog({share,onClose}:{share:FolderShare;onClose:()=>void}){
  const [published,setPublished]=useState<PublishedShare|null>(null),[qr,setQr]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useShareDialogFocus(true,()=>{if(!busy)onClose();});
  async function publish(){
    setBusy(true);setError("");
    try{const result=await publishShare(share);setPublished(result);setQr(await QRCode.toDataURL(result.url,{width:320,margin:4,errorCorrectionLevel:"M"}));}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function revoke(){
    if(!published||!confirm("確定撤銷？之後無法使用這個連結。"))return;
    setBusy(true);setError("");
    try{const response=await fetch(`/api/shares/${published.id}`,{method:"DELETE",headers:{Authorization:`Bearer ${published.deleteToken}`},signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error("撤銷失敗");onClose();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="nested-dialog-backdrop"><section className="nested-dialog share-dialog" role="dialog" aria-modal="true" aria-label="分享網址與 QR Code">
    <header><h3>分享教材</h3><button className="icon-button" aria-label="關閉" disabled={busy} onClick={onClose}><MdClose size={24}/></button></header>
    <WorkflowSteps current={published?2:1} labels={["選擇教材","確認上傳","取得連結"]}/>
    <div className="form">{published?<>
      <img className="share-link-qr" src={qr} width={240} height={240} alt="分享 QR Code"/>
      <label><span>分享網址</span><input readOnly value={published.url} onFocus={event=>event.target.select()}/></label>
      <div className="share-expiry"><strong>7 天分享</strong><span>到期：{new Date(published.expiresAt).toLocaleString("zh-TW")}</span></div>
      <p>讀取不會延長期限。持有連結的人可以讀取教材；關閉前可撤銷本次分享。</p>
      <button className="primary" onClick={()=>navigator.clipboard.writeText(published.url).catch(()=>setError("無法直接複製，請選取上方網址手動複製"))}><MdContentCopy size={20}/>複製網址</button>
      <button className="danger-text share-revoke" disabled={busy} onClick={()=>void revoke()}><MdDeleteOutline size={20}/>撤銷連結</button>
    </>:<>
      <div className="share-material-summary"><strong>{share.decks.length} 個資料夾</strong><span>{share.decks.reduce((count,deck)=>count+deck.cards.length,0)} 個單字</span></div>
      <div className="share-preview-names">{share.decks.map((deck,index)=><div key={index}><strong>{deck.name}</strong><small>{deck.course} · {deck.cards.length} 字</small></div>)}</div>
      <p>任何持有連結的人都可以讀取。7 天後自動刪除，不上傳學習進度、API Key 或聊天紀錄。若已選擇包含個人筆記，筆記也會上傳。</p>
      <button className="primary" disabled={busy} onClick={()=>void publish()}>{busy?<><span className="spinner"/>上傳中…</>:<><MdShare size={20}/>同意上傳並產生連結</>}</button>
    </>}{error&&<p role="alert">{error}</p>}</div>
  </section></div>;
}
