import type {Card} from "./types";
export const QUIZ_DRAFT_KEY="vocab-quiz-session-v1";
export type MatchProgress={remaining:string[];active:string[];left:string|null;right:string|null;correct:number;wrong:string[]};
export type QuizDraft={version:1;deckId:string;mode:string;ids:string[];fingerprints:string[];index:number;score:number;wrong:string[];selected:string;typed:string;result:boolean|null;ordered:string[];available:string[];options:string[];count:number;match:MatchProgress|null};
export const quizFingerprint=(c:Card)=>JSON.stringify([c.word,c.definition,c.partOfSpeech,c.exampleSentence,c.exampleTranslation,c.suspended]);
const modes=new Set(["chineseToEnglish","englishToChinese","chineseTypeEnglish","clozeChoice","clozeTyping","listeningChoice","listeningSpelling","sentenceOrder","partOfSpeech","synonym","match"]);
export function parseQuizDraft(raw:string,cards:Card[]):QuizDraft|null{
 try{
  if(raw.length>2_000_000)return null;
  const d=JSON.parse(raw) as QuizDraft;
  if(d.version!==1||!modes.has(d.mode)||typeof d.deckId!=="string"||!Array.isArray(d.ids)||!d.ids.length||d.ids.length>1000||new Set(d.ids).size!==d.ids.length||!Array.isArray(d.fingerprints)||d.fingerprints.length!==d.ids.length||!Number.isInteger(d.index)||d.index<0||d.index>=d.ids.length||!Number.isInteger(d.score)||d.score<0||d.score>d.ids.length||!(d.result===null||typeof d.result==="boolean"))return null;
  const byId=new Map(cards.map(c=>[c.id,c]));
  if(d.ids.some((id,i)=>!byId.has(id)||quizFingerprint(byId.get(id)!)!==d.fingerprints[i]))return null;
  for(const field of [d.wrong,d.ordered,d.available,d.options])if(!Array.isArray(field)||field.length>1000||field.some(x=>typeof x!=="string"))return null;
  if(typeof d.typed!=="string"||typeof d.selected!=="string"||!Number.isInteger(d.count)||d.count<1||d.count>1000)return null;
  if(d.mode==="match"&&d.match){const m=d.match;if(!Array.isArray(m.active)||!Array.isArray(m.remaining)||!Array.isArray(m.wrong)||[...m.active,...m.remaining,...m.wrong].some(id=>!d.ids.includes(id))||!Number.isInteger(m.correct)||m.correct<0||m.correct>=d.ids.length)return null;}
  return d;
 }catch{return null;}
}
