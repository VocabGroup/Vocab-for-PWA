"use client";
import { useEffect, useRef, useState } from "react";
import { MdCameraAlt } from "react-icons/md";

// One inference at a time, with small frames, to limit CPU/battery use on phones.
export function LiveDocumentCamera({ onCapture }: { onCapture: (file: File) => void }) {
  const video=useRef<HTMLVideoElement>(null), overlay=useRef<HTMLCanvasElement>(null);
  const [ready,setReady]=useState(false), [capturing,setCapturing]=useState(false);
  const [message,setMessage]=useState("正在開啟後置相機，請允許相機權限…");
  const dispose=useRef<()=>void>(()=>{}), mounted=useRef(true), shutterLock=useRef(false);
  useEffect(()=>{
    const element=video.current;
    mounted.current=true;let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined,stream:MediaStream|undefined;
    const stop=()=>{cancelled=true;if(timer)clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop());};dispose.current=stop;
    async function start() {
      try {
        if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)throw new Error("即時相機需要 HTTPS 或本機 localhost；也可以改用拍照或選擇照片。");
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}});
        if(cancelled){stream.getTracks().forEach(track=>track.stop());return;}
        const live=element;if(!live) {stop();return;}live.srcObject=stream;await live.play();
        if(cancelled)return;
        for(const track of stream.getVideoTracks())track.addEventListener("ended",()=>{if(!cancelled){stop();setReady(false);setMessage("相機已中斷，請改用拍照／選照片，或重新開啟掃描器。");const canvas=overlay.current;canvas?.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height);}});
        setReady(true);setMessage("移動鏡頭會重新偵測框線；對準文件後按快門。");
        const scanic=await import("scanic");if(cancelled)return;
        const frame=document.createElement("canvas");
        async function detect() {
          if(cancelled)return;
          if(document.hidden || live!.paused || !live!.videoWidth){timer=setTimeout(()=>void detect(),300);return;}
          const begin=performance.now(), scale=Math.min(1,640/Math.max(live!.videoWidth,live!.videoHeight));
          frame.width=Math.round(live!.videoWidth*scale);frame.height=Math.round(live!.videoHeight*scale);
          frame.getContext("2d")!.drawImage(live!,0,0,frame.width,frame.height);
          try {
            const result=await scanic.scanDocument(frame,{mode:"detect",detector:"classical",maxProcessingDimension:640});
            if(cancelled)return;
            const canvas=overlay.current;if(canvas){canvas.width=frame.width;canvas.height=frame.height;const ctx=canvas.getContext("2d")!;ctx.clearRect(0,0,canvas.width,canvas.height);
              if(result.success && result.corners){const c=result.corners;ctx.beginPath();ctx.moveTo(c.topLeft.x,c.topLeft.y);for(const p of [c.topRight,c.bottomRight,c.bottomLeft])ctx.lineTo(p.x,p.y);ctx.closePath();ctx.lineWidth=Math.max(3,canvas.width/160);ctx.strokeStyle="#55efb0";ctx.fillStyle="rgba(85,239,176,.12)";ctx.fill();ctx.stroke();canvas.dataset.detected="true";}else canvas.dataset.detected="false";
            }
          } catch {const canvas=overlay.current;canvas?.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height);if(canvas)canvas.dataset.detected="false";}
          if(!cancelled)timer=setTimeout(()=>void detect(),Math.max(100,300-(performance.now()-begin)));
        }
        void detect();
      } catch(error){if(cancelled)return;stream?.getTracks().forEach(track=>track.stop());setReady(false);setMessage(error instanceof DOMException && error.name==="NotAllowedError" ? "未取得相機權限，請允許相機存取，或改用拍照／選擇照片。" : `無法啟動即時相機：${error instanceof Error ? error.message : "請改用拍照／選照片"}`);}
    }
    void start();return()=>{mounted.current=false;stop();if(element)element.srcObject=null;};
  },[]);
  async function capture() {
    const live=video.current;if(!ready || !live?.videoWidth || shutterLock.current)return;
    shutterLock.current=true;setCapturing(true);
    try {
      // Freeze the actual shutter frame. The full-size still is detected again in
      // DocumentScanner; never apply corners from an earlier moving preview frame.
      const scale=Math.min(1,2000/Math.max(live.videoWidth,live.videoHeight));
      const canvas=document.createElement("canvas");canvas.width=Math.round(live.videoWidth*scale);canvas.height=Math.round(live.videoHeight*scale);canvas.getContext("2d")!.drawImage(live,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value ? resolve(value):reject(new Error("無法拍攝照片")),"image/jpeg",0.94));
      if(!mounted.current)return;dispose.current();onCapture(new File([blob],`document-${Date.now()}.jpg`,{type:"image/jpeg"}));
    }catch(error){if(mounted.current){setMessage(`拍攝失敗：${error instanceof Error ? error.message : "請重試"}`);setCapturing(false);shutterLock.current=false;}}
  }
  return <section className="live-document-camera" aria-label="即時文件掃描">
    <div className="live-camera-viewport"><video ref={video} autoPlay muted playsInline aria-label="相機預覽"/><canvas ref={overlay} aria-hidden="true" className="live-camera-outline"/></div>
    <p role="status">{message}</p><button className="primary live-shutter" aria-label="快門" disabled={!ready || capturing} onClick={()=>void capture()}><MdCameraAlt size={26}/>{capturing ? "拍攝中…":"拍攝文件"}</button>
  </section>;
}
