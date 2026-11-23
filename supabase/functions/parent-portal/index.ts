import { corsHeaders, db, hashPin, issueToken, json, sameOrigin, verifyToken } from "../_shared/portal.ts";
const clean=(v:unknown,n=80)=>String(v??"").trim().toUpperCase().slice(0,n);

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!sameOrigin(req))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
  try{
    const body=await req.json(),action=String(body.action||"");
    const supabase=db();
    if(action==="login"){
      const id=clean(body.loginId,40),pin=String(body.pin||"");
      if(!id||!/^[0-9]{8}$/.test(pin))return json({error:"Login ID या 8 अंकों का PIN सही भरें।"},400);
      const {data:row,error}=await supabase.from("parent_portal_credentials").select("*").eq("login_id",id).eq("active",true).maybeSingle();
      if(error)throw error;if(!row)return json({error:"Login ID या PIN गलत है।"},401);
      if(row.locked_until&&new Date(row.locked_until).getTime()>Date.now())return json({error:"कई गलत प्रयास हुए हैं। 15 मिनट बाद प्रयास करें।"},429);
      const ok=await hashPin(pin,row.pin_salt)===row.pin_hash;
      if(!ok){const n=(row.failed_attempts||0)+1;await supabase.from("parent_portal_credentials").update({failed_attempts:n>=5?0:n,locked_until:n>=5?new Date(Date.now()+15*60*1000).toISOString():null}).eq("profile_id",row.profile_id);return json({error:"Login ID या PIN गलत है।"},401);}
      await supabase.from("parent_portal_credentials").update({failed_attempts:0,locked_until:null}).eq("profile_id",row.profile_id);
      const token=await issueToken({role:"parent",profileId:row.profile_id,schoolKey:row.school_key},12*60*60*1000);
      return json({ok:true,token});
    }
    const claims=await verifyToken(req,"parent");
    if(!claims)return json({error:"Login की अवधि समाप्त है। दोबारा Login करें।"},401);
    if(action==="logout")return json({ok:true});
    if(action==="reports"){
      const {data:student,error:se}=await supabase.from("student_profiles").select("student_name,class_name,school_key").eq("profile_id",claims.profileId).eq("school_key",claims.schoolKey).maybeSingle();
      if(se)throw se;if(!student)return json({error:"विद्यार्थी रिकॉर्ड नहीं मिला।"},404);
      const {data:reports,error}=await supabase.from("progress_report_files").select("id,academic_session,report_title,uploaded_at").eq("profile_id",claims.profileId).eq("school_key",claims.schoolKey).eq("published",true).order("uploaded_at",{ascending:false});
      if(error)throw error;return json({student:{name:student.student_name,className:student.class_name},reports:reports||[]});
    }
    if(action==="report"){
      const id=String(body.reportId||"");
      const {data:r,error}=await supabase.from("progress_report_files").select("storage_path").eq("id",id).eq("profile_id",claims.profileId).eq("school_key",claims.schoolKey).eq("published",true).maybeSingle();
      if(error)throw error;if(!r)return json({error:"यह रिपोर्ट उपलब्ध नहीं है।"},404);
      const {data:signed,error:se2}=await supabase.storage.from("student-progress-reports").createSignedUrl(r.storage_path,60);
      if(se2)throw se2;return json({url:signed.signedUrl});
    }
    return json({error:"अज्ञात कार्य।"},400);
  }catch(e){console.error("parent-portal",e);return json({error:"अनुरोध पूरा नहीं हुआ।"},500);}
});
