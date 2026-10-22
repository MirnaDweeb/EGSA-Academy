const http = require('http');
const assert = require('assert');
const mongoose = require('mongoose');

const API_HOST = '127.0.0.1';
const API_PORT = 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/egsa_academy';

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

async function runPhase12InstructorSessionTest() {
  console.log('========================================================================');
  console.log(' EgSA Academy — Phase 12 Instructor Session Command Center & QR Cycle Test');
  console.log(' Target Spec: Sections 4, 10.1, 10.2 & 18 (Lifecycle & Classroom Delivery)');
  console.log('========================================================================\n');

  // Step 1: Login as Instructor (Eng. Tarek ElKady)
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

  // Step 2: Login as Student (Youssef Mohamed)
  console.log('2. Authenticating as Student (youssef.student@egsa.gov.eg)...');
  const studentLoginRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: 'youssef.student@egsa.gov.eg', password: 'Password123!' })
  );

  assert.strictEqual(studentLoginRes.status, 200, `Student login failed: ${studentLoginRes.raw}`);
  const studentToken =
    studentLoginRes.data?.data?.accessToken ||
    studentLoginRes.data?.accessToken ||
    studentLoginRes.data?.data?.token ||
    studentLoginRes.data?.token;
  assert(studentToken, 'Missing student JWT token');
  console.log('   ✓ Student authenticated successfully.\n');

  // Step 3: Fetch Instructor Sessions to select a target session
  console.log('3. Fetching Instructor Sessions to locate target session...');
  const sessionsRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/instructor/sessions',
    method: 'GET',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });

  assert.strictEqual(sessionsRes.status, 200, `Failed to fetch instructor sessions: ${sessionsRes.raw}`);
  const sessions = sessionsRes.data?.items || sessionsRes.data?.data || sessionsRes.data || [];
  assert(Array.isArray(sessions) && sessions.length > 0, 'No sessions returned for instructor');

  // Prefer Session 4, or any scheduled session
  let targetSession =
    sessions.find((s) => s.title?.includes('Session 4')) ||
    sessions.find((s) => s.title?.includes('Session 5')) ||
    sessions.find((s) => String(s.status).toLowerCase() === 'scheduled') ||
    sessions[0];

  assert(targetSession, 'No target session found for testing');
  const sessionId = targetSession._id;
  console.log(`   -> Target Session: "${targetSession.title}" (ID: ${sessionId})\n`);

  // Idempotency: Connect DB to reset target session to Scheduled and clear any test records for student
  await mongoose.connect(MONGO_URI);
  const { Session, Attendance, User } = require('../models');
  const AttendanceRecord = require('../models/AttendanceRecord');
  const TrainingSession = require('../models/TrainingSession');

  const studentDoc = await User.findOne({ email: 'youssef.student@egsa.gov.eg' });
  const StudentReference = require('../models/StudentReference');
  const studentRef = studentDoc ? await StudentReference.findOne({ email: studentDoc.email }) : null;
  const sIds = [studentDoc?._id, studentRef?._id].filter(Boolean);
  const targetSess = (await Session.findById(sessionId)) || (await TrainingSession.findById(sessionId));
  const sessTitle = targetSess?.title;
  const matchSessions = await Session.find({ title: sessTitle }).select('_id');
  const matchTrainSessions = await TrainingSession.find({ title: sessTitle }).select('_id');
  const allSessIds = [sessionId, ...matchSessions.map(s => s._id), ...matchTrainSessions.map(s => s._id)];
  await AttendanceRecord.deleteMany({ session: { $in: allSessIds }, student: { $in: sIds } });
  await Attendance.deleteMany({ session: { $in: allSessIds }, student: { $in: sIds } });
  // Reset session to scheduled state so launch transitions fresh
  await Session.findByIdAndUpdate(sessionId, {
    $set: { status: 'scheduled', actualStartTime: null, actualEndTime: null },
  });
  await TrainingSession.findByIdAndUpdate(sessionId, {
    $set: { status: 'Scheduled', actualStartTime: null, actualEndTime: null },
  });
  await mongoose.disconnect();
  console.log('   -> Session state prepped: status reset to Scheduled, prior student records cleared.\n');

  // Step 4: Instructor launches session -> In_Progress & dynamic QR token issued
  console.log(`4. Instructor launches live session (POST /api/instructor/sessions/${sessionId}/start)...`);
  const startRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: `/api/instructor/sessions/${sessionId}/start`,
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });

  assert(
    startRes.status === 200 || startRes.status === 201,
    `Launch session failed with HTTP ${startRes.status}: ${startRes.raw}`
  );
  const startedData = startRes.data?.data || startRes.data;
  const startedStatus = String(startedData.status).toLowerCase();
  assert(
    startedStatus === 'in_progress' || startedStatus === 'inprogress',
    `Expected status In_Progress, got: ${startedData.status}`
  );
  assert(startedData.actualStartTime, 'Expected actualStartTime to be recorded');
  assert(startedData.qrCode, 'Expected qrCode object on started session');
  assert(startedData.qrCode.token, 'Expected qrCode.token to be generated');
  assert(startedData.qrCode.code, 'Expected 6-char qrCode.code fallback to be generated');
  assert.strictEqual(startedData.qrCode.isActive, true, 'Expected qrCode.isActive to be true');

  const initialToken = startedData.qrCode.token;
  const initialCode = startedData.qrCode.code;
  console.log(`   ✓ Session started! Status: ${startedData.status}`);
  console.log(`   ✓ Recorded actualStartTime: ${startedData.actualStartTime}`);
  console.log(`   ✓ Active QR Token: ${initialToken}`);
  console.log(`   ✓ Fallback 6-Char Alphanumeric Code: ${initialCode}\n`);

  // Step 5: Instructor cycles token -> old token invalidated, new valid token active
  console.log(`5. Instructor cycles token for on-premise security (POST /api/instructor/sessions/${sessionId}/regenerate-qr)...`);
  const cycleRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: `/api/instructor/sessions/${sessionId}/regenerate-qr`,
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });

  assert(
    cycleRes.status === 200 || cycleRes.status === 201,
    `Cycle token failed with HTTP ${cycleRes.status}: ${cycleRes.raw}`
  );
  const cycledData = cycleRes.data?.data || cycleRes.data;
  assert(cycledData.qrCode, 'Expected qrCode in cycle response');
  const cycledToken = cycledData.qrCode.token;
  const cycledCode = cycledData.qrCode.code;

  assert.notStrictEqual(cycledToken, initialToken, 'New token should differ from initial token');
  console.log(`   ✓ Token cycled successfully!`);
  console.log(`   ✓ New Active QR Token: ${cycledToken}`);
  console.log(`   ✓ New Fallback Alphanumeric Code: ${cycledCode}\n`);

  // Verify that old token is now rejected if scanned
  console.log('5b. Verifying that scanning old token is rejected...');
  const oldScanRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/attendance/check-in',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({ qrToken: initialToken })
  );
  assert(
    oldScanRes.status >= 400,
    `Expected old token to be rejected with 4xx, but received status ${oldScanRes.status}: ${oldScanRes.raw}`
  );
  console.log(`   ✓ Old token properly rejected (${oldScanRes.status}: ${oldScanRes.data?.message || 'Invalid token'})\n`);

  // Step 6: Student scans new cycled token -> appears in scannedPendingCount
  console.log('6. Student scans new cycled token (POST /api/attendance/check-in)...');
  const newScanRes = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/attendance/check-in',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({ qrToken: cycledToken, checkInMethod: 'QR_Scan' })
  );

  assert(
    newScanRes.status === 200 || newScanRes.status === 201,
    `New token scan failed with HTTP ${newScanRes.status}: ${newScanRes.raw}`
  );
  console.log(`   ✓ Student scan accepted: ${newScanRes.data?.message || 'Pending verification'}`);

  // Fetch updated session as instructor to verify real-time roster counter
  console.log(`   Checking live classroom counter (GET /api/instructor/sessions/${sessionId})...`);
  const sessionCheckRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: `/api/instructor/sessions/${sessionId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });

  assert.strictEqual(sessionCheckRes.status, 200, `Failed to fetch session detail: ${sessionCheckRes.raw}`);
  const currentSession = sessionCheckRes.data?.data || sessionCheckRes.data;
  const pendingCount = currentSession.scannedPendingCount ?? currentSession.counts?.scannedPendingCount ?? 0;
  console.log(`   ✓ Live Scanned Pending Count: ${pendingCount}`);
  assert(
    pendingCount >= 1,
    `Expected scannedPendingCount >= 1, got ${pendingCount}`
  );
  console.log(`   ✓ Student correctly registered in scannedPendingCount!\n`);

  // Step 7: Instructor concludes session -> status updates to Completed, QR token expired
  console.log(`7. Instructor concludes live session (POST /api/instructor/sessions/${sessionId}/end)...`);
  const endRes = await request({
    hostname: API_HOST,
    port: API_PORT,
    path: `/api/instructor/sessions/${sessionId}/end`,
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });

  assert(
    endRes.status === 200 || endRes.status === 201,
    `Conclude session failed with HTTP ${endRes.status}: ${endRes.raw}`
  );
  const endedData = endRes.data?.data || endRes.data;
  const endedStatus = String(endedData.status).toLowerCase();
  assert.strictEqual(endedStatus, 'completed', `Expected status Completed, got ${endedData.status}`);
  assert(endedData.actualEndTime, 'Expected actualEndTime to be recorded');
  assert.strictEqual(endedData.qrCode?.isActive, false, 'Expected qrCode.isActive to be false on concluded session');

  console.log(`   ✓ Session concluded! Status: ${endedData.status}`);
  console.log(`   ✓ Recorded actualEndTime: ${endedData.actualEndTime}`);
  console.log(`   ✓ QR Token isActive: ${endedData.qrCode?.isActive} (Post-session check-ins locked)\n`);

  // Step 8: Verify that post-conclude check-ins are rejected
  console.log('8. Verifying that check-ins after session conclusion are rejected...');
  const postConcludeScan = await request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/attendance/check-in',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({ qrToken: cycledToken })
  );

  assert(
    postConcludeScan.status >= 400,
    `Expected post-conclude check-in to fail with 4xx, got: ${postConcludeScan.status}`
  );
  console.log(`   ✓ Post-conclude check-in successfully blocked (${postConcludeScan.status}: ${postConcludeScan.data?.message || 'Session concluded'})\n`);

  console.log('========================================================================');
  console.log(' ★ PHASE 12 INSTRUCTOR SESSION COMMAND CENTER TEST PASSED FULLY! ★');
  console.log('========================================================================');
}

runPhase12InstructorSessionTest().catch((err) => {
  console.error('\n❌ TEST FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
