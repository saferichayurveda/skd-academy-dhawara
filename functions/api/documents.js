import { isAuthenticated, json, originIsSame } from "../_lib/auth.js";
async function ensureTable(db){await db.prepare("CREATE TABLE IF NOT EXISTS school_documents (id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)").run()}
export async function onRequest({request,env}){
 if(!(await isAuthenticated(request,env)))return json({error:"पहले School Office में Admin Login करें।"},401);
 if(!env.SCHOOL_DB)return json({error:"SCHOOL_DB database binding उपलब्ध नहीं है।"},503);
 try{
  await ensureTable(env.SCHOOL_DB);
  const url=new URL(request.url);
  if(request.method==="GET"){
   const id=url.searchParams.get("id");
   if(id){const row=await env.SCHOOL_DB.prepare("SELECT * FROM school_documents WHERE id=?").bind(id).first();return row?json({document:row}):json({error:"दस्तावेज़ नहीं मिला।"},404)}
   const {results=[]}=await env.SCHOOL_DB.prepare("SELECT id,category,title,body,created_at,updated_at FROM school_documents ORDER BY updated_at DESC LIMIT 500").all();
   return json({documents:results});
  }
  if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
  if(request.method==="POST"){
   const d=await request.json();const id=String(d.id||crypto.randomUUID());const category=String(d.category||"अन्य दस्तावेज़").slice(0,80);const title=String(d.title||"").trim().slice(0,180);const body=String(d.body||"").slice(0,100000);
   if(!title||!body)return json({error:"शीर्षक और सामग्री आवश्यक हैं।"},400);
   const now=new Date().toISOString();
   await env.SCHOOL_DB.prepare("INSERT INTO school_documents (id,category,title,body,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET category=excluded.category,title=excluded.title,body=excluded.body,updated_at=excluded.updated_at").bind(id,category,title,body,now,now).run();
   return json({ok:true,document:{id,category,title,body,created_at:now,updated_at:now}});
  }
  if(request.method==="DELETE"){
   const id=url.searchParams.get("id");if(!id)return json({error:"दस्तावेज़ ID आवश्यक है।"},400);
   await env.SCHOOL_DB.prepare("DELETE FROM school_documents WHERE id=?").bind(id).run();return json({ok:true});
  }
  return json({error:"Method not allowed"},405,{Allow:"GET,POST,DELETE"});
 }catch(e){console.error("school_documents API error",e);return json({error:"दस्तावेज़ सेव नहीं हुआ। Database permissions जाँचें।"},500)}
}