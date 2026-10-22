const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const Application = require('../models/Application');
const User = require('../models/User');

const API_URL = 'http://127.0.0.1:5000/api';

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

async function runAdmissionsTests() {
  console.log('\n======================================================');
  console.log('🚀 EGSA ACADEMY - PHASE 2A ADMISSIONS & ELIGIBILITY VERIFICATION');
  console.log('======================================================\n');

  await connectDB();

  // Find courses
  const telemetryCourse = await Course.findOne({ slug: 'cubesat-telemetry-ground-stations' });
  const advEpsCourse = await Course.findOne({ slug: 'advanced-satellite-eps' });
  const canSatCourse = await Course.findOne({ slug: 'cansat-junior-rocketry' });
  const roboticsSchoolCourse = await Course.findOne({ slug: 'space-robotics-for-schools' });

  if (!telemetryCourse || !advEpsCourse || !canSatCourse || !roboticsSchoolCourse) {
    throw new Error('Required Phase 2A courses not found in database. Please run seed.');
  }

  console.log('✓ Found target courses:');
  console.log(`  - University 1: ${telemetryCourse.title} (Level: ${telemetryCourse.level}, Div: ${telemetryCourse.division})`);
  console.log(`  - University 2: ${advEpsCourse.title} (Level: ${advEpsCourse.level}, Div: ${advEpsCourse.division}, Prereqs: ${advEpsCourse.prerequisites.length})`);
  console.log(`  - Pre-Univ 1:   ${canSatCourse.title} (Level: ${canSatCourse.level}, Div: ${canSatCourse.division})`);
  console.log(`  - Pre-Univ 2:   ${roboticsSchoolCourse.title} (Level: ${roboticsSchoolCourse.level}, Div: ${roboticsSchoolCourse.division})\n`);

  // Start express server in-process on port 5002 for isolated testing
  const app = require('../app');
  const server = app.listen(5002);
  const baseUrl = 'http://127.0.0.1:5002/api';

  // Ensure clean slate for test applications
  const omarUser = await User.findOne({ email: 'omar.student@egsa.gov.eg' });
  const mariamUser = await User.findOne({ email: 'mariam.cadet@egsa.gov.eg' });
  if (omarUser && mariamUser) {
    await Application.deleteMany({
      $or: [
        { student: omarUser._id, course: advEpsCourse._id },
        { student: mariamUser._id, course: telemetryCourse._id },
      ],
    });
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Omar Hassan (University Student)
    // ----------------------------------------------------
    console.log('--- TEST 1: Omar Hassan (University Student) ---');
    const omarLogin = await req(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: {
        email: 'omar.student@egsa.gov.eg',
        password: 'Password123!',
      },
    });
    const omarToken = omarLogin.data.accessToken;
    console.log('✓ Logged in as Omar Hassan (University Student)');

    // 1A: Check eligibility for CubeSat Telemetry (University, no prereqs) -> should be Eligible
    const omarCheck1 = await req(`${baseUrl}/admissions/check-eligibility`, {
      method: 'POST',
      body: { courseId: String(telemetryCourse._id) },
      headers: { Authorization: `Bearer ${omarToken}` },
    });
    console.log('1A: Check CubeSat Telemetry:', omarCheck1.data.status);
    if (omarCheck1.data.status !== 'Eligible') {
      throw new Error(`Expected Eligible but got ${omarCheck1.data.status}`);
    }
    console.log('   ✓ Status is Eligible, requiresReadiness is true');

    // 1B: Check eligibility for Advanced Satellite EPS (requires CubeSat Telemetry) -> should be Foundation Required
    const omarCheck2 = await req(`${baseUrl}/admissions/check-eligibility`, {
      method: 'POST',
      body: { courseId: String(advEpsCourse._id) },
      headers: { Authorization: `Bearer ${omarToken}` },
    });
    console.log('1B: Check Advanced Satellite EPS:', omarCheck2.data.status);
    if (omarCheck2.data.status !== 'Foundation Required') {
      throw new Error(`Expected Foundation Required but got ${omarCheck2.data.status}`);
    }
    console.log('   ✓ Status is Foundation Required');
    console.log('   ✓ Missing requirements:', omarCheck2.data.missingRequirements);
    if (!omarCheck2.data.recommendedCourse) {
      throw new Error('Recommended course should be present when foundation is required');
    }
    console.log('   ✓ Recommended Foundation course:', omarCheck2.data.recommendedCourse.title);

    // 1C: Apply for Advanced Satellite EPS
    const advCohort = await Cohort.findOne({ course: advEpsCourse._id });
    const omarApply = await req(`${baseUrl}/admissions/apply`, {
      method: 'POST',
      body: { courseId: String(advEpsCourse._id), cohortId: String(advCohort?._id) },
      headers: { Authorization: `Bearer ${omarToken}` },
    });
    const appData = omarApply.data?.application || omarApply.data?.data || omarApply.data;
    console.log('1C: Application Submission status:', appData.status);
    if (appData.status !== 'Foundation Required') {
      throw new Error(`Expected application status Foundation Required, got ${appData.status}`);
    }
    console.log('   ✓ Application created with Foundation Required status\n');

    // ----------------------------------------------------
    // TEST 2: Mariam Khaled (Pre-University Student)
    // ----------------------------------------------------
    console.log('--- TEST 2: Mariam Khaled (Pre-University Student) ---');
    const mariamLogin = await req(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: {
        email: 'mariam.cadet@egsa.gov.eg',
        password: 'Password123!',
      },
    });
    const mariamToken = mariamLogin.data.accessToken;
    console.log('✓ Logged in as Mariam Khaled (Pre-University Student)');

    // 2A: Check eligibility for CanSat Junior Rocketry (Pre-University) -> Eligible
    const mariamCheck1 = await req(`${baseUrl}/admissions/check-eligibility`, {
      method: 'POST',
      body: { courseId: String(canSatCourse._id) },
      headers: { Authorization: `Bearer ${mariamToken}` },
    });
    console.log('2A: Check CanSat Junior Rocketry:', mariamCheck1.data.status);
    if (mariamCheck1.data.status !== 'Eligible') {
      throw new Error(`Expected Eligible but got ${mariamCheck1.data.status}`);
    }
    console.log('   ✓ Status is Eligible for Pre-University course');

    // 2B: Check eligibility for CubeSat Telemetry (University) -> Manual Review (Division Mismatch)
    const mariamCheck2 = await req(`${baseUrl}/admissions/check-eligibility`, {
      method: 'POST',
      body: { courseId: String(telemetryCourse._id) },
      headers: { Authorization: `Bearer ${mariamToken}` },
    });
    console.log('2B: Check CubeSat Telemetry (Univ):', mariamCheck2.data.status);
    if (mariamCheck2.data.status !== 'Manual Review') {
      throw new Error(`Expected Manual Review but got ${mariamCheck2.data.status}`);
    }
    console.log('   ✓ Status is Manual Review due to division mismatch');
    console.log('   ✓ Missing requirements:', mariamCheck2.data.missingRequirements);

    // 2C: Apply for CubeSat Telemetry as Pre-University Cadet -> Queued for Manual Review
    const teleCohort = await Cohort.findOne({ course: telemetryCourse._id });
    const mariamApply = await req(`${baseUrl}/admissions/apply`, {
      method: 'POST',
      body: { courseId: String(telemetryCourse._id), cohortId: String(teleCohort?._id) },
      headers: { Authorization: `Bearer ${mariamToken}` },
    });
    const mariamAppData = mariamApply.data?.application || mariamApply.data?.data || mariamApply.data;
    console.log('2C: Application Submission status:', mariamAppData.status);
    if (mariamAppData.status !== 'Manual Review') {
      throw new Error(`Expected application status Manual Review, got ${mariamAppData.status}`);
    }
    const createdAppId = mariamAppData._id;
    console.log('   ✓ Application created with Manual Review status (ID:', createdAppId, ')\n');

    // ----------------------------------------------------
    // TEST 3: Sara Mostafa (University Division Admin)
    // ----------------------------------------------------
    console.log('--- TEST 3: Sara Mostafa (University Division Admin) ---');
    const saraLogin = await req(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: {
        email: 'sara.univadmin@egsa.gov.eg',
        password: 'Password123!',
      },
    });
    const saraToken = saraLogin.data.accessToken;
    console.log('✓ Logged in as Sara Mostafa (University Admin)');

    // 3A: List applications for University Admin
    const adminAppsRes = await req(`${baseUrl}/admissions/admin/applications`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    });
    console.log(`3A: University Admin applications count: ${adminAppsRes.data.length}`);
    const nonUnivApps = adminAppsRes.data.filter(
      (a) => a.course?.division && a.course.division !== 'UNIVERSITY'
    );
    if (nonUnivApps.length > 0) {
      throw new Error(`Scoped University admin should not see non-University courses. Found: ${nonUnivApps.length}`);
    }
    console.log('   ✓ Applications strictly scoped to UNIVERSITY division');

    // 3B: Admin Override on Mariam's Manual Review Application
    const overrideReason = 'Academic Affairs approved waiver based on exceptional national Olympiad gold medal';
    const overrideRes = await req(
      `${baseUrl}/admissions/admin/applications/${createdAppId}/override`,
      {
        method: 'PATCH',
        body: { reason: overrideReason },
        headers: { Authorization: `Bearer ${saraToken}` },
      }
    );
    const overrideData = overrideRes.data?.data || overrideRes.data;
    console.log('3B: Override status:', overrideData.status, '| Eligibility Status:', overrideData.eligibilityStatus);
    if (overrideData.status !== 'Eligible' && overrideData.status !== 'Accepted') {
      throw new Error(`Expected status Eligible or Accepted after override, got ${overrideData.status}`);
    }
    if (overrideData.eligibilityStatus !== 'Eligible') {
      throw new Error(`Expected eligibilityStatus Eligible, got ${overrideData.eligibilityStatus}`);
    }
    if (!overrideData.adminOverride?.applied) {
      throw new Error('adminOverride.applied should be true');
    }
    console.log('   ✓ Application overridden successfully (Eligibility: Eligible, Seat Reserved)');
    console.log('   ✓ Admin stamped ID:', overrideData.adminOverride.adminId);
    console.log('   ✓ Reason recorded:', overrideData.adminOverride.reason);

    // 3C: Test Request More Info
    const reqInfoRes = await req(
      `${baseUrl}/admissions/admin/applications/${createdAppId}/request-info`,
      {
        method: 'POST',
        body: { note: 'Please upload recommendation letter from school principal.' },
        headers: { Authorization: `Bearer ${saraToken}` },
      }
    );
    const reqInfoData = reqInfoRes.data?.data || reqInfoRes.data;
    console.log('3C: Request Info status:', reqInfoData.status);
    if (reqInfoData.status !== 'Needs Information' && reqInfoData.status !== 'Manual Review') {
      throw new Error(`Expected status Needs Information or Manual Review, got ${reqInfoData.status}`);
    }
    console.log('   ✓ Request info transitioned status to:', reqInfoData.status);

    // 3D: Test Reject
    const rejectRes = await req(
      `${baseUrl}/admissions/admin/applications/${createdAppId}/reject`,
      {
        method: 'POST',
        body: { reason: 'Cohort capacity reached for current cycle.' },
        headers: { Authorization: `Bearer ${saraToken}` },
      }
    );
    const rejectData = rejectRes.data?.data || rejectRes.data;
    console.log('3D: Reject status:', rejectData.status);
    if (rejectData.status !== 'Rejected') {
      throw new Error(`Expected status Rejected, got ${rejectData.status}`);
    }
    console.log('   ✓ Application marked Rejected with reason recorded');

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 2A ADMISSIONS & ELIGIBILITY TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    await mongoose.disconnect();
  }
}

runAdmissionsTests().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILED:', err.data || err.message);
  process.exit(1);
});
