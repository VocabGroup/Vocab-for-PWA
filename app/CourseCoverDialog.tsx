"use client";
/* eslint-disable @next/next/no-img-element -- Covers are local compressed raster images. */
import { useState } from "react";
import {useDialogFocus} from "./use-share-dialog-focus";
import { MdClose, MdPhotoLibrary } from "react-icons/md";
import { COVER_PRESETS, courseCoverColor, prepareCourseCover } from "./course-covers";

export function CourseCoverDialog({ course, cover, onSave, onClose }: { course: string; cover?: string; onSave: (cover: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(cover ?? "preset:sky");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useDialogFocus(true,()=>{if(!busy)onClose();},'.cover-dialog');
  return <div className="nested-dialog-backdrop"><section className="nested-dialog cover-dialog" role="dialog" aria-modal="true" aria-label="自訂課程封面">
    <header><h3>自訂課程封面</h3><button className="icon-button" aria-label="關閉" onClick={onClose}><MdClose size={24}/></button></header>
    <div className="form"><div className={`cover-preview ${draft.startsWith("data:") ? "has-photo" : ""}`} style={{ backgroundColor: courseCoverColor(draft) }}>{draft.startsWith("data:") && <img src={draft} alt="封面預覽"/>}<strong>{course}</strong></div>
      <div className="cover-presets">{COVER_PRESETS.map(p => <button key={p.id} type="button" aria-label={p.name} aria-pressed={draft === `preset:${p.id}`} style={{ backgroundColor: p.color }} onClick={() => setDraft(`preset:${p.id}`)}>{draft === `preset:${p.id}` ? "✓" : ""}</button>)}</div>
      <label className="cover-upload"><MdPhotoLibrary size={22}/>{busy ? "處理圖片中…" : "選擇自己的圖片"}<input aria-label="選擇課程封面圖片" type="file" accept="image/*" disabled={busy} onChange={async event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setBusy(true); setError(""); try { setDraft(await prepareCourseCover(file)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}/></label>
      <small>圖片會置中裁切並儲存在此裝置，不會自動上傳到分享網址。</small>{error && <p role="alert">{error}</p>}
      <div className="dialog-form-actions"><button className="secondary" onClick={() => setDraft("preset:sky")}>還原預設</button><button className="primary" disabled={busy} onClick={() => onSave(draft)}>儲存封面</button></div>
    </div>
  </section></div>;
}
