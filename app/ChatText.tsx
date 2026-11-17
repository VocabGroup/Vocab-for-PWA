import {Fragment,type ReactNode} from "react";
function inline(text:string):ReactNode[]{return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part,i)=>part.startsWith("**")&&part.endsWith("**")?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith("`")&&part.endsWith("`")?<code key={i}>{part.slice(1,-1)}</code>:<Fragment key={i}>{part}</Fragment>);}
export function ChatText({text}:{text:string}){
 let code=false;const nodes:ReactNode[]=[],lines=text.split("\n");
 for(let i=0;i<lines.length;i++){const line=lines[i];if(line.startsWith("```")){code=!code;continue;}if(code){nodes.push(<pre key={i}>{line||" "}</pre>);continue;}if(/^#{1,3}\s/.test(line)){nodes.push(<h3 key={i}>{inline(line.replace(/^#{1,3}\s/,""))}</h3>);continue;}if(/^\s*[-*•]\s/.test(line)){nodes.push(<div className="chat-bullet" key={i}><span>•</span><span>{inline(line.replace(/^\s*[-*•]\s/,""))}</span></div>);continue;}nodes.push(<p key={i}>{inline(line)}</p>);}
 return <div className="chat-rich-text">{nodes}</div>;
}
