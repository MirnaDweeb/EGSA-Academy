const API_BASE = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function runTests() {
  console.log('====================================================');
  console.log('EGSA COMMERCIAL ENGINE & 72-HOUR RULE VERIFICATION');
  console.log('====================================================\n');

  try {
    // 1. Login as Mariam Khaled (Student)
    console.log('[TEST 1] Student Authentication (Mariam Khaled)...');
    const mariamLoginRes = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'mariam.cadet@egsa.gov.eg',
        password: 'Password123!',
      }),
    });
    const mariamToken = mariamLoginRes.token || mariamLoginRes.data?.token;
    console.log('  -> Logged in successfully. Token acquired.');

    // 2. Fetch My Invoices
    console.log('\n[TEST 2] GET /api/payments/my-invoices...');
    const myInvoicesRes = await req(`${API_BASE}/payments/my-invoices`, {
      headers: { Authorization: `Bearer ${mariamToken}` },
    });
    const invoices = myInvoicesRes.data || [];
    console.log(`  -> Retrieved ${invoices.length} invoices for Mariam.`);
    const activeCountdownInvoice = invoices.find(inv => inv.countdown && !inv.countdown.isOverdue && !['Paid', 'Waived'].includes(inv.status));
    console.log(`  -> Active countdown: ${activeCountdownInvoice ? activeCountdownInvoice.countdown.formatted : 'None'}`);
    console.log(`  -> Urgent status (<24h): ${activeCountdownInvoice?.countdown?.isUrgent}`);
    if (invoices.length === 0) throw new Error('Expected at least 1 invoice for Mariam.');

    const pendingInvoice = invoices.find(inv => inv.status === 'Pending');
    console.log(`  -> Pending Invoice ID: ${pendingInvoice?._id}, Number: ${pendingInvoice?.invoiceNumber}, Amount: ${pendingInvoice?.amount} EGP`);

    // 3. Simulate Payment via Vodafone Cash
    if (pendingInvoice) {
      console.log('\n[TEST 3] POST /api/payments/pay (Vodafone Cash Simulation)...');
      const payRes = await req(`${API_BASE}/payments/pay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${mariamToken}` },
        body: JSON.stringify({
          invoiceId: pendingInvoice._id,
          method: 'Vodafone Cash',
          paymentDetails: {
            walletNumber: '01019998877',
          },
          notes: 'Automated test simulation for CanSat junior rocketry seat confirmation.',
        }),
      });
      console.log('  -> Payment Success:', payRes.data.transaction?.transactionId);
      console.log('  -> Updated Invoice Status:', payRes.data.invoice?.status);
      console.log('  -> Updated Seat Status:', payRes.data.enrollment?.seatStatus);
      if (payRes.data.invoice?.status !== 'Paid') throw new Error('Invoice status should be Paid.');
      if (payRes.data.enrollment?.seatStatus !== 'Confirmed') throw new Error('Enrollment seatStatus should be Confirmed.');
    }

    // 4. Test Check Deadlines & Waitlist Promotion
    console.log('\n[TEST 4] POST /api/payments/check-deadlines (Automated 72-Hour Release & Waitlist FIFO Promotion)...');
    const deadlineRes = await req(`${API_BASE}/payments/check-deadlines`, {
      method: 'POST',
    });
    console.log('  -> Released Count:', deadlineRes.releasedCount);
    console.log('  -> Promoted Count:', deadlineRes.promotedCount);
    console.log('  -> Released Invoices:', JSON.stringify(deadlineRes.releases, null, 2));
    console.log('  -> Promoted Candidates:', JSON.stringify(deadlineRes.promotions, null, 2));

    // 5. Admin Authentication (Sara Mostafa)
    console.log('\n[TEST 5] Admin Authentication (Sara Mostafa)...');
    const adminLoginRes = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'sara.univadmin@egsa.gov.eg',
        password: 'Password123!',
      }),
    });
    const adminToken = adminLoginRes.token || adminLoginRes.data?.token;
    console.log('  -> Logged in as Division Admin.');

    // 6. Admin Overview KPIs & Invoices
    console.log('\n[TEST 6] GET /api/payments/admin/overview...');
    const adminOverviewRes = await req(`${API_BASE}/payments/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stats = adminOverviewRes.metrics || {};
    console.log('  -> Collected Revenue (EGP):', stats.collectedRevenue);
    console.log('  -> Outstanding Balance (EGP):', stats.outstandingBalance);
    console.log('  -> Confirmed Seats:', stats.confirmedSeats);
    console.log('  -> Released Seats:', stats.releasedSeats);
    console.log(`  -> Total Invoices in Admin Ledger: ${adminOverviewRes.invoices?.length}`);

    // 7. Admin Late Override Test
    console.log('\n[TEST 7] POST /api/admin/payments/override-late...');
    const releasedInvoice = (adminOverviewRes.invoices || []).find(inv => inv.status === 'Overdue');
    if (releasedInvoice) {
      const overrideRes = await req(`${API_BASE}/admin/payments/override-late`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          invoiceId: releasedInvoice._id,
          reason: 'Academic Dean Exceptional Approval: National Science Olympiad Finalist.',
        }),
      });
      console.log('  -> Late Override Succeeded:', overrideRes.message);
      console.log('  -> New Seat Status:', overrideRes.data?.enrollment?.seatStatus);
      console.log('  -> New Invoice Status:', overrideRes.data?.invoice?.status);
    } else {
      console.log('  -> Note: No overdue invoice currently found to override.');
    }

    console.log('\n====================================================');
    console.log('>>> ALL COMMERCIAL ENGINE BACKEND TESTS PASSED! <<<');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n[TEST ERROR]:', err.data || err.message);
    process.exit(1);
  }
}

runTests();
