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

async function runPhase13GradebookTest() {
  console.log('========================================================================');
  console.log(' EgSA Academy — Phase 13 Instructor Gradebook & At-Risk Matrix Test');
  console.log(' Target Spec: Sections 4, 10.1, 10.2, 17, and 18 (Assessment & Governance)');
  console.log('========================================================================\n');

  // Step 1: Authenticate Instructor (Eng. Tarek ElKady)
  console.log('1. Authenticating as Instructor (tarek.instructor@egsa.gov.eg)...');
  const instructorLoginRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: 'tarek.instructor@egsa.gov.eg', password: 'Password123!' })
  );

  assert.strictEqual(instructorLoginRes.status, 200, `Instructor login failed: ${instructorLoginRes.raw}`);
  const instructorToken =
    instructorLoginRes.data?.data?.accessToken ||
    instructorLoginRes.data?.accessToken ||
    instructorLoginRes.data?.data?.token ||
    instructorLoginRes.data?.token;
  assert(instructorToken, 'Missing instructor JWT token');
  console.log('   ✓ Instructor authenticated successfully.\n');

  // Step 2: Fetch Instructor's Cohorts
  console.log('2. Fetching Instructor Cohorts...');
  const cohortsRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/instructor/cohorts',
    method: 'GET',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });

  assert.strictEqual(cohortsRes.status, 200, `Failed to fetch cohorts: ${cohortsRes.raw}`);
  const cohorts = cohortsRes.data?.items || cohortsRes.data?.data || cohortsRes.data || [];
  assert(Array.isArray(cohorts) && cohorts.length > 0, 'Instructor has no assigned cohorts');
  const targetCohort =
    cohorts.find((c) => (c.name || '').includes('CubeSat Cohort Alpha')) ||
    cohorts.find((c) => (c.name || '').toLowerCase().includes('cubesat')) ||
    cohorts[0];
  const cohortId = targetCohort._id || targetCohort.id;
  console.log(`   ✓ Target Cohort located: "${targetCohort.name || targetCohort.code}" (ID: ${cohortId})\n`);

  // Step 3: Query Cohort Gradebook
  console.log(`3. Querying Gradebook for Cohort ${cohortId}...`);
  const gradebookRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: `/api/instructor/cohorts/${cohortId}/gradebook`,
    method: 'GET',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });

  assert.strictEqual(gradebookRes.status, 200, `Gradebook fetch failed: ${gradebookRes.raw}`);
  const gbData = gradebookRes.data?.data || gradebookRes.data;
  assert(gbData, 'Missing gradebook data object');

  // Validate Summary KPI metrics
  const summary = gbData.summary;
  assert(summary, 'Missing summary KPI object in gradebook');
  console.log('   Summary KPIs:', {
    totalStudents: summary.totalStudents,
    classAverageScore: summary.classAverageScore,
    attendanceGateHealth: summary.attendanceGateHealth,
    atRiskCount: summary.atRiskCount,
  });
  assert(typeof summary.totalStudents === 'number' && summary.totalStudents >= 2, 'Expected at least 2 students');
  assert(typeof summary.classAverageScore === 'number', 'Expected valid class average score');
  assert(typeof summary.attendanceGateHealth === 'number', 'Expected valid attendance gate count');
  assert(typeof summary.atRiskCount === 'number' && summary.atRiskCount >= 1, 'Expected at least 1 at-risk student');

  // Validate Students list
  const students = gbData.students;
  assert(Array.isArray(students) && students.length >= 2, 'Expected students array with >= 2 students');

  // Verify Youssef Mohamed (High Achiever: 100% attendance, >90% scores)
  const youssef = students.find((s) => s.email === 'youssef.student@egsa.gov.eg');
  assert(youssef, 'Student youssef.student@egsa.gov.eg not found in gradebook');
  console.log('\n   [Cadet 1: Youssef Mohamed]');
  console.log(`     Full Name: ${youssef.fullName}`);
  console.log(`     Attendance: ${youssef.attendanceHealth?.attendancePercentage}% (Attended ${youssef.attendanceHealth?.sessionsAttended}/${youssef.attendanceHealth?.totalSessions})`);
  console.log(`     Attendance At-Risk Flag: ${youssef.attendanceHealth?.attendanceAtRisk}`);
  console.log(`     Cumulative Score: ${youssef.cumulativeScore}%`);
  console.log(`     Standing: ${youssef.academicStanding}`);
  console.log(`     Evaluation Completed: ${youssef.evaluationCompleted}`);

  assert.strictEqual(youssef.attendanceHealth?.attendanceAtRisk, false, 'Youssef should NOT be at risk for attendance');
  assert(youssef.attendanceHealth?.attendancePercentage >= 85, 'Youssef attendance must be >= 85%');
  assert(youssef.cumulativeScore >= 90, 'Youssef cumulative score must be >= 90%');
  assert.strictEqual(youssef.academicStanding, 'Distinction', 'Youssef standing should be Distinction');

  // Verify Omar Hassan (At Risk: < 85% attendance)
  const omar = students.find((s) => s.email === 'omar.student@egsa.gov.eg');
  assert(omar, 'Student omar.student@egsa.gov.eg not found in gradebook');
  console.log('\n   [Cadet 2: Omar Hassan]');
  console.log(`     Full Name: ${omar.fullName}`);
  console.log(`     Attendance: ${omar.attendanceHealth?.attendancePercentage}% (Attended ${omar.attendanceHealth?.sessionsAttended}/${omar.attendanceHealth?.totalSessions})`);
  console.log(`     Attendance At-Risk Flag: ${omar.attendanceHealth?.attendanceAtRisk}`);
  console.log(`     Cumulative Score: ${omar.cumulativeScore}%`);
  console.log(`     Standing: ${omar.academicStanding}`);

  assert.strictEqual(omar.attendanceHealth?.attendanceAtRisk, true, 'Omar MUST be flagged attendanceAtRisk = true');
  assert(omar.attendanceHealth?.attendancePercentage < 85, 'Omar attendance must be < 85%');
  assert(
    ['At Risk', 'Academic Warning'].includes(omar.academicStanding),
    `Omar standing expected At Risk or Academic Warning, got: ${omar.academicStanding}`
  );
  console.log('   ✓ Gradebook student metrics, calculations, and at-risk matrix verified.\n');

  // Step 4: Quick-Grade Single Score Update
  console.log('4. Testing Quick-Grade endpoint (score & feedback adjustment)...');
  // Find a submission to update
  let targetAssessment = null;
  let targetSubmissionId = null;

  for (const st of students) {
    const sub = st.technicalAssessments?.find((a) => a.submissionId && a.isSubmitted);
    if (sub) {
      targetAssessment = sub;
      targetSubmissionId = sub.submissionId;
      break;
    }
  }

  assert(targetSubmissionId, 'Could not find an assessment submission to test quick-grade');
  const newScore = 88;
  const newFeedback = 'Telemetry link budget verified with orbital correction factors.';

  const quickGradeRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: `/api/instructor/cohorts/${cohortId}/quick-grade`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructorToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({
      submissionId: targetSubmissionId,
      score: newScore,
      feedback: newFeedback,
    })
  );

  assert.strictEqual(quickGradeRes.status, 200, `Quick-grade update failed: ${quickGradeRes.raw}`);
  assert.strictEqual(quickGradeRes.data?.success, true, 'Quick-grade returned success !== true');
  console.log('   ✓ Quick-grade API returned success.');

  // Verify the updated gradebook reflects changes immediately
  const refreshedGbRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: `/api/instructor/cohorts/${cohortId}/gradebook`,
    method: 'GET',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });
  assert.strictEqual(refreshedGbRes.status, 200, 'Refreshed gradebook fetch failed');
  const refreshedGb = refreshedGbRes.data?.data || refreshedGbRes.data;

  // Locate the updated assessment in refreshed gradebook
  let updatedScoreFound = false;
  for (const st of refreshedGb.students) {
    const match = st.technicalAssessments?.find(
      (a) => String(a.submissionId) === String(targetSubmissionId)
    );
    if (match && match.score === newScore) {
      updatedScoreFound = true;
      console.log(`   ✓ Refreshed gradebook confirms score updated to ${match.score} (Max: ${match.maxScore})`);
      break;
    }
  }
  assert(updatedScoreFound, 'Updated score was not reflected in refreshed gradebook query');
  console.log('   ✓ Quick-grade verified in real-time calculation.\n');

  // Step 5: Export CSV Ledger
  console.log('5. Testing Official CSV Ledger Export...');
  const csvRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: `/api/instructor/cohorts/${cohortId}/export-csv`,
    method: 'GET',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });

  assert.strictEqual(csvRes.status, 200, `CSV export failed with status ${csvRes.status}`);
  const contentType = csvRes.headers['content-type'] || '';
  assert(contentType.includes('text/csv'), `Expected text/csv content-type, got: ${contentType}`);
  const contentDisposition = csvRes.headers['content-disposition'] || '';
  assert(contentDisposition.includes('attachment'), `Expected attachment content-disposition, got: ${contentDisposition}`);

  const csvRaw = csvRes.raw;
  assert(typeof csvRaw === 'string' && csvRaw.length > 50, 'CSV output is empty or too short');

  const lines = csvRaw.split('\n').filter((l) => l.trim().length > 0);
  assert(lines.length >= 3, `Expected at least header + 2 student rows, got ${lines.length} lines`);

  const headerLine = lines[0];
  console.log('   CSV Header:', headerLine);
  assert(headerLine.includes('Student Name'), 'CSV header missing "Student Name"');
  assert(headerLine.includes('Email'), 'CSV header missing "Email"');
  assert(headerLine.includes('Attendance Rate (%)'), 'CSV header missing "Attendance Rate (%)"');
  assert(headerLine.includes('Attendance Risk Status'), 'CSV header missing "Attendance Risk Status"');
  assert(headerLine.includes('Cumulative Score (%)'), 'CSV header missing "Cumulative Score (%)"');
  assert(headerLine.includes('Standing'), 'CSV header missing "Standing"');

  // Verify rows contain student identifiers
  const hasYoussef = lines.some((l) => l.includes('youssef.student@egsa.gov.eg'));
  const hasOmar = lines.some((l) => l.includes('omar.student@egsa.gov.eg'));
  assert(hasYoussef, 'CSV export missing Youssef Mohamed');
  assert(hasOmar, 'CSV export missing Omar Hassan');
  console.log('   ✓ CSV rows contain all cohort students and metrics.');
  console.log('   ✓ CSV export header and format validated.\n');

  console.log('========================================================================');
  console.log(' ✓ ALL PHASE 13 INSTRUCTOR GRADEBOOK TESTS PASSED PERFECTLY!');
  console.log('========================================================================');
}

runPhase13GradebookTest().catch((err) => {
  console.error('\n❌ PHASE 13 TEST SUITE FAILED:', err);
  process.exit(1);
});
