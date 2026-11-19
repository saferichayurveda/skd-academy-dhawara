import { isAuthenticated, json, originIsSame } from "../_lib/auth.js";

const clean = (v, n = 160) => String(v ?? "").trim().slice(0, n);
const amount = (v) => Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0;
const sessionPattern = /^\d{4}-\d{2}$/;

async function tableReady(db) {
  const names = ["student_session_enrollments", "fee_assessments", "fee_transactions", "fee_adjustments"];
  for (const name of names) {
    const row = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first();
    if (!row) return false;
  }
  return true;
}

export async function onRequest({ request, env }) {
  if (!env.SCHOOL_DB) return json({ error: "SCHOOL_DB database binding उपलब्ध नहीं है।" }, 503);
  if (!(await isAuthenticated(request, env))) return json({ error: "पहले School Office में Admin Login करें।" }, 401);

  try {
    if (!(await tableReady(env.SCHOOL_DB))) {
      return json({ error: "Fee ledger migration अभी database पर लागू नहीं हुई है। Preview/Production में migration status जाँचें।" }, 503);
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const academicSession = clean(url.searchParams.get("session"), 20);
      const schoolKey = clean(url.searchParams.get("school"), 30);
      if (!sessionPattern.test(academicSession)) return json({ error: "सत्र YYYY-YY प्रारूप में दें, जैसे 2027-28।" }, 400);
      const profiles = await env.SCHOOL_DB.prepare(`
        SELECT p.profile_id AS profileId, p.school_key AS schoolKey, p.admission_no AS admissionNo,
               p.student_name AS studentName, p.father_name AS fatherName, p.mobile_number AS mobileNumber,
               p.class_name AS sourceClass, p.total_fee AS legacyTotalFee,
               e.class_name AS sessionClass, e.monthly_fee AS monthlyFee,
               e.enrollment_status AS enrollmentStatus,
               e.concession_type AS concessionType, e.concession_value AS concessionValue
        FROM student_profiles p
        LEFT JOIN student_session_enrollments e
          ON e.profile_id=p.profile_id AND e.academic_session=?
        WHERE (?='' OR p.school_key=?)
        ORDER BY p.school_key, COALESCE(e.class_name,p.class_name), p.student_name
      `).bind(academicSession, schoolKey, schoolKey).all();
      const dues = await env.SCHOOL_DB.prepare(`
        SELECT profile_id AS profileId, school_key AS schoolKey, academic_session AS academicSession,
               fee_period AS feePeriod, period_start AS periodStart, period_end AS periodEnd,
               base_amount AS baseAmount, discount_amount AS discountAmount, net_amount AS netAmount,
               paid_amount AS paidAmount, MAX(net_amount-paid_amount,0) AS dueAmount, status
        FROM fee_assessments
        WHERE academic_session=? AND (?='' OR school_key=?)
        ORDER BY period_start, profile_id
      `).bind(academicSession, schoolKey, schoolKey).all();
      return json({ academicSession, students: profiles.results || [], dues: dues.results || [] });
    }

    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST" });
    if (!originIsSame(request)) return json({ error: "अनुरोध अस्वीकार किया गया।" }, 403);
    let body;
    try { body = await request.json(); } catch { return json({ error: "सही अनुरोध भेजें।" }, 400); }
    const action = clean(body.action, 40);
    const academicSession = clean(body.academicSession, 20);
    if (!sessionPattern.test(academicSession)) return json({ error: "सत्र YYYY-YY प्रारूप में दें।" }, 400);

    if (action === "promote_students") {
      if (!Array.isArray(body.students) || body.students.length < 1 || body.students.length > 200) {
        return json({ error: "एक बार में 1 से 200 विद्यार्थियों को Promote करें।" }, 400);
      }
      const seen = new Set();
      const statements = [];
      for (let i = 0; i < body.students.length; i++) {
        const item = body.students[i] || {};
        const profileId = clean(item.profileId, 100);
        const className = clean(item.className, 40);
        const monthlyFee = amount(item.monthlyFee);
        const schoolKey = clean(item.schoolKey, 30);
        if (!profileId || !className || !schoolKey) return json({ error: "पंक्ति " + (i + 1) + " में Profile ID, विद्यालय या नई कक्षा अधूरी है।" }, 400);
        if (seen.has(profileId)) return json({ error: "एक ही Profile ID दो बार दी गई है: " + profileId }, 400);
        seen.add(profileId);
        const profile = await env.SCHOOL_DB.prepare(
          "SELECT profile_id, school_key FROM student_profiles WHERE profile_id=?"
        ).bind(profileId).first();
        if (!profile || profile.school_key !== schoolKey) return json({ error: "विद्यार्थी रिकॉर्ड नहीं मिला या विद्यालय मेल नहीं खाता: " + profileId }, 404);
        statements.push(env.SCHOOL_DB.prepare(`
          INSERT INTO student_session_enrollments
            (profile_id, school_key, academic_session, class_name, monthly_fee, enrollment_status)
          VALUES (?, ?, ?, ?, ?, 'active')
          ON CONFLICT(profile_id, academic_session) DO NOTHING
        `).bind(profileId, schoolKey, academicSession, className, monthlyFee));
      }
      await env.SCHOOL_DB.batch(statements);
      return json({ ok: true, promoted: statements.length, note: "पहले से मौजूद सत्र-नामांकन को overwrite नहीं किया गया।" }, 201);
    }

    if (action === "update_enrollment") {
      const profileId = clean(body.profileId, 100);
      const schoolKey = clean(body.schoolKey, 30);
      const className = clean(body.className, 40);
      const monthlyFee = amount(body.monthlyFee);
      const status = clean(body.enrollmentStatus, 20) || "active";
      const concessionType = clean(body.concessionType, 20) || "none";
      const concessionValue = Number(body.concessionValue || 0);
      if (!profileId || !schoolKey || !className || !["active", "left", "transferred"].includes(status)) return json({ error: "विद्यार्थी, विद्यालय, कक्षा या स्थिति सही नहीं है।" }, 400);
      if (!["none", "fixed", "percent"].includes(concessionType) || !Number.isFinite(concessionValue) || concessionValue < 0 || (concessionType === "percent" && concessionValue > 100)) return json({ error: "रियायत का प्रकार या राशि सही नहीं है।" }, 400);
      const result = await env.SCHOOL_DB.prepare(`
        UPDATE student_session_enrollments
        SET class_name=?, monthly_fee=?, enrollment_status=?, concession_type=?, concession_value=?, updated_at=CURRENT_TIMESTAMP
        WHERE profile_id=? AND school_key=? AND academic_session=?
      `).bind(className, monthlyFee, status, concessionType, concessionValue, profileId, schoolKey, academicSession).run();
      if (!(result.meta?.changes)) return json({ error: "इस सत्र का विद्यार्थी रिकॉर्ड नहीं मिला। पहले Promote करें।" }, 404);
      return json({ ok: true, updated: true });
    }

    return json({ error: "अज्ञात कार्य अनुरोध।" }, 400);
  } catch (error) {
    console.error("Fee ledger API error:", error);
    return json({ error: "Fee ledger अनुरोध पूरा नहीं हुआ। Database migration और API जाँचें।" }, 500);
  }
}
