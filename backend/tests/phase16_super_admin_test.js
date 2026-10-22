const http = require('http');
const assert = require('assert');

const API_HOST = '127.0.0.1';
const API_PORT = 5000;

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

async function loginUser(email, password = 'Password123!') {
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

async function runPhase16SuperAdminTest() {
  console.log('========================================================================');
  console.log(' EgSA Academy — Phase 16 Super Admin Executive Suite & Governance Test');
  console.log(' Target Spec: Sections 4, 5, 12, 17, and 18 (Executive Analytics & Audit)');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Authenticate Users across Roles
  // -------------------------------------------------------------------------
  console.log('1. Authenticating test users across platform roles...');
  const student = await loginUser('omar.student@egsa.gov.eg');
  console.log('   ✓ Student authenticated:', student.user.email);

  const instructor = await loginUser('tarek.instructor@egsa.gov.eg');
  console.log('   ✓ Instructor authenticated:', instructor.user.email);

  const univAdmin = await loginUser('sara.univadmin@egsa.gov.eg');
  console.log('   ✓ University Admin authenticated:', univAdmin.user.email);

  const superAdmin = await loginUser('ayman.superadmin@egsa.gov.eg');
  console.log('   ✓ Super Admin authenticated:', superAdmin.user.email, '(Role:', superAdmin.user.role, ')\n');

  // -------------------------------------------------------------------------
  // 2. Security Guardrails: Strict Role Authorization (Non-Super-Admin Rejected)
  // -------------------------------------------------------------------------
  console.log('2. Testing Security Guardrails: Non-Super-Admin Access Rejection (HTTP 403)...');
  
  // Student Attempt
  const studentAttempt = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admin/super/strategic-overview',
    method: 'GET',
    headers: { Authorization: `Bearer ${student.token}` },
  });
  assert.strictEqual(studentAttempt.status, 403, `Student must receive HTTP 403, got ${studentAttempt.status}`);
  console.log('   ✓ Student access blocked with HTTP 403 Forbidden.');

  // Instructor Attempt
  const instructorAttempt = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admin/super/strategic-overview',
    method: 'GET',
    headers: { Authorization: `Bearer ${instructor.token}` },
  });
  assert.strictEqual(instructorAttempt.status, 403, `Instructor must receive HTTP 403, got ${instructorAttempt.status}`);
  console.log('   ✓ Instructor access blocked with HTTP 403 Forbidden.');

  // Division Admin Attempt
  const divAdminAttempt = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admin/super/strategic-overview',
    method: 'GET',
    headers: { Authorization: `Bearer ${univAdmin.token}` },
  });
  assert.strictEqual(divAdminAttempt.status, 403, `Division Admin must receive HTTP 403, got ${divAdminAttempt.status}`);
  console.log('   ✓ Division Admin access blocked with HTTP 403 Forbidden.\n');

  // -------------------------------------------------------------------------
  // 3. Super Admin Executive Strategic Overview (GET /api/admin/super/strategic-overview)
  // -------------------------------------------------------------------------
  console.log('3. Querying Executive Strategic Overview as Super Admin...');
  const overviewRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admin/super/strategic-overview',
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });

  assert.strictEqual(overviewRes.status, 200, `Failed to fetch strategic overview: ${overviewRes.raw}`);
  assert.strictEqual(overviewRes.data?.success, true);
  const overview = overviewRes.data?.data;
  assert(overview, 'Overview data object missing');

  // Verify Cross-Division Comparison
  const univMetrics = overview.divisions?.UNIVERSITY;
  const preUnivMetrics = overview.divisions?.PRE_UNIVERSITY;
  assert(univMetrics, 'UNIVERSITY division metrics missing');
  assert(preUnivMetrics, 'PRE_UNIVERSITY division metrics missing');

  console.log('   [UNIVERSITY Division]');
  console.log(`     Applications: ${univMetrics.totalApplications}, Enrollments: ${univMetrics.totalEnrollments}`);
  console.log(`     Revenue: ${univMetrics.financials.collectedRevenue} EGP, Waived: ${univMetrics.financials.waivedAmount} EGP`);
  console.log(`     Seat Capacity Utilization: ${univMetrics.seatUtilizationRate}%`);
  console.log(`     Evaluation Average: ${univMetrics.evaluationAverage} / 5.0`);

  console.log('   [PRE_UNIVERSITY Division]');
  console.log(`     Applications: ${preUnivMetrics.totalApplications}, Enrollments: ${preUnivMetrics.totalEnrollments}`);
  console.log(`     Revenue: ${preUnivMetrics.financials.collectedRevenue} EGP, Waived: ${preUnivMetrics.financials.waivedAmount} EGP`);
  console.log(`     Seat Capacity Utilization: ${preUnivMetrics.seatUtilizationRate}%`);
  console.log(`     Evaluation Average: ${preUnivMetrics.evaluationAverage} / 5.0`);

  // Verify Operational Funnel
  const funnel = overview.funnel;
  assert(funnel, 'Operational funnel missing');
  console.log('   [Operational Funnel]');
  console.log(`     Applied: ${funnel.applied} → Eligible: ${funnel.eligible} → Assessed: ${funnel.assessed} → Provisional: ${funnel.provisional} → Enrolled: ${funnel.enrolled} → Certified: ${funnel.certified}`);
  console.log(`     Overall Conversion Rate: ${funnel.conversionRate}%`);
  assert(funnel.applied >= funnel.enrolled, 'Applied count must be >= Enrolled count');

  // Verify Totals
  const totals = overview.totals;
  assert(totals, 'Totals object missing');
  console.log(`   ✓ Global Totals: Revenue: ${totals.totalRevenue} EGP, Receivables: ${totals.pendingReceivables} EGP, Utilization: ${totals.overallUtilizationRate}%\n`);

  // -------------------------------------------------------------------------
  // 4. Academy-Wide Master Immutable Audit Trail (GET /api/admin/super/audit-logs)
  // -------------------------------------------------------------------------
  console.log('4. Querying Academy-Wide Master Immutable Audit Trail...');
  const auditRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admin/super/audit-logs',
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });

  assert.strictEqual(auditRes.status, 200, `Failed to retrieve master audit logs: ${auditRes.raw}`);
  assert.strictEqual(auditRes.data?.success, true);
  const auditLogs = auditRes.data?.data || [];
  console.log(`   ✓ Retrieved ${auditLogs.length} platform-wide audit log entries (Total: ${auditRes.data?.total}).`);

  // Test filter by division
  const univAuditRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admin/super/audit-logs?division=UNIVERSITY',
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });
  assert.strictEqual(univAuditRes.status, 200);
  const univLogs = univAuditRes.data?.data || [];
  console.log(`   ✓ Filtered by UNIVERSITY division: ${univLogs.length} records returned.`);

  // Verify that any returned logs have division === 'UNIVERSITY'
  univLogs.forEach((log) => {
    if (log.division) {
      assert.strictEqual(log.division.toUpperCase(), 'UNIVERSITY');
    }
  });
  console.log('   ✓ Audit logs division filtering verified cleanly.\n');

  // -------------------------------------------------------------------------
  // 5. Institutional System Configuration (GET & PUT /api/admin/super/config)
  // -------------------------------------------------------------------------
  console.log('5. Testing Institutional System Configuration...');
  const configRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admin/super/config',
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });

  assert.strictEqual(configRes.status, 200, `Failed to fetch system config: ${configRes.raw}`);
  const config = configRes.data?.data;
  assert(config, 'Config data missing');
  assert.strictEqual(typeof config.seatReservationHours, 'number');
  assert.strictEqual(typeof config.minimumAttendanceGate, 'number');
  assert.strictEqual(typeof config.passingAssessmentThreshold, 'number');
  console.log(`   Initial Config: 72h Rule: ${config.seatReservationHours}h, Attendance Gate: ${config.minimumAttendanceGate}%, Passing Threshold: ${config.passingAssessmentThreshold}%`);

  // 5B. Tune Institutional Constants
  console.log('   5B. Updating institutional thresholds (seatReservationHours: 48, attendanceGate: 88%, passingThreshold: 75%)...');
  const updateRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/admin/super/config',
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${superAdmin.token}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({
      seatReservationHours: 48,
      minimumAttendanceGate: 88,
      passingAssessmentThreshold: 75,
    })
  );

  assert.strictEqual(updateRes.status, 200, `Failed to update config: ${updateRes.raw}`);
  const updatedConfig = updateRes.data?.data;
  assert.strictEqual(updatedConfig.seatReservationHours, 48);
  assert.strictEqual(updatedConfig.minimumAttendanceGate, 88);
  assert.strictEqual(updatedConfig.passingAssessmentThreshold, 75);
  console.log('   ✓ Configuration successfully tuned.');

  // 5C. Confirm persistence via re-fetching
  const verifyConfigRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admin/super/config',
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });
  assert.strictEqual(verifyConfigRes.data?.data?.seatReservationHours, 48);
  assert.strictEqual(verifyConfigRes.data?.data?.minimumAttendanceGate, 88);
  assert.strictEqual(verifyConfigRes.data?.data?.passingAssessmentThreshold, 75);
  console.log('   ✓ Verified persistence in database.');

  // 5D. Verify AuditLog entry was written for SYSTEM_CONFIG_UPDATED
  console.log('   5D. Verifying AuditLog entry for SYSTEM_CONFIG_UPDATED...');
  const configAuditRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admin/super/audit-logs?action=SYSTEM_CONFIG_UPDATED',
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });
  const configAudits = configAuditRes.data?.data || [];
  const latestConfigAudit = configAudits[0];
  assert(latestConfigAudit, 'AuditLog entry for SYSTEM_CONFIG_UPDATED not found');
  assert.strictEqual(latestConfigAudit.action, 'SYSTEM_CONFIG_UPDATED');
  assert.strictEqual(latestConfigAudit.entity, 'SystemConfig');
  assert.strictEqual(latestConfigAudit.after?.seatReservationHours, 48);
  console.log('   ✓ Immutable AuditLog entry verified for SYSTEM_CONFIG_UPDATED.\n');

  console.log('========================================================================');
  console.log(' ✓ ALL PHASE 16 SUPER ADMIN INTEGRATION TESTS PASSED!');
  console.log('========================================================================');
}

runPhase16SuperAdminTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ PHASE 16 TEST FAILED:', err);
    process.exit(1);
  });
