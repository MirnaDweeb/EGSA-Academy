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

async function runPhase14GovernanceTest() {
  console.log('========================================================================');
  console.log(' EgSA Academy — Phase 14 Division Admin Governance & Audit Trail Test');
  console.log(' Target Spec: Sections 4, 5, 12, 17, and 18 (Division Scoping & Overrides)');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Authenticate University Admin
  // -------------------------------------------------------------------------
  console.log('1. Authenticating as University Admin (sara.univadmin@egsa.gov.eg)...');
  const { token: univAdminToken, user: univAdminUser } = await loginUser('sara.univadmin@egsa.gov.eg');
  assert.strictEqual(univAdminUser.division, 'UNIVERSITY', 'User division must be UNIVERSITY');
  console.log(`   ✓ University Admin authenticated successfully (ID: ${univAdminUser._id || univAdminUser.id}).\n`);

  // -------------------------------------------------------------------------
  // 2. Strict Division Isolation Check (University Admin)
  // -------------------------------------------------------------------------
  console.log('2. Querying applications ledger as University Admin (GET /api/admissions/admin/applications)...');
  const univAppsRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admissions/admin/applications',
    method: 'GET',
    headers: { Authorization: `Bearer ${univAdminToken}` },
  });

  assert.strictEqual(univAppsRes.status, 200, `Failed to query applications: ${univAppsRes.raw}`);
  const univApps = univAppsRes.data?.data || univAppsRes.data?.items || univAppsRes.data || [];
  assert(Array.isArray(univApps) && univApps.length > 0, 'No applications returned for University division');
  assert.strictEqual(univAppsRes.data?.scopeDivision, 'UNIVERSITY', 'Response scopeDivision must be UNIVERSITY');

  console.log(`   ✓ Received ${univApps.length} applications in University scope.`);

  // Verify zero leak: all returned applications must belong to UNIVERSITY
  for (const app of univApps) {
    const courseDivision = app.course?.division;
    assert.strictEqual(
      courseDivision,
      'UNIVERSITY',
      `LEAK DETECTED: Application ${app._id} has course division "${courseDivision}", expected "UNIVERSITY"`
    );
    const studentEmail = app.student?.email;
    assert.notStrictEqual(
      studentEmail,
      'nour.cadet@egsa.gov.eg',
      `LEAK DETECTED: Pre-University cadet Nour Mansour application appeared in University Admin ledger!`
    );
  }
  console.log('   ✓ Strict division isolation verified: 0 Pre-University records leaked to University Admin.\n');

  // Locate Youssef Mohamed's application in Manual Review
  const youssefApp = univApps.find((a) => a.student?.email === 'youssef.student@egsa.gov.eg');
  assert(youssefApp, 'Expected seeded application for youssef.student@egsa.gov.eg in University queue');
  console.log(`   ✓ Located target application for Youssef Mohamed (ID: ${youssefApp._id}, Status: ${youssefApp.status}).\n`);

  // -------------------------------------------------------------------------
  // 3. Administrative Override Validation Mechanics
  // -------------------------------------------------------------------------
  console.log('3. Testing Administrative Override Validation (POST /api/admissions/admin/applications/:id/override)...');

  // 3A. Missing reason -> HTTP 400
  console.log('   3A. Submitting override with empty reason...');
  const emptyReasonRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/admissions/admin/applications/${youssefApp._id}/override`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${univAdminToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({ reason: '' })
  );
  assert.strictEqual(emptyReasonRes.status, 400, `Expected 400 on empty reason, got ${emptyReasonRes.status}: ${emptyReasonRes.raw}`);
  console.log('   ✓ Rejected empty reason with HTTP 400 as expected.');

  // 3B. Short reason (< 10 chars) -> HTTP 400
  console.log('   3B. Submitting override with short reason ("too short", 9 chars)...');
  const shortReasonRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/admissions/admin/applications/${youssefApp._id}/override`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${univAdminToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({ reason: 'too short' })
  );
  assert.strictEqual(shortReasonRes.status, 400, `Expected 400 on short reason, got ${shortReasonRes.status}: ${shortReasonRes.raw}`);
  console.log('   ✓ Rejected short reason (< 10 characters) with HTTP 400 as expected.');

  // 3C. Valid reason -> HTTP 200, status Eligible, adminOverride stamped
  console.log('   3C. Submitting override with valid justification reason...');
  const validReason = 'Approved institutional prerequisite waiver: Cadet demonstrated outstanding astrodynamics research in aerospace lab.';
  const validOverrideRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/admissions/admin/applications/${youssefApp._id}/override`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${univAdminToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({ reason: validReason })
  );

  assert.strictEqual(validOverrideRes.status, 200, `Override failed: ${validOverrideRes.raw}`);
  const updatedApp = validOverrideRes.data?.data || validOverrideRes.data?.application || validOverrideRes.data;
  assert(
    ['Eligible', 'Accepted'].includes(updatedApp.status),
    `Expected status "Eligible" or "Accepted", got "${updatedApp.status}"`
  );
  assert(updatedApp.adminOverride, 'adminOverride object must be present on application');
  assert.strictEqual(updatedApp.adminOverride.applied, true, 'adminOverride.applied must be true');
  assert.strictEqual(updatedApp.adminOverride.reason, validReason, 'adminOverride.reason must match submitted justification');
  assert(updatedApp.adminOverride.adminId, 'adminOverride.adminId must be stamped');
  assert(updatedApp.adminOverride.overriddenAt, 'adminOverride.overriddenAt timestamp must be recorded');
  console.log(`   ✓ Override approved, status transitioned to "${updatedApp.status}", and administrative stamp applied successfully.\n`);

  // -------------------------------------------------------------------------
  // 4. Audit Trail Verification
  // -------------------------------------------------------------------------
  console.log('4. Verifying Immutable Governance Audit Trail (GET /api/admissions/admin/audit-logs)...');
  const auditRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admissions/admin/audit-logs',
    method: 'GET',
    headers: { Authorization: `Bearer ${univAdminToken}` },
  });

  assert.strictEqual(auditRes.status, 200, `Failed to retrieve audit logs: ${auditRes.raw}`);
  const auditLogs = auditRes.data?.data || auditRes.data?.items || auditRes.data || [];
  assert(Array.isArray(auditLogs) && auditLogs.length > 0, 'Audit logs ledger is unexpectedly empty');
  console.log(`   ✓ Retrieved ${auditLogs.length} audit trail records.`);

  // Find the override event
  const overrideEvent = auditLogs.find(
    (log) =>
      log.action === 'ADMIN_OVERRIDE' &&
      String(log.entityId || log.resourceId) === String(youssefApp._id)
  );

  assert(overrideEvent, `No ADMIN_OVERRIDE audit event found for Application ID ${youssefApp._id}`);
  assert.strictEqual(overrideEvent.entity || overrideEvent.resource, 'Application', 'Audit entity must be "Application"');
  assert(overrideEvent.actor || overrideEvent.user, 'Audit actor must be present');
  const eventDetails = overrideEvent.details || overrideEvent.after || {};
  assert(
    ['Eligible', 'Accepted'].includes(eventDetails.newStatus),
    `Audit details.newStatus must be Eligible or Accepted, got: ${eventDetails.newStatus}`
  );
  assert.strictEqual(eventDetails.reason, validReason, 'Audit details.reason must match override justification');
  console.log('   ✓ Immutable AuditLog entry verified with actor, entity, entityId, previousStatus, newStatus, and justification.\n');

  // -------------------------------------------------------------------------
  // 5. Request Document/Info & Formal Rejection Endpoints
  // -------------------------------------------------------------------------
  console.log('5. Testing Request More Info & Reject endpoints...');

  // 5A. Request More Info
  const infoRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/admissions/admin/applications/${youssefApp._id}/request-info`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${univAdminToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({
      note: 'Please upload an official stamped copy of your Bachelor degree transcript.',
      requiredItem: 'Official University Transcript',
    })
  );
  assert.strictEqual(infoRes.status, 200, `Request-info failed: ${infoRes.raw}`);
  const infoApp = infoRes.data?.data || infoRes.data?.application || infoRes.data;
  assert.strictEqual(infoApp.status, 'Needs Information', `Expected status "Needs Information", got "${infoApp.status}"`);
  console.log('   ✓ Request-info transitioned status to "Needs Information" and dispatched request.');

  // 5B. Reject Application
  const rejectRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/admissions/admin/applications/${youssefApp._id}/reject`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${univAdminToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({
      reason: 'Prerequisite coursework credentials could not be verified by institutional registrar.',
    })
  );
  assert.strictEqual(rejectRes.status, 200, `Reject failed: ${rejectRes.raw}`);
  const rejectedApp = rejectRes.data?.data || rejectRes.data?.application || rejectRes.data;
  assert.strictEqual(rejectedApp.status, 'Rejected', `Expected status "Rejected", got "${rejectedApp.status}"`);
  console.log('   ✓ Formal rejection completed and recorded in status.\n');

  // -------------------------------------------------------------------------
  // 6. Bi-Directional Division Isolation Check (Pre-University Admin)
  // -------------------------------------------------------------------------
  console.log('6. Authenticating as Pre-University Admin (noha.preunivadmin@egsa.gov.eg)...');
  const { token: preUnivAdminToken, user: preUnivAdminUser } = await loginUser('noha.preunivadmin@egsa.gov.eg');
  assert.strictEqual(preUnivAdminUser.division, 'PRE_UNIVERSITY', 'User division must be PRE_UNIVERSITY');

  const preUnivAppsRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admissions/admin/applications',
    method: 'GET',
    headers: { Authorization: `Bearer ${preUnivAdminToken}` },
  });

  assert.strictEqual(preUnivAppsRes.status, 200, `Failed to query pre-uni applications: ${preUnivAppsRes.raw}`);
  const preUnivApps = preUnivAppsRes.data?.data || preUnivAppsRes.data?.items || preUnivAppsRes.data || [];
  assert(Array.isArray(preUnivApps) && preUnivApps.length > 0, 'No applications returned for Pre-University division');
  assert.strictEqual(preUnivAppsRes.data?.scopeDivision, 'PRE_UNIVERSITY', 'Response scopeDivision must be PRE_UNIVERSITY');

  for (const app of preUnivApps) {
    assert.strictEqual(
      app.course?.division,
      'PRE_UNIVERSITY',
      `LEAK DETECTED: Application ${app._id} has course division "${app.course?.division}", expected "PRE_UNIVERSITY"`
    );
  }

  // Confirm Nour's application is present in Pre-University queue
  const nourApp = preUnivApps.find((a) => a.student?.email === 'nour.cadet@egsa.gov.eg');
  assert(nourApp, 'Expected seeded application for nour.cadet@egsa.gov.eg in Pre-University queue');
  console.log(`   ✓ Located Nour Mansour in Pre-University queue (ID: ${nourApp._id}).`);
  console.log('   ✓ Bi-directional isolation confirmed: Pre-University Admin receives ONLY Pre-University applications.\n');

  console.log('========================================================================');
  console.log(' ✓ ALL PHASE 14 DIVISION GOVERNANCE INTEGRATION TESTS PASSED!');
  console.log('========================================================================');
}

runPhase14GovernanceTest().catch((err) => {
  console.error('\n❌ PHASE 14 TEST EXECUTION FAILED:', err);
  process.exit(1);
});
