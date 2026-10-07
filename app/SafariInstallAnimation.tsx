"use client";
import { useState } from "react";
import { MdIosShare, MdMoreHoriz, MdAddBox, MdClose, MdBookmarkBorder, MdMenuBook, MdAdd, MdContentCopy, MdSearch, MdPrint, MdOutlineStarBorder, MdRefresh, MdChevronLeft, MdMenu, MdWifi, MdBatteryFull, MdMailOutline, MdChatBubbleOutline } from "react-icons/md";

export function SafariInstallAnimation() {
  const [paused,setPaused]=useState(false);
  return <div className={`safari-animation ${paused ? "animation-paused":""}`}>
    <div className="install-demo-phone" aria-hidden="true">
      <div className="demo-statusbar"><b>3:33</b><span><MdWifi/><MdBatteryFull/></span></div><div className="demo-island"/>
      <div className="demo-app"><header><MdMenu/><strong>Vocab</strong><MdSearch/></header><div className="demo-hero">每天一點，學會更多<span>YOUR VOCABULARY JOURNEY</span></div><b>讓每個新單字，成為你的日常。</b>{["單字卡與例句","翻卡學習","我的資料夾"].map(label=><div className="demo-article" key={label}><i/><span><b>{label}</b><small>記錄、練習，累積你的學習進度。</small></span></div>)}</div>
      <div className="demo-browserbar"><span className="demo-back"><MdChevronLeft/></span><span className="demo-address"><MdMenuBook/>vocab · 網頁<MdRefresh/></span><span className="demo-more-target"><MdMoreHoriz/></span></div>
      <div className="demo-more-sheet">
        <div className="demo-menu-row demo-share-target"><MdIosShare/><span>分享</span></div><div className="demo-menu-row"><MdBookmarkBorder/><span>加入「喜好項目」</span></div><div className="demo-menu-row"><MdMenuBook/><span>將書籤加入檔案夾⋯</span></div>
        <div className="demo-menu-row demo-menu-divider"><MdAdd/><span>新增標籤頁</span></div><div className="demo-menu-row"><MdContentCopy/><span>新增私密標籤頁</span></div><footer><span><MdMenuBook/>書籤</span><span><MdContentCopy/>所有標籤頁</span></footer>
      </div>
      <div className="demo-share-sheet"><div className="demo-share-header"><span className="demo-site-icon">V</span><div><b>Vocab</b><small>vocab · 網頁</small><span>選項 ›</span></div><MdClose className="demo-sheet-close"/></div>
        <div className="demo-share-apps">{["AirDrop","Instagram","訊息","郵件"].map((label,index)=><div key={label}><i className={`demo-app-icon demo-app-icon-${index}`}>{index===2 ? <MdChatBubbleOutline/>:index===3 ? <MdMailOutline/>:index===1 ? "◎":"◉"}</i><small>{label}</small></div>)}</div>
        <div className="demo-shortcuts">{[<MdContentCopy key="copy"/>,<MdBookmarkBorder key="bookmark"/>,<MdSearch key="read"/>,<MdMenuBook key="book"/>].map((icon,index)=><div key={index}><i>{icon}</i><small>{["拷貝","加入喜好項目","加入閱讀列表","書籤加入檔案夾⋯"][index]}</small></div>)}</div>
        <div className="demo-share-actions"><div><MdOutlineStarBorder/>加入喜好項目</div><div><MdAddBox/>加入快速備忘錄</div><div><MdSearch/>在網頁中尋找</div><div className="demo-home-target"><MdAddBox/>加入主畫面</div></div>
        <div className="demo-share-actions demo-extra-actions"><div><MdMenuBook/>標示</div><div><MdPrint/>列印</div><div><MdSearch/>網站檢查</div></div>
      </div>
      <div className="demo-success"><header><MdClose/><strong>加入主畫面</strong><b className="demo-add-target">加入</b></header><div className="demo-name-row"><span className="demo-site-icon">V</span><div><b>Vocab<span className="demo-caret"/></b><small>https://vocab/</small></div></div><div className="demo-webapp-target"><span>打開為網頁 App</span><i/></div><p>在主畫面加入圖像，讓你快速連接此網站。</p><div className="demo-keyboard"><div className="demo-suggestions">的　被　👩　在　監獄　圖　⌄</div>{["ㄅㄉˇˋㄓˊㄚㄞㄢㄦ","ㄆㄊㄍㄐㄔㄗㄧㄛㄟ","ㄇㄋㄎㄑㄕㄘㄨㄜㄠ","ㄈㄌㄏㄒㄖㄙㄩㄝㄡ"].map(row=><div className="demo-key-row" key={row}>{Array.from(row).map((key,index)=><span key={index}>{key}</span>)}</div>)}<div className="demo-key-bottom"><span>123</span><span>☺</span><span>空格</span><b>✓</b></div><footer>◎<span>♩</span></footer></div></div>
      <svg className="demo-hand" viewBox="0 0 80 100"><path d="M22 91L13 59Q9 48 17 46Q22 44 27 57L29 62V15Q29 5 37 5Q45 5 45 15V45Q50 37 57 44Q65 38 70 47Q78 46 78 56L77 77Q76 89 66 97L34 97Z" fill="#f0be93" stroke="#805740" strokeWidth="2.5"/></svg><span className="demo-tap-ring"/>
    </div>
    <ol className="install-steps"><li>點右下角「⋯」</li><li>點浮動選單第一列「分享」</li><li>在分享面板點「加入主畫面」</li><li>保持「打開為網頁 App」開啟，點右上角「加入」</li></ol>
    <p className="hint">依參考畫面製作；Safari 版面依版本與工具列設定而異。若已看到分享圖示，可直接點分享。</p>
    <button className="android-text-button" onClick={()=>setPaused(value=>!value)}>{paused ? "播放教學動畫":"暫停教學動畫"}</button>
  </div>;
}
