import {test,expect} from "@playwright/test";
test.use({serviceWorkers:"block"});
test.beforeEach(async({context})=>{await context.addInitScript(()=>{
 if(localStorage.getItem("share-quiz-seeded"))return;localStorage.setItem("share-quiz-seeded","yes");localStorage.setItem("vocab-web-entry-v1","browser");
 localStorage.setItem("vocab-pwa-state-v1",JSON.stringify({version:1,decks:[{id:"d1",name:"第一課",course:"英文",color:"#426B63",order:0}],cards:[{id:"c1",deckId:"d1",word:"apple",definition:"蘋果",notes:"PRIVATE-NOTE",mastered:true,intervalDays:30,order:0},{id:"c2",deckId:"d1",word:"banana",definition:"香蕉",notes:"",mastered:false,intervalDays:0,order:1}],logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"light",fullscreenOnLaunch:false,aiEnabled:false}}));
});});
test("share URL requires consent and creates local QR without exporting private notes",async({page})=>{
 const id="a".repeat(48),deleteToken="b".repeat(48);let posts=0;
 await page.route("**/api/shares",async route=>{posts++;const raw=route.request().postData()!;expect(raw).not.toContain("PRIVATE-NOTE");expect(raw).not.toContain("mastered");await route.fulfill({status:201,json:{url:new URL(page.url()).origin+"/share#"+id,id,deleteToken,expiresAt:Date.now()+604800000}});});
 await page.goto("/");await page.getByRole("navigation",{name:"主要導覽"}).getByRole("button",{name:"教材",exact:true}).click();await page.getByRole("button",{name:"開啟課程 英文",exact:true}).click();
 await page.getByRole("button",{name:"更多操作 第一課"}).click();await page.getByRole("menuitem",{name:"分享資料夾"}).click();await page.getByRole("button",{name:"分享網址／QR Code",exact:true}).click();
 expect(posts).toBe(0);await page.getByRole("button",{name:"同意上傳並產生連結"}).click();
 await expect(page.getByAltText("分享 QR Code")).toBeVisible();await expect(page.getByAltText("分享 QR Code")).toHaveAttribute("src",/^data:image\/png/);expect(posts).toBe(1);
});
test("shared landing page previews then imports a fresh copy",async({page},info)=>{
 const id="a".repeat(48);await page.route("**/api/shares/"+id,route=>route.fulfill({json:{expiresAt:Date.now()+604800000,share:{format:"vocab-folder-share",version:1,decks:[{name:"朋友教材",course:"日常",cards:[{word:"cat",definition:"貓"}]}]}}}));
 await page.goto("/share#"+id);await expect(page.getByText("朋友教材",{exact:false})).toBeVisible();await page.getByRole("button",{name:info.project.name==="iphone-webkit"?"存到目前瀏覽器":"在網頁匯入"}).click();
 const dialog=page.getByRole("dialog",{name:"匯入分享資料夾"});await expect(dialog).toBeVisible();await expect(dialog).toContainText("不沿用精熟度");await dialog.getByRole("button",{name:"下一步：確認匯入"}).click();await dialog.getByRole("button",{name:"確認匯入所選資料夾"}).click();await page.getByRole("button",{name:"開啟匯入教材"}).click();await expect(page.locator(".manage-card-list")).toContainText("cat");
});
test("quiz custom count and partial answer survive reload, completion removes checkpoint",async({page})=>{
 async function openQuiz(){await page.getByRole("navigation",{name:"主要導覽"}).getByRole("button",{name:"練習",exact:true}).click();await page.locator(".practice-tabs").getByRole("button",{name:"測驗",exact:true}).click();await page.getByRole("button",{name:/測驗全部/}).click();}
 await page.goto("/");await openQuiz();await page.getByRole("spinbutton",{name:"自訂題數（1–1000）"}).fill("1");await page.getByRole("button",{name:/中文填英文 ·/}).click();
 await page.getByPlaceholder("輸入完整英文單字").fill("partial");await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("vocab-quiz-session-v1")||"{}").typed)).toBe("partial");
 const ids=await page.evaluate(()=>JSON.parse(localStorage.getItem("vocab-quiz-session-v1")!).ids);await page.reload();await openQuiz();await page.getByRole("button",{name:"接續上次",exact:true}).click();await expect(page.getByPlaceholder("輸入完整英文單字")).toHaveValue("partial");await expect(page.locator(".quiz-frame-title")).toContainText("1 / 1");
 await page.getByPlaceholder("輸入完整英文單字").fill(ids[0]==="c1"?"apple":"banana");await page.getByRole("button",{name:"確認答案",exact:true}).click();await page.getByRole("button",{name:"查看結果",exact:true}).click();await expect(page.getByRole("heading",{name:"測驗完成",exact:true}).last()).toBeVisible();await expect.poll(()=>page.evaluate(()=>localStorage.getItem("vocab-quiz-session-v1"))).toBeNull();
});
