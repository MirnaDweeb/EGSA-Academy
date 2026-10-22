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

async function runPhase15FinanceTest() {
  console.log('========================================================================');
  console.log(' EgSA Academy — Phase 15 Commercial Engine, Waivers & 72h Sweep Test');
  console.log(' Target Spec: Sections 4, 7, 12, 17, and 18 (Finance, Waivers & Sweeps)');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Authenticate University Admin & Super Admin
  // -------------------------------------------------------------------------
  console.log('1. Authenticating administrators...');
  const { token: univAdminToken, user: univAdmin } = await loginUser('sara.univadmin@egsa.gov.eg');
  const { token: superAdminToken, user: superAdmin } = await loginUser('ayman.superadmin@egsa.gov.eg');
  console.log(`   ✓ University Admin: ${univAdmin.fullName} (Division: ${univAdmin.division})`);
  console.log(`   ✓ Super Admin: ${superAdmin.fullName} (Role: ${superAdmin.role})\n`);

  // -------------------------------------------------------------------------
  // 2. Financial Overview KPIs
  // -------------------------------------------------------------------------
  console.log('2. Querying Financial Overview KPIs (GET /api/finance/overview)...');
  const overviewRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/finance/overview',
    method: 'GET',
    headers: { Authorization: `Bearer ${univAdminToken}` },
  });

  assert.strictEqual(overviewRes.status, 200, `Failed to retrieve finance overview: ${overviewRes.raw}`);
  const kpis = overviewRes.data?.data || {};

  console.log('   Financial KPIs received:', {
    totalRevenue: `${kpis.totalRevenue} EGP`,
    pendingReceivables: `${kpis.pendingReceivables} EGP`,
    waivedAmount: `${kpis.waivedAmount} EGP`,
    refundedAmount: `${kpis.refundedAmount} EGP`,
    seatUtilizationRate: `${kpis.seatUtilizationRate}%`,
  });

  assert(typeof kpis.totalRevenue === 'number' && kpis.totalRevenue > 0, 'totalRevenue must be a positive number');
  assert(typeof kpis.pendingReceivables === 'number', 'pendingReceivables must be a number');
  assert(typeof kpis.seatUtilizationRate === 'number', 'seatUtilizationRate must be a number');
  assert.strictEqual(overviewRes.data?.scopeDivision, 'UNIVERSITY', 'Scope must be strictly UNIVERSITY for University Admin');
  console.log('   ✓ Financial Overview KPIs verified successfully.\n');

  // -------------------------------------------------------------------------
  // 3. Invoices Ledger Query
  // -------------------------------------------------------------------------
  console.log('3. Fetching Invoices Ledger (GET /api/finance/invoices)...');
  const ledgerRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/finance/invoices',
    method: 'GET',
    headers: { Authorization: `Bearer ${univAdminToken}` },
  });

  assert.strictEqual(ledgerRes.status, 200, `Failed to fetch invoices: ${ledgerRes.raw}`);
  const invoices = ledgerRes.data?.data || [];
  assert(Array.isArray(invoices) && invoices.length > 0, 'Invoices ledger is empty');
  console.log(`   ✓ Retrieved ${invoices.length} invoices in University scope.`);

  // Find the pending invoice seeded for tuition waiver testing
  const waiverTargetInv = invoices.find((inv) => inv.status === 'Pending' && Number(inv.amount) > 0);
  assert(waiverTargetInv, 'Expected to find an active pending invoice for waiver test');
  console.log(`   ✓ Located target pending invoice: #${waiverTargetInv.invoiceNumber} (${waiverTargetInv.amount} EGP)\n`);

  // -------------------------------------------------------------------------
  // 4. Sponsorship & Tuition Waiver Engine
  // -------------------------------------------------------------------------
  console.log('4. Testing Sponsorship & Tuition Waiver Engine (POST /api/finance/invoices/:id/waive)...');

  // 4A. Validate mandatory sponsorName
  console.log('   4A. Submitting waiver with missing sponsorName...');
  const missingSponsorRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/finance/invoices/${waiverTargetInv._id}/waive`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${univAdminToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({
      waiverType: 'Full',
      sponsorName: '',
      reason: 'Valid justification with more than ten characters',
    })
  );
  assert.strictEqual(missingSponsorRes.status, 400, `Expected 400 for missing sponsor, got ${missingSponsorRes.status}`);
  console.log('   ✓ Rejected missing sponsorName with HTTP 400 as expected.');

  // 4B. Validate mandatory reason (min 10 characters)
  console.log('   4B. Submitting waiver with short reason (< 10 chars)...');
  const shortReasonRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/finance/invoices/${waiverTargetInv._id}/waive`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${univAdminToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({
      waiverType: 'Full',
      sponsorName: 'EgSA National Talent Fund',
      reason: 'too short',
    })
  );
  assert.strictEqual(shortReasonRes.status, 400, `Expected 400 for short reason, got ${shortReasonRes.status}`);
  console.log('   ✓ Rejected short reason (< 10 chars) with HTTP 400 as expected.');

  // 4C. Valid 100% Full Waiver Application
  console.log('   4C. Applying 100% Full Sponsor Waiver...');
  const validWaiverRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/finance/invoices/${waiverTargetInv._id}/waive`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${univAdminToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({
      waiverType: 'Full',
      waiverPercent: 100,
      sponsorName: 'Egyptian Space Agency National Space Cadets Scholarship',
      reason: 'Full institutional grant awarded for distinguished academic standing in aerospace engineering.',
    })
  );

  assert.strictEqual(validWaiverRes.status, 200, `Waiver request failed: ${validWaiverRes.raw}`);
  const waivedData = validWaiverRes.data?.data || {};
  assert.strictEqual(waivedData.invoice?.status, 'Waived', `Expected invoice status "Waived", got "${waivedData.invoice?.status}"`);
  assert.strictEqual(waivedData.invoice?.balanceDue, 0, 'Invoice balanceDue must be 0 after 100% waiver');
  assert.strictEqual(waivedData.invoice?.sponsorWaiver?.applied, true, 'sponsorWaiver.applied must be true');
  assert(waivedData.enrollment, 'Enrollment must be returned and updated');
  assert.strictEqual(waivedData.enrollment.status, 'Confirmed', 'Enrollment status must transition to Confirmed');
  assert.strictEqual(waivedData.enrollment.seatStatus, 'Confirmed', 'Enrollment seatStatus must be Confirmed');
  assert.strictEqual(waivedData.enrollment.seatLocked, true, 'Enrollment seatLocked must be true for full waiver');
  console.log('   ✓ 100% Sponsor Waiver applied: Invoice marked as "Waived", Enrollment "Confirmed", and seatLocked = true.');

  // 4D. Verify AuditLog for Sponsor Waiver
  console.log('   4D. Verifying AuditLog entry for SPONSOR_WAIVER_APPLIED...');
  const auditRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admissions/admin/audit-logs',
    method: 'GET',
    headers: { Authorization: `Bearer ${univAdminToken}` },
  });
  assert.strictEqual(auditRes.status, 200, `Failed to retrieve audit logs: ${auditRes.raw}`);
  const auditLogs = auditRes.data?.data || auditRes.data?.items || auditRes.data || [];
  const waiverAudit = auditLogs.find(
    (log) =>
      log.action === 'SPONSOR_WAIVER_APPLIED' &&
      String(log.entityId || log.resourceId) === String(waiverTargetInv._id)
  );
  assert(waiverAudit, `SPONSOR_WAIVER_APPLIED AuditLog entry not found for Invoice ${waiverTargetInv._id}`);
  assert.strictEqual(waiverAudit.entity || waiverAudit.resource, 'Invoice');
  assert.strictEqual(waiverAudit.details?.waiverPercent, 100);
  console.log('   ✓ Immutable AuditLog entry verified for SPONSOR_WAIVER_APPLIED.\n');

  // -------------------------------------------------------------------------
  // 5. Automated 72-Hour Expiration & Waitlist Promotion Sweep
  // -------------------------------------------------------------------------
  console.log('5. Testing Automated 72h Sweep & Waitlist Promotion (POST /api/finance/sweep-expired)...');
  const sweepRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/finance/sweep-expired',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({})
  );

  assert.strictEqual(sweepRes.status, 200, `Sweep request failed: ${sweepRes.raw}`);
  const sweepData = sweepRes.data?.data || {};
  console.log('   Sweep outcome:', {
    expiredCount: sweepData.expiredCount,
    promotedCount: sweepData.promotedCount,
    affectedCohorts: sweepData.affectedCohortIds?.length || 0,
  });

  assert(sweepData.expiredCount >= 1, `Expected at least 1 expired invoice, got ${sweepData.expiredCount}`);
  assert(sweepData.promotedCount >= 1, `Expected at least 1 promoted waitlist candidate, got ${sweepData.promotedCount}`);
  console.log('   ✓ Automated 72-hour sweep successfully released expired provisional seats and promoted waitlisted candidate.\n');

  // -------------------------------------------------------------------------
  // 6. Refund Processing
  // -------------------------------------------------------------------------
  console.log('6. Testing Refund Processing (POST /api/finance/invoices/:id/refund)...');

  // Find Youssef's paid invoice (INV-2026-0088)
  const allInvoicesRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/finance/invoices',
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const allInvoices = allInvoicesRes.data?.data || [];
  const paidInvoice = allInvoices.find((i) => ['Paid', 'PAID'].includes(i.status) && Number(i.amount) > 0);
  assert(paidInvoice, 'Expected to locate a paid invoice for refund testing');
  console.log(`   Located paid invoice: #${paidInvoice.invoiceNumber} (${paidInvoice.amount} EGP)`);

  const refundRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/finance/invoices/${paidInvoice._id}/refund`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({
      refundReason: 'Candidate requested official medical withdrawal prior to cohort kickoff.',
    })
  );

  assert.strictEqual(refundRes.status, 200, `Refund request failed: ${refundRes.raw}`);
  const refundData = refundRes.data?.data || {};
  assert.strictEqual(refundData.invoice?.status, 'Refunded', 'Invoice status must transition to Refunded');
  assert.strictEqual(refundData.invoice?.refundStatus, 'Refunded', 'Invoice refundStatus must be Refunded');
  if (refundData.enrollment) {
    assert.strictEqual(refundData.enrollment.status, 'Withdrawn', 'Enrollment status must transition to Withdrawn');
    assert.strictEqual(refundData.enrollment.seatStatus, 'Released', 'Enrollment seatStatus must be Released');
  }
  console.log('   ✓ Refund executed: Invoice marked as "Refunded", Enrollment transitioned to "Withdrawn", seat released.');

  // Verify AuditLog for Refund
  const auditRes2 = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/admissions/admin/audit-logs',
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const allAuditLogs = auditRes2.data?.data || auditRes2.data?.items || auditRes2.data || [];
  const refundAudit = allAuditLogs.find(
    (log) =>
      log.action === 'REFUND_PROCESSED' &&
      String(log.entityId || log.resourceId) === String(paidInvoice._id)
  );
  assert(refundAudit, `REFUND_PROCESSED AuditLog entry not found for Invoice ${paidInvoice._id}`);
  console.log('   ✓ Immutable AuditLog entry verified for REFUND_PROCESSED.\n');

  console.log('========================================================================');
  console.log(' ✓ ALL PHASE 15 COMMERCIAL & FINANCE INTEGRATION TESTS PASSED!');
  console.log('========================================================================');
}

runPhase15FinanceTest().catch((err) => {
  console.error('\n❌ PHASE 15 TEST EXECUTION FAILED:', err);
  process.exit(1);
});
