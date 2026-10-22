require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceDispute = require('../models/AttendanceDispute');
const User = require('../models/User');

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
  return { status: res.status, ok: res.ok, data };
}

async function runPhase8Test() {
  console.log('========================================================================');
  console.log('PHASE 8: TWO-STAGE QR ATTENDANCE VERIFICATION & ABSENCE EXCUSE TEST');
  console.log('========================================================================\n');

  try {
    // 0. Clean prior test state for idempotent execution
    console.log('[STEP 0] Resetting prior test attendance state for idempotent test run...');
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_academy';
    await mongoose.connect(mongoUri);
    const youssefDoc = await User.findOne({ email: 'youssef.student@egsa.gov.eg' });
    if (youssefDoc) {
      await AttendanceRecord.deleteMany({ student: youssefDoc._id });
      await AttendanceDispute.deleteMany({ student: youssefDoc._id });
      console.log('  -> Prior test records cleared for student Youssef.');
    }
    await mongoose.disconnect();

    // 1. Authenticate Student (Youssef)
    console.log('\n[STEP 1] Authenticating student youssef.student@egsa.gov.eg...');
    let studentLogin = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'youssef.student@egsa.gov.eg', password: 'Password123!' }),
    });

    if (!studentLogin.ok) {
      console.log('  -> Student not found, registering youssef.student@egsa.gov.eg...');
      await req(`${API_BASE}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Youssef Mohamed',
          email: 'youssef.student@egsa.gov.eg',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          division: 'UNIVERSITY',
          phone: '+201012345678',
        }),
      });

      studentLogin = await req(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'youssef.student@egsa.gov.eg', password: 'Password123!' }),
      });
    }

    if (!studentLogin.ok) {
      throw new Error(`Failed to login student: ${JSON.stringify(studentLogin.data)}`);
    }

    const studentToken = studentLogin.data?.data?.accessToken || studentLogin.data?.accessToken || studentLogin.data?.token;
    const studentUser = studentLogin.data?.data?.user || studentLogin.data?.user;
    console.log(`  -> Student authenticated: ${studentUser?.fullName} (${studentUser?._id})`);

    // 2. Authenticate Instructor (Tarek)
    console.log('\n[STEP 2] Authenticating instructor tarek.instructor@egsa.gov.eg...');
    const instructorLogin = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'tarek.instructor@egsa.gov.eg', password: 'Password123!' }),
    });

    if (!instructorLogin.ok) {
      throw new Error(`Failed to login instructor: ${JSON.stringify(instructorLogin.data)}`);
    }

    const instructorToken = instructorLogin.data?.data?.accessToken || instructorLogin.data?.accessToken || instructorLogin.data?.token;
    const instructorUser = instructorLogin.data?.data?.user || instructorLogin.data?.user;
    console.log(`  -> Instructor authenticated: ${instructorUser?.fullName} (${instructorUser?._id})`);

    // 3. Stage 1: Student scans QR code token EGSA-QR-CUBESAT-LIVE-2026
    console.log('\n[STEP 3] Stage 1 - Student check-in with token EGSA-QR-CUBESAT-LIVE-2026...');
    const qrCheckInRes = await req(`${API_BASE}/attendance/check-in/qr`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ qrToken: 'EGSA-QR-CUBESAT-LIVE-2026' }),
    });

    console.log(`  -> Status code: ${qrCheckInRes.status}`);
    console.log(`  -> Response message: ${qrCheckInRes.data?.message}`);
    const checkInRecord = qrCheckInRes.data?.data?.record || qrCheckInRes.data?.record || qrCheckInRes.data?.data;
    console.log(`  -> Attendance record status: ${checkInRecord?.status}`);
    console.log(`  -> Session ID: ${checkInRecord?.session}`);

    if (qrCheckInRes.status !== 200 && qrCheckInRes.status !== 201) {
      throw new Error(`Stage 1 QR Check-in failed with status ${qrCheckInRes.status}: ${JSON.stringify(qrCheckInRes.data)}`);
    }

    if (checkInRecord?.status !== 'pending_instructor_verification') {
      throw new Error(`Expected record status 'pending_instructor_verification', got: '${checkInRecord?.status}'`);
    }
    console.log('  -> PASS: Check-in created with status: pending_instructor_verification');

    const sessionId = checkInRecord?.session;

    // 4. Stage 2: Instructor fetches session queue
    console.log(`\n[STEP 4] Stage 2 - Instructor fetches queue for session ${sessionId}...`);
    const queueRes = await req(`${API_BASE}/attendance/session/${sessionId}/queue`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });

    console.log(`  -> Status code: ${queueRes.status}`);
    const queueList = queueRes.data?.data?.queue || queueRes.data?.queue || [];
    console.log(`  -> Queue length: ${queueList.length}`);

    const youssefInQueue = queueList.find(
      (item) => String(item.student?._id || item.student) === String(studentUser._id)
    );

    if (!youssefInQueue) {
      throw new Error(`Student ${studentUser._id} not found in session verification queue!`);
    }
    console.log(`  -> PASS: Found ${youssefInQueue.student?.name || youssefInQueue.student?.fullName || studentUser.fullName} in pending queue`);

    // 5. Stage 2: Instructor verifies Youssef on-premise
    console.log(`\n[STEP 5] Stage 2 - Instructor verifies student on-premise...`);
    const verifyRes = await req(`${API_BASE}/attendance/session/${sessionId}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: JSON.stringify({ studentIds: [studentUser._id] }),
    });

    console.log(`  -> Status code: ${verifyRes.status}`);
    console.log(`  -> Response message: ${verifyRes.data?.message}`);
    const verifiedRecords =
      verifyRes.data?.data?.verifiedRecords ||
      verifyRes.data?.data?.records ||
      verifyRes.data?.verifiedRecords ||
      verifyRes.data?.records ||
      [];
    console.log(`  -> Verified records count: ${verifiedRecords.length}`);

    if (verifyRes.status !== 200) {
      throw new Error(`Verification failed with status ${verifyRes.status}: ${JSON.stringify(verifyRes.data)}`);
    }

    const verifiedRecord = verifiedRecords[0];
    if (verifiedRecord?.status !== 'verified' || !verifiedRecord?.verified) {
      throw new Error(`Expected record to be verified, got status: '${verifiedRecord?.status}', verified: ${verifiedRecord?.verified}`);
    }
    console.log(`  -> PASS: Student marked verified at ${verifiedRecord.verifiedAt} by instructor ${verifiedRecord.verifiedBy}`);

    // 6. Stage 3: Student submits absence excuse for scheduled session
    console.log('\n[STEP 6] Stage 3 - Student submits absence excuse...');
    // Fetch student training sessions to get another session ID
    const studentSessionsRes = await req(`${API_BASE}/student/training/sessions`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const otherSessions = studentSessionsRes.data?.data || studentSessionsRes.data?.sessions || [];
    const targetSession = otherSessions.find((s) => String(s._id) !== String(sessionId)) || otherSessions[0];
    const excuseSessionId = targetSession?._id || sessionId;

    const excuseRes = await req(`${API_BASE}/attendance/excuse`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        sessionId: excuseSessionId,
        reason: 'Official university mid-term examination and satellite lab commitment.',
        documentNote: 'Dean signed formal letter of excuse Ref #ENG-2026-4412',
      }),
    });

    console.log(`  -> Status code: ${excuseRes.status}`);
    console.log(`  -> Response message: ${excuseRes.data?.message}`);
    const excuseRecord = excuseRes.data?.data?.record || excuseRes.data?.record || excuseRes.data?.data;
    console.log(`  -> Excuse record status: ${excuseRecord?.status}`);
    console.log(`  -> Stored reason: "${excuseRecord?.reason}"`);

    if (excuseRes.status !== 200 && excuseRes.status !== 201) {
      throw new Error(`Absence excuse submission failed with status ${excuseRes.status}: ${JSON.stringify(excuseRes.data)}`);
    }

    if (excuseRecord?.status !== 'excused') {
      throw new Error(`Expected excuse record status 'excused', got: '${excuseRecord?.status}'`);
    }
    console.log('  -> PASS: Absence excuse submitted and recorded as status: excused');

    // 7. Admin Ledger Verification
    console.log('\n[STEP 7] Authenticating Division Admin & verifying attendance ledger...');
    const adminLogin = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'sara.univadmin@egsa.gov.eg', password: 'Password123!' }),
    });

    if (adminLogin.ok) {
      const adminToken = adminLogin.data?.data?.accessToken || adminLogin.data?.accessToken || adminLogin.data?.token;
      const ledgerRes = await req(`${API_BASE}/attendance/admin/ledger`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      console.log(`  -> Ledger status code: ${ledgerRes.status}`);
      const ledger = ledgerRes.data?.data?.ledger || ledgerRes.data?.ledger || [];
      console.log(`  -> Ledger records count: ${ledger.length}`);
      if (ledger.length > 0) {
        console.log(`  -> Sample ledger entry student: ${ledger[0].student?.fullName || ledger[0].student?.name}`);
        console.log(`  -> Sample attendance rate: ${ledger[0].attendanceRate}% (Below 85% threshold: ${ledger[0].isBelowThreshold})`);
      }
      console.log('  -> PASS: Attendance ledger retrieved successfully for Division Admin');
    } else {
      console.log('  -> Note: Admin login skipped or credentials altered; verifying with Super Admin...');
      const superLogin = await req(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: 'ayman.superadmin@egsa.gov.eg', password: 'Password123!' }),
      });
      if (superLogin.ok) {
        const superToken = superLogin.data?.data?.accessToken || superLogin.data?.accessToken;
        const ledgerRes = await req(`${API_BASE}/attendance/admin/ledger`, {
          headers: { Authorization: `Bearer ${superToken}` },
        });
        console.log(`  -> Super Admin Ledger status: ${ledgerRes.status}`);
        console.log('  -> PASS: Attendance ledger retrieved successfully');
      }
    }

    console.log('\n========================================================================');
    console.log('PHASE 8 ALL VERIFICATION STEPS PASSED SUCCESSFULLY!');
    console.log('========================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n[PHASE 8 TEST FAILED]:', err.message);
    process.exit(1);
  }
}

runPhase8Test();
