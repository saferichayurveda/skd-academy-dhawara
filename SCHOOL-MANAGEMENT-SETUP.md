# School Management Setup (Free Cloudflare D1)

The school office module uses Cloudflare D1 so records are stored on the server and are not limited to one phone/browser. Student and fee records are only returned after the existing admin session is authenticated.

## One-time setup
1. Cloudflare Dashboard → Storage & databases → D1 SQL Database → Create database.
2. Database name: `skd-academy-school` (Free plan is sufficient for the initial module).
3. Open Workers & Pages → `skd-academy-dhawara` → Settings → Bindings → Add D1 database binding.
4. Variable name must be exactly `SCHOOL_DB`; select `skd-academy-school`; apply to Production (and Preview if you test previews).
5. In the D1 database's Console, run the full SQL from `migrations/0001_school_management.sql`.
6. Deploy the site again, then open `/school-office.html` and sign in with the existing `ADMIN_PASSWORD` configured for the gallery admin. Do not put this password in GitHub or send it in chat.

## Module
- Add/edit student profile by Admission No. (student name, father name, 10-digit mobile number, class, total fee).
- Record each payment; receipt numbers are generated sequentially from the database ID as `SKD-0001`, `SKD-0002`, etc.
- Print a single payment receipt from the browser's print dialog (choose Save as PDF to create a PDF).
- Record staff attendance by date using P (Present), A (Absent), L (Leave); same staff/date can be corrected by saving again.
- Monthly report counts P/A/L and paid fee totals.
- The existing public school website and Safe Rich Ayurveda project are not changed by this module.

## Data handling
Use the private admin page only. Keep `ADMIN_PASSWORD` strong and private. The module stores student and payment data in D1 and does not publish those records on the public homepage.
