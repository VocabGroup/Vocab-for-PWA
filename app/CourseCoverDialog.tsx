"use client";
/* eslint-disable @next/next/no-img-element -- Covers are local compressed raster images. */
import { useState } from "react";
import {useDialogFocus} from "./use-share-dialog-focus";
import { MdClose, MdPhotoLibrary } from "react-icons/md";
import { COVER_PRESETS, courseCoverColor, courseCoverInk, prepareCourseCover } from "./course-covers";

export function CourseCoverDialog({ course, cover, onSave, onClose, mode, onConfirm, onDelete }: { course: string; cover?: string; onSave: (cover: string) => void; onClose: () => void; mode?:"create"|"edit";onConfirm?:(name:string,cover:string)=>void;onDelete?:()=>void }) {
  const [name,setName]=useState(course);
  const [draft, setDraft] = useState(cover ?? "preset:sky");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useDialogFocus(true,()=>{if(!busy)onClose();},'.cover-dialog');
  const title=mode==="create"?"新增課程":mode==="edit"?"編輯課程":"自訂課程封面";
  return <div className="nested-dialog-backdrop"><section className="nested-dialog cover-dialog" role="dialog" aria-modal="true" aria-label={title}>
    <header><h3>{title}</h3><button className="icon-button" aria-label="關閉" onClick={onClose}><MdClose size={24}/></button></header>
    <div className="form">{mode&&<label>課程名稱<input autoFocus value={name} maxLength={200} onChange={e=>{setName(e.target.value);setError("");}}/></label>}<div className={`cover-preview ${draft.startsWith("data:") ? "has-photo" : ""}`} style={{ backgroundColor: courseCoverColor(draft),color:courseCoverInk(draft) }}>{draft.startsWith("data:") && <img src={draft} alt="封面預覽"/>}<strong>{name||"我的新課程"}</strong></div>
      <div className="cover-presets">{COVER_PRESETS.map(p => <button key={p.id} type="button" aria-label={p.name} aria-pressed={draft === `preset:${p.id}`} style={{ backgroundColor: p.color }} onClick={() => setDraft(`preset:${p.id}`)}>{draft === `preset:${p.id}` ? "✓" : ""}</button>)}</div>
      <label className="custom-cover-color">自訂封面顏色<input type="color" aria-label="自訂封面顏色" value={courseCoverColor(draft)} onChange={e=>setDraft(e.target.value)}/><input key={draft} aria-label="封面 HEX 色碼" defaultValue={courseCoverColor(draft)} maxLength={7} onBlur={e=>{if(/^#[\da-f]{6}$/i.test(e.target.value)){setDraft(e.target.value);setError("");}else setError("色碼請使用 # 加六位英數字，例如 #DCE5FA");}}/></label>
      <label className="cover-upload"><MdPhotoLibrary size={22}/>{busy ? "處理圖片中…" : "選擇自己的圖片"}<input aria-label="選擇課程封面圖片" type="file" accept="image/*" disabled={busy} onChange={async event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setBusy(true); setError(""); try { setDraft(await prepareCourseCover(file)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}/></label>
      <small>圖片會置中裁切並儲存在此裝置，不會自動上傳到分享網址。</small>{error && <p role="alert">{error}</p>}
      <div className="dialog-form-actions"><button className="secondary" onClick={() => setDraft("preset:sky")}>還原預設</button><button className="primary" disabled={busy||(!!mode&&!name.trim())} onClick={() => {try{if(onConfirm)onConfirm(name.trim(),draft);else onSave(draft);}catch(e){setError((e as Error).message);}}}>{mode==="create"?"建立課程":mode==="edit"?"儲存課程":"儲存封面"}</button>{onDelete&&<button className="danger-button" style={{gridColumn:"1 / -1"}} disabled={busy} onClick={onDelete}>刪除課程</button>}</div>
    </div>
  </section></div>;
}
