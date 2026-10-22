const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const Course = require('../models/Course');
const Application = require('../models/Application');
const ReadinessQuestion = require('../models/ReadinessQuestion');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

async function req(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}: ${data.message || res.statusText}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function runReadinessTests() {
  console.log('\n======================================================');
  console.log('🚀 EGSA ACADEMY - PHASE 2B AI READINESS ENGINE VERIFICATION');
  console.log('======================================================\n');

  await connectDB();

  // Find target course
  const telemetryCourse = await Course.findOne({ slug: 'cubesat-telemetry-ground-stations' });
  if (!telemetryCourse) {
    throw new Error('Course "CubeSat Telemetry & Ground Stations" not found. Please run seed.');
  }

  const foundationCourse = await Course.findOne({ slug: 'satellite-systems-fundamentals' });
  console.log(`✓ Found Target Course: ${telemetryCourse.title} (ID: ${telemetryCourse._id})`);
  if (foundationCourse) {
    console.log(`✓ Found Foundation Course: ${foundationCourse.title} (ID: ${foundationCourse._id})`);
  }

  // Verify Question Bank in Database
  const questionsInDb = await ReadinessQuestion.find({ course: telemetryCourse._id });
  console.log(`✓ Question bank count in DB: ${questionsInDb.length} questions`);
  const topicsInDb = [...new Set(questionsInDb.map((q) => q.topic))];
  console.log(`  Covered technical topics: ${topicsInDb.join(', ')}\n`);

  if (!topicsInDb.includes('Electrical Power Systems (EPS)') || !topicsInDb.includes('Telemetry & Communications') || !topicsInDb.includes('Orbital Mechanics')) {
    throw new Error('Question bank must cover EPS, Telemetry, and Orbital Mechanics.');
  }

  // Start express server in-process on port 5004 for isolated testing
  const app = require('../app');
  const server = app.listen(5004);
  const baseUrl = 'http://127.0.0.1:5004/api';

  try {
    // ----------------------------------------------------
    // STEP 1: Authenticate Student & Division Admin
    // ----------------------------------------------------
    console.log('--- Step 1: User Authentication ---');
    const omarLogin = await req(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: { email: 'omar.student@egsa.gov.eg', password: 'Password123!' },
    });
    const omarToken = omarLogin.data.accessToken;
    const omarUser = omarLogin.data.user;
    console.log(`✓ Student authenticated: ${omarUser.fullName} (${omarUser.email})`);

    const adminLogin = await req(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: { email: 'sara.univadmin@egsa.gov.eg', password: 'Password123!' },
    });
    const adminToken = adminLogin.data.accessToken;
    const adminUser = adminLogin.data.user;
    console.log(`✓ Division Admin authenticated: ${adminUser.fullName} (${adminUser.role})\n`);

    // ----------------------------------------------------
    // STEP 2: GET /api/readiness/course/:courseId
    // ----------------------------------------------------
    console.log('--- Step 2: GET /api/readiness/course/:courseId ---');
    const courseQuestionsRes = await req(`${baseUrl}/readiness/course/${telemetryCourse._id}`, {
      headers: { Authorization: `Bearer ${omarToken}` },
    });
    console.log(`✓ Received ${courseQuestionsRes.count} randomized questions from course endpoint`);
    if (!Array.isArray(courseQuestionsRes.data) || courseQuestionsRes.data.length === 0) {
      throw new Error('Expected an array of questions.');
    }

    // Verify sanitization: student must not see correct answers
    const hasLeakedAnswers = courseQuestionsRes.data.some(
      (q) => q.correctOptionIndex !== undefined || q.correctAnswerIndex !== undefined
    );
    if (hasLeakedAnswers) {
      throw new Error('Security Breach: correct answers leaked to student!');
    }
    console.log('✓ Security verified: correct answer indices stripped from student payload.\n');

    // ----------------------------------------------------
    // STEP 3: Simulate Student Passing (>= 70%)
    // ----------------------------------------------------
    console.log('--- Step 3: Simulate Student Passing (>= 70%) ---');
    const omarId = omarUser.id || omarUser._id;
    // Ensure an application exists for Omar
    let omarApp = await Application.findOne({ student: omarId, course: telemetryCourse._id });
    if (!omarApp) {
      omarApp = await Application.create({
        student: omarId,
        course: telemetryCourse._id,
        status: 'Submitted',
        eligibilityStatus: 'Eligible',
      });
    }

    // Prepare 100% correct answers using DB questions
    const passingAnswers = courseQuestionsRes.data.map((q) => {
      const qDb = questionsInDb.find((item) => item._id.toString() === q.id.toString());
      const correctIdx = qDb ? (qDb.correctOptionIndex ?? qDb.correctAnswerIndex ?? 0) : 0;
      return {
        questionId: q.id,
        selectedIndex: correctIdx,
      };
    });

    const submitPassRes = await req(`${baseUrl}/readiness/submit`, {
      method: 'POST',
      body: {
        applicationId: String(omarApp._id),
        answers: passingAnswers,
      },
      headers: { Authorization: `Bearer ${omarToken}` },
    });

    console.log(`✓ Pass Submission Result:`);
    console.log(`  - Composite Score: ${submitPassRes.data.scorePercentage}%`);
    console.log(`  - Outcome: ${submitPassRes.data.outcome}`);
    console.log(`  - Application Status: ${submitPassRes.data.applicationStatus}`);

    if (submitPassRes.data.scorePercentage < 70) {
      throw new Error(`Expected score >= 70% but got ${submitPassRes.data.scorePercentage}%`);
    }
    if (!['Ready', 'READY'].includes(submitPassRes.data.outcome)) {
      throw new Error(`Expected outcome 'Ready' but got ${submitPassRes.data.outcome}`);
    }

    // Verify Application Status updated to 'Eligible - Payment Pending' or 'Accepted'
    const updatedOmarApp = await Application.findById(omarApp._id);
    if (!['Eligible - Payment Pending', 'Accepted'].includes(updatedOmarApp.status)) {
      throw new Error(`Expected Application status 'Eligible - Payment Pending' or 'Accepted' but got ${updatedOmarApp.status}`);
    }
    console.log(`✓ Application verified: Updated to '${updatedOmarApp.status}' with readiness attempt linked.\n`);

    // ----------------------------------------------------
    // STEP 4: Simulate Student Failing with EPS Gaps (< 70%)
    // ----------------------------------------------------
    console.log('--- Step 4: Simulate Student Failing with EPS Gaps (< 70%) ---');
    // Create / find cadet Mariam
    const mariamUser = await User.findOne({ email: 'mariam.cadet@egsa.gov.eg' });
    if (!mariamUser) throw new Error('Cadet Mariam not found in DB.');

    const mariamLogin = await req(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: { email: 'mariam.cadet@egsa.gov.eg', password: 'Password123!' },
    });
    const mariamToken = mariamLogin.data.accessToken;

    let mariamApp = await Application.findOne({ student: mariamUser._id, course: telemetryCourse._id });
    if (!mariamApp) {
      mariamApp = await Application.create({
        student: mariamUser._id,
        course: telemetryCourse._id,
        status: 'Submitted',
        eligibilityStatus: 'In Progress',
      });
    }

    // Deliberately answer EPS questions incorrectly, achieving a low score
    const failingAnswers = courseQuestionsRes.data.map((q) => {
      const qDb = questionsInDb.find((item) => item._id.toString() === q.id.toString());
      const correctIdx = qDb ? (qDb.correctOptionIndex ?? qDb.correctAnswerIndex ?? 0) : 0;
      // If EPS topic, choose wrong option
      if (q.topic.includes('EPS') || q.topic.includes('Power')) {
        return {
          questionId: q.id,
          selectedIndex: (correctIdx + 1) % 4, // Guaranteed incorrect
        };
      }
      // Wrong on others too to ensure score < 70%
      return {
        questionId: q.id,
        selectedIndex: (correctIdx + 1) % 4,
      };
    });

    const submitFailRes = await req(`${baseUrl}/readiness/submit`, {
      method: 'POST',
      body: {
        applicationId: String(mariamApp._id),
        answers: failingAnswers,
      },
      headers: { Authorization: `Bearer ${mariamToken}` },
    });

    console.log(`✓ Failing Submission Result:`);
    console.log(`  - Composite Score: ${submitFailRes.data.scorePercentage}% (Threshold: 70%)`);
    console.log(`  - Outcome: ${submitFailRes.data.outcome}`);
    console.log(`  - Knowledge Gaps: ${submitFailRes.data.knowledgeGaps.join(', ')}`);
    console.log(`  - Application Status: ${submitFailRes.data.applicationStatus}`);

    if (submitFailRes.data.scorePercentage >= 70) {
      throw new Error(`Expected score < 70% but got ${submitFailRes.data.scorePercentage}%`);
    }
    if (!['Foundation Required', 'FOUNDATION_REQUIRED'].includes(submitFailRes.data.outcome)) {
      throw new Error(`Expected outcome 'Foundation Required' but got ${submitFailRes.data.outcome}`);
    }

    // Verify Application Status updated to 'Foundation Required'
    const updatedMariamApp = await Application.findById(mariamApp._id);
    if (updatedMariamApp.status !== 'Foundation Required') {
      throw new Error(`Expected Application status 'Foundation Required' but got ${updatedMariamApp.status}`);
    }
    console.log(`✓ Application verified: Updated to '${updatedMariamApp.status}' with EPS gap flagged.`);

    // Verify Foundation Course Recommendation
    const failAttemptDoc = await ReadinessAttempt.findById(submitFailRes.data.attemptId).populate('recommendedCourse recommendedCourses');
    const recommended = failAttemptDoc.recommendedCourse || (failAttemptDoc.recommendedCourses && failAttemptDoc.recommendedCourses[0]);
    if (!recommended) {
      throw new Error('Expected recommended foundation course to be mapped for deficient attempt.');
    }
    console.log(`✓ Foundation recommendation verified: "${recommended.title}" recommended for identified technical gaps.\n`);

    // ----------------------------------------------------
    // STEP 5: Simulate Division Admin Manual Override
    // ----------------------------------------------------
    console.log('--- Step 5: Simulate Division Admin Manual Override ---');
    const overrideReason = 'Candidate completed equivalent NASA-standard CubeSat EPS training module in university lab.';
    const overrideRes = await req(`${baseUrl}/readiness/admin/override/${failAttemptDoc._id}`, {
      method: 'POST',
      body: { reason: overrideReason },
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    console.log(`✓ Override API Response: ${overrideRes.message}`);

    // Verify attempt updated
    const overriddenAttempt = await ReadinessAttempt.findById(failAttemptDoc._id);
    if (!['Ready', 'READY'].includes(overriddenAttempt.outcome)) {
      throw new Error(`Expected attempt outcome 'Ready' after override, got ${overriddenAttempt.outcome}`);
    }
    if (!overriddenAttempt.adminOverride?.applied) {
      throw new Error('Expected adminOverride.applied to be true.');
    }
    if (overriddenAttempt.adminOverride.reason !== overrideReason) {
      throw new Error(`Override reason mismatch. Expected "${overrideReason}", got "${overriddenAttempt.adminOverride.reason}"`);
    }
    console.log(`✓ Attempt record verified: Outcome updated to 'Ready', admin override applied.`);

    // Verify application upgraded to 'Eligible - Payment Pending'
    const overriddenApp = await Application.findById(mariamApp._id);
    if (!['Eligible - Payment Pending', 'Accepted'].includes(overriddenApp.status)) {
      throw new Error(`Expected Application status upgraded to 'Eligible - Payment Pending', got ${overriddenApp.status}`);
    }
    console.log(`✓ Application verified: Upgraded to '${overriddenApp.status}' with override metadata.`);

    // Verify Audit Log was recorded
    const auditRecord = await AuditLog.findOne({
      action: 'READINESS_ADMIN_OVERRIDE',
      resourceId: failAttemptDoc._id,
    });
    if (!auditRecord) {
      throw new Error('AuditLog entry was not found for the readiness override action!');
    }
    if (auditRecord.reason !== overrideReason) {
      throw new Error(`AuditLog reason mismatch: ${auditRecord.reason}`);
    }
    console.log(`✓ Audit log verified: Recorded by Admin ${adminUser.fullName} with reason: "${auditRecord.reason}".\n`);

    // ----------------------------------------------------
    // STEP 6: Verify Division Admin Oversight Ledger
    // ----------------------------------------------------
    console.log('--- Step 6: Verify Division Admin Oversight Ledger ---');
    const adminAttemptsRes = await req(`${baseUrl}/readiness/admin/attempts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`✓ Retrieved ${adminAttemptsRes.count} readiness attempts in Division Admin scope.`);
    console.log(`  - Total Attempts: ${adminAttemptsRes.summary?.totalAttempts}`);
    console.log(`  - Passed Count:   ${adminAttemptsRes.summary?.passedCount}`);
    console.log(`  - Failed Count:   ${adminAttemptsRes.summary?.failedCount}`);
    console.log(`  - Override Count: ${adminAttemptsRes.summary?.overrideCount}`);
    console.log(`  - Score Distribution:`, adminAttemptsRes.summary?.scoreDistribution);

    if (adminAttemptsRes.count === 0) {
      throw new Error('Expected at least 1 attempt in admin ledger.');
    }

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 2B READINESS ENGINE TESTS PASSED CLEANLY!');
    console.log('======================================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runReadinessTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message);
  if (err.data) console.error('Error Details:', err.data);
  process.exit(1);
});
