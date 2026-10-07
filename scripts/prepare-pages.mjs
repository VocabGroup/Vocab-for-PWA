import {mkdir,cp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,join,relative,dirname} from "node:path";
import {build} from "esbuild";
const root=resolve(import.meta.dirname,".."),output=join(root,"dist/pages");
if(output!==resolve(root,"dist","pages"))throw new Error("Unexpected deployment output path");
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
const client=join(root,"dist/client");
await cp(client,output,{recursive:true,filter:path=>!path.endsWith(".map") && !relative(client,path).split(/[\\/]/).some(part=>part.startsWith("."))});
// Flatten circular SSR/RSC module references for Pages' single-worker entry.
await build({entryPoints:[join(root,"dist/server/index.js")],outfile:join(output,"_worker.js"),bundle:true,format:"esm",platform:"neutral",external:["node:*","cloudflare:*"],minify:true,sourcemap:false});
await writeFile(join(output,"_routes.json"),JSON.stringify({version:1,include:["/*"],exclude:["/assets/*","/_next/static/*","/icon-192.png","/icon-512.png","/og.png","/favicon.svg","/manifest.webmanifest","/sw.js","/offline-assets.json","/licenses/*"]}));
// The Vite plugin writes a Workers-only CLI redirect; it must not override Pages config.
const redirect=join(root,".wrangler/deploy/config.json");
try{const config=JSON.parse(await readFile(redirect,"utf8"));if(resolve(dirname(redirect),config.configPath)!==join(root,"dist/server/wrangler.json"))throw new Error("Unexpected Wrangler redirect target");await rm(redirect);}catch(error){if(error.code!=="ENOENT")throw error;}
console.log("Cloudflare Pages output prepared without logs, databases, environment files or source maps.");
