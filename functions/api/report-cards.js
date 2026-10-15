import { isAuthenticated, json, originIsSame } from "../_lib/auth.js";

const clean = (v, max=160) => String(v ?? "").trim().slice(0,max);
async function ensure(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS progress_cards (
    admission_no TEXT NOT NULL,
    school_key TEXT NOT NULL,
    session TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (admission_no, school_key, session)
  )`).run();
}
export async function onRequest({request, env}) {
  if (!env.SCHOOL_DB) return json({error:"School management database configure नहीं है।"},503);
  if (!(await isAuthenticated(request,env))) return json({error:"कृपया School Admin Login करें।"},401);
  try {
    await ensure(env.SCHOOL_DB);
    if (request.method === "GET") {
      const schoolKey = clean(new URL(request.url).searchParams.get("school"),30);
      const session = clean(new URL(request.url).searchParams.get("session"),20) || "2026-27";
      if (!["primary","l-madhyamik","u-madhyamik"].includes(schoolKey)) return json({error:"सही स्कूल चुनें।"},400);
      const result = await env.SCHOOL_DB.prepare("SELECT admission_no AS admissionNo, payload_json AS payloadJson, updated_at AS updatedAt FROM progress_cards WHERE school_key=? AND session=?").bind(schoolKey,session).all();
      return json({cards:(result.results||[]).map(r=>({admissionNo:r.admissionNo,payload:JSON.parse(r.payloadJson),updatedAt:r.updatedAt}))});
    }
    if (request.method !== "POST") return json({error:"Method not allowed"},405,{Allow:"GET, POST"});
    if (!originIsSame(request)) return json({error:"अनुरोध अस्वीकार किया गया।"},403);
    const body = await request.json();
    const admissionNo=clean(body.admissionNo,40), schoolKey=clean(body.schoolKey,30), session=clean(body.session,20), payload=body.payload;
    if (!admissionNo || !session || !["primary","l-madhyamik","u-madhyamik"].includes(schoolKey) || !payload || typeof payload!=="object") return json({error:"रिपोर्ट कार्ड का डेटा अधूरा है।"},400);
    const student = await env.SCHOOL_DB.prepare("SELECT admission_no FROM students WHERE admission_no=?").bind(admissionNo).first();
    if (!student) return json({error:"विद्यार्थी रिकॉर्ड नहीं मिला। पहले School Office में विद्यार्थी जोड़ें।"},404);
    const safePayload = JSON.stringify(payload);
    if (safePayload.length > 30000) return json({error:"रिपोर्ट कार्ड का डेटा बहुत बड़ा है।"},413);
    await env.SCHOOL_DB.prepare(`INSERT INTO progress_cards(admission_no,school_key,session,payload_json,updated_at)
      VALUES(?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(admission_no,school_key,session) DO UPDATE SET payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP`)
      .bind(admissionNo,schoolKey,session,safePayload).run();
    return json({ok:true,saved:true});
  } catch (e) {
    console.error("Progress card API error",e);
    return json({error:"रिपोर्ट कार्ड सेव/लोड नहीं हो सका। डेटाबेस सेटिंग जाँचें।"},500);
  }
}
