import {json,originIsSame} from "../_lib/auth.js";
import {createParentSession,parentCookie} from "../_lib/parent-auth.js";
const clean=v=>String(v||"").trim().toUpperCase().slice(0,40);
async function hashPin(pin,salt){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},key,256);return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,"0")).join("")}
export async function onRequest({request,env}){
 if(request.method!=="POST")return json({error:"Method not allowed"},405,{Allow:"POST"});
 if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
 if(!env.SCHOOL_DB||!env.SESSION_SECRET)return json({error:"Portal configuration अधूरी है।"},503);
 let b;try{b=await request.json()}catch{return json({error:"सही Login ID और PIN भरें।"},400)}
 const id=clean(b.loginId),pin=String(b.pin||"");
 if(!id||!/^[0-9]{8}$/.test(pin))return json({error:"Login ID या 8 अंकों का PIN सही भरें।"},400);
 const row=await env.SCHOOL_DB.prepare("SELECT * FROM parent_portal_credentials WHERE login_id=? AND active=1").bind(id).first();
 if(!row)return json({error:"Login ID या PIN गलत है।"},401);
 if(row.locked_until&&Date.parse(row.locked_until)>Date.now())return json({error:"कई गलत प्रयास हुए हैं। 15 मिनट बाद प्रयास करें।"},429);
 const salt=Uint8Array.from((row.pin_salt.match(/.{2}/g)||[]),x=>parseInt(x,16));
 const ok=await hashPin(pin,salt)===row.pin_hash;
 if(!ok){const n=(row.failed_attempts||0)+1;await env.SCHOOL_DB.prepare("UPDATE parent_portal_credentials SET failed_attempts=?,locked_until=?,updated_at=CURRENT_TIMESTAMP WHERE profile_id=?").bind(n>=5?0:n,n>=5?new Date(Date.now()+15*60*1000).toISOString():null,row.profile_id).run();return json({error:"Login ID या PIN गलत है।"},401)}
 await env.SCHOOL_DB.prepare("UPDATE parent_portal_credentials SET failed_attempts=0,locked_until=NULL WHERE profile_id=?").bind(row.profile_id).run();
 const token=await createParentSession(row.profile_id,row.school_key,env.SESSION_SECRET);
 return json({ok:true},200,{"Set-Cookie":parentCookie(token)});
}
