const mongoose = require('mongoose');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('--- STARTING PHASE 2 PROFILE VERIFICATION TEST ---');

  // Connect to DB directly to verify persistence
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_academy');
  console.log('[DB] Connected to MongoDB');

  try {
    // 1. Authenticate as University Student (Youssef Mohamed)
    console.log('\n[TEST 1] Authenticating as Youssef Mohamed (University)...');
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
    console.log('✓ Successfully authenticated! Token received.');

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 2. Fetch Profile via GET /api/students/profile
    console.log('\n[TEST 2] Fetching Profile via GET /api/students/profile...');
    const getRes = await fetch(`${API_BASE}/students/profile`, { headers });
    const getData = await getRes.json();

    if (!getData.success) {
      throw new Error(`Profile fetch returned unsuccessful: ${JSON.stringify(getData)}`);
    }

    const fetchedProfile = getData.data;
    console.log('✓ Profile retrieved:');
    console.log(`  - Full Name: ${fetchedProfile.user?.fullName}`);
    console.log(`  - Division: ${fetchedProfile.division}`);
    console.log(`  - Institution: ${fetchedProfile.academicInfo?.institutionName}`);
    console.log(`  - Initial Completion %: ${fetchedProfile.profileCompletionPercentage}%`);

    if (fetchedProfile.user?.email !== 'youssef.student@egsa.gov.eg') {
      throw new Error(`Expected email youssef.student@egsa.gov.eg but received ${fetchedProfile.user?.email}`);
    }

    // 3. Update Profile via PUT /api/students/profile
    console.log('\n[TEST 3] Updating Technical Skills, Academic Year & Phone via PUT /api/students/profile...');
    const updatedSkills = [
      'Orbital Mechanics',
      'C++',
      'MATLAB/Simulink',
      'Telemetry Analysis',
      'CanSat Avionics',
      'RTOS',
      'Spacecraft Attitude Dynamics',
      'Solar Panel Thermal Analysis',
    ];
    const updatePayload = {
      phone: '+201099998888',
      academicInfo: {
        institutionName: 'Ain Shams University - Faculty of Engineering',
        faculty: 'Faculty of Engineering',
        department: 'Aerospace & Aeronautical Systems',
        studyYear: 'Graduation Project Year (Senior)',
        graduationYear: 2026,
        studentIdCardUrl: 'https://cdn.egsa.gov.eg/docs/ids/youssef_student_id_updated.pdf',
      },
      spaceExperience: {
        backgroundSummary:
          'Avionics team lead for National CanSat Competition, specializing in real-time telemetry decoding and Attitude Determination and Control Systems (ADCS).',
        technicalSkills: updatedSkills,
        completedExternalCourses: [
          'EgSA Satellite Engineering Fundamentals 2024',
          'NASA Open Science Data Literacy',
          'ESA CubeSat Hands-on Training',
        ],
        portfolioUrl: 'https://github.com/youssef-egsa/space-avionics-portfolio-v2',
      },
      personalInfo: {
        address: '5 Abbas El-Akkad, Nasr City, Cairo',
        guardianContact: {
          name: 'Mohamed Adel',
          phone: '+201098765430',
          relation: 'Father',
        },
      },
    };

    const putRes = await fetch(`${API_BASE}/students/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updatePayload),
    });
    const putData = await putRes.json();

    if (!putData.success) {
      throw new Error(`Profile update failed: ${JSON.stringify(putData)}`);
    }

    const updatedData = putData.data;
    console.log('✓ Profile updated successfully:');
    console.log(`  - Message: ${putData.message}`);
    console.log(`  - Study Year: ${updatedData.academicInfo?.studyYear}`);
    console.log(`  - Technical Skills Count: ${updatedData.spaceExperience?.technicalSkills?.length}`);
    console.log(`  - Recalculated Completion %: ${updatedData.profileCompletionPercentage}%`);

    if (updatedData.academicInfo?.studyYear !== 'Graduation Project Year (Senior)') {
      throw new Error('Study year update did not persist in API response');
    }
    if (updatedData.spaceExperience?.technicalSkills?.length !== 8) {
      throw new Error(`Expected 8 technical skills, got ${updatedData.spaceExperience?.technicalSkills?.length}`);
    }
    if (updatedData.profileCompletionPercentage < 70) {
      throw new Error(`Expected completion percentage >= 70%, got ${updatedData.profileCompletionPercentage}%`);
    }

    // 4. Verify MongoDB Persistence directly
    console.log('\n[TEST 4] Direct MongoDB persistence verification...');
    const dbProfile = await StudentProfile.findOne({ user: fetchedProfile.user.id || fetchedProfile.user._id });
    const dbUser = await User.findById(fetchedProfile.user.id || fetchedProfile.user._id);

    if (!dbProfile) throw new Error('StudentProfile not found in database');
    if (dbProfile.academicInfo.studyYear !== 'Graduation Project Year (Senior)') {
      throw new Error(`Database studyYear mismatch: ${dbProfile.academicInfo.studyYear}`);
    }
    if (dbUser.phone !== '+201099998888') {
      throw new Error(`User phone was not synced! Found: ${dbUser.phone}`);
    }
    console.log('✓ Direct database persistence & User phone synchronization verified!');

    // 5. Verify Pre-University Cadet (Nour Mansour)
    console.log('\n[TEST 5] Testing Cadet Profile for Nour Mansour (Pre-University)...');
    const cadetLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nour.cadet@egsa.gov.eg',
        password: 'Password123!',
      }),
    });
    const cadetLoginData = await cadetLogin.json();
    const cadetToken = cadetLoginData.data.token;

    const cadetGet = await fetch(`${API_BASE}/students/profile`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cadetToken}`,
      },
    });
    const cadetGetData = await cadetGet.json();

    console.log(`✓ Cadet Profile retrieved for: ${cadetGetData.data.user.fullName}`);
    console.log(`  - Division: ${cadetGetData.data.division}`);
    console.log(`  - School: ${cadetGetData.data.academicInfo?.institutionName}`);
    console.log(`  - Skills: ${cadetGetData.data.spaceExperience?.technicalSkills?.join(', ')}`);
    console.log(
      `  - Guardian: ${cadetGetData.data.personalInfo?.guardianContact?.name} (${cadetGetData.data.personalInfo?.guardianContact?.relation})`
    );

    console.log('\n======================================================');
    console.log('>>> ALL PHASE 2 BACKEND PROFILE TESTS PASSED 100% <<<');
    console.log('======================================================\n');
  } catch (error) {
    console.error('TEST ERROR:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
