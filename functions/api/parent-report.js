import {json,originIsSame} from "../_lib/auth.js";
import {readParentSession,parentCookie} from "../_lib/parent-auth.js";
export async function onRequest({request,env}){
 if(!env.SCHOOL_DB||!env.SESSION_SECRET)return json({error:"Progress Report सेवा उपलब्ध नहीं है।"},503);
 const s=await readParentSession(request,env.SESSION_SECRET);if(!s)return json({error:"पहले Login करें।"},401);
 if(request.method==="DELETE"){if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);return json({ok:true},200,{"Set-Cookie":parentCookie("",0)})}
 if(request.method!=="GET")return json({error:"Method not allowed"},405,{Allow:"GET,DELETE"});
 const id=new URL(request.url).searchParams.get("id");
 if(id){
  const r=await env.SCHOOL_DB.prepare("SELECT r.pdf_blob,r.content_type,r.file_size FROM progress_report_files r JOIN parent_portal_credentials c ON c.profile_id=r.profile_id JOIN parent_fee_status f ON f.profile_id=r.profile_id AND f.school_key=r.school_key WHERE r.id=? AND r.profile_id=? AND r.school_key=? AND r.published=1 AND c.active=1 AND f.fee_status='paid'").bind(id,s.profileId,s.schoolKey).first();
  if(!r)return json({error:"यह रिपोर्ट उपलब्ध नहीं है।"},404);
  const body=r.pdf_blob instanceof ArrayBuffer?r.pdf_blob:new Uint8Array(r.pdf_blob);
  return new Response(body,{headers:{"Content-Type":r.content_type||"application/pdf","Content-Length":String(r.file_size||body.byteLength),"Content-Disposition":"inline; filename=\"progress-report.pdf\"","Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});
 }
 const p=await env.SCHOOL_DB.prepare("SELECT student_name,class_name,school_key,admission_no FROM student_profiles WHERE profile_id=? AND school_key=?").bind(s.profileId,s.schoolKey).first();if(!p)return json({error:"विद्यार्थी रिकॉर्ड नहीं मिला।"},404);
 const fee=await env.SCHOOL_DB.prepare("SELECT fee_status FROM parent_fee_status WHERE profile_id=? AND school_key=?").bind(s.profileId,s.schoolKey).first();
 const feeStatus=fee?.fee_status==="paid"?"paid":"unpaid";
 const cardKey="PROFILE:"+s.profileId;
 const card=await env.SCHOOL_DB.prepare("SELECT session,payload_json,updated_at FROM progress_cards WHERE school_key=? AND admission_no IN (?,?) ORDER BY updated_at DESC LIMIT 1").bind(s.schoolKey,cardKey,p.admission_no).first();
 const q=feeStatus==="paid"?await env.SCHOOL_DB.prepare("SELECT id,academic_session,report_title,uploaded_at FROM progress_report_files WHERE profile_id=? AND school_key=? AND published=1 ORDER BY uploaded_at DESC").bind(s.profileId,s.schoolKey).all():{results:[]};
 let reportCard=null;try{if(card)reportCard={session:card.session,updatedAt:card.updated_at,payload:JSON.parse(card.payload_json||"{}")}}catch{}
 return json({student:{name:p.student_name,className:p.class_name},feeStatus,reportCard,reports:q.results||[]});
}
