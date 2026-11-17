import type {Course,VocabState} from "./types";
import {validCourseCover} from "./course-covers";
export function coursesFor(state:Pick<VocabState,"courses"|"decks"|"courseCovers">):Course[]{
 const names=new Set<string>(),result:Course[]=[];
 for(const course of Array.isArray(state.courses)?state.courses:[]){if(!course||typeof course.name!=="string"||!course.name.trim()||names.has(course.name))continue;names.add(course.name);result.push({id:typeof course.id==="string"?course.id:`legacy:${course.name}`,name:course.name,cover:validCourseCover(course.cover)?course.cover:"preset:sky",createdAt:Number.isFinite(course.createdAt)?course.createdAt:0});}
 for(const name of [...state.decks.map(d=>d.course),...Object.keys(state.courseCovers??{})]){if(!name||names.has(name))continue;names.add(name);result.push({id:`legacy:${encodeURIComponent(name)}`,name,cover:state.courseCovers?.[name]??"preset:sky",createdAt:0});}
 return result;
}
export function rememberDeck(state:VocabState,id:string,now=Date.now()):VocabState{
 if(!state.decks.some(d=>d.id===id))return state;
 return {...state,recentDecks:[{id,openedAt:now},...(state.recentDecks??[]).filter(d=>d.id!==id&&state.decks.some(deck=>deck.id===d.id))].slice(0,50)};
}
export function deleteCourse(state:VocabState,name:string):VocabState{
 const courses=coursesFor(state);
 if(!courses.some(course=>course.name===name))return state;
 const deckIds=new Set(state.decks.filter(deck=>deck.course===name).map(deck=>deck.id));
 const cardIds=new Set(state.cards.filter(card=>deckIds.has(card.deckId)).map(card=>card.id));
 return {...state,courses:courses.filter(course=>course.name!==name),courseCovers:Object.fromEntries(Object.entries(state.courseCovers??{}).filter(([course])=>course!==name)),
  decks:state.decks.filter(deck=>!deckIds.has(deck.id)),cards:state.cards.filter(card=>!deckIds.has(card.deckId)),
  reviewLogs:state.reviewLogs?.filter(log=>!cardIds.has(log.cardId)),recentDecks:state.recentDecks?.filter(deck=>!deckIds.has(deck.id)),
  quizRecords:state.quizRecords.filter(record=>!deckIds.has(record.deckId)).map(record=>({...record,wrongCardIds:record.wrongCardIds.filter(id=>!cardIds.has(id))}))};
}
export type ConflictPolicy="skip"|"overwrite";
const key=(word:string)=>word.trim().toLocaleLowerCase();
const content=(source:VocabState["cards"][number],target:VocabState["cards"][number])=>({...target,word:source.word,phonetic:source.phonetic,partOfSpeech:source.partOfSpeech,definition:source.definition,exampleSentence:source.exampleSentence,exampleTranslation:source.exampleTranslation,notes:source.notes});
const fresh=(source:VocabState["cards"][number],id:string,deckId:string,order:number)=>({...source,id,deckId,order,mastered:false,favorite:false,suspended:false,mistakeCount:0,repetitionCount:0,intervalDays:0,easeFactor:2.5,lastReviewedAt:undefined,nextReviewAt:Date.now()});
export function wordConflicts(state:VocabState,ids:string[],target:string){const seen=new Set(state.cards.filter(c=>c.deckId===target).map(c=>key(c.word))),conflicts=new Set<string>();for(const c of state.cards.filter(c=>ids.includes(c.id))){if(seen.has(key(c.word)))conflicts.add(c.word);seen.add(key(c.word));}return [...conflicts];}
export function folderConflicts(state:VocabState,ids:string[],target:string){const names=new Set(state.decks.filter(d=>d.course===target).map(d=>d.name)),conflicts=new Set<string>();for(const d of state.decks.filter(d=>ids.includes(d.id)&&d.course!==target)){if(names.has(d.name))conflicts.add(d.name);names.add(d.name);}return [...conflicts];}
export function transferFolders(state:VocabState,ids:string[],target:string,copy:boolean,id=()=>crypto.randomUUID(),policy:ConflictPolicy|"rename"="rename"):VocabState{
 if(!coursesFor(state).some(c=>c.name===target))throw Error("請選擇存在的目的課程");
 let decks=[...state.decks],cards=[...state.cards];const remap=new Map<string,string>(),removed=new Set<string>(),deckRemap=new Map<string,string>();
 for(const source of state.decks.filter(d=>ids.includes(d.id))){
  if(source.course===target)continue;
  const existing=decks.find(d=>d.course===target&&d.name===source.name);
  if(existing&&policy==="skip")continue;
  if(existing&&policy==="overwrite"){
   const oldCards=cards.filter(c=>c.deckId===existing.id),sources=state.cards.filter(c=>c.deckId===source.id).sort((a,b)=>a.order-b.order);
   const replacements=sources.map((c,index)=>{const match=oldCards.find(t=>key(t.word)===key(c.word));if(match){if(!copy)remap.set(c.id,match.id);return {...content(c,match),order:index};}return copy?fresh(c,id(),existing.id,index):{...c,deckId:existing.id,order:index};});
   const kept=new Set(replacements.map(c=>c.id));oldCards.filter(c=>!kept.has(c.id)).forEach(c=>removed.add(c.id));
   cards=cards.filter(c=>c.deckId!==existing.id&&(copy||c.deckId!==source.id)).concat(replacements);
   decks=decks.map(d=>d.id===existing.id?{...d,description:source.description,color:source.color}:d);
   if(!copy){decks=decks.filter(d=>d.id!==source.id);deckRemap.set(source.id,existing.id);}continue;
  }
  let name=source.name,n=2;while(decks.some(d=>d.course===target&&d.name===name&&d.id!==source.id))name=`${source.name}（${n++}）`;
  if(!copy){decks=decks.map(d=>d.id===source.id?{...d,course:target,name}:d);continue;}
  const deckId=id();decks.push({...source,id:deckId,course:target,name,order:decks.length,createdAt:Date.now()});cards.push(...state.cards.filter(c=>c.deckId===source.id).map((c,i)=>fresh(c,id(),deckId,i)));
 }
 return {...state,courses:coursesFor(state),decks,cards,reviewLogs:state.reviewLogs?.filter(r=>!removed.has(r.cardId)).map(r=>({...r,cardId:remap.get(r.cardId)??r.cardId})),quizRecords:state.quizRecords.map(q=>({...q,deckId:deckRemap.get(q.deckId)??q.deckId,wrongCardIds:[...new Set(q.wrongCardIds.map(card=>remap.get(card)??card))]})),recentDecks:state.recentDecks?.map(d=>({...d,id:deckRemap.get(d.id)??d.id})).filter((d,i,all)=>all.findIndex(x=>x.id===d.id)===i)};
}
export function copyWords(state:VocabState,ids:string[],target:string,id=()=>crypto.randomUUID(),policy:ConflictPolicy="skip"):{state:VocabState;added:number;skipped:number;overwritten:number}{
 if(!state.decks.some(d=>d.id===target))throw Error("目的資料夾不存在");
 let cards=[...state.cards],added=0,skipped=0,overwritten=0,order=Math.max(-1,...cards.filter(c=>c.deckId===target).map(c=>c.order))+1;
 for(const source of state.cards.filter(c=>ids.includes(c.id))){const match=cards.find(c=>c.deckId===target&&key(c.word)===key(source.word));if(match){if(policy==="skip")skipped++;else{cards=cards.map(c=>c.id===match.id?content(source,c):c);overwritten++;}}else{cards.push(fresh(source,id(),target,order++));added++;}}
 return {state:{...state,cards},added,skipped,overwritten};
}
export function moveWords(state:VocabState,ids:string[],target:string,policy:ConflictPolicy="skip"):{state:VocabState;moved:number;skipped:number;overwritten:number}{
 if(!state.decks.some(d=>d.id===target))throw Error("目的資料夾不存在");
 let cards=[...state.cards],moved=0,skipped=0,overwritten=0,order=Math.max(-1,...cards.filter(c=>c.deckId===target).map(c=>c.order))+1;const remap=new Map<string,string>();
 for(const source of state.cards.filter(c=>ids.includes(c.id))){if(source.deckId===target)continue;const match=cards.find(c=>c.deckId===target&&key(c.word)===key(source.word));if(match){if(policy==="skip"){skipped++;continue;}cards=cards.filter(c=>c.id!==source.id).map(c=>c.id===match.id?content(source,c):c);remap.set(source.id,match.id);overwritten++;}else cards=cards.map(c=>c.id===source.id?{...c,deckId:target,order:order++}:c);moved++;}
 return {state:{...state,cards,reviewLogs:state.reviewLogs?.map(r=>({...r,cardId:remap.get(r.cardId)??r.cardId})),quizRecords:state.quizRecords.map(q=>({...q,wrongCardIds:[...new Set(q.wrongCardIds.map(id=>remap.get(id)??id))]}))},moved,skipped,overwritten};
}
