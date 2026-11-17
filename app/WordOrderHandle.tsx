"use client";
import {useEffect,useRef} from "react";
import {MdDragIndicator} from "react-icons/md";
type Drag={id:number;y:number;pointerY:number;row:HTMLElement;rows:HTMLElement[];index:number;target:number;height:number;tops:number[];heights:number[];listTop:number;scroll:HTMLElement|null;startScroll:number;placeholder:HTMLDivElement;frame:number};
function clearDrag(value:Drag){cancelAnimationFrame(value.frame);value.placeholder.remove();for(const row of value.rows){row.style.transform="";delete row.dataset.sortShift;}delete value.row.dataset.dragging;}
function preview(value:Drag){
 const delta=(value.scroll?.scrollTop??0)-value.startScroll;
 value.target=value.tops.filter((top,i)=>i!==value.index&&value.pointerY>top-delta+value.heights[i]/2).length;
 value.row.style.transform=`translateY(${value.pointerY-value.y+delta}px)`;
 value.rows.forEach((row,i)=>{if(i===value.index)return;const shift=i>=value.target&&i<value.index?value.height:i>value.index&&i<=value.target?-value.height:0;row.dataset.sortShift="true";row.style.transform=`translateY(${shift}px)`;});
 const gapTop=value.target>value.index?value.tops[value.target]+value.heights[value.target]-value.height:value.tops[value.target];
 value.placeholder.style.top=`${gapTop-value.listTop}px`;
}
export function SortableOrderHandle({label,kind="word",onMove}:{label:string;kind?:"word"|"folder";onMove:(offset:number)=>void}){
 const drag=useRef<Drag|null>(null);
 const reset=()=>{if(drag.current)clearDrag(drag.current);drag.current=null;};
 useEffect(()=>()=>{if(drag.current)clearDrag(drag.current);},[]);
 return <button className={kind==="folder"?"collection-drag":"icon-button word-drag"} aria-label={`拖曳排序 ${label}`} title="拖曳排序，或使用上下方向鍵"
 onKeyDown={e=>{if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();onMove(e.key==="ArrowUp"?-1:1);}}}
 onPointerDown={e=>{
  if(e.button!==0)return;const row=(kind==="folder"?e.currentTarget.closest<HTMLElement>(".selectable-folder"):null)??e.currentTarget.closest("article");if(!row)return;
  reset();e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
  const list=row.parentElement!,rows=Array.from(list.children).filter((item):item is HTMLElement=>item instanceof HTMLElement&&item.matches(kind==="folder"?".selectable-folder,.modern-collection-row":"article")),rects=rows.map(item=>item.getBoundingClientRect()),index=rows.indexOf(row),scroll=row.closest<HTMLElement>(".sheet-body")??document.scrollingElement as HTMLElement|null;
  const placeholder=document.createElement("div");placeholder.className=`sort-drop-placeholder ${kind}-drop-placeholder`;placeholder.setAttribute("aria-hidden","true");placeholder.style.height=`${rects[index].height}px`;list.appendChild(placeholder);
  const value:Drag={id:e.pointerId,y:e.clientY,pointerY:e.clientY,row,rows,index,target:index,height:rects[index].height,tops:rects.map(r=>r.top),heights:rects.map(r=>r.height),listTop:list.getBoundingClientRect().top,scroll,startScroll:scroll?.scrollTop??0,placeholder,frame:0};
  drag.current=value;row.dataset.dragging="true";preview(value);
  const tick=()=>{if(drag.current!==value)return;if(scroll){const bounds=scroll===document.scrollingElement?{top:0,bottom:window.innerHeight-100}:scroll.getBoundingClientRect(),edge=48;const speed=value.pointerY<bounds.top+edge?-Math.min(14,(bounds.top+edge-value.pointerY)/3):value.pointerY>bounds.bottom-edge?Math.min(14,(value.pointerY-bounds.bottom+edge)/3):0;if(speed){scroll.scrollTop+=speed;preview(value);}}value.frame=requestAnimationFrame(tick);};value.frame=requestAnimationFrame(tick);
 }}
 onPointerMove={e=>{const value=drag.current;if(!value||e.pointerId!==value.id)return;value.pointerY=e.clientY;preview(value);}}
 onPointerUp={e=>{const value=drag.current;if(!value||value.id!==e.pointerId)return;value.pointerY=e.clientY;preview(value);const offset=value.target-value.index;reset();if(offset)onMove(offset);}}
 onPointerCancel={reset} onLostPointerCapture={reset}><MdDragIndicator size={22}/></button>;
}

export function WordOrderHandle({word,onMove}:{word:string;onMove:(offset:number)=>void}){return <SortableOrderHandle label={word} onMove={onMove}/>;}
