import { isAuthenticated, json, originIsSame } from "../_lib/auth.js";

const ITERATIONS=120000;
const clean=(v,n=120)=>String(v??"").trim().slice(0,n);
function b64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function hashPin(pin,salt){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:Uint8Array.from(atob(salt.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-salt.length%4)%4)),c=>c.charCodeAt(0)),iterations:ITERATIONS},key,256);return b64(new Uint8Array(bits))}
async function ensure(db){await db.prepare(`CREATE TABLE IF NOT EXISTS student_accounts(profile_id TEXT PRIMARY KEY,pin_salt TEXT NOT NULL,pin_hash TEXT NOT NULL,must_change_pin INTEGER NOT NULL DEFAULT 1,failed_attempts INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run()}
function temporaryPin(){const bytes=crypto.getRandomValues(new Uint8Array(4));const n=((bytes[0]<<24)|(bytes[1]<<16)|(bytes[2]<<8)|bytes[3])>>>0;return String(n%1000000).padStart(6,"0")}
export async function onRequest({request,env}){
 if(!(await isAuthenticated(request,env)))return json({error:"पहले विद्यालय Admin Login करें।"},401);
 if(!env.SCHOOL_DB)return json({error:"SCHOOL_DB डेटाबेस उपलब्ध नहीं है।"},503);
 try{
  await ensure(env.SCHOOL_DB);
  if(request.method==="GET"){
   const q=await env.SCHOOL_DB.prepare("SELECT p.profile_id,p.school_key,p.admission_no,p.student_name,p.father_name,p.class_name,CASE WHEN a.profile_id IS NULL THEN 0 ELSE 1 END AS account_exists,COALESCE(a.must_change_pin,0) AS must_change_pin,a.updated_at FROM student_profiles p LEFT JOIN student_accounts a ON a.profile_id=p.profile_id ORDER BY p.school_key,p.class_name,p.student_name").all();
   return json({students:q.results||[]});
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405,{Allow:"GET, POST"});
  if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
  let body;try{body=await request.json()}catch{return json({error:"अनुरोध सही नहीं है।"},400)}
  const profileId=clean(body.profileId,100),action=clean(body.action,20);
  if(!profileId||!["create","reset"].includes(action))return json({error:"विद्यार्थी और कार्रवाई चुनें।"},400);
  const profile=await env.SCHOOL_DB.prepare("SELECT profile_id FROM student_profiles WHERE profile_id=?").bind(profileId).first();
  if(!profile)return json({error:"विद्यार्थी का रिकॉर्ड नहीं मिला।"},404);
  const existing=await env.SCHOOL_DB.prepare("SELECT profile_id FROM student_accounts WHERE profile_id=?").bind(profileId).first();
  if(action==="create"&&existing)return json({error:"इस विद्यार्थी का लॉगिन पहले से है। PIN रीसेट चुनें।"},409);
  if(action==="reset"&&!existing)return json({error:"इस विद्यार्थी का लॉगिन अभी नहीं बना है। पहले लॉगिन बनाएँ।"},404);
  const pin=temporaryPin(),salt=b64(crypto.getRandomValues(new Uint8Array(16))),pinHash=await hashPin(pin,salt);
  await env.SCHOOL_DB.prepare(`INSERT INTO student_accounts(profile_id,pin_salt,pin_hash,must_change_pin,failed_attempts,locked_until,updated_at) VALUES(?,?,?,1,0,0,CURRENT_TIMESTAMP) ON CONFLICT(profile_id) DO UPDATE SET pin_salt=excluded.pin_salt,pin_hash=excluded.pin_hash,must_change_pin=1,failed_attempts=0,locked_until=0,updated_at=CURRENT_TIMESTAMP`).bind(profileId,salt,pinHash).run();
  return json({ok:true,profileId,temporaryPin:pin,message:"यह अस्थायी PIN केवल अभी दिखाया गया है। विद्यार्थी को सुरक्षित रूप से दें; पहली लॉगिन के बाद इसे बदलना होगा।"});
 }catch(e){console.error("Student account admin error",e);return json({error:"Student PIN रिकॉर्ड सेव नहीं हुआ।"},500)}
}
