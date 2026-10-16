import { json, originIsSame } from "../_lib/auth.js";

const COOKIE = "skd_student_session";
const SESSION_MS = 8 * 60 * 60 * 1000;
const ITERATIONS = 120000;
const clean = (v, n=160) => String(v ?? "").trim().slice(0,n);

async function ensure(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS student_accounts (
    profile_id TEXT PRIMARY KEY,
    pin_salt TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    must_change_pin INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
function b64(bytes) {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function unb64(s) {
  const v=s.replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(v+"=".repeat((4-v.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function derive(pin,salt) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:unb64(salt),iterations:ITERATIONS},key,256);
  return b64(new Uint8Array(bits));
}
function same(a,b) {
  const x=new TextEncoder().encode(String(a)), y=new TextEncoder().encode(String(b));
  let d=x.length^y.length; for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]||0)^(y[i]||0);
  return d===0;
}
async function sign(value,secret) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value))));
}
async function makeCookie(profileId,secret) {
  const payload=b64(new TextEncoder().encode(JSON.stringify({profileId,exp:Date.now()+SESSION_MS})));
  return COOKIE+"="+payload+"."+await sign(payload,secret)+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+Math.floor(SESSION_MS/1000);
}
async function currentProfile(request,env) {
  if(!env.SESSION_SECRET)return null;
  const raw=(request.headers.get("Cookie")||"").match(/(?:^|;\s*)skd_student_session=([^;]+)/);
  if(!raw)return null;
  const parts=raw[1].split(".");
  if(parts.length!==2||!same(parts[1],await sign(parts[0],env.SESSION_SECRET)))return null;
  try {
    const p=JSON.parse(new TextDecoder().decode(unb64(parts[0])));
    if(!p.profileId||!Number.isFinite(p.exp)||p.exp<=Date.now())return null;
    return p.profileId;
  } catch { return null; }
}
function validPin(pin) { return typeof pin==="string" && /^\d{6,8}$/.test(pin); }

export async function onRequest({request,env}) {
  if(!env.SCHOOL_DB)return json({error:"विद्यालय डेटाबेस उपलब्ध नहीं है।"},503);
  if(!env.SESSION_SECRET)return json({error:"सुरक्षा सेटिंग उपलब्ध नहीं है।"},503);
  try {
    await ensure(env.SCHOOL_DB);
    if(request.method==="DELETE") {
      if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
      return json({ok:true},200,{"Set-Cookie":COOKIE+"=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"});
    }
    if(request.method==="GET") {
      const profileId=await currentProfile(request,env);
      if(!profileId)return json({authenticated:false},200);
      const profile=await env.SCHOOL_DB.prepare("SELECT profile_id,school_key,admission_no,student_name,father_name,mother_name,dob,class_name,pen,marks_json FROM student_profiles WHERE profile_id=?").bind(profileId).first();
      if(!profile)return json({error:"विद्यार्थी रिकॉर्ड नहीं मिला।"},404,{"Set-Cookie":COOKIE+"=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"});
      const result=await env.SCHOOL_DB.prepare("SELECT session,payload_json,updated_at FROM progress_cards WHERE admission_no=? AND school_key=? ORDER BY session DESC").bind("PROFILE:"+profileId,profile.school_key).all();
      let importedMarks={};try{importedMarks=JSON.parse(profile.marks_json||"{}")}catch{}
      return json({authenticated:true,mustChangePin:(await env.SCHOOL_DB.prepare("SELECT must_change_pin FROM student_accounts WHERE profile_id=?").bind(profileId).first())?.must_change_pin===1,student:{studentName:profile.student_name,fatherName:profile.father_name,className:profile.class_name,dob:profile.dob,schoolKey:profile.school_key,marks:importedMarks},progressCards:(result.results||[]).map(r=>{let payload={};try{payload=JSON.parse(r.payload_json||"{}")}catch{}return {session:r.session,payload,updatedAt:r.updated_at}})});
    }
    if(request.method==="POST") {
      if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
      let body;try{body=await request.json()}catch{return json({error:"अनुरोध सही नहीं है।"},400)}
      const profileId=clean(body.studentId,100),pin=String(body.pin??"");
      if(!profileId||!validPin(pin))return json({error:"Student ID और 6–8 अंकों का PIN दर्ज करें।"},400);
      const account=await env.SCHOOL_DB.prepare("SELECT pin_salt,pin_hash,failed_attempts,locked_until FROM student_accounts WHERE profile_id=?").bind(profileId).first();
      if(!account)return json({error:"Student ID या PIN सही नहीं है।"},401);
      if(Number(account.locked_until)>Date.now())return json({error:"कई गलत प्रयास हुए हैं। कुछ समय बाद फिर कोशिश करें।"},429);
      const hash=await derive(pin,account.pin_salt);
      if(!same(hash,account.pin_hash)){
        const failed=Number(account.failed_attempts||0)+1,locked=failed>=5?Date.now()+15*60*1000:0;
        await env.SCHOOL_DB.prepare("UPDATE student_accounts SET failed_attempts=?,locked_until=?,updated_at=CURRENT_TIMESTAMP WHERE profile_id=?").bind(failed,locked,profileId).run();
        return json({error:"Student ID या PIN सही नहीं है।"},401);
      }
      await env.SCHOOL_DB.prepare("UPDATE student_accounts SET failed_attempts=0,locked_until=0 WHERE profile_id=?").bind(profileId).run();
      return json({ok:true},200,{"Set-Cookie":await makeCookie(profileId,env.SESSION_SECRET)});
    }
    if(request.method==="PATCH") {
      if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
      const profileId=await currentProfile(request,env);
      if(!profileId)return json({error:"कृपया दोबारा लॉगिन करें।"},401);
      let body;try{body=await request.json()}catch{return json({error:"अनुरोध सही नहीं है।"},400)}
      const oldPin=String(body.currentPin??""),newPin=String(body.newPin??"");
      if(!validPin(newPin))return json({error:"नया PIN 6–8 अंकों का होना चाहिए।"},400);
      if(oldPin===newPin)return json({error:"नया PIN पुराने PIN से अलग रखें।"},400);
      const account=await env.SCHOOL_DB.prepare("SELECT pin_salt,pin_hash FROM student_accounts WHERE profile_id=?").bind(profileId).first();
      if(!account||!same(await derive(oldPin,account.pin_salt),account.pin_hash))return json({error:"वर्तमान PIN सही नहीं है।"},401);
      const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await derive(newPin,salt);
      await env.SCHOOL_DB.prepare("UPDATE student_accounts SET pin_salt=?,pin_hash=?,must_change_pin=0,updated_at=CURRENT_TIMESTAMP WHERE profile_id=?").bind(salt,hash,profileId).run();
      return json({ok:true});
    }
    return json({error:"Method not allowed"},405,{Allow:"GET, POST, PATCH, DELETE"});
  } catch(e) {
    console.error("Student auth error",e);
    return json({error:"विद्यार्थी लॉगिन सेवा अभी उपलब्ध नहीं है।"},500);
  }
}
