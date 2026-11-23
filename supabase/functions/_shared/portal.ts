import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin"
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export function db() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server configuration missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const enc = new TextEncoder();
function b64u(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function unb64(s: string) {
  s=s.replace(/-/g,"+").replace(/_/g,"/");
  s += "=".repeat((4-s.length%4)%4);
  return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
}
async function signature(payload: string) {
  const secret = Deno.env.get("PORTAL_TOKEN_SECRET");
  if (!secret || secret.length < 32) throw new Error("PORTAL_TOKEN_SECRET must be at least 32 characters");
  const key = await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(payload))));
}
export async function issueToken(claims: Record<string,unknown>, ttlMs: number) {
  const p=b64u(enc.encode(JSON.stringify({...claims,exp:Date.now()+ttlMs})));
  return p+"."+await signature(p);
}
export async function verifyToken(req: Request, role: "admin"|"parent") {
  const auth=req.headers.get("Authorization")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  const parts=token.split(".");
  if(parts.length!==2)return null;
  const expected=await signature(parts[0]);
  if(parts[1].length!==expected.length)return null;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=parts[1].charCodeAt(i)^expected.charCodeAt(i);
  if(diff)return null;
  try {
    const claims=JSON.parse(new TextDecoder().decode(unb64(parts[0])));
    return claims.role===role && Number(claims.exp)>Date.now()?claims:null;
  } catch { return null; }
}
export function randomPin() {
  const max=4294967296, ceiling=Math.floor(max/100000000)*100000000;
  const a=new Uint32Array(1);let n=0;
  do { crypto.getRandomValues(a); n=a[0]; } while(n>=ceiling);
  return String(n%100000000).padStart(8,"0");
}
export async function hashPin(pin: string, saltHex: string) {
  const salt=Uint8Array.from((saltHex.match(/.{2}/g)||[]),x=>parseInt(x,16));
  const key=await crypto.subtle.importKey("raw",enc.encode(pin),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"},key,256);
  return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,"0")).join("");
}
export function hex(bytes: Uint8Array) { return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join(""); }
export function sameOrigin(req: Request) {
  const origin=req.headers.get("Origin");
  const allowed=Deno.env.get("SITE_ORIGIN");
  return !!origin && !!allowed && origin===allowed;
}
export const schools = ["primary","l-madhyamik","u-madhyamik"];
