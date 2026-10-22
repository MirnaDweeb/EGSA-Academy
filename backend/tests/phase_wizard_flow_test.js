const mongoose = require('mongoose');
const User = require('../models/User');
const Course = require('../models/Course');
const Application = require('../models/Application');
const Invoice = require('../models/Invoice');
const ReadinessQuestion = require('../models/ReadinessQuestion');

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('========================================================================');
  console.log('🚀 GUIDED MULTI-STEP APPLICATION WIZARD (PHASE VERIFICATION TEST)');
  console.log('========================================================================\n');

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_academy');
  console.log('[DB] Connected to MongoDB');

  try {
    // 1. Authenticate as Youssef Mohamed
    console.log('[TEST 1] Authenticating as Youssef Mohamed (University Student)...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'youssef.student@egsa.gov.eg',
        password: 'Password123!',
      }),
    });
    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.data.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    const token = loginData.data.token;
    console.log('✓ Successfully authenticated!');

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 2. Locate Target Course (CubeSat Telemetry & Ground Stations)
    const targetCourse = await Course.findOne({
      $or: [
        { code: 'CRS-TEL-01' },
        { title: /CubeSat Telemetry/i },
      ],
    });
    if (!targetCourse) throw new Error('Target course "CubeSat Telemetry" not found in database.');
    console.log(`✓ Located Target Course: "${targetCourse.title}" (ID: ${targetCourse._id})`);

    // 3. Step 1: Start Flow via POST /api/admissions/start-flow
    console.log('\n[TEST 2] Step 1: Calling POST /api/admissions/start-flow...');
    const startRes = await fetch(`${API_BASE}/admissions/start-flow`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ courseId: targetCourse._id }),
    });
    const startData = await startRes.json();
    if (!startData.success) {
      throw new Error(`start-flow returned failure: ${JSON.stringify(startData)}`);
    }

    const { course, eligibility, readiness } = startData.data;
    console.log('✓ Flow started successfully:');
    console.log(`  - Course Title: ${course.title}`);
    console.log(`  - Eligibility Status: ${eligibility.status}`);
    console.log(`  - Is Eligible: ${eligibility.isEligible}`);
    console.log(`  - Question Pool Count: ${readiness.questions?.length}`);

    if (!eligibility.isEligible) {
      throw new Error(`Expected isEligible=true for Youssef, got ${eligibility.isEligible}`);
    }
    if (!readiness.questions || readiness.questions.length === 0) {
      throw new Error('Readiness question pool was empty in start-flow response');
    }

    // 4. Step 2 & 3: Complete Assessment via POST /api/admissions/complete-assessment
    console.log('\n[TEST 3] Step 2 & 3: Submitting answers via POST /api/admissions/complete-assessment...');
    // Look up correct answers from database to guarantee a passing score for test
    const qIds = readiness.questions.map((q) => q.id || q.questionId);
    const dbQuestions = await ReadinessQuestion.find({ _id: { $in: qIds } });
    const qMap = new Map(dbQuestions.map((q) => [String(q._id), q.correctOptionIndex]));

    const testAnswers = readiness.questions.map((q) => {
      const qid = String(q.id || q.questionId);
      const correctIdx = qMap.get(qid) !== undefined ? qMap.get(qid) : 0;
      return {
        questionId: qid,
        selectedOptionIndex: correctIdx,
      };
    });

    const assessRes = await fetch(`${API_BASE}/admissions/complete-assessment`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        courseId: targetCourse._id,
        attemptId: readiness.attemptId,
        answers: testAnswers,
      }),
    });
    const assessData = await assessRes.json();
    if (!assessData.success) {
      throw new Error(`complete-assessment failed: ${JSON.stringify(assessData)}`);
    }

    const resultData = assessData.data;
    console.log('✓ Assessment submitted & scored successfully:');
    console.log(`  - Score: ${resultData.score}% (Threshold: ${resultData.threshold}%)`);
    console.log(`  - Passed: ${resultData.passed}`);
    console.log(`  - Outcome: ${resultData.outcome}`);
    console.log(`  - Topic Breakdown Count: ${resultData.topicBreakdown?.length}`);

    if (!resultData.passed || resultData.score < 70) {
      throw new Error(`Expected passing score >= 70%, got ${resultData.score}%`);
    }

    // 5. Step 4: Verify Invoice Generation & 72-Hour Hold
    console.log('\n[TEST 4] Step 4: Verifying Invoice generation and 72-hour seat reservation...');
    const invoice = resultData.invoice;
    if (!invoice || !invoice.id) {
      throw new Error('Invoice was not returned upon passing assessment');
    }

    console.log('✓ Commercial Invoice provisioned:');
    console.log(`  - Invoice Number: ${invoice.invoiceNumber}`);
    console.log(`  - Amount: ${invoice.amount} ${invoice.currency}`);
    console.log(`  - Status: ${invoice.status}`);
    console.log(`  - Expiration Date: ${invoice.expiresAt}`);
    console.log(`  - Remaining Seconds: ${invoice.remainingSeconds}s (~${Math.round(invoice.remainingSeconds / 3600)}h)`);

    if (invoice.remainingSeconds <= 0) {
      throw new Error('72-hour countdown has already expired or was invalid');
    }

    // 6. Settle Invoice via simulated payment
    console.log('\n[TEST 5] Settling Invoice via POST /api/payments/pay (InstaPay)...');
    const payRes = await fetch(`${API_BASE}/payments/pay`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        invoiceId: invoice.id,
        method: 'InstaPay',
        paymentDetails: {
          instapayHandle: 'youssef@instapay',
          transactionReference: `EGSA-TEST-TX-${Date.now()}`,
        },
      }),
    });
    const payData = await payRes.json();
    if (!payData.success) {
      throw new Error(`Payment failed: ${JSON.stringify(payData)}`);
    }

    console.log('✓ Tuition settled successfully:');
    console.log(`  - Message: ${payData.message || 'Payment confirmed'}`);
    console.log(`  - Invoice Status: Paid`);

    const dbInvoice = await Invoice.findById(invoice.id);
    if (dbInvoice.status !== 'Paid') {
      throw new Error(`Expected database invoice status 'Paid', got '${dbInvoice.status}'`);
    }
    console.log('✓ Database Invoice persistence and Paid status confirmed!');

    console.log('\n========================================================================');
    console.log('>>> ALL APPLICATION WIZARD E2E PIPELINE TESTS PASSED 100% <<<');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('TEST ERROR:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
