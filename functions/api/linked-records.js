import { isAuthenticated, json } from "../_lib/auth.js";

const schools = {
  primary: { name: "S. K. D. Prathmik Vidyalaya", code: "09590408502" },
  "l-madhyamik": { name: "S. K. D. L. Madhyamik Vidyalaya", code: "09590408503" },
  "u-madhyamik": { name: "S. K. D. U. Madhyamik Vidyalaya", code: "09590408504" }
};
async function ensure(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS student_profiles (
    profile_id TEXT PRIMARY KEY, school_key TEXT NOT NULL, admission_no TEXT NOT NULL DEFAULT '',
    student_name TEXT NOT NULL, father_name TEXT NOT NULL DEFAULT '', mother_name TEXT NOT NULL DEFAULT '',
    dob TEXT NOT NULL DEFAULT '', class_name TEXT NOT NULL DEFAULT '', pen TEXT NOT NULL DEFAULT '',
    mobile_number TEXT NOT NULL DEFAULT '', total_fee INTEGER NOT NULL DEFAULT 0,
    marks_json TEXT NOT NULL DEFAULT '{}', source_row INTEGER, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_key,profile_id))`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS progress_cards (
    admission_no TEXT NOT NULL, school_key TEXT NOT NULL, session TEXT NOT NULL,
    payload_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (admission_no, school_key, session))`).run();
}
export async function onRequest({ request, env }) {
  if (!(await isAuthenticated(request, env))) return json({ error: "पहले School Office में Admin Login करें।" }, 401);
  if (!env.SCHOOL_DB) return json({ error: "SCHOOL_DB database binding उपलब्ध नहीं है।" }, 503);
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });
  try {
    const db = env.SCHOOL_DB;
    await ensure(db);
    const [profiles, cards] = await Promise.all([
      db.prepare("SELECT profile_id,school_key,admission_no,student_name,father_name,mother_name,dob,class_name,pen,mobile_number,total_fee,marks_json,updated_at FROM student_profiles ORDER BY school_key,class_name,student_name").all(),
      db.prepare("SELECT admission_no,school_key,session,payload_json,updated_at FROM progress_cards ORDER BY updated_at DESC").all()
    ]);
    let legacyStudents = [], payments = [];
    try {
      const s = await db.prepare("SELECT s.admission_no AS admissionNo,s.student_name AS studentName,s.father_name AS fatherName,s.mobile_number AS mobileNumber,s.class_name AS className,s.total_fee AS totalFee,COALESCE(SUM(p.amount),0) AS paidFee FROM students s LEFT JOIN payments p ON p.student_id=s.id GROUP BY s.admission_no ORDER BY s.student_name LIMIT 2000").all();
      legacyStudents = s.results || [];
      const p = await db.prepare("SELECT p.id,p.receipt_no AS receiptNo,s.admission_no AS admissionNo,s.student_name AS studentName,s.father_name AS fatherName,s.mobile_number AS mobileNumber,s.class_name AS className,s.total_fee AS totalFee,p.amount AS paidFee,SUM(p.amount) OVER(PARTITION BY p.student_id ORDER BY p.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulativePaidFee,p.payment_date AS paymentDate,p.payment_mode AS paymentMode,p.remarks FROM payments p JOIN students s ON s.id=p.student_id ORDER BY p.id DESC LIMIT 2000").all();
      payments = p.results || [];
    } catch (e) {
      // Older installations may not yet have the legacy fee tables.
      console.warn("Legacy fee records not available to linked-records API", e);
    }
    const studentProfiles = (profiles.results || []).map(p => ({ ...p, marks: safeJson(p.marks_json), schoolName: schools[p.school_key]?.name || p.school_key, udise: schools[p.school_key]?.code || "" }));
    const progressCards = (cards.results || []).map(c => ({ admissionNo: c.admission_no, schoolKey: c.school_key, session: c.session, payload: safeJson(c.payload_json), updatedAt: c.updated_at }));
    return json({ students: studentProfiles, legacyStudents, progressCards, payments, schools });
  } catch (e) {
    console.error("Linked records API error", e);
    return json({ error: "केंद्रीय विद्यार्थी डेटा लोड नहीं हुआ।" }, 500);
  }
}
function safeJson(v) { try { return JSON.parse(v || "{}"); } catch { return {}; } }
