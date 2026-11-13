import { test, expect } from "@playwright/test";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem("vocab-web-entry-v1", "browser");
    if (localStorage.getItem("liquid-fixture")) return;
    localStorage.setItem("liquid-fixture", "yes");
    localStorage.setItem("vocab-pwa-state-v1", JSON.stringify({ version:1,
      decks:[{id:"d1",name:"旅行",course:"日常英文",order:0},{id:"d2",name:"第一課",course:"學校英文",order:1}],
      cards:[{id:"c1",deckId:"d1",word:"resilient",definition:"有韌性的",order:0,nextReviewAt:1},{id:"c2",deckId:"d1",word:"persist",definition:"堅持",order:1,nextReviewAt:1}],
      logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"lightBlue",autoSpeak:false,fullscreenOnLaunch:false} }));
  });
});

test("blue choices and personal raster course cover survive restart and rename", async ({ page }, info) => {
  const errors:string[]=[]; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  const nav=page.getByRole("navigation",{name:"主要導覽"});
  await nav.getByRole("button",{name:"教材",exact:true}).click();
  await expect(page.getByRole("button",{name:"開啟課程 日常英文"})).toBeVisible();
  await expect(page.getByRole("article",{name:"旅行",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"自訂 日常英文 封面",exact:true}).click();
  // Actual PNG decoding, cropping and durable persistence; no remote image URL.
  const raster = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 80; canvas.height = 100; const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#96c6e9"; ctx.fillRect(0,0,80,100); return canvas.toDataURL("image/png").split(",")[1]; });
  await page.getByLabel("選擇課程封面圖片").setInputFiles({name:"cover.png",mimeType:"image/png",buffer:Buffer.from(raster,"base64")});
  await expect(page.locator(".cover-preview img")).toHaveAttribute("src",/^data:image\/jpeg/);
  await page.getByRole("button",{name:"儲存封面",exact:true}).click();
  await expect(page.locator(".course-book.has-photo img")).toHaveCount(1);
  await page.getByRole("button",{name:"開啟課程 日常英文"}).click();
  await expect(page.getByRole("article",{name:"旅行",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"重新命名課程",exact:true}).click();
  await page.locator(".nested-dialog input").fill("生活英文");
  await page.getByRole("button",{name:"儲存",exact:true}).click();
  await page.getByRole("button",{name:"返回課程"}).click();
  await expect(page.getByRole("button",{name:"開啟課程 生活英文"}).locator("img")).toHaveCount(1);
  await page.getByRole("button",{name:"設定",exact:true}).click();
  await page.getByRole("button",{name:"外觀",exact:true}).click();
  await page.getByRole("button",{name:"冰川藍",exact:true}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","iceBlue");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme","iceBlue", {timeout:15000});
  await nav.getByRole("button",{name:"教材",exact:true}).click();
  await expect(page.getByRole("button",{name:"開啟課程 生活英文"}).locator("img")).toHaveCount(1);
  await page.screenshot({path:info.outputPath("course-covers.png")});
  await page.setViewportSize({width:320,height:720});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("selection bubble moves; original left-forgot/right-remember swipe and undo remain", async ({ page }, info) => {
  await page.goto("/"); const nav=page.getByRole("navigation",{name:"主要導覽"});
  const first=await page.locator(".liquid-selection-bubble").boundingBox();
  await nav.getByRole("button",{name:"練習",exact:true}).click();
  await expect(nav.getByRole("button",{name:"練習",exact:true})).toHaveAttribute("aria-current","page");
  await expect.poll(async()=>{const next=await page.locator(".liquid-selection-bubble").boundingBox();return next!.x-first!.x;}).toBeGreaterThan(60);
  await expect.poll(async()=>{const lens=(await page.locator(".liquid-selection-bubble").boundingBox())!;const target=(await nav.getByRole("button",{name:"練習",exact:true}).boundingBox())!;return Math.abs(lens.x+lens.width/2-target.x-target.width/2);}).toBeLessThan(2);
  await page.getByRole("article",{name:"旅行",exact:true}).locator(".collection-main").click();
  await page.getByRole("button",{name:"依照順序",exact:true}).click();
  await expect(page.locator('.flip-face.front')).toContainText("resilient");
  const swipe=async(right:boolean)=>{const b=(await page.locator(".swipe-card-wrap").boundingBox())!;const x=b.x+b.width*(right?.25:.75);await page.mouse.move(x,b.y+b.height*.55);await page.mouse.down();await page.mouse.move(x+(right?120:-120),b.y+b.height*.55,{steps:8});await page.mouse.up();};
  await page.locator(".flip-rotor").click({position:{x:35,y:100}}); await expect(page.locator(".flip-rotor")).toHaveClass(/is-flipped/);
  await swipe(false); await expect(page.locator('.flip-face.front')).toContainText("persist");
  await swipe(true); await expect(page.locator(".study-completion h2")).toHaveText("本輪完成");
  await expect(page.getByRole("button",{name:"繼續複習（1）"})).toBeVisible();
  await page.getByRole("button",{name:"返回上一步",exact:true}).click();
  await expect(page.locator('.flip-face.front')).toContainText("persist");
  await page.screenshot({path:info.outputPath("swipe-study.png")});
});

test("reduced motion settles the bubble without animation and search stays accessible", async ({ page }) => {
  await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/");
  await page.getByRole("button",{name:"設定",exact:true}).click(); await page.getByRole("button",{name:"外觀",exact:true}).click();
  await page.getByRole("button",{name:"系統",exact:true}).click();
  await page.emulateMedia({colorScheme:"light"}); await expect(page.locator("html")).toHaveAttribute("data-theme","lightBlue");
  await page.emulateMedia({colorScheme:"dark"}); await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.getByRole("button",{name:"返回",exact:true}).click(); await page.getByRole("button",{name:"返回",exact:true}).click();
  await page.getByRole("navigation").getByRole("button",{name:"教材",exact:true}).click();
  await expect(page.locator(".liquid-selection-bubble")).toHaveCSS("transform",/matrix/);
  await page.getByRole("button",{name:"搜尋單字",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"搜尋英文單字或中文解釋"})).toBeVisible();
});
