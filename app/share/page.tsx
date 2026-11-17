"use client";
/* eslint-disable @next/next/no-img-element -- QR is generated locally and must not be sent to an image optimizer. */
import {useEffect,useState} from "react";
import Link from "next/link";
import QRCode from "qrcode/lib/browser";
import {useRouter} from "next/navigation";
import {MdArrowForward,MdClose,MdBook,MdContentCopy,MdDownload,MdPhoneIphone,MdQrCode2,MdRefresh} from "react-icons/md";
import {parseFolderShare,type FolderShare} from "../folder-sharing";
import {androidShareIntent,receivingEnvironment,shareId} from "../share-receive";
import {SharedMaterialBrowser} from "../SharedMaterialBrowser";
import {useDialogFocus} from "../use-share-dialog-focus";

export default function SharedLessonPage(){
  const [share,setShare]=useState<FolderShare|null>(null),[error,setError]=useState(""),[expiry,setExpiry]=useState(0);
  const [environment,setEnvironment]=useState("desktop"),[id,setId]=useState(""),[url,setUrl]=useState("");
  const [help,setHelp]=useState(false),[qr,setQr]=useState(""),[notice,setNotice]=useState(""),[attempt,setAttempt]=useState(0),[unavailable,setUnavailable]=useState(false);
  const router=useRouter();
  const [methods,setMethods]=useState(false),[getting,setGetting]=useState(false);
  useDialogFocus(methods&&!!share,()=>setMethods(false),".receive-method-dialog");
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){
      setError("");setShare(null);setQr("");
      const standalone=matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
      const env=receivingEnvironment(navigator.userAgent+(navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent)?" iPad":""),standalone);
      setEnvironment(env);if(env==="android")setMethods(true);setUnavailable(new URLSearchParams(location.search).get("app")==="unavailable");
      const key=shareId(location.hash);setId(key);setUrl(`${location.origin}/share#${key}`);
      const response=await fetch(`/api/shares/${key}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)]),cache:"no-store"});
      const value=await response.json() as {error?:string;share?:unknown;expiresAt:number};
      if(!response.ok)throw Error(value.error||"讀取分享失敗");
      if(!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now())throw Error("分享已到期，請向分享者索取新連結");
      if(controller.signal.aborted)return;
      setShare(parseFolderShare(JSON.stringify(value.share)));setExpiry(value.expiresAt);
    }
    void load().catch(e=>{if(!controller.signal.aborted)setError(e.name==="TimeoutError"?"讀取逾時，請再試一次":e.message);});
    return()=>controller.abort();
  },[attempt]);
  async function copy(){try{await navigator.clipboard.writeText(url);setNotice("已複製分享網址");}catch{setNotice("請長按下方網址並複製");}}
  function receive(){
    if(!share)return;
    if(expiry<=Date.now()){setError("分享已到期，請索取新連結");return;}
    try{localStorage.setItem("vocab-web-entry-v1","browser");sessionStorage.setItem("vocab-pending-share",JSON.stringify(share));sessionStorage.setItem("vocab-pending-share-id",id);router.push("/");}
    catch{setNotice("無法準備匯入，請改下載 JSON 檔案");}
  }
  function download(){
    if(!share)return;
    const blob=URL.createObjectURL(new Blob([JSON.stringify(share,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=blob;a.download="Vocab.vocab-share.json";a.click();setTimeout(()=>URL.revokeObjectURL(blob),60000);
  }
  function get(){if(environment==="android"||environment==="ios"||environment==="embedded"){setGetting(true);setMethods(true);}else receive();}
  return <main className="share-receive-page workspace-share-page">
   {error?<section className="receive-state" role="alert"><MdBook size={36}/><h1>暫時無法開啟教材</h1><p>{error}</p><button className="secondary" onClick={()=>setAttempt(v=>v+1)}><MdRefresh/>重新讀取</button><Link href="/">返回 Vocab</Link></section>:!share?<section className="receive-state" role="status"><h1>正在準備教材預覽</h1><p>不會自動匯入或更動你的資料。</p></section>:<SharedMaterialBrowser key={id} share={share} expiresAt={expiry} onGet={get} onBack={()=>router.push("/")}/>}
   {share&&<details className="shared-transfer-options"><summary>其他接收方式</summary><p>連結七天到期；取得後的教材副本會保留。</p><button className="secondary" onClick={download}><MdDownload/>下載 JSON 檔案</button><button className="secondary" onClick={copy}><MdContentCopy/>複製分享網址</button><button className="secondary" onClick={async()=>{try{setQr(await QRCode.toDataURL(url,{width:240,margin:2}));}catch{setNotice("QR Code 暫時無法產生，請複製網址");}}}><MdQrCode2/>用另一台裝置接收</button>{qr&&<img src={qr} width={240} height={240} alt="掃描以開啟相同教材"/>}</details>}
   {share&&methods&&<div className="nested-dialog-backdrop"><section className="nested-dialog receive-method-dialog" role="dialog" aria-modal="true" aria-label="選擇開啟方式"><header><h3>{environment==="android"?"在 Vocab 開啟":"取得分享教材"}</h3><button className="icon-button" aria-label="關閉" onClick={()=>setMethods(false)}><MdClose/></button></header><div className="form">
    {environment==="android"?<><a className="primary" href={androidShareIntent(id,typeof location!=="undefined"?location.origin:"")}>前往安卓版開啟<MdArrowForward/></a><button className="secondary" onClick={()=>{setMethods(false);if(getting)receive();}}>繼續使用瀏覽器</button>{unavailable&&<p role="status">未能開啟 App，請確認已安裝新版，或使用瀏覽器取得。</p>}<a href="https://github.com/VocabGroup/Vocab-for-Android/releases/latest" target="_blank" rel="noopener noreferrer">下載／更新安卓版</a><small>瀏覽器不一定能確認安裝狀態；更新完成後重新開啟這個連結。</small></>:environment==="ios"?<><button className="primary" onClick={()=>setHelp(v=>!v)}><MdPhoneIphone/>存到主畫面版 Vocab</button><button className="secondary" onClick={receive}>存到目前瀏覽器</button><small>Safari 無法保證自動開啟已安裝的主畫面版；兩者資料可能分開儲存。</small></>:<><button className="primary" onClick={receive}>取得到目前瀏覽器</button><button className="secondary" onClick={()=>setHelp(v=>!v)}>使用外部瀏覽器的方法</button></>}
    {help&&<section className="receive-help"><h3>{environment==="ios"?"存到主畫面版":"換個瀏覽器接收"}</h3>{environment==="ios"?<ol><li>複製分享網址。</li><li>回主畫面開啟 Vocab。</li><li>到教材庫，點右下角 ＋ → 匯入分享網址。</li><li>貼上網址，預覽並確認取得。</li></ol>:<p>使用瀏覽器選單中的外部開啟，或將網址複製到 Safari／Chrome。</p>}<button className="secondary" onClick={copy}>複製分享網址</button><input aria-label="分享網址" readOnly value={url} onFocus={e=>e.target.select()}/></section>}
   </div></section></div>}{notice&&<p role="status">{notice}</p>}
  </main>;
}
