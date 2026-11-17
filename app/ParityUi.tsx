"use client";

import { useRef, useState } from "react";
import {SortableOrderHandle} from "./WordOrderHandle";
import {ActionMenu} from "./ActionMenu";
import type { IconType } from "react-icons";
import { MdChevronRight, MdFolder, MdMoreVert } from "react-icons/md";

export function ListRow({ title, subtitle, icon: Glyph, onClick }: { title: string; subtitle?: string; icon: IconType; onClick: () => void }) {
  return <button className="modern-list-row" onClick={onClick}><Glyph size={24} aria-hidden="true" /><span><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span><MdChevronRight size={24} aria-hidden="true" /></button>;
}

export function CollectionRow({ title, subtitle, count, due, progress, mode = "manage", onManage, onLearn, onQuiz, onEdit, onDelete, onMove, onShare }: {
  onShare?:()=>void;
  title: string; subtitle: string; count: number; due?: number; progress?: number; mode?: "manage" | "learn" | "quiz";
  onManage: () => void; onLearn: () => void; onQuiz: () => void; onEdit?: () => void; onDelete?: () => void;
  onMove?: (offset: number) => void;
}) {
  const [anchor,setAnchor]=useState<DOMRect|null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close=(restore=true)=>{setAnchor(null);if(restore)trigger.current?.focus({preventScroll:true});};
  const primary = mode === "learn" ? onLearn : mode === "quiz" ? onQuiz : onManage;
  const actions = [{ label: "管理", action: onManage }, { label: "學習", action: onLearn, disabled: count === 0 }, { label: "測驗", action: onQuiz, disabled: count === 0 },
    ...(onEdit ? [{ label: "編輯", action: onEdit }] : []), ...(onShare ? [{label:"分享資料夾",action:onShare}]:[]), ...(onDelete ? [{ label: "刪除", action: onDelete }] : [])];
  return <article className="modern-collection-row" aria-label={title}>
    <button className="collection-main" onClick={primary} disabled={mode !== "manage" && count === 0}>
      <span className="collection-icon"><MdFolder size={20} aria-hidden="true" /></span>
      <span className="collection-copy"><strong>{title}</strong><small>{subtitle}</small><span>{count} 張單字{due !== undefined && ` · 待複習 ${due}`}</span></span>
    </button>
    {progress !== undefined && <div className="collection-progress"><span>{Math.floor(Math.max(0, Math.min(1, progress)) * 100)}%</span><div><i style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} /></div></div>}
    {onMove&&<SortableOrderHandle kind="folder" label={title} onMove={onMove}/>}
    <button ref={trigger} className="collection-more" aria-label={`更多操作 ${title}`} aria-haspopup="menu" aria-expanded={!!anchor} onClick={()=>anchor?close():setAnchor(trigger.current!.getBoundingClientRect())}><MdMoreVert size={24} aria-hidden="true" /></button>
    {anchor&&<ActionMenu anchor={anchor} trigger={trigger} label={`${title}的操作`} actions={actions.map(item=>({...item,danger:item.label==="刪除"}))} onClose={close} className="collection-menu"/>}
  </article>;
}
