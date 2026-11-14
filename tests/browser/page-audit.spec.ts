import {test,expect,type Page,type Locator} from "@playwright/test";
test.use({serviceWorkers:"block"});
test.beforeEach(async({context})=>{
 await context.addInitScript(()=>{
  localStorage.setItem("vocab-web-entry-v1","browser");
  Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true});
  localStorage.setItem("vocab-pwa-state-v1",JSON.stringify({version:1,decks:Array.from({length:12},(_,i)=>({id:"d"+i,name:"教材資料夾"+i,course:"日常英文",description:"課程說明",order:i})),cards:Array.from({length:16},(_,i)=>({id:"c"+i,deckId:"d0",word:"word"+i,definition:"需要保留的解釋",notes:"需要保留的筆記",exampleSentence:"A useful example.",exampleTranslation:"實用的例句。",favorite:true,mastered:i%2===0,repetitionCount:3,intervalDays:10,nextReviewAt:1,order:i})),logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"lightBlue",autoSpeak:false,fullscreenOnLaunch:false}}));
 });
});
async function keyboard(page:Page,top=70,height=340){await page.evaluate(({top,height})=>{document.documentElement.style.setProperty("--visible-top",`${top}px`);document.documentElement.style.setProperty("--visible-height",`${height}px`);document.documentElement.dataset.keyboard="true";},{top,height});}
async function normal(page:Page){await page.evaluate(()=>{document.documentElement.style.removeProperty("--visible-top");document.documentElement.style.removeProperty("--visible-height");document.documentElement.dataset.keyboard="false";});}
async function bounded(element:Locator,top:number,height:number){const b=(await element.boundingBox())!;expect(b.y).toBeGreaterThanOrEqual(top-1);expect(b.y+b.height).toBeLessThanOrEqual(top+height+1);}
async function folders(page:Page){await page.getByRole("navigation",{name:"主要導覽"}).getByRole("button",{name:"教材",exact:true}).click();await page.getByRole("button",{name:"開啟課程 日常英文"}).click();}

test("folder menu near screen edge and edit/rename dialogs stay above the keyboard",async({page},info)=>{
 await page.setViewportSize({width:320,height:664});await page.goto("/");await folders(page);
 const trigger=page.getByRole("button",{name:"更多操作 教材資料夾11",exact:true});await trigger.scrollIntoViewIfNeeded();await trigger.click();
 await bounded(page.getByRole("menu"),0,664);await page.getByRole("menuitem",{name:"編輯",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"編輯資料夾",exact:true});await dialog.getByLabel("資料夾名稱 *",{exact:true}).fill("較長的教材名稱仍然可以編輯");await keyboard(page);
 await bounded(dialog,70,340);await dialog.getByRole("button",{name:"儲存",exact:true}).scrollIntoViewIfNeeded();await bounded(dialog.getByRole("button",{name:"儲存",exact:true}),70,340);
 await page.screenshot({path:info.outputPath("folder-dialog-keyboard.png")});await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await normal(page);
 await page.getByRole("button",{name:"重新命名課程",exact:true}).click();const rename=page.getByRole("dialog",{name:"重新命名課程",exact:true});await keyboard(page);await bounded(rename,70,340);await page.keyboard.press("Escape");await expect(rename).toHaveCount(0);
});
test("word menu, delete, move and add dialogs preserve every action in short viewports",async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/");await folders(page);await page.getByRole("article",{name:"教材資料夾0",exact:true}).locator(".collection-main").click();
 await keyboard(page,50,350);await page.getByRole("button",{name:"單字操作 word15",exact:true}).click();await bounded(page.getByRole("menu"),50,350);await expect(page.getByRole("menuitem")).toHaveCount(4);
 await page.getByRole("menuitem",{name:"刪除",exact:true}).click();const deletion=page.getByRole("dialog",{name:"刪除單字卡？",exact:true});await bounded(deletion,50,350);await page.keyboard.press("Escape");await expect(deletion).toHaveCount(0);
 await normal(page);await page.getByRole("button",{name:"多選管理",exact:true}).click();await page.getByRole("button",{name:"選取單字",exact:true}).first().click();await page.getByRole("button",{name:"移動",exact:true}).click();
 const move=page.locator(".manage-sheet .nested-dialog");await keyboard(page,50,350);await bounded(move,50,350);await page.keyboard.press("Escape");await expect(move).toHaveCount(0);
 await normal(page);await page.getByRole("button",{name:"完成多選",exact:true}).click();await page.getByRole("button",{name:"新增單字卡",exact:true}).click();const add=page.locator(".add-mode-dialog");await keyboard(page,50,350);await bounded(add,50,350);await page.screenshot({path:info.outputPath("word-actions-keyboard.png")});await page.keyboard.press("Escape");await expect(add).toHaveCount(0);
 await normal(page);await expect(page.locator(".manage-card-list>article")).toHaveCount(16);
});
test("new-folder sheet, cover picker and onboarding work on narrow and landscape screens",async({page},info)=>{
 await page.setViewportSize({width:320,height:640});await page.goto("/");await page.getByRole("button",{name:"新增資料夾",exact:true}).click();
 const add=page.getByRole("dialog");await add.getByLabel("名稱 *",{exact:true}).fill("新教材");await keyboard(page,60,330);await bounded(add,60,330);await add.getByRole("button",{name:"建立資料夾",exact:true}).scrollIntoViewIfNeeded();await bounded(add.getByRole("button",{name:"建立資料夾",exact:true}),60,330);await page.keyboard.press("Escape");await expect(add).toHaveCount(0);await normal(page);
 await page.getByRole("navigation",{name:"主要導覽"}).getByRole("button",{name:"教材",exact:true}).click();await page.getByRole("button",{name:"自訂 日常英文 封面",exact:true}).click();
 await page.setViewportSize({width:844,height:390});const cover=page.getByRole("dialog",{name:"自訂課程封面",exact:true});await bounded(cover,0,390);await cover.getByRole("button",{name:"儲存封面",exact:true}).scrollIntoViewIfNeeded();await expect(cover.getByRole("button",{name:"儲存封面",exact:true})).toBeVisible();await page.keyboard.press("Escape");await expect(cover).toHaveCount(0);
 await page.goto("/?preview=onboarding");await expect(page.getByRole("heading",{name:"每天想學幾張？"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath("onboarding-landscape.png")});
});
test("every settings subpage stays readable; reminder and destructive dialogs remain cancellable",async({page},info)=>{
 await page.setViewportSize({width:320,height:640});await page.goto("/");await page.getByRole("button",{name:"設定",exact:true}).click();
 for(const name of ["外觀","學習","AI","掃描與文件","單字查詢","發音與提醒","更新","資料"]){
  await page.getByRole("button",{name,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`settings-${name}.png`)});await page.getByRole("button",{name:"返回",exact:true}).click();
 }
 await page.getByRole("button",{name:"資料",exact:true}).click();await page.getByRole("button",{name:/清空所有資料並從 0 開始/}).click();const clear=page.getByRole("dialog",{name:"清空所有資料？",exact:true});await keyboard(page,50,300);await bounded(clear,50,300);await page.keyboard.press("Escape");await expect(clear).toHaveCount(0);await normal(page);await page.getByRole("button",{name:"返回",exact:true}).click();
 await page.getByRole("button",{name:"外觀",exact:true}).click();await page.getByRole("button",{name:"暗色",exact:true}).click();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");await page.screenshot({path:info.outputPath("settings-dark.png")});
});
