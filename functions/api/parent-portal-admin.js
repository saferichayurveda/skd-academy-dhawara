import {isAuthenticated,json,originIsSame} from "../_lib/auth.js";
const clean=(v,n=180)=>String(v??"").trim().slice(0,n);
const schools={"primary":"S. K. D. Prathmik Vidyalaya","l-madhyamik":"S. K. D. L. Madhyamik Vidyalaya","u-madhyamik":"S. K. D. U. Madhyamik Vidyalaya"};
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
async function pinHash(pin,salt){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},k,256);return hex(new Uint8Array(bits))}
function makePin(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(a[0]%100000000).padStart(8,"0")}
const MAX_PDF_BYTES=1500000;
async function ensurePortalTables(db){
 await db.prepare(`CREATE TABLE IF NOT EXISTS parent_portal_credentials (
  profile_id TEXT PRIMARY KEY, school_key TEXT NOT NULL, login_id TEXT NOT NULL UNIQUE,
  pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 )`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS progress_report_files (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_key TEXT NOT NULL,
  academic_session TEXT NOT NULL, report_title TEXT NOT NULL DEFAULT 'Progress Report',
  pdf_blob BLOB NOT NULL, content_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size INTEGER NOT NULL CHECK(file_size > 0 AND file_size <= 1500000),
  published INTEGER NOT NULL DEFAULT 0, uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 )`).run();
 await db.prepare("CREATE INDEX IF NOT EXISTS idx_progress_reports_profile ON progress_report_files(profile_id,published,academic_session)").run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS parent_fee_status (
  profile_id TEXT PRIMARY KEY, school_key TEXT NOT NULL,
  fee_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(fee_status IN ('paid','unpaid')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 )`).run();
}
export async function onRequest({request,env}){
 if(!(await isAuthenticated(request,env)))return json({error:"पहले School Office में Admin Login करें।"},401);
 if(!env.SCHOOL_DB)return json({error:"SCHOOL_DB binding उपलब्ध नहीं है।"},503);
 try{
  await ensurePortalTables(env.SCHOOL_DB);
  if(request.method==="GET"){
   const school=clean(new URL(request.url).searchParams.get("school"),30);
   if(school&&!schools[school])return json({error:"विद्यालय चुनें।"},400);
   const q=school?await env.SCHOOL_DB.prepare("SELECT s.profile_id,s.school_key,s.student_name,s.father_name,s.class_name,COALESCE(f.fee_status,'unpaid') AS fee_status FROM student_profiles s LEFT JOIN parent_fee_status f ON f.profile_id=s.profile_id AND f.school_key=s.school_key WHERE s.school_key=? ORDER BY s.class_name,s.student_name").bind(school).all():await env.SCHOOL_DB.prepare("SELECT s.profile_id,s.school_key,s.student_name,s.father_name,s.class_name,COALESCE(f.fee_status,'unpaid') AS fee_status FROM student_profiles s LEFT JOIN parent_fee_status f ON f.profile_id=s.profile_id AND f.school_key=s.school_key ORDER BY s.school_key,s.class_name,s.student_name").all();
   const c=await env.SCHOOL_DB.prepare("SELECT profile_id,login_id,active FROM parent_portal_credentials").all();const by=new Map((c.results||[]).map(x=>[x.profile_id,x]));
   return json({students:(q.results||[]).map(s=>({...s,credential:by.get(s.profile_id)||null}))});
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405,{Allow:"GET,POST"});
  if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
  const ct=request.headers.get("Content-Type")||"";
  if(ct.includes("multipart/form-data")){
   const f=await request.formData(),profileId=clean(f.get("profileId"),100),school=clean(f.get("schoolKey"),30),session=clean(f.get("academicSession"),20),title=clean(f.get("reportTitle")||"Progress Report",100),file=f.get("file");
   if(!schools[school]||!profileId||!session||!(file instanceof File))return json({error:"विद्यार्थी, सत्र और PDF फ़ाइल आवश्यक हैं।"},400);
   if(file.size<8||file.size>MAX_PDF_BYTES)return json({error:"PDF 1.5 MB से छोटी होनी चाहिए। D1 Storage की सीमा के कारण PDF को compress करके दोबारा अपलोड करें।"},413);
   const bytes=new Uint8Array(await file.arrayBuffer());
   if(String.fromCharCode(...bytes.slice(0,5))!=="%PDF-")return json({error:"केवल सही PDF फ़ाइल अपलोड करें।"},415);
   const student=await env.SCHOOL_DB.prepare("SELECT profile_id FROM student_profiles WHERE profile_id=? AND school_key=?").bind(profileId,school).first();if(!student)return json({error:"विद्यार्थी रिकॉर्ड नहीं मिला।"},404);
   const fee=await env.SCHOOL_DB.prepare("SELECT fee_status FROM parent_fee_status WHERE profile_id=? AND school_key=?").bind(profileId,school).first();
   const published=fee?.fee_status==="paid"?1:0;
   const id=crypto.randomUUID();
   await env.SCHOOL_DB.prepare("INSERT INTO progress_report_files(id,profile_id,school_key,academic_session,report_title,pdf_blob,content_type,file_size,published) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,profileId,school,session,title,bytes,"application/pdf",file.size,published).run();
   return json({ok:true,id,published:!!published,fileSize:file.size,storage:"D1"},201);
  }
  let b;try{b=await request.json()}catch{return json({error:"सही अनुरोध भेजें।"},400)}
  const action=clean(b.action,30),profileId=clean(b.profileId,100),school=clean(b.schoolKey,30);
  if(action==="generate"||action==="reset"){
   if(!profileId||!schools[school])return json({error:"विद्यार्थी चुनें।"},400);
   const st=await env.SCHOOL_DB.prepare("SELECT profile_id FROM student_profiles WHERE profile_id=? AND school_key=?").bind(profileId,school).first();if(!st)return json({error:"विद्यार्थी रिकॉर्ड नहीं मिला।"},404);
   const old=await env.SCHOOL_DB.prepare("SELECT login_id FROM parent_portal_credentials WHERE profile_id=?").bind(profileId).first();
   const loginId=old?.login_id||("SKD"+crypto.randomUUID().replace(/-/g,"").slice(0,9).toUpperCase());
   const pin=makePin(),salt=crypto.getRandomValues(new Uint8Array(16)),hash=await pinHash(pin,salt);
   await env.SCHOOL_DB.prepare(`INSERT INTO parent_portal_credentials(profile_id,school_key,login_id,pin_salt,pin_hash,active,failed_attempts,locked_until,updated_at) VALUES(?,?,?,?,?,1,0,NULL,CURRENT_TIMESTAMP) ON CONFLICT(profile_id) DO UPDATE SET school_key=excluded.school_key,pin_salt=excluded.pin_salt,pin_hash=excluded.pin_hash,active=1,failed_attempts=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP`).bind(profileId,school,loginId,hex(salt),hash).run();
   return json({ok:true,loginId,pin,student:st});
  }
  if(action==="fee_status"){
   if(!profileId||!schools[school]||!["paid","unpaid"].includes(b.feeStatus))return json({error:"सही फीस स्थिति चुनें।"},400);
   const student=await env.SCHOOL_DB.prepare("SELECT profile_id FROM student_profiles WHERE profile_id=? AND school_key=?").bind(profileId,school).first();
   if(!student)return json({error:"विद्यार्थी रिकॉर्ड नहीं मिला।"},404);
   const status=b.feeStatus;
   await env.SCHOOL_DB.prepare("INSERT INTO parent_fee_status(profile_id,school_key,fee_status,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(profile_id) DO UPDATE SET school_key=excluded.school_key,fee_status=excluded.fee_status,updated_at=CURRENT_TIMESTAMP").bind(profileId,school,status).run();
   await env.SCHOOL_DB.prepare("UPDATE progress_report_files SET published=? WHERE profile_id=? AND school_key=?").bind(status==="paid"?1:0,profileId,school).run();
   return json({ok:true,feeStatus:status,published:status==="paid"});
  }
  if(action==="publish"||action==="unpublish"){
   const id=clean(b.reportId,80),published=action==="publish"?1:0;
   if(published){const fee=await env.SCHOOL_DB.prepare("SELECT fee_status FROM parent_fee_status WHERE profile_id=? AND school_key=?").bind(profileId,school).first();if(fee?.fee_status!=="paid")return json({error:"फीस जमा होने के बाद ही रिपोर्ट प्रकाशित होगी।"},403)}
   const r=await env.SCHOOL_DB.prepare("UPDATE progress_report_files SET published=? WHERE id=? AND profile_id=? AND school_key=?").bind(published,id,profileId,school).run();
   if(!r.meta?.changes)return json({error:"रिपोर्ट रिकॉर्ड नहीं मिला।"},404);return json({ok:true,published:!!published});
  }
  if(action==="disable"||action==="enable"){
   const r=await env.SCHOOL_DB.prepare("UPDATE parent_portal_credentials SET active=?,updated_at=CURRENT_TIMESTAMP WHERE profile_id=? AND school_key=?").bind(action==="enable"?1:0,profileId,school).run();
   if(!r.meta?.changes)return json({error:"Login रिकॉर्ड नहीं मिला।"},404);return json({ok:true});
  }
  if(action==="reports"){
   const q=await env.SCHOOL_DB.prepare("SELECT id,academic_session,report_title,published,uploaded_at,file_size FROM progress_report_files WHERE profile_id=? AND school_key=? ORDER BY uploaded_at DESC").bind(profileId,school).all();return json({reports:q.results||[]});
  }
  return json({error:"अज्ञात कार्य।"},400);
 }catch(e){console.error("Parent portal admin error",e);const detail=String(e?.message||e||"Unknown database error").replace(/[\\r\\n]+/g," ").slice(0,220);return json({error:"कार्य पूरा नहीं हुआ। Database जाँचें।",detail},500)}
}
