import { isAuthenticated, json, originIsSame } from "../_lib/auth.js";

const today = () => new Date().toISOString().slice(0, 10);
const clean = (value, max = 160) => String(value ?? "").trim().slice(0, max);
const rupees = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;

async function loadData(db) {
  const [students, payments, attendance] = await Promise.all([
    db.prepare("SELECT s.admission_no AS admissionNo, s.student_name AS studentName, s.father_name AS fatherName, s.class_name AS className, s.total_fee AS totalFee, COALESCE(SUM(p.paid_fee),0) AS paidFee FROM students s LEFT JOIN payments p ON p.admission_no=s.admission_no GROUP BY s.admission_no ORDER BY s.admission_no LIMIT 1000").all(),
    db.prepare("SELECT id, receipt_no AS receiptNo, admission_no AS admissionNo, student_name AS studentName, father_name AS fatherName, class_name AS className, total_fee AS totalFee, paid_fee AS paidFee, SUM(paid_fee) OVER (PARTITION BY admission_no ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulativePaidFee, payment_date AS paymentDate, payment_mode AS paymentMode, remarks FROM payments ORDER BY id DESC LIMIT 1000").all(),
    db.prepare("SELECT id, staff_name AS staffName, attendance_date AS attendanceDate, status, remarks FROM staff_attendance ORDER BY attendance_date DESC, staff_name LIMIT 2000").all()
  ]);
  return { students: students.results || [], payments: payments.results || [], attendance: attendance.results || [] };
}

export async function onRequest({ request, env }) {
  if (!env.SCHOOL_DB) return json({ error: "School management database अभी configure नहीं है। Cloudflare में SCHOOL_DB D1 binding जोड़ें और migrations/0001_school_management.sql चलाएँ।" }, 503);
  if (!(await isAuthenticated(request, env))) return json({ error: "कृपया School Admin Login करें।" }, 401);

  if (request.method === "GET") {
    try { return json(await loadData(env.SCHOOL_DB)); }
    catch { return json({ error: "डेटा पढ़ने में समस्या हुई। D1 schema और binding जाँचें।" }, 500); }
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST" });
  if (!originIsSame(request)) return json({ error: "अनुरोध अस्वीकार किया गया।" }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: "सही अनुरोध भेजें।" }, 400); }
  const action = clean(body.action, 40);

  try {
    if (action === "save_student") {
      const admissionNo = clean(body.admissionNo, 40);
      const studentName = clean(body.studentName, 120);
      const fatherName = clean(body.fatherName, 120);
      const className = clean(body.className, 40);
      const totalFee = rupees(body.totalFee);
      if (!admissionNo || !studentName || !className) return json({ error: "Admission No., विद्यार्थी का नाम और Class भरें।" }, 400);
      await env.SCHOOL_DB.prepare("INSERT INTO students (admission_no, student_name, father_name, class_name, total_fee) VALUES (?, ?, ?, ?, ?) ON CONFLICT(admission_no) DO UPDATE SET student_name=excluded.student_name, father_name=excluded.father_name, class_name=excluded.class_name, total_fee=excluded.total_fee")
        .bind(admissionNo, studentName, fatherName, className, totalFee).run();
      return json({ ok: true }, 201);
    }

    if (action === "add_payment") {
      const admissionNo = clean(body.admissionNo, 40);
      const paidFee = rupees(body.paidFee);
      const paymentDate = clean(body.paymentDate, 10) || today();
      const paymentMode = clean(body.paymentMode, 30) || "Cash";
      const remarks = clean(body.remarks, 300);
      if (!admissionNo || paidFee <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return json({ error: "विद्यार्थी, जमा राशि और सही भुगतान तारीख भरें।" }, 400);
      const student = await env.SCHOOL_DB.prepare("SELECT admission_no, student_name, father_name, class_name, total_fee FROM students WHERE admission_no=?").bind(admissionNo).first();
      if (!student) return json({ error: "यह Admission No. विद्यार्थी सूची में नहीं मिला। पहले विद्यार्थी जोड़ें।" }, 404);
      const inserted = await env.SCHOOL_DB.prepare("INSERT INTO payments (admission_no, student_name, father_name, class_name, total_fee, paid_fee, payment_date, payment_mode, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(student.admission_no, student.student_name, student.father_name, student.class_name, student.total_fee, paidFee, paymentDate, paymentMode, remarks).run();
      const id = inserted.meta?.last_row_id;
      if (!id) return json({ error: "भुगतान दर्ज हुआ या नहीं, इसकी पुष्टि नहीं हो सकी। रिकॉर्ड जाँचें।" }, 500);
      const receiptNo = "SKD-" + String(id).padStart(4, "0");
      await env.SCHOOL_DB.prepare("UPDATE payments SET receipt_no=? WHERE id=?").bind(receiptNo, id).run();
      return json({ ok: true, receiptNo }, 201);
    }

    if (action === "save_attendance") {
      const staffName = clean(body.staffName, 120);
      const attendanceDate = clean(body.attendanceDate, 10) || today();
      const status = clean(body.status, 1).toUpperCase();
      const remarks = clean(body.remarks, 300);
      if (!staffName || !/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate) || !["P","A","L"].includes(status)) return json({ error: "शिक्षक का नाम, तारीख और P/A/L स्थिति सही भरें।" }, 400);
      await env.SCHOOL_DB.prepare("INSERT INTO staff_attendance (staff_name, attendance_date, status, remarks) VALUES (?, ?, ?, ?) ON CONFLICT(staff_name, attendance_date) DO UPDATE SET status=excluded.status, remarks=excluded.remarks")
        .bind(staffName, attendanceDate, status, remarks).run();
      return json({ ok: true }, 201);
    }

    return json({ error: "अज्ञात कार्य अनुरोध।" }, 400);
  } catch (error) {
    return json({ error: "रिकॉर्ड सेव नहीं हुआ। कृपया दोबारा कोशिश करें।" }, 500);
  }
}
