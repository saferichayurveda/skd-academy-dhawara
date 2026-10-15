import { isAuthenticated, json, originIsSame } from "../_lib/auth.js";

const clean=(v,n=300)=>String(v??"").trim().slice(0,n);
const schools={"primary":"S. K. D. Prathmik Vidyalaya","l-madhyamik":"S. K. D. L. Madhyamik Vidyalaya","u-madhyamik":"S. K. D. U. Madhyamik Vidyalaya"};
async function ensure(db){
 await db.prepare(`CREATE TABLE IF NOT EXISTS student_profiles (
 profile_id TEXT PRIMARY KEY, school_key TEXT NOT NULL, admission_no TEXT NOT NULL DEFAULT '',
 student_name TEXT NOT NULL, father_name TEXT NOT NULL DEFAULT '', mother_name TEXT NOT NULL DEFAULT '',
 dob TEXT NOT NULL DEFAULT '', class_name TEXT NOT NULL DEFAULT '', pen TEXT NOT NULL DEFAULT '',
 mobile_number TEXT NOT NULL DEFAULT '', total_fee INTEGER NOT NULL DEFAULT 0,
 marks_json TEXT NOT NULL DEFAULT '{}', source_row INTEGER, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_key,profile_id))`).run();
}
export async function onRequest({request,env}){
 if(!env.SCHOOL_DB)return json({error:"SCHOOL_DB database binding नहीं है।"},503);
 if(!(await isAuthenticated(request,env)))return json({error:"पहले School Office में Admin Login करें।"},401);
 try{
  await ensure(env.SCHOOL_DB);
  if(request.method==="GET"){
   const u=new URL(request.url),school=clean(u.searchParams.get("school"),30);
   if(school&&!schools[school])return json({error:"सही विद्यालय चुनें।"},400);
   const q=school?await env.SCHOOL_DB.prepare("SELECT * FROM student_profiles WHERE school_key=? ORDER BY class_name,student_name").bind(school).all():await env.SCHOOL_DB.prepare("SELECT * FROM student_profiles ORDER BY school_key,class_name,student_name").all();
   return json({students:(q.results||[]).map(r=>({...r,marks:JSON.parse(r.marks_json||"{}")}))});
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405,{Allow:"GET,POST"});
  if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
  const body=await request.json(), action=clean(body.action,30);
  if(action==="import"){
   if(!Array.isArray(body.students)||body.students.length<1||body.students.length>200)return json({error:"एक बार में 1 से 200 विद्यार्थी आयात करें।"},400);
   const seen=new Set(),stmts=[];
   for(let i=0;i<body.students.length;i++){
    const s=body.students[i]||{},school=clean(s.schoolKey,30),id=clean(s.profileId,100),name=clean(s.studentName,120),cls=clean(s.className,30);
    if(!schools[school]||!id||!name||!cls)return json({error:"पंक्ति "+(i+1)+" में विद्यालय, विद्यार्थी नाम या कक्षा अधूरी है। कोई रिकॉर्ड सेव नहीं हुआ।"},400);
    const key=school+"|"+id;if(seen.has(key))return json({error:"डुप्लीकेट प्रोफ़ाइल ID: "+id},400);seen.add(key);
    const marks=JSON.stringify(s.marks||{});if(marks.length>12000)return json({error:"विद्यार्थी "+name+" के अंकों का डेटा बहुत बड़ा है।"},413);
    stmts.push(env.SCHOOL_DB.prepare(`INSERT INTO student_profiles(profile_id,school_key,admission_no,student_name,father_name,mother_name,dob,class_name,pen,mobile_number,total_fee,marks_json,source_row,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(profile_id) DO UPDATE SET school_key=excluded.school_key,admission_no=excluded.admission_no,student_name=excluded.student_name,father_name=excluded.father_name,mother_name=excluded.mother_name,dob=excluded.dob,class_name=excluded.class_name,pen=excluded.pen,mobile_number=excluded.mobile_number,total_fee=excluded.total_fee,marks_json=excluded.marks_json,source_row=excluded.source_row,updated_at=CURRENT_TIMESTAMP`)
     .bind(id,school,clean(s.admissionNo,40),name,clean(s.fatherName,120),clean(s.motherName,120),clean(s.dob,30),cls,clean(s.pen,50),clean(s.mobileNumber,10),Math.max(0,Number(s.totalFee)||0),marks,Number(s.sourceRow)||null));
   }
   await env.SCHOOL_DB.batch(stmts);return json({ok:true,imported:stmts.length});
  }
  if(action==="edit"){
   const id=clean(body.profileId,100),school=clean(body.schoolKey,30),s=body.student||{};
   if(!id||!schools[school]||!clean(s.studentName,120)||!clean(s.className,30))return json({error:"नाम और कक्षा आवश्यक हैं।"},400);
   const result=await env.SCHOOL_DB.prepare(`UPDATE student_profiles SET admission_no=?,student_name=?,father_name=?,mother_name=?,dob=?,class_name=?,pen=?,mobile_number=?,total_fee=?,marks_json=?,updated_at=CURRENT_TIMESTAMP WHERE profile_id=? AND school_key=?`)
    .bind(clean(s.admissionNo,40),clean(s.studentName,120),clean(s.fatherName,120),clean(s.motherName,120),clean(s.dob,30),clean(s.className,30),clean(s.pen,50),clean(s.mobileNumber,10),Math.max(0,Number(s.totalFee)||0),JSON.stringify(s.marks||{}),id,school).run();
   if(!(result.meta?.changes))return json({error:"रिकॉर्ड नहीं मिला।"},404);return json({ok:true,saved:true});
  }
  return json({error:"अज्ञात कार्य।"},400);
 }catch(e){console.error("Student profile import error",e);return json({error:"डेटा सेव नहीं हुआ। Database/API configuration जाँचें।"},500)}
}