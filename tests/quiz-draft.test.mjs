import test from "node:test";
import assert from "node:assert/strict";
import {loadSource} from "./load-source.mjs";
const {parseQuizDraft,quizFingerprint}=loadSource("app/quiz-draft.ts");
const cards=[{id:"1",word:"apple",definition:"蘋果",partOfSpeech:"n.",exampleSentence:"An apple.",exampleTranslation:"蘋果。",suspended:false}];
const draft={version:1,deckId:"deck",mode:"chineseTypeEnglish",ids:["1"],fingerprints:cards.map(quizFingerprint),index:0,score:0,wrong:[],selected:"",typed:"app",result:null,ordered:[],available:[],options:[],count:1,match:null};
test("quiz checkpoint retains partial answers and score, rejects missing or edited material",()=>{
 assert.equal(parseQuizDraft(JSON.stringify(draft),cards).typed,"app");
 assert.equal(parseQuizDraft(JSON.stringify(draft),[]),null);
 assert.equal(parseQuizDraft(JSON.stringify(draft),[{...cards[0],definition:"改過的教材"}]),null);
 for(const value of [{...draft,index:99},{...draft,score:-1},{...draft,mode:"invalid"},{...draft,count:1001},{...draft,ids:["1","1"]}])assert.equal(parseQuizDraft(JSON.stringify(value),cards),null);
});
