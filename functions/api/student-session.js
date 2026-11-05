import {studentCookie,hashPassword,json,cookieHeader,studentFrom} from "./_lib/student-auth.js";
import {originIsSame} from "../_lib/auth.js";
async function setup(db){await db.prepare("CREATE TABLE IF NOT EXISTS student_logins(profile_id TEXT PRIMARY KEY,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();}
export async function onRequest({request,env}){
 if(!env.SCHOOL_DB||!env.SESSION_SECRET)return json({error:"Student login के लिए SCHOOL_DB और SESSION_SECRET आवश्यक हैं।"},503);
 await setup(env.SCHOOL_DB);
 if(request.method==="GET"){const id=await studentFrom(request,env);if(!id)return json({authenticated:false});const q=await env.SCHOOL_DB.prepare("SELECT profile_id,admission_no,student_name,class_name,school_key FROM student_profiles WHERE profile_id=?").bind(id).first();return q?json({authenticated:true,student:q}):json({authenticated:false});}
 if(request.method==="DELETE"){if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);return json({ok:true},200,{"Set-Cookie":cookieHeader("",0)});}
 if(request.method!=="POST"||!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
 const b=await request.json(),ad=String(b.admissionNo||"").trim(),pw=String(b.password||"");
 if(!ad||pw.length<1||pw.length>128)return json({error:"Admission Number और Password भरें।"},400);
 const found=await env.SCHOOL_DB.prepare("SELECT profile_id FROM student_profiles WHERE admission_no=?").bind(ad).all();
 if(found.results?.length!==1)return json({error:found.results?.length?"इस Admission Number से एक से अधिक विद्यार्थी जुड़े हैं। स्कूल कार्यालय से संपर्क करें।":"विद्यार्थी रिकॉर्ड नहीं मिला।"},401);
 const id=found.results[0].profile_id,cred=await env.SCHOOL_DB.prepare("SELECT password_salt,password_hash FROM student_logins WHERE profile_id=?").bind(id).first();
 if(!cred)return json({error:"अभी Login बनाया नहीं गया है। स्कूल कार्यालय से संपर्क करें।"},401);
 const h=await hashPassword(pw,cred.password_salt);if(h!==cred.password_hash)return json({error:"Admission Number या Password गलत है।"},401);
 return json({ok:true},200,{"Set-Cookie":cookieHeader(await studentCookie(id,env))});
}