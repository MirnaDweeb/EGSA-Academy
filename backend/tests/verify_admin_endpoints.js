/**
 * Master Verification Suite: Comprehensive Admin Endpoints & Multi-Division Audit
 * Asserts HTTP 200 and schema validation across all administrative and strategic governance routes.
 */
const http = require('http');
const assert = require('assert');

const API_HOST = '127.0.0.1';
const API_PORT = process.env.PORT || 5000;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function login(email, password = 'Password123!') {
  const res = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email, password })
  );

  assert.strictEqual(res.status, 200, `Login failed for ${email}: ${res.raw}`);
  const token =
    res.data?.data?.accessToken ||
    res.data?.accessToken ||
    res.data?.data?.token ||
    res.data?.token;
  assert(token, `Missing token in login response for ${email}`);
  const user = res.data?.data?.user || res.data?.user;
  return { token, user };
}

async function runAudit() {
  console.log('========================================================================');
  console.log('EGSA ACADEMY: MASTER ADMIN ENDPOINTS & MULTI-DIVISION VERIFICATION SUITE');
  console.log('========================================================================\n');

  // 1. Authenticate University Admin
  console.log('[AUTH] Logging in as University Admin (sara.univadmin@egsa.gov.eg)...');
  const univAdmin = await login('sara.univadmin@egsa.gov.eg');
  console.log(`[AUTH SUCCESS] Authenticated as ${univAdmin.user?.fullName} (Role: ${univAdmin.user?.role}, Division: ${univAdmin.user?.division})\n`);

  // 2. Authenticate Super Admin
  console.log('[AUTH] Logging in as Super Admin (ayman.superadmin@egsa.gov.eg)...');
  const superAdmin = await login('ayman.superadmin@egsa.gov.eg');
  console.log(`[AUTH SUCCESS] Authenticated as ${superAdmin.user?.fullName} (Role: ${superAdmin.user?.role})\n`);

  const results = [];

  // -------------------------------------------------------------------------
  // TEST SUITE 1: Division Admin Endpoints
  // -------------------------------------------------------------------------
  console.log('--- SUITE 1: Division Admin Operational Endpoints (University Admin) ---');

  // 1.1 Applications Queue
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/admissions/admin/applications',
      method: 'GET',
      headers: { Authorization: `Bearer ${univAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `GET /api/admissions/admin/applications failed: ${res.raw}`);
    const count = res.data?.data?.length || 0;
    assert(count >= 10, `Expected at least 10 seeded applications, received ${count}`);
    console.log(`[PASS] GET /api/admissions/admin/applications -> HTTP 200 (${count} applications retrieved)`);
    results.push({ endpoint: 'GET /api/admissions/admin/applications', role: 'Division Admin', status: 200, count });
  }

  // 1.2 Admissions Audit Logs
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/admissions/admin/audit-logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${univAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `GET /api/admissions/admin/audit-logs failed: ${res.raw}`);
    const count = res.data?.data?.length || 0;
    assert(count > 0, `Expected seeded audit logs for division admin, received ${count}`);
    console.log(`[PASS] GET /api/admissions/admin/audit-logs -> HTTP 200 (${count} audit logs retrieved)`);
    results.push({ endpoint: 'GET /api/admissions/admin/audit-logs', role: 'Division Admin', status: 200, count });
  }

  // 1.3 Financial Overview KPIs
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/finance/overview',
      method: 'GET',
      headers: { Authorization: `Bearer ${univAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `GET /api/finance/overview failed: ${res.raw}`);
    const metrics = res.data?.data || {};
    assert(metrics.totalRevenue != null, 'Missing totalRevenue in financial overview');
    assert(metrics.pendingReceivables != null, 'Missing pendingReceivables in financial overview');
    console.log(`[PASS] GET /api/finance/overview -> HTTP 200 (Revenue: ${metrics.totalRevenue} EGP, Receivables: ${metrics.pendingReceivables} EGP, Waived: ${metrics.waivedAmount} EGP)`);
    results.push({ endpoint: 'GET /api/finance/overview', role: 'Division Admin', status: 200, count: 'KPIs verified' });
  }

  // 1.4 Commercial Invoices Ledger
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/finance/invoices',
      method: 'GET',
      headers: { Authorization: `Bearer ${univAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `GET /api/finance/invoices failed: ${res.raw}`);
    const count = res.data?.data?.length || 0;
    assert(count >= 5, `Expected multiple seeded invoices, received ${count}`);
    console.log(`[PASS] GET /api/finance/invoices -> HTTP 200 (${count} invoices retrieved)`);
    results.push({ endpoint: 'GET /api/finance/invoices', role: 'Division Admin', status: 200, count });
  }

  // 1.5 Command Overview
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/admin/overview',
      method: 'GET',
      headers: { Authorization: `Bearer ${univAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `GET /api/admin/overview failed: ${res.raw}`);
    console.log(`[PASS] GET /api/admin/overview -> HTTP 200 (Students: ${res.data?.data?.studentCount}, Applications: ${res.data?.data?.applicationCount})`);
    results.push({ endpoint: 'GET /api/admin/overview', role: 'Division Admin', status: 200, count: 'Command overview' });
  }

  // 1.6 Cohorts & Capacities
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/admin/cohorts',
      method: 'GET',
      headers: { Authorization: `Bearer ${univAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `GET /api/admin/cohorts failed: ${res.raw}`);
    const count = res.data?.data?.length || 0;
    assert(count >= 4, `Expected active cohorts, received ${count}`);
    console.log(`[PASS] GET /api/admin/cohorts -> HTTP 200 (${count} active cohorts retrieved)`);
    results.push({ endpoint: 'GET /api/admin/cohorts', role: 'Division Admin', status: 200, count });
  }

  // 1.7 Attendance Ledger & Risk Telemetry
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/attendance/admin/ledger',
      method: 'GET',
      headers: { Authorization: `Bearer ${univAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `GET /api/attendance/admin/ledger failed: ${res.raw}`);
    const { totalStudents = 0, atRiskCount = 0 } = res.data?.data || {};
    assert(totalStudents > 0, 'Expected attendance ledger records');
    assert(atRiskCount > 0, `Expected at least one flagged at-risk cadet (<85%), found ${atRiskCount}`);
    console.log(`[PASS] GET /api/attendance/admin/ledger -> HTTP 200 (Total Cadets: ${totalStudents}, At-Risk (<85%): ${atRiskCount})`);
    results.push({ endpoint: 'GET /api/attendance/admin/ledger', role: 'Division Admin', status: 200, count: `Total: ${totalStudents}, At-Risk: ${atRiskCount}` });
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 2: Super Admin Strategic Governance Endpoints
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Super Admin Executive Governance Endpoints (Super Admin) ---');

  // 2.1 Strategic Overview & Cross-Division Intelligence
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/admin/super/strategic-overview',
      method: 'GET',
      headers: { Authorization: `Bearer ${superAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `GET /api/admin/super/strategic-overview failed: ${res.raw}`);
    assert(res.data?.success === true, 'Expected success: true');
    const { divisions, totals, funnel } = res.data?.data || {};
    assert(divisions?.UNIVERSITY, 'Missing UNIVERSITY division in strategic overview');
    assert(divisions?.PRE_UNIVERSITY, 'Missing PRE_UNIVERSITY division in strategic overview');
    assert(totals?.totalRevenue > 0, `Expected positive global revenue, got ${totals?.totalRevenue}`);
    assert(totals?.totalApplications >= 15, `Expected at least 15 total applications, got ${totals?.totalApplications}`);
    console.log(`[PASS] GET /api/admin/super/strategic-overview -> HTTP 200`);
    console.log(`       - Global Revenue: ${totals?.totalRevenue} EGP`);
    console.log(`       - Global Applications: ${totals?.totalApplications}`);
    console.log(`       - Seat Utilization: ${totals?.overallUtilizationRate}%`);
    console.log(`       - University Division: ${divisions.UNIVERSITY.totalApplications} apps, ${divisions.UNIVERSITY.confirmedSeats} seats`);
    console.log(`       - Pre-University Division: ${divisions.PRE_UNIVERSITY.totalApplications} apps, ${divisions.PRE_UNIVERSITY.confirmedSeats} seats`);
    results.push({ endpoint: 'GET /api/admin/super/strategic-overview', role: 'Super Admin', status: 200, count: 'Cross-Division Matrix' });
  }

  // 2.2 Master Audit Logs
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/admin/super/audit-logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${superAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `GET /api/admin/super/audit-logs failed: ${res.raw}`);
    const logs = res.data?.data || [];
    assert(logs.length >= 5, `Expected at least 5 audit logs, got ${logs.length}`);
    console.log(`[PASS] GET /api/admin/super/audit-logs -> HTTP 200 (${logs.length} master audit logs retrieved)`);
    results.push({ endpoint: 'GET /api/admin/super/audit-logs', role: 'Super Admin', status: 200, count: logs.length });
  }

  // 2.3 System Config Retrieval
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/admin/super/config',
      method: 'GET',
      headers: { Authorization: `Bearer ${superAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `GET /api/admin/super/config failed: ${res.raw}`);
    const config = res.data?.data || {};
    assert.strictEqual(config.seatReservationHours, 72, 'Expected 72h seat reservation hours');
    assert.strictEqual(config.minimumAttendanceGate, 85, 'Expected 85% attendance gate');
    console.log(`[PASS] GET /api/admin/super/config -> HTTP 200 (Hold: ${config.seatReservationHours}h, Min Attendance: ${config.minimumAttendanceGate}%)`);
    results.push({ endpoint: 'GET /api/admin/super/config', role: 'Super Admin', status: 200, count: 'Config verified' });
  }

  // 2.4 Super Admin Access to Division Admissions Queue (cross-division visibility)
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/admissions/admin/applications',
      method: 'GET',
      headers: { Authorization: `Bearer ${superAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `Super Admin access to applications failed: ${res.raw}`);
    console.log(`[PASS] GET /api/admissions/admin/applications (Super Admin) -> HTTP 200 (${res.data?.data?.length} applications)`);
    results.push({ endpoint: 'GET /api/admissions/admin/applications (Cross-Division)', role: 'Super Admin', status: 200, count: res.data?.data?.length });
  }

  // 2.5 Super Admin Access to Financial Ledgers
  {
    const res = await request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/finance/invoices',
      method: 'GET',
      headers: { Authorization: `Bearer ${superAdmin.token}` },
    });
    assert.strictEqual(res.status, 200, `Super Admin access to invoices failed: ${res.raw}`);
    console.log(`[PASS] GET /api/finance/invoices (Super Admin) -> HTTP 200 (${res.data?.data?.length} invoices)`);
    results.push({ endpoint: 'GET /api/finance/invoices (Cross-Division)', role: 'Super Admin', status: 200, count: res.data?.data?.length });
  }

  console.log('\n========================================================================');
  console.log('MASTER VERIFICATION SUMMARY: ALL ADMIN ENDPOINTS RETURNED HTTP 200 OK');
  console.log('========================================================================');
  console.table(results);
}

runAudit().catch((err) => {
  console.error('\n[FATAL AUDIT FAILURE]', err);
  process.exit(1);
});
