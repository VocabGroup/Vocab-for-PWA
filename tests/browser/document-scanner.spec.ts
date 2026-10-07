import { test, expect } from "@playwright/test";

// Isolate existing screen tests from first-visit install/fullscreen prompts.
test.beforeEach(async ({context}) => { await context.addInitScript(() => { localStorage.setItem("vocab-web-entry-v1","browser"); Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true}); }); });
test.use({serviceWorkers:"block"});
const paper={name:"document.svg",mimeType:"image/svg+xml",buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#18202b"/><path d="M130 100 L690 145 L645 900 L100 845 Z" fill="white"/><g fill="#131313"><text x="190" y="270" font-size="45">persist</text><text x="190" y="420" font-size="45">resilient</text></g></svg>')};
test.beforeEach(async({context})=>{
  await context.addInitScript(()=>localStorage.setItem("vocab-pwa-state-v1",JSON.stringify({version:1,decks:[{id:"d1",name:"掃描測試",course:"英文",order:0}],cards:[],logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"light",aiEnabled:true,usePersonalAiApi:true,aiProvider:"gemini",aiApiKey:"fake-test-key",aiModel:"gemini-flash-latest"}})));
});

test("live camera continuously redetects moving paper; shutter uses current frame and releases camera",async({page,context},info)=>{
  await context.addInitScript(()=>{
    const fixture=window as Window & {movePaper?:number;cameraTracks?:MediaStreamTrack[]};
    fixture.movePaper=0;
    const canvas=document.createElement("canvas");canvas.width=640;canvas.height=480;
    const draw=()=>{const ctx=canvas.getContext("2d")!;ctx.fillStyle="#121a22";ctx.fillRect(0,0,640,480);const x=fixture.movePaper ?? 0;ctx.fillStyle="white";ctx.beginPath();ctx.moveTo(50+x,50);ctx.lineTo(340+x,65);ctx.lineTo(320+x,430);ctx.lineTo(40+x,410);ctx.closePath();ctx.fill();ctx.fillStyle="black";ctx.font="25px sans-serif";ctx.fillText("persist",90+x,130);};
    // Simulate only the camera boundary: real Scanic still processes changing pixels.
    // Playwright's Windows WebKit build does not expose hardware MediaDevices.
    Object.defineProperty(navigator,"mediaDevices",{value:{getUserMedia:async()=>{draw();const track={readyState:"live",stop(){this.readyState="ended";},addEventListener(){}};fixture.cameraTracks=[track as unknown as MediaStreamTrack];setInterval(draw,60);return {getTracks:()=>fixture.cameraTracks,getVideoTracks:()=>fixture.cameraTracks};}},configurable:true});
    Object.defineProperty(HTMLMediaElement.prototype,"srcObject",{get(){return null;},set(){},configurable:true});
    Object.defineProperty(HTMLMediaElement.prototype,"play",{value:()=>Promise.resolve(),configurable:true});
    Object.defineProperty(HTMLMediaElement.prototype,"paused",{get:()=>false,configurable:true});
    Object.defineProperty(HTMLVideoElement.prototype,"videoWidth",{get:()=>640,configurable:true});Object.defineProperty(HTMLVideoElement.prototype,"videoHeight",{get:()=>480,configurable:true});
    const original=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=(function(this:CanvasRenderingContext2D,...args:Parameters<typeof original>){if(args[0] instanceof HTMLVideoElement)args[0]=canvas;return original.apply(this,args);}) as typeof original;
  });
  await page.goto("/");await page.getByRole("button",{name:"掃描匯入",exact:true}).click();await page.getByRole("button",{name:"掃描",exact:true}).click();
  await expect(page.getByRole("button",{name:"快門",exact:true})).toBeEnabled();
  const outline=page.locator(".live-camera-outline");await expect(outline).toHaveAttribute("data-detected","true");
  const left=()=>outline.evaluate((element:HTMLCanvasElement)=>{const ctx=element.getContext("2d")!,data=ctx.getImageData(0,0,element.width,element.height).data;let min=element.width;for(let i=0;i<data.length;i+=4)if(data[i+1]>180 && data[i]<150 && data[i+3]>200)min=Math.min(min,(i/4)%element.width);return min;});
  const original=await left();await page.evaluate(()=>{(window as Window & {movePaper?:number}).movePaper=170;});
  await expect.poll(left).toBeGreaterThan(original+100);
  await page.screenshot({path:info.outputPath("live-camera.png")});
  await page.getByRole("button",{name:"快門",exact:true}).click();
  await expect(page.locator(".scanic-handle")).toHaveCount(4);await expect(page.getByRole("button",{name:"裁切並保留"})).toBeEnabled();
  expect(await page.evaluate(()=>(window as unknown as {cameraTracks:MediaStreamTrack[]}).cameraTracks.every(track=>track.readyState==="ended"))).toBe(true);
  await expect(page.locator(".live-document-camera")).toHaveCount(0);
  await page.getByRole("button",{name:"裁切並保留"}).click();await expect(page.getByRole("img",{name:"掃描第 1 頁"})).toBeVisible();
  await page.getByRole("button",{name:"拍下一頁",exact:true}).click();await expect(page.getByRole("button",{name:"快門",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"關閉即時鏡頭",exact:true}).click();
  expect(await page.evaluate(()=>(window as unknown as {cameraTracks:MediaStreamTrack[]}).cameraTracks.every(track=>track.readyState==="ended"))).toBe(true);
});

test("camera permission denial keeps file fallback usable",async({page,context})=>{
  await context.addInitScript(()=>Object.defineProperty(navigator,"mediaDevices",{value:{getUserMedia:async()=>{throw new DOMException("denied","NotAllowedError");}},configurable:true}));
  await page.goto("/");await page.getByRole("button",{name:"掃描匯入",exact:true}).click();await page.getByRole("button",{name:"掃描",exact:true}).click();
  await expect(page.locator(".live-document-camera")).toContainText("未取得相機權限");await expect(page.getByRole("button",{name:"快門",exact:true})).toBeDisabled();
  await page.getByTestId("scan-next-photo").setInputFiles(paper);
  await expect(page.getByRole("button",{name:"裁切並保留",exact:true})).toBeEnabled();
});

test("real Scanic detects, adjusts and rectifies locally, then recognizes pages in order",async({page},info)=>{
  const calls:{mime:string;data:string}[]=[];
  await page.route("https://generativelanguage.googleapis.com/**",async route=>{
    const body=route.request().postDataJSON();
    const image=body.contents.flatMap((item:{parts:unknown[]})=>item.parts).find((item:{inlineData?:unknown})=>item.inlineData).inlineData;
    calls.push({mime:image.mimeType,data:image.data});
    await route.fulfill({json:{candidates:[{content:{parts:[{text:JSON.stringify({cards:[{word:calls.length===1 ? "persist":"resilient",definition:"掃描定義"}]})}]}}]}});
  });
  await page.goto("/");await page.getByRole("button",{name:"掃描匯入",exact:true}).click();
  await page.getByTestId("document-scan-input").setInputFiles(paper);
  await expect(page.getByRole("heading",{name:"文件掃描",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"裁切並保留",exact:true})).toBeEnabled();
  await expect(page.locator(".scanic-handle")).toHaveCount(4);
  await expect(page.getByRole("status")).toContainText("已偵測邊框");
  const corner=page.locator(".scanic-handle").first(),box=(await corner.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+15,box.y+box.height/2+10,{steps:4});await page.mouse.up();
  await page.screenshot({path:info.outputPath("document-corners.png")});
  expect((await page.locator(".document-scan-overlay>header").boundingBox())!.y).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(calls).toHaveLength(0);
  await page.getByRole("button",{name:"裁切並保留",exact:true}).click();
  const preview=page.getByRole("img",{name:"掃描第 1 頁"});await expect(preview).toBeVisible();
  await expect.poll(()=>preview.evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBeGreaterThan(100);
  const dimensions=await preview.evaluate((element:HTMLImageElement)=>({width:element.naturalWidth,height:element.naturalHeight}));
  expect(dimensions.width).toBeLessThan(800);expect(dimensions.height).toBeLessThan(1000);
  await page.getByTestId("scan-next-photo").setInputFiles(paper);
  await expect(page.getByRole("button",{name:"裁切並保留",exact:true})).toBeEnabled();await page.getByRole("button",{name:"裁切並保留",exact:true}).click();
  await expect(page.getByRole("img",{name:"掃描第 2 頁"})).toBeVisible();
  await page.screenshot({path:info.outputPath("document-pages.png")});
  const footer=(await page.locator(".document-scan-overlay>footer").boundingBox())!;
  expect(footer.y+footer.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);
  expect(calls).toHaveLength(0);
  await page.getByRole("button",{name:"送交 AI 辨識（2 頁）",exact:true}).click();
  await expect(page.getByRole("heading",{name:"文件掃描",exact:true})).toHaveCount(0);
  await expect(page.locator(".import-preview")).toContainText("persist");await expect(page.locator(".import-preview")).toContainText("resilient");
  expect(calls).toHaveLength(2);expect(calls.every(call=>call.mime==="image/jpeg" && call.data.startsWith("/9j/"))).toBe(true);
  await page.getByRole("button",{name:"加入資料夾最後方"}).click();
  await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
});

test("AI failure retains scans for retry and does not import incomplete results",async({page})=>{
  let fail=true;
  await page.route("https://generativelanguage.googleapis.com/**",route=>fail ? route.fulfill({status:500,json:{error:{message:"test failure"}}}) : route.fulfill({json:{candidates:[{content:{parts:[{text:'{"cards":[{"word":"persist","definition":"堅持"}]}'}]}}]}}));
  await page.goto("/");await page.getByRole("button",{name:"掃描匯入",exact:true}).click();
  await page.getByTestId("document-scan-input").setInputFiles(paper);
  await expect(page.getByRole("button",{name:"裁切並保留"})).toBeEnabled();await page.getByRole("button",{name:"裁切並保留"}).click();
  await page.getByRole("button",{name:"送交 AI 辨識（1 頁）"}).click();
  await expect(page.getByRole("status")).toContainText("裁切頁面已保留");
  await expect(page.getByRole("img",{name:"掃描第 1 頁"})).toBeVisible();
  await expect(page.locator(".import-preview")).toHaveCount(0);
  fail=false;await page.getByRole("button",{name:"送交 AI 辨識（1 頁）"}).click();
  await expect(page.locator(".import-preview")).toContainText("persist");
});

test("manual corners work without AI credentials; invalid image recovers and pages can be removed",async({page,context})=>{
  await context.addInitScript(()=>{const state=JSON.parse(localStorage.getItem("vocab-pwa-state-v1")!);state.settings.aiApiKey="";localStorage.setItem("vocab-pwa-state-v1",JSON.stringify(state));});
  await page.goto("/");await page.getByRole("button",{name:"掃描匯入",exact:true}).click();
  await expect(page.getByRole("button",{name:"掃描",exact:true})).toBeEnabled();
  await page.getByTestId("document-scan-input").setInputFiles({name:"bad.jpg",mimeType:"image/jpeg",buffer:Buffer.from("not-an-image")});
  await expect(page.getByRole("status")).toContainText("無法開啟圖片");
  await page.getByRole("button",{name:"取消這頁"}).click();
  await page.getByTestId("scan-next-photo").setInputFiles({name:"blank.svg",mimeType:"image/svg+xml",buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="white"/></svg>')});
  await expect(page.getByRole("status")).toContainText("請手動拖曳四角");
  await page.getByRole("button",{name:"裁切並保留"}).click();
  await expect(page.getByRole("button",{name:"送交 AI 辨識（1 頁）"})).toBeDisabled();
  await page.getByRole("button",{name:"刪除第 1 頁"}).click();await expect(page.locator(".document-pages img")).toHaveCount(0);
  await page.getByRole("button",{name:"返回掃描匯入"}).click();await expect(page.getByRole("heading",{name:"文件掃描"})).toHaveCount(0);
});
