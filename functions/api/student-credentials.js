import {isAuthenticated,originIsSame,json} from "../_lib/auth.js";
import {hashPassword} from "../_lib/student-auth.js";
async function setup(db){await db.prepare("CREATE TABLE IF NOT EXISTS student_logins(profile_id TEXT PRIMARY KEY,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();}
export async function onRequest({request,env}){
 if(!env.SCHOOL_DB)return json({error:"SCHOOL_DB binding उपलब्ध नहीं है।"},503);
 if(!(await isAuthenticated(request,env)))return json({error:"Admin Login आवश्यक है।"},401);
 await setup(env.SCHOOL_DB);
 if(request.method==="GET"){const q=await env.SCHOOL_DB.prepare("SELECT profile_id,admission_no,student_name,class_name,school_key,CASE WHEN l.profile_id IS NULL THEN 0 ELSE 1 END AS login_ready FROM student_profiles p LEFT JOIN student_logins l ON l.profile_id=p.profile_id ORDER BY class_name,student_name").all();return json({students:q.results||[]});}
 if(request.method!=="POST"||!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
 const b=await request.json(),id=String(b.profileId||""),pw=String(b.password||"");
 if(!id||pw.length<8||pw.length>128)return json({error:"विद्यार्थी चुनें और कम से कम 8 अक्षर का पासवर्ड दें।"},400);
 const s=await env.SCHOOL_DB.prepare("SELECT profile_id FROM student_profiles WHERE profile_id=?").bind(id).first();if(!s)return json({error:"विद्यार्थी रिकॉर्ड नहीं मिला।"},404);
 const salt=b64rand(),hash=await hashPassword(pw,salt);
 await env.SCHOOL_DB.prepare("INSERT INTO student_logins(profile_id,password_salt,password_hash,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(profile_id) DO UPDATE SET password_salt=excluded.password_salt,password_hash=excluded.password_hash,updated_at=CURRENT_TIMESTAMP").bind(id,salt,hash).run();
 return json({ok:true});
}
function b64rand(){const b=new Uint8Array(16);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");}