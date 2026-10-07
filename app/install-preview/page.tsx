import { SafariInstallAnimation } from "../BrowserExperience";
import Link from "next/link";

export default function InstallPreview() {
  return <main className="browser-entry"><section className="browser-entry-card">
    <span className="entry-brand">Vocab</span>
    <h1>把 Vocab 加入主畫面</h1>
    <p>Safari 安裝教學預覽，動畫會自動循環播放。</p>
    <SafariInstallAnimation />
    <Link className="secondary wide android-button-link" href="/">返回 Vocab</Link>
  </section></main>;
}
