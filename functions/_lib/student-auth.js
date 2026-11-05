const COOKIE="skd_student_session", HOURS=8;
const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
async function sign(payload,secret){const k=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64(await crypto.subtle.sign("HMAC",k,enc.encode(payload)));}
export async function studentCookie(profileId,env){const p=b64(enc.encode(JSON.stringify({id:profileId,exp:Date.now()+HOURS*3600000})));return p+"."+await sign(p,env.SESSION_SECRET);}
export async function studentFrom(request,env){if(!env.SESSION_SECRET)return null;const c=request.headers.get("Cookie")||"",m=c.match(/(?:^|;\\s*)skd_student_session=([^;]+)/);if(!m)return null;const [p,s]=m[1].split(".");if(!p||!s||s!==await sign(p,env.SESSION_SECRET))return null;try{const o=JSON.parse(atob(p.replace(/-/g,"+").replace(/_/g,"/")));return o.exp>Date.now()?o.id:null}catch{return null}}
export function cookieHeader(v,max=HOURS*3600){return COOKIE+"="+v+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+max;}
export async function hashPassword(password,salt){const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);return b64(await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:210000,hash:"SHA-256"},key,256));}
export function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}})}
