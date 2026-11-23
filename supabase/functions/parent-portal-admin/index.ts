import { corsHeaders, db, hashPin, hex, issueToken, json, randomPin, sameOrigin, verifyToken, schools } from "../_shared/portal.ts";

const MAX_PDF=10*1024*1024;
const clean=(v:unknown,n=180)=>String(v??"").trim().slice(0,n);
function b64bytes(s:string){const raw=atob(s);const a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return a;}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!sameOrigin(req))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
  try{
    const body=await req.json(), action=clean(body.action,30);
    if(action==="login"){
      const expected=Deno.env.get("ADMIN_PASSWORD")||"";
      if(expected.length<16)return json({error:"Admin password secret सेट नहीं है।"},503);
      if(String(body.password||"")!==expected)return json({error:"Admin password गलत है।"},401);
      return json({ok:true,token:await issueToken({role:"admin"},4*60*60*1000)});
    }
    const claims=await verifyToken(req,"admin");
    if(!claims)return json({error:"Admin session समाप्त है। दोबारा Login करें।"},401);
    const supabase=db();
    if(action==="students"){
      const school=clean(body.school,30);
      if(school&&!schools.includes(school))return json({error:"विद्यालय चुनें।"},400);
      let q=supabase.from("student_profiles").select("profile_id,school_key,student_name,father_name,class_name").order("class_name").order("student_name");
      if(school)q=q.eq("school_key",school);
      const [{data:students,error},{data:credentials,error:ce}]=await Promise.all([
        q, supabase.from("parent_portal_credentials").select("profile_id,login_id,active")
      ]);
      if(error||ce)throw error||ce;
      const by=new Map((credentials||[]).map((c:any)=>[c.profile_id,c]));
      return json({students:(students||[]).map((s:any)=>({...s,credential:by.get(s.profile_id)||null}))});
    }
    const profileId=clean(body.profileId,100),school=clean(body.schoolKey,30);
    if(!schools.includes(school))return json({error:"विद्यालय चुनें।"},400);
    if(action==="generate"||action==="reset"){
      const {data:student,error}=await supabase.from("student_profiles").select("profile_id,student_name").eq("profile_id",profileId).eq("school_key",school).maybeSingle();
      if(error)throw error;if(!student)return json({error:"विद्यार्थी रिकॉर्ड नहीं मिला।"},404);
      const {data:old,error:oe}=await supabase.from("parent_portal_credentials").select("login_id").eq("profile_id",profileId).maybeSingle();
      if(oe)throw oe;
      const loginId=old?.login_id||("SKD"+crypto.randomUUID().replace(/-/g,"").slice(0,9).toUpperCase());
      const pin=randomPin(),salt=crypto.getRandomValues(new Uint8Array(16)),saltHex=hex(salt),pinHash=await hashPin(pin,saltHex);
      const {error:up}=await supabase.from("parent_portal_credentials").upsert({profile_id:profileId,school_key:school,login_id:loginId,pin_salt:saltHex,pin_hash:pinHash,active:true,failed_attempts:0,locked_until:null,updated_at:new Date().toISOString()},{onConflict:"profile_id"});
      if(up)throw up;
      return json({ok:true,loginId,pin,student});
    }
    if(action==="upload"){
      const title=clean(body.reportTitle||"Progress Report",100),session=clean(body.academicSession,20);
      if(!profileId||!session||typeof body.pdfBase64!=="string")return json({error:"विद्यार्थी, सत्र और PDF आवश्यक हैं।"},400);
      const bytes=b64bytes(body.pdfBase64);
      if(bytes.length<8||bytes.length>MAX_PDF||new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")return json({error:"सही PDF चुनें। अधिकतम 10 MB।"},413);
      const {data:student,error}=await supabase.from("student_profiles").select("profile_id").eq("profile_id",profileId).eq("school_key",school).maybeSingle();
      if(error)throw error;if(!student)return json({error:"विद्यार्थी रिकॉर्ड नहीं मिला।"},404);
      const id=crypto.randomUUID(),path=school+"/"+profileId+"/"+id+".pdf";
      const {error:ue}=await supabase.storage.from("student-progress-reports").upload(path,bytes,{contentType:"application/pdf",upsert:false});
      if(ue)throw ue;
      const {error:ie}=await supabase.from("progress_report_files").insert({id,profile_id:profileId,school_key:school,academic_session:session,report_title:title,storage_path:path,content_type:"application/pdf",file_size:bytes.length,published:false});
      if(ie){await supabase.storage.from("student-progress-reports").remove([path]);throw ie;}
      return json({ok:true,id,published:false,fileSize:bytes.length,storage:"Supabase"},201);
    }
    if(action==="reports"){
      const {data,error}=await supabase.from("progress_report_files").select("id,academic_session,report_title,published,uploaded_at,file_size").eq("profile_id",profileId).eq("school_key",school).order("uploaded_at",{ascending:false});
      if(error)throw error;return json({reports:data||[]});
    }
    if(action==="publish"||action==="unpublish"){
      const {data,error}=await supabase.from("progress_report_files").update({published:action==="publish"}).eq("id",clean(body.reportId,80)).eq("profile_id",profileId).eq("school_key",school).select("id").maybeSingle();
      if(error)throw error;if(!data)return json({error:"रिपोर्ट रिकॉर्ड नहीं मिला।"},404);return json({ok:true,published:action==="publish"});
    }
    if(action==="enable"||action==="disable"){
      const {data,error}=await supabase.from("parent_portal_credentials").update({active:action==="enable",updated_at:new Date().toISOString()}).eq("profile_id",profileId).eq("school_key",school).select("profile_id").maybeSingle();
      if(error)throw error;if(!data)return json({error:"Login रिकॉर्ड नहीं मिला।"},404);return json({ok:true});
    }
    return json({error:"अज्ञात कार्य।"},400);
  }catch(e){console.error("parent-portal-admin",e);return json({error:"कार्य पूरा नहीं हुआ। Supabase सेटिंग जाँचें।"},500);}
});
