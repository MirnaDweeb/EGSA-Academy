const http = require('http');
const assert = require('assert');

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

async function runPhase10EvaluationTest() {
  console.log('========================================================================');
  console.log(' EgSA Academy — Phase 10 Mandatory Quality Assurance Evaluation Test');
  console.log('========================================================================\n');

  // Step 1: Login as Student Youssef Mohamed
  console.log('1. Authenticating as Student (youssef.student@egsa.gov.eg)...');
  const studentLoginRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: 'youssef.student@egsa.gov.eg', password: 'Password123!' })
  );

  assert.strictEqual(studentLoginRes.status, 200, `Login failed: ${studentLoginRes.raw}`);
  const studentToken = studentLoginRes.data?.data?.token || studentLoginRes.data?.token;
  assert(studentToken, 'Missing student JWT token');
  console.log('✓ Student logged in successfully.\n');

  // Step 2: Get Student Enrollments to locate target cohort
  console.log('2. Fetching student enrollments to identify target cohort...');
  const enrRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/enrollments/my',
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  assert.strictEqual(enrRes.status, 200, `Enrollments fetch failed: ${enrRes.raw}`);
  const enrollments = enrRes.data?.data || enrRes.data || [];
  assert(enrollments.length > 0, 'No active enrollment found for youssef.student@egsa.gov.eg');

  const targetEnrollment = enrollments[0];
  const targetCohortId = targetEnrollment.cohort?._id || targetEnrollment.cohort;
  const targetCourseId = targetEnrollment.course?._id || targetCourseId || targetEnrollment.course;
  assert(targetCohortId, 'Enrollment cohort ID missing');
  console.log(`✓ Located target enrollment (Cohort ID: ${targetCohortId}, Course ID: ${targetCourseId})\n`);

  // Reset evaluation state for Youssef to test fresh evaluation submission
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_academy');
  }
  const Evaluation = require('../models/Evaluation');
  const Enrollment = require('../models/Enrollment');
  const User = require('../models/User');
  const userDoc = await User.findOne({ email: 'youssef.student@egsa.gov.eg' });
  if (userDoc) {
    await Evaluation.deleteMany({ student: userDoc._id });
    await Enrollment.updateMany({ student: userDoc._id }, { $set: { evaluationCompleted: false } });
  }

  // Step 3: Check Initial Evaluation Status -> Must be false
  console.log(`3. Checking initial evaluation status via GET /api/evaluations/check/${targetCohortId}...`);
  const initialCheckRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/evaluations/check/${targetCohortId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  assert.strictEqual(initialCheckRes.status, 200, `Check status failed: ${initialCheckRes.raw}`);
  const initialCompleted =
    initialCheckRes.data?.evaluationCompleted ?? initialCheckRes.data?.data?.evaluationCompleted;
  assert.strictEqual(
    initialCompleted,
    false,
    `Expected evaluationCompleted to be false before submission, got: ${initialCompleted}`
  );
  console.log('✓ Initial evaluation status confirmed: evaluationCompleted === false\n');

  // Step 4: Submit Quality Evaluation
  console.log('4. Submitting course & instructor evaluation with 4 rating criteria...');
  const evalPayload = {
    cohortId: targetCohortId,
    courseId: targetCourseId,
    ratings: {
      content: 5,
      instructor: 5,
      facilities: 4,
      organization: 5,
    },
    comments:
      'Outstanding CubeSat telemetry ground station simulation lab. Ground telemetry decoding exercises provided rigorous practical experience.',
    isAnonymous: true,
  };

  const submitRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/evaluations',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify(evalPayload)
  );

  assert.strictEqual(submitRes.status, 201, `Submit evaluation failed: ${submitRes.raw}`);
  const evalData = submitRes.data?.data;
  assert(evalData, 'Missing evaluation payload in response');
  assert.strictEqual(evalData.overallRating, 4.75, `Expected overallRating 4.75, got: ${evalData.overallRating}`);
  assert.strictEqual(evalData.isAnonymous, true, 'isAnonymous should be true');
  console.log(`✓ Evaluation submitted successfully with overallRating: ${evalData.overallRating}\n`);

  // Step 5: Verify Enrollment.evaluationCompleted is now true
  console.log('5. Verifying evaluation status is now completed...');
  const postCheckRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/evaluations/check/${targetCohortId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  assert.strictEqual(postCheckRes.status, 200);
  const postCompleted =
    postCheckRes.data?.evaluationCompleted ?? postCheckRes.data?.data?.evaluationCompleted;
  assert.strictEqual(postCompleted, true, 'Expected evaluationCompleted to be true after submission');
  console.log('✓ Enrollment synchronization confirmed: evaluationCompleted === true\n');

  // Step 6: Verify Duplicate Submission is Blocked (400 or 409)
  console.log('6. Attempting duplicate evaluation submission (Must be blocked)...');
  const duplicateRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/evaluations',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify(evalPayload)
  );

  assert(
    duplicateRes.status === 400 || duplicateRes.status === 409,
    `Expected duplicate rejection status 400 or 409, got: ${duplicateRes.status}`
  );
  console.log(`✓ Duplicate submission cleanly blocked with HTTP status: ${duplicateRes.status}\n`);

  // Step 7: Instructor Summary & Student Anonymity Verification
  console.log('7. Authenticating as Instructor (tarek.instructor@egsa.gov.eg)...');
  const instructorLoginRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: 'tarek.instructor@egsa.gov.eg', password: 'Password123!' })
  );

  assert.strictEqual(instructorLoginRes.status, 200, `Instructor login failed: ${instructorLoginRes.raw}`);
  const instructorToken = instructorLoginRes.data?.data?.token || instructorLoginRes.data?.token;

  console.log('8. Fetching instructor summary via GET /api/evaluations/instructor/summary...');
  const instructorSummaryRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/evaluations/instructor/summary',
    method: 'GET',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });

  assert.strictEqual(instructorSummaryRes.status, 200, `Instructor summary failed: ${instructorSummaryRes.raw}`);
  const summaryData = instructorSummaryRes.data?.data;
  assert(summaryData, 'Missing instructor summary data');
  assert(summaryData.totalEvaluations >= 1, `Expected at least 1 evaluation, got: ${summaryData.totalEvaluations}`);

  console.log(`✓ Aggregated Ratings:`);
  console.log(`   - Content Rating:      ${summaryData.averages?.contentRating}`);
  console.log(`   - Instructor Delivery: ${summaryData.averages?.instructorRating}`);
  console.log(`   - Facilities & Labs:   ${summaryData.averages?.facilitiesRating}`);
  console.log(`   - Platform & Org:      ${summaryData.averages?.organizationRating}`);
  console.log(`   - Overall Quality:     ${summaryData.averages?.overallRating}`);

  // Verify student identity disclosure is completely prevented
  const comments = summaryData.comments || [];
  assert(comments.length >= 1, 'Expected at least 1 qualitative feedback item');
  const targetComment = comments.find((c) =>
    (c.comment || c.comments || '').includes('Outstanding CubeSat telemetry ground station simulation')
  );
  assert(targetComment, 'Target qualitative comment not found in instructor summary');

  console.log(`\n9. Verifying student anonymity on qualitative feedback...`);
  console.log(`   - Comment: "${targetComment.comment.slice(0, 50)}..."`);
  console.log(`   - Reported Student Name: "${targetComment.studentName}"`);
  console.log(`   - Is Anonymous: ${targetComment.isAnonymous}`);

  assert.strictEqual(
    targetComment.studentName,
    'Anonymous Student',
    `Student name disclosed! Expected "Anonymous Student", got: "${targetComment.studentName}"`
  );
  assert(!targetComment.email, `Student email was exposed in instructor summary: ${targetComment.email}`);
  assert(!targetComment.studentEmail, `Student email was exposed: ${targetComment.studentEmail}`);

  console.log('\n✓ Student anonymity strictly preserved — identity protected from instructor view.');
  console.log('\n========================================================================');
  console.log(' Phase 10 Quality Assurance Evaluation Engine: ALL ASSERTIONS PASSED! ✓');
  console.log('========================================================================\n');
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

runPhase10EvaluationTest().catch((err) => {
  console.error('\n❌ Test assertion failed:', err);
  process.exit(1);
});
