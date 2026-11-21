const COOKIE="skd_parent_session";
const enc=new TextEncoder();
function b64u(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function unb64(s){s=s.replace(/-/g,"+").replace(/_/g,"/");s+="=".repeat((4-s.length%4)%4);return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function sign(payload,secret){const k=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64u(new Uint8Array(await crypto.subtle.sign("HMAC",k,enc.encode(payload))))}
export async function createParentSession(profileId,schoolKey,secret){const p=b64u(enc.encode(JSON.stringify({profileId,schoolKey,exp:Date.now()+12*60*60*1000})));return p+"."+await sign(p,secret)}
export async function readParentSession(request,secret){if(!secret)return null;const c=request.headers.get("Cookie")||"",m=c.match(/(?:^|;\s*)skd_parent_session=([^;]+)/);if(!m)return null;const a=m[1].split(".");if(a.length!==2)return null;const expected=await sign(a[0],secret);if(a[1].length!==expected.length)return null;let d=0;for(let i=0;i<expected.length;i++)d|=expected.charCodeAt(i)^a[1].charCodeAt(i);if(d)return null;try{const p=JSON.parse(new TextDecoder().decode(unb64(a[0])));return p.exp>Date.now()?p:null}catch{return null}}
export function parentCookie(v,maxAge=43200){return COOKIE+"="+v+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+maxAge}
