"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {parseFolderShare,type FolderShare} from "../folder-sharing";

export default function SharedLessonPage(){
  const [share,setShare]=useState<FolderShare|null>(null),[error,setError]=useState(""),[expiry,setExpiry]=useState("");
  const router=useRouter();
  useEffect(()=>{
    const controller=new AbortController();
    const load=async()=>{
      const id=location.hash.slice(1);if(!/^[a-f0-9]{48}$/.test(id))throw Error("分享網址不完整，請重新複製連結");
      const response=await fetch(`/api/shares/${id}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)]),cache:"no-store"});
      const value=await response.json() as {error?:string;share?:unknown;expiresAt:number};
      if(!response.ok)throw Error(value.error||"讀取失敗");
      setShare(parseFolderShare(JSON.stringify(value.share)));setExpiry(new Date(value.expiresAt).toLocaleString("zh-TW"));
    };
    load().catch(e=>{if(e.name!=="AbortError")setError(e.message);});return()=>controller.abort();
  },[]);
  function download(){
    if(!share)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(share,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="Vocab.vocab-share.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  return <main className="shared-lesson"><h1>Vocab 分享教材</h1><p>持有連結即可閱讀。匯入不沿用原作者的精熟度。</p>
    {error?<p role="alert">{error}</p>:!share?<p role="status">讀取分享中…</p>:<>
      <p>{share.decks.length} 個資料夾 · {share.decks.reduce((n,d)=>n+d.cards.length,0)} 個單字</p><p>到期：{expiry}</p>
      {share.decks.map((deck,i)=><details key={i}><summary>{deck.course} › {deck.name}（{deck.cards.length} 字）</summary>{deck.cards.slice(0,100).map((c,j)=><p key={j}><strong>{c.word}</strong> — {c.definition}</p>)}{deck.cards.length>100&&<p>僅預覽前 100 字，匯入包含全部。</p>}</details>)}
      <button className="primary" onClick={()=>{try{sessionStorage.setItem("vocab-pending-share",JSON.stringify(share));router.push("/");}catch{setError("無法準備匯入，請改下載 JSON 檔案");}}}>在網頁版預覽匯入</button>
      <button className="secondary" onClick={download}>下載 JSON（Android 可匯入）</button>
    </>}
    <p><Link href="/">回到 Vocab</Link></p>
  </main>;
}
