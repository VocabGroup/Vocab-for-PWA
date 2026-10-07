import { lookupDictionary, type LookupSource } from "../../dictionary-lookup";

export async function GET(request: Request) {
  const url = new URL(request.url), source = url.searchParams.get("source") ?? "AUTO";
  if (!["AUTO","GOOGLE","CAMBRIDGE","FREE"].includes(source)) return Response.json({ error:"此来源尚未支援；請選擇 Google、劍橋或 Free Dictionary" }, { status:400 });
  try { return Response.json({ entry:await lookupDictionary(url.searchParams.get("q") ?? "",source as LookupSource,request.signal) }, { headers:{"Cache-Control":"no-store"} }); }
  catch (error) { return Response.json({ error:error instanceof Error ? error.message : "查詢失敗，請稍後重試" }, { status:502,headers:{"Cache-Control":"no-store"} }); }
}
