"use client";
/* eslint-disable @next/next/no-img-element -- QR is generated locally and must not be sent to an image optimizer. */
import {useEffect,useState} from "react";
import Link from "next/link";
import QRCode from "qrcode/lib/browser";
import {useRouter} from "next/navigation";
import {MdArrowBack,MdArrowForward,MdBook,MdCheck,MdContentCopy,MdDownload,MdPhoneIphone,MdQrCode2,MdRefresh} from "react-icons/md";
import {parseFolderShare,type FolderShare,type SharedDeck} from "../folder-sharing";
import {androidShareIntent,receivingEnvironment,shareId} from "../share-receive";
import {WorkflowSteps} from "../EditorialUi";

export default function SharedLessonPage(){
  const [share,setShare]=useState<FolderShare|null>(null),[error,setError]=useState(""),[expiry,setExpiry]=useState(0);
  const [environment,setEnvironment]=useState("desktop"),[id,setId]=useState(""),[url,setUrl]=useState("");
  const [help,setHelp]=useState(false),[qr,setQr]=useState(""),[notice,setNotice]=useState(""),[attempt,setAttempt]=useState(0),[unavailable,setUnavailable]=useState(false);
  const router=useRouter();
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){
      setError("");setShare(null);setQr("");
      const standalone=matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
      const env=receivingEnvironment(navigator.userAgent+(navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent)?" iPad":""),standalone);
      setEnvironment(env);setUnavailable(new URLSearchParams(location.search).get("app")==="unavailable");
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
    try{sessionStorage.setItem("vocab-pending-share",JSON.stringify(share));sessionStorage.setItem("vocab-pending-share-id",id);router.push("/");}
    catch{setNotice("無法準備匯入，請改下載 JSON 檔案");}
  }
  function download(){
    if(!share)return;
    const blob=URL.createObjectURL(new Blob([JSON.stringify(share,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=blob;a.download="Vocab.vocab-share.json";a.click();setTimeout(()=>URL.revokeObjectURL(blob),60000);
  }
  const count=share?.decks.reduce((n,d)=>n+d.cards.length,0)||0;
  const courses=Array.from(new Set(share?.decks.map(d=>d.course)||[]));
  const title=courses.length===1?courses[0]:"分享教材";
  return <main className="share-receive-page">
    <header className="receive-header"><Link href="/" aria-label="回到 Vocab"><MdArrowBack size={22}/></Link><strong>Vocab</strong><span>教材分享</span></header>
    <WorkflowSteps labels={["預覽教材","選擇存放位置","確認匯入"]} current={0}/>
    {error?<section className="receive-state" role="alert"><MdBook size={36}/><h1>暫時無法開啟教材</h1><p>{error}</p><button className="secondary" onClick={()=>setAttempt(v=>v+1)}><MdRefresh/>重新讀取</button><p>已到期或停止分享的連結，需要請分享者重新產生。</p></section>:!share?<section className="receive-state" role="status"><h1>正在準備教材預覽</h1><p>不會自動匯入或更動你的資料。</p></section>:<>
      <a className="receive-quick" href="#receive-methods">選擇接收方式<MdArrowForward/></a>
      <section className="receive-hero"><div className="receive-book" aria-hidden="true"><MdBook size={40}/><small>VOCAB</small></div><div><span className="eyebrow">分享給你的學習材料</span><h1>{title}</h1><p>{share.decks.length} 個資料夾 <span>·</span> {count} 個單字</p><small>有效至 {new Date(expiry).toLocaleString("zh-TW")}</small></div></section>
      <div className="receive-layout"><section className="receive-materials" aria-label="教材內容"><h2>裡面有什麼</h2>{share.decks.map((deck,i)=><SharedDeckPreview key={i} deck={deck} index={i}/>)}</section>
      <aside className="receive-actions" id="receive-methods"><h2>收進你的教材</h2><p><MdCheck/>匯入成自己的副本</p><p><MdCheck/>精熟度與複習進度重新開始</p><p><MdCheck/>保留現有教材，不直接覆蓋</p>
      {environment==="android"&&<><a className="primary" href={androidShareIntent(id,typeof location!=="undefined"?location.origin:"")}>用安卓版開啟<MdArrowForward/></a>{unavailable&&<p role="status">未能開啟 App？請確認已安裝支援分享連結的新版，或繼續使用網頁版。</p>}<button className="secondary" onClick={receive}>在網頁匯入</button><a className="receive-text-link" href="https://github.com/VocabGroup/Vocab-for-Android/releases/latest" target="_blank" rel="noopener noreferrer">下載安卓版</a><small>安裝完成後，重新點開原分享連結即可接收。</small></>}
      {environment==="ios"?<><button className="primary" onClick={()=>setHelp(v=>!v)}><MdPhoneIphone/>存到主畫面版 Vocab</button><button className="secondary" onClick={receive}>存到目前瀏覽器</button><small>瀏覽器與主畫面版的教材可能分開儲存。</small></>:environment!=="android"&&<><button className="primary" onClick={receive}>加入我的教材<MdArrowForward/></button><small>{environment==="standalone"?"將匯入目前這個 Vocab。":environment==="embedded"?"將存到目前的內建瀏覽器，建議先以外部瀏覽器開啟。":"將匯入目前瀏覽器中的 Vocab。"}</small></>}
      {environment==="embedded"&&<button className="secondary" onClick={()=>setHelp(v=>!v)}>使用外部瀏覽器的方法</button>}
      {help&&<section className="receive-help"><h3>{environment==="ios"?"存到主畫面版":"換個瀏覽器接收"}</h3>{environment==="ios"?<ol><li>複製下方分享網址。</li><li>回到主畫面，開啟 Vocab。</li><li>到教材的分享與匯入，選「匯入分享網址」。</li><li>貼上網址，預覽並確認匯入。</li></ol>:<p>在目前瀏覽器的選單選擇以外部瀏覽器開啟；若沒有這個選項，複製網址後貼到 Safari 或 Chrome。</p>}<button className="secondary" onClick={copy}><MdContentCopy/>複製分享網址</button><input readOnly aria-label="分享網址" value={url} onFocus={e=>e.target.select()}/></section>}
      <details className="receive-other"><summary>其他接收方式</summary><button className="secondary" onClick={download}><MdDownload/>下載 JSON 檔案</button>{environment!=="ios"&&<button className="secondary" onClick={copy}><MdContentCopy/>複製分享網址</button>}<button className="secondary" onClick={async()=>{try{setQr(await QRCode.toDataURL(url,{width:240,margin:2}));}catch{setNotice("QR Code 暫時無法產生，請複製網址");}}}><MdQrCode2/>用另一台裝置接收</button>{qr&&<img src={qr} width={240} height={240} alt="用手機掃描以開啟相同教材"/>}</details>
      <p className="receive-footnote">連結七天到期；已匯入的副本會保留。持有連結的人皆可閱讀及轉傳。</p>{notice&&<p role="status">{notice}</p>}</aside></div>
    </>}
  </main>;
}

function SharedDeckPreview({deck,index}:{deck:SharedDeck;index:number}){
  const [expanded,setExpanded]=useState(false);
  return <details open={index===0}><summary><span className="receive-folder-index">{String(index+1).padStart(2,"0")}</span><span><strong>{deck.name}</strong><small>{deck.course} · {deck.cards.length} 字</small></span><MdArrowForward/></summary><div className="receive-word-list">{deck.description&&<p>{deck.description}</p>}{deck.cards.slice(0,expanded?100:5).map((card,j)=><article key={j}><strong lang="en">{card.word}</strong>{card.phonetic&&<small>{card.phonetic}</small>}<p>{card.definition}</p>{card.exampleSentence&&<details><summary>例句</summary><p lang="en">{card.exampleSentence}</p><p>{card.exampleTranslation}</p></details>}{card.notes&&<details><summary>教材筆記</summary><p>{card.notes}</p></details>}</article>)}{deck.cards.length>5&&<button className="receive-text-link" onClick={()=>setExpanded(value=>!value)}>{expanded?"收合預覽":`查看更多單字（共 ${deck.cards.length} 字）`}</button>}{expanded&&deck.cards.length>100&&<p>預覽前 100 字，匯入時包含全部 {deck.cards.length} 字。</p>}</div></details>;
}
