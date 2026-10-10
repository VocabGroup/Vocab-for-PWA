import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });
test("ECDICT bundled search on mobile, source link and stable input", async ({ context, page }) => {
  await context.addInitScript(() => {
    localStorage.setItem("vocab-web-entry-v1", "browser");
    localStorage.setItem("vocab-pwa-state-v1", JSON.stringify({version:1,decks:[{id:"d1",name:"第一課",course:"英文",order:0}],cards:[],logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"light",fullscreenOnLaunch:false}}));
  });
  await page.goto("/");
  await page.getByRole("button", {name:"搜尋單字", exact:true}).click();
  const input = page.getByRole("textbox", {name:"搜尋英文單字或中文解釋"});
  const before = await input.boundingBox();
  await input.fill("apple");
  await page.getByRole("button", {name:"搜尋", exact:true}).click();
  await expect(page.locator(".lookup-result")).toContainText("apple");
  await expect(page.locator(".lookup-result")).toContainText("ECDICT");
  await expect(page.locator(".lookup-result")).toContainText("蘋果");
  await expect(page.locator(".lookup-result")).not.toContainText("苹果");
  await expect(page.locator(".lookup-result a")).toHaveAttribute("href", "https://github.com/skywind3000/ECDICT");
  const after = await input.boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
  await page.getByRole("button", {name:"加入資料夾",exact:true}).click();
  await page.getByRole("button", {name:"英文 · 第一課",exact:true}).click();
  await expect.poll(async () => page.evaluate(() => new Promise<string>((resolve,reject) => {
    const request = indexedDB.open("vocab-device-data",1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("snapshots","readonly").objectStore("snapshots").get("state");
      read.onsuccess = () => {
        const state = JSON.parse(read.result ?? "{}");
        db.close();
        resolve(state.cards?.find((card: {word:string}) => card.word === "apple")?.definition ?? "");
      };
      read.onerror = () => { db.close(); reject(read.error); };
    };
  }))).toContain("蘋果");
  await page.getByRole("button", {name:"搜尋單字",exact:true}).click();
  await page.getByLabel("查詢來源", {exact:true}).selectOption("ECDICT");
  await input.fill("zzzznonexistentword");
  await page.getByRole("button", {name:"搜尋",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("ECDICT 查無");
});
