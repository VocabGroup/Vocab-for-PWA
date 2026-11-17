"use client";
import {MdClose} from "react-icons/md";
import {useDialogFocus} from "./use-share-dialog-focus";
export type DuplicatePolicy="skip"|"overwrite";
export function DuplicateResolutionDialog({kind,names,onResolve,onClose}:{kind:"word"|"folder";names:string[];onResolve:(policy:DuplicatePolicy)=>void;onClose:()=>void}){
 useDialogFocus(true,onClose,".duplicate-resolution-dialog");
 return <div className="nested-dialog-backdrop duplicate-resolution-backdrop"><section className="nested-dialog duplicate-resolution-dialog" role="dialog" aria-modal="true" aria-label="發現重複內容"><header><h3>發現 {names.length} 個重複{kind==="word"?"單字":"資料夾"}</h3><button className="icon-button" aria-label="取消這次操作" onClick={onClose}><MdClose/></button></header><p>請選擇這次操作的處理方式。選擇前不會變更任何資料。</p><ul className="duplicate-names">{names.slice(0,50).map(name=><li key={name}>{name}</li>)}</ul>{names.length>50&&<p>另有 {names.length-50} 項，選擇將套用到全部重複項目。</p>}<p><strong>略過：</strong>保留目標內容，移動時重複的來源也會留在原處；其餘項目繼續處理。</p><p><strong>覆蓋：</strong>{kind==="word"?"使用來源的單字、解釋、例句與筆記，取代目標內容；保留目標原有的學習紀錄。":"以來源資料夾的名稱、說明、顏色與完整單字清單取代目標。相同單字保留目標學習紀錄；目標中不在來源的單字會移除。"} 移動時，成功覆蓋後才移除來源。</p><div className="dialog-actions"><button className="secondary" onClick={()=>onResolve("skip")}>略過</button><button className="danger-button" onClick={()=>onResolve("overwrite")}>覆蓋</button></div></section></div>;
}
