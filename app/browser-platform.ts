export const ANDROID_RELEASES_URL="https://github.com/VocabGroup/Vocab-for-Android/releases";
export type BrowserPlatform="android"|"ios-safari"|"ios-other"|"desktop";
export function detectBrowserPlatform(userAgent:string, platform:string, maxTouchPoints:number):BrowserPlatform {
  if(/Android/i.test(userAgent))return "android";
  const ios=/iPhone|iPad|iPod/i.test(userAgent) || (/Mac/i.test(platform) && maxTouchPoints>1);
  if(!ios)return "desktop";
  return /Version\/[\d.]+.*Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo|YaBrowser|FBAN|FBAV|Instagram|Line\//i.test(userAgent) ? "ios-safari":"ios-other";
}
export function isInstalledWebApp():boolean {
  return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || (navigator as Navigator & {standalone?:boolean}).standalone===true;
}
export function canUseFullscreen():boolean {return document.fullscreenEnabled===true && typeof document.documentElement.requestFullscreen==="function";}
export async function enterWebFullscreen():Promise<string> {
  if(isInstalledWebApp() || document.fullscreenElement)return "";
  if(!canUseFullscreen())return "此瀏覽器不支援網頁全螢幕；iPhone 建議從 Safari 加入主畫面後開啟。";
  try {await document.documentElement.requestFullscreen();return "";}
  catch{return "瀏覽器未允許全螢幕，可在設定中按「立即進入全螢幕」再試一次。";}
}
