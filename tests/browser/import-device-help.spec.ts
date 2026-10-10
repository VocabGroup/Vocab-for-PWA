import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const devices = [
  { name:"Safari", ua:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1", platform:"iPhone", title:"iPhone／iPad 匯入方式", link:"安裝免費 Userscripts", host:"apps.apple.com" },
  { name:"iOS Chrome", ua:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/140.0 Mobile/15E148 Safari/604.1", platform:"iPhone", title:"iPhone／iPad 匯入方式", link:"安裝免費 Userscripts", host:"apps.apple.com" },
  { name:"Android", ua:"Mozilla/5.0 (Linux; Android 14) Chrome/140.0 Mobile Safari/537.36", platform:"Linux armv8l", title:"Android 匯入方式", link:"下載 Vocab 安卓版", host:"github.com" },
  { name:"desktop Chrome", ua:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36", platform:"Win32", title:"電腦匯入方式", link:"查看／安裝 QuickCards", host:"chromewebstore.google.com" },
];
for (const device of devices) {
  test(`${device.name} shows device help and working fallback`, async ({ context, page }) => {
    await context.addInitScript(({ ua, platform }) => {
      Object.defineProperty(navigator,"userAgent",{value:ua,configurable:true});
      Object.defineProperty(navigator,"platform",{value:platform,configurable:true});
      Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true});
      localStorage.setItem("vocab-web-entry-v1","browser");
      localStorage.setItem("vocab-pwa-state-v1",JSON.stringify({version:1,decks:[{id:"d1",name:"第一課",course:"英文",order:0}],cards:[],logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"light"}}));
    }, device);
    await page.goto("/");
    await page.getByRole("button",{name:/匯入單字集/}).click();
    const help=page.getByRole("region",{name:"此裝置的匯入方法"});
    await expect(help.getByRole("heading",{name:device.title})).toBeVisible();
    const link=help.getByRole("link",{name:device.link});
    expect(new URL((await link.getAttribute("href"))!).hostname).toBe(device.host);
    await expect(link).toHaveAttribute("rel","noopener noreferrer");
    await help.getByRole("button",{name:"使用方法",exact:true}).click();
    await expect(help.locator("ol")).toBeVisible();
    if(device.name==="iOS Chrome") await expect(help).toContainText("請先用 Safari");
    if(device.platform==="iPhone") await expect(help).toContainText("目前沒有可安裝的 Vocab 腳本");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await help.getByRole("button",{name:"改用貼上文字"}).click();
    await page.locator(".import-text").fill(JSON.stringify({cards:[{term:"apple",definition:"蘋果"}]}));
    await page.getByRole("button",{name:"產生文字預覽"}).click();
    await expect(page.locator(".import-preview")).toContainText("apple");
    await expect(page.locator(".import-preview")).toContainText("蘋果");
  });
}
