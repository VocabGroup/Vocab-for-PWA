import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });
test("ECDICT bundled search on mobile, source link and stable input", async ({ context, page }) => {
  await context.addInitScript(() => {
    localStorage.setItem("vocab-web-entry-v1", "browser");
    localStorage.setItem("vocab-pwa-state-v1", JSON.stringify({version:1,decks:[],cards:[],logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"light"}}));
  });
  await page.goto("/");
  await page.getByRole("button", {name:"搜尋單字", exact:true}).click();
  const input = page.getByRole("textbox", {name:"搜尋英文單字或中文解釋"});
  const before = await input.boundingBox();
  await input.fill("apple");
  await page.getByRole("button", {name:"搜尋", exact:true}).click();
  await expect(page.locator(".lookup-result")).toContainText("apple");
  await expect(page.locator(".lookup-result")).toContainText("ECDICT");
  await expect(page.locator(".lookup-result a")).toHaveAttribute("href", "https://github.com/skywind3000/ECDICT");
  const after = await input.boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
  await page.getByLabel("查詢來源", {exact:true}).selectOption("ECDICT");
  await input.fill("zzzznonexistentword");
  await page.getByRole("button", {name:"搜尋",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("ECDICT 查無");
});
