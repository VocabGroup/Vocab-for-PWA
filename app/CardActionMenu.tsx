"use client";
import {useRef,useState} from "react";
import {MdDeleteOutline,MdEdit,MdMoreVert,MdStarBorder,MdStar,MdVolumeUp} from "react-icons/md";
import type {Card} from "./types";
import {ActionMenu} from "./ActionMenu";

export function CardActionMenu({card,onEdit,onFavorite,onDelete,onSpeak}:{card:Card;onEdit:()=>void;onFavorite:()=>void;onDelete:()=>void;onSpeak:()=>void}){
  const [anchor,setAnchor]=useState<DOMRect|null>(null),trigger=useRef<HTMLButtonElement>(null);
  const close=(restore=true)=>{setAnchor(null);if(restore)trigger.current?.focus({preventScroll:true});};
  const actions=[{label:card.favorite?"取消收藏":"加入收藏",icon:card.favorite?MdStar:MdStarBorder,action:onFavorite},{label:"編輯",icon:MdEdit,action:onEdit},{label:"發音",icon:MdVolumeUp,action:onSpeak},{label:"刪除",icon:MdDeleteOutline,action:onDelete,danger:true}];
  return <><button ref={trigger} className="icon-button" aria-label={`單字操作 ${card.word}`} aria-expanded={!!anchor} aria-haspopup="menu" onClick={()=>anchor?close():setAnchor(trigger.current!.getBoundingClientRect())}><MdMoreVert size={24}/></button>{anchor&&<ActionMenu anchor={anchor} trigger={trigger} label={`${card.word} 的操作`} actions={actions} onClose={close}/>}</>;
}
