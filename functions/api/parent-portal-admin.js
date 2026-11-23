import {isAuthenticated,json,originIsSame} from "../_lib/auth.js";
const clean=(v,n=180)=>String(v??"").trim().slice(0,n);
const schools={"primary":"S. K. D. Prathmik Vidyalaya","l-madhyamik":"S. K. D. L. Madhyamik Vidyalaya","u-madhyamik":"S. K. D. U. Madhyamik Vidyalaya"};
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
async function pinHash(pin,salt){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"},k,256);return hex(new Uint8Array(bits))}
function makePin(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(a[0]%100000000).padStart(8,"0")}
const MAX_PDF_BYTES=1500000;
export async function onRequest({request,env}){
 if(!(await isAuthenticated(request,env)))return json({error:"पहले School Office में Admin Login करें।"},401);
 if(!env.SCHOOL_DB)return json({error:"SCHOOL_DB binding उपलब्ध नहीं है।"},503);
 try{
  if(request.method==="GET"){
   const school=clean(new URL(request.url).searchParams.get("school"),30);
   if(school&&!schools[school])return json({error:"विद्यालय चुनें।"},400);
   const q=school?await env.SCHOOL_DB.prepare("SELECT profile_id,school_key,student_name,father_name,class_name FROM student_profiles WHERE school_key=? ORDER BY class_name,student_name").bind(school).all():await env.SCHOOL_DB.prepare("SELECT profile_id,school_key,student_name,father_name,class_name FROM student_profiles ORDER BY school_key,class_name,student_name").all();
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
   const id=crypto.randomUUID();
   await env.SCHOOL_DB.prepare("INSERT INTO progress_report_files(id,profile_id,school_key,academic_session,report_title,pdf_blob,content_type,file_size,published) VALUES(?,?,?,?,?,?,?,?,0)").bind(id,profileId,school,session,title,bytes,"application/pdf",file.size).run();
   return json({ok:true,id,published:false,fileSize:file.size,storage:"D1"},201);
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
  if(action==="publish"||action==="unpublish"){
   const id=clean(b.reportId,80),published=action==="publish"?1:0;
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
 }catch(e){console.error("Parent portal admin error",e);return json({error:"कार्य पूरा नहीं हुआ। Database जाँचें।"},500)}
}
