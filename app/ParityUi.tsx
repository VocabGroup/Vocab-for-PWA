"use client";

import { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { MdChevronRight, MdFolder, MdMoreVert, MdDragHandle } from "react-icons/md";

export function ListRow({ title, subtitle, icon: Glyph, onClick }: { title: string; subtitle?: string; icon: IconType; onClick: () => void }) {
  return <button className="modern-list-row" onClick={onClick}><Glyph size={24} aria-hidden="true" /><span><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span><MdChevronRight size={24} aria-hidden="true" /></button>;
}

export function CollectionRow({ title, subtitle, count, due, progress, mode = "manage", onManage, onLearn, onQuiz, onEdit, onDelete, onMove, onShare }: {
  onShare?:()=>void;
  title: string; subtitle: string; count: number; due?: number; progress?: number; mode?: "manage" | "learn" | "quiz";
  onManage: () => void; onLearn: () => void; onQuiz: () => void; onEdit?: () => void; onDelete?: () => void;
  onMove?: (offset: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const start = useRef<number | null>(null);
  const [dragY, setDragY] = useState<number | null>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard); };
  }, [open]);
  const primary = mode === "learn" ? onLearn : mode === "quiz" ? onQuiz : onManage;
  const actions = [{ label: "管理", action: onManage }, { label: "學習", action: onLearn, disabled: count === 0 }, { label: "測驗", action: onQuiz, disabled: count === 0 },
    ...(onEdit ? [{ label: "編輯", action: onEdit }] : []), ...(onShare ? [{label:"分享資料夾",action:onShare}]:[]), ...(onDelete ? [{ label: "刪除", action: onDelete }] : [])];
  return <article className={`modern-collection-row ${dragY !== null ? "collection-lifted" : ""}`} style={dragY !== null ? { transform: `translateY(${dragY}px) scale(1.025)`, zIndex: 40 } : undefined} ref={root} aria-label={title}>
    <button className="collection-main" onClick={primary} disabled={mode !== "manage" && count === 0}>
      <span className="collection-icon"><MdFolder size={20} aria-hidden="true" /></span>
      <span className="collection-copy"><strong>{title}</strong><small>{subtitle}</small><span>{count} 張單字{due !== undefined && ` · 待複習 ${due}`}</span></span>
    </button>
    {progress !== undefined && <div className="collection-progress"><span>{Math.floor(Math.max(0, Math.min(1, progress)) * 100)}%</span><div><i style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} /></div></div>}
    {onMove && <button className="collection-drag" aria-label={`拖曳排序 ${title}`} title="拖曳排序；方向鍵可移動" onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); onMove(event.key === "ArrowUp" ? -1 : 1); } }}
      onPointerDown={event => { event.preventDefault(); start.current = event.clientY; setDragY(0); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (start.current !== null) setDragY(event.clientY - start.current); }}
      onPointerUp={event => { if (start.current !== null) { const distance = event.clientY - start.current; const height = (root.current?.offsetHeight ?? 90) + 12; if (Math.abs(distance) > height / 2) onMove(Math.round(distance / height)); } start.current = null; setDragY(null); }}
      onPointerCancel={() => { start.current = null; setDragY(null); }}><MdDragHandle size={22} aria-hidden="true" /></button>}
    <button ref={trigger} className="collection-more" aria-label={`更多操作 ${title}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><MdMoreVert size={24} aria-hidden="true" /></button>
    {open && <div className="collection-menu" role="menu" aria-label={`${title}的操作`}>{actions.map(item => <button key={item.label} role="menuitem" disabled={item.disabled} className={item.label === "刪除" ? "danger-text" : ""} onClick={() => { close(); item.action(); }}>{item.label}</button>)}</div>}
  </article>;
}
