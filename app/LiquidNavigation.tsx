"use client";
import { useEffect, useRef } from "react";
import { MdHome, MdFolder, MdStyle, MdAutoAwesome, MdSearch } from "react-icons/md";

type Destination = "home" | "folders" | "study" | "ai";
const items = [{ id: "home", label: "今天", Icon: MdHome }, { id: "folders", label: "教材", Icon: MdFolder }, { id: "study", label: "練習", Icon: MdStyle }, { id: "ai", label: "助理", Icon: MdAutoAwesome }] as const;

export function LiquidNavigation({ selected, onSelect, onSearch }: { selected: Destination; onSelect: (tab: Destination) => void; onSearch: () => void }) {
  const bubble = useRef<HTMLSpanElement>(null), group = useRef<HTMLDivElement>(null);
  const position = useRef(0), frame = useRef(0);
  const index = items.findIndex(item => item.id === selected);
  useEffect(() => {
    const target = index; let last = 0, velocity = 0;
    const element = bubble.current; if (!element) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { position.current = target; element.style.transform = `translateX(${target * 100}%)`; return; }
    const tick = (time: number) => {
      const dt = Math.min((time - (last || time - 16)) / 1000, .032); last = time;
      velocity += ((target - position.current) * 220 - velocity * 20) * dt;
      position.current += velocity * dt;
      const lift = Math.min(1, Math.abs(velocity) / 5 + Math.abs(target - position.current) * .3);
      element.style.transform = `translateX(${position.current * 100}%) translateY(${-lift * 7}px) scale(${1 + lift * .16},${1 + lift * .25})`;
      element.style.setProperty("--bubble-lift", String(lift));
      if (Math.abs(target - position.current) > .001 || Math.abs(velocity) > .003) frame.current = requestAnimationFrame(tick);
      else { position.current = target; element.style.transform = `translateX(${target * 100}%)`; element.style.setProperty("--bubble-lift", "0"); }
    };
    frame.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame.current);
  }, [index]);
  const drag = useRef<{ x: number; index: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  return <nav className="liquid-navigation" aria-label="主要導覽"><div className="liquid-tab-group" ref={group}
    onPointerDown={event => { if (event.button !== 0) return; drag.current = { x: event.clientX, index, moved: false }; }}
    onPointerMove={event => { const gesture = drag.current; if (!gesture || !group.current || !bubble.current) return; const delta = event.clientX - gesture.x; if (Math.abs(delta) < 10 && !gesture.moved) return; gesture.moved = true; group.current.setPointerCapture(event.pointerId); cancelAnimationFrame(frame.current); const tabWidth = group.current.clientWidth / items.length; position.current = Math.max(-.1, Math.min(3.1, gesture.index + delta / tabWidth)); bubble.current.style.transform = `translateX(${position.current * 100}%) translateY(-7px) scale(1.12,1.22)`; }}
    onPointerUp={() => { const gesture = drag.current; drag.current = null; if (!gesture?.moved) return; suppressClick.current = true; setTimeout(() => { suppressClick.current = false; }, 0); const target = Math.max(0, Math.min(3, Math.round(position.current))); onSelect(items[target].id); if (target === index && bubble.current) { position.current = target; bubble.current.style.transform = `translateX(${target * 100}%)`; } }}
    onPointerCancel={() => { drag.current = null; position.current = index; if (bubble.current) bubble.current.style.transform = `translateX(${index * 100}%)`; }}>
      <span className="liquid-selection-bubble" aria-hidden="true" ref={bubble}/>
      {items.map(({id, label, Icon}) => <button key={id} className={id === selected ? "active" : ""} aria-current={id === selected ? "page" : undefined} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onSelect(id); }}><Icon size={24}/><span>{label}</span></button>)}
    </div><button className="liquid-search" aria-label="搜尋單字" onClick={onSearch}><MdSearch size={25}/></button></nav>;
}
