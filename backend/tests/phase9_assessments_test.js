require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const TrainingSession = require('../models/TrainingSession');
const Enrollment = require('../models/Enrollment');
const Assessment = require('../models/Assessment');
const StudentSubmission = require('../models/StudentSubmission');
const AssessmentResult = require('../models/AssessmentResult');

let API_BASE = 'http://127.0.0.1:5000/api';

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

async function runPhase9Test() {
  console.log('========================================================================');
  console.log('PHASE 9: ACADEMIC ASSESSMENT ENGINE & LATE GRACE PERIOD VERIFICATION TEST');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_academy';
  await mongoose.connect(mongoUri);

  let server;
  try {
    const probe = await fetch('http://127.0.0.1:5000/api/health', { signal: AbortSignal.timeout(1000) }).catch(() => null);
    if (!probe || !probe.ok) {
      const app = require('../app');
      const TEST_PORT = 5055;
      server = await new Promise((resolve) => {
        const s = app.listen(TEST_PORT, () => resolve(s));
      });
      API_BASE = `http://127.0.0.1:${TEST_PORT}/api`;
      console.log(`[TEST SETUP] In-process Express server started on http://127.0.0.1:${TEST_PORT}\n`);
    } else {
      console.log('[TEST SETUP] Using existing API server at http://127.0.0.1:5000\n');
    }
  } catch (err) {
    console.error('Failed to initialize test server:', err);
  }

  try {
    // -------------------------------------------------------------------
    // Step 0: Ensure Test Users & Data
    // -------------------------------------------------------------------
    console.log('[STEP 0] Ensuring test accounts and assessments in database...');

    // Student
    let student = await User.findOne({ email: 'youssef.student@egsa.gov.eg' });
    if (!student) {
      student = await User.create({
        fullName: 'Youssef Mohamed',
        email: 'youssef.student@egsa.gov.eg',
        password: 'Password123!',
        role: 'student',
        accountStatus: 'active',
        isEmailVerified: true,
      });
    }

    // Instructor
    let instructor = await User.findOne({ email: 'tarek.instructor@egsa.gov.eg' });
    if (!instructor) {
      instructor = await User.create({
        fullName: 'Eng. Tarek Elkady',
        email: 'tarek.instructor@egsa.gov.eg',
        password: 'Password123!',
        role: 'instructor',
        accountStatus: 'active',
        isEmailVerified: true,
      });
    }

    // Course & Cohort
    let course = await Course.findOne({ code: 'SAT-101' });
    if (!course) {
      course = await Course.findOne() || await Course.create({
        title: 'CubeSat Telemetry & Ground Station Engineering',
        code: 'SAT-101',
        track: 'CUBESAT_SUBSYSTEMS',
        division: 'UNIVERSITY',
        status: 'published',
      });
    }

    let cohort = await Cohort.findOne({ course: course._id });
    if (!cohort) {
      cohort = await Cohort.create({
        name: 'Cohort Alpha 2026',
        course: course._id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 60 * 86400000),
        status: 'in_progress',
        instructors: [instructor._id],
      });
    }

    // Enrollment
    let enrollment = await Enrollment.findOne({ student: student._id, course: course._id });
    if (!enrollment) {
      enrollment = await Enrollment.create({
        student: student._id,
        course: course._id,
        cohort: cohort._id,
        status: 'active',
      });
    }

    // Training Session
    let session = await TrainingSession.findOne({ cohort: cohort._id });
    if (!session) {
      session = await TrainingSession.create({
        title: 'Telemetry Decoding Lab',
        cohort: cohort._id,
        course: course._id,
        instructor: instructor._id,
        sessionNumber: 1,
        startTime: new Date(),
        endTime: new Date(Date.now() + 2 * 3600000),
        status: 'completed',
      });
    }

    // 1. Technical Quiz (CubeSat Telemetry with 4 questions)
    let quiz = await Assessment.findOne({ title: 'Phase 9 CubeSat Telemetry Test Quiz', course: course._id });
    if (!quiz) {
      quiz = await Assessment.create({
        title: 'Phase 9 CubeSat Telemetry Test Quiz',
        description: 'Auto-graded technical quiz covering telemetry link budgets, AX.25, and Doppler shift.',
        type: 'Quiz',
        course: course._id,
        cohort: cohort._id,
        session: session._id,
        instructor: instructor._id,
        instructorName: instructor.fullName,
        maxScore: 100,
        passingScore: 70,
        weight: 20,
        deadline: new Date(Date.now() + 7 * 86400000),
        dueDate: new Date(Date.now() + 7 * 86400000),
        questions: [
          {
            questionText: 'What is the standard frequency allocation for CubeSat telemetry downlinks?',
            options: ['144-146 MHz / 435-438 MHz', '2.4 GHz WiFi', '50 MHz 6-meter', '10.5 GHz Terrestrial'],
            correctOptionIndex: 0,
            points: 25,
            explanation: 'VHF/UHF bands are globally allocated for amateur CubeSat downlinks.',
          },
          {
            questionText: 'Which protocol is standard for packet telemetry framing?',
            options: ['AX.25 Packet Protocol', 'HTTP/3 over QUIC', 'Zigbee 802.15.4', 'Modbus RTU'],
            correctOptionIndex: 0,
            points: 25,
            explanation: 'AX.25 is standard in amateur satellite communications.',
          },
          {
            questionText: 'What phenomenon causes frequency shifts during a LEO satellite pass?',
            options: ['Doppler effect due to relative orbital velocity', 'Thermal expansion of crystal', 'Solar wind pressure', 'Battery discharge voltage drop'],
            correctOptionIndex: 0,
            points: 25,
            explanation: 'Doppler frequency compression and dilation results from ~7.5 km/s orbital motion.',
          },
          {
            questionText: 'What does Eb/N0 represent in telemetry link budget calculations?',
            options: ['Energy per bit to noise power spectral density ratio', 'Effective battery voltage', 'Earth bounce factor', 'Electromagnetic baseline index'],
            correctOptionIndex: 0,
            points: 25,
            explanation: 'Eb/N0 is the normalized signal-to-noise ratio determining digital BER.',
          },
        ],
      });
    }

    // 2. Past Deadline Assignment (Testing isLate: true & Late Grace Period)
    let lateAssignment = await Assessment.findOne({ title: 'Phase 9 Past Deadline Antenna Calibration', course: course._id });
    if (!lateAssignment) {
      lateAssignment = await Assessment.create({
        title: 'Phase 9 Past Deadline Antenna Calibration',
        description: 'Calibrate the ground station azimuth/elevation rotator for active CubeSat tracking.',
        type: 'Assignment',
        course: course._id,
        cohort: cohort._id,
        instructor: instructor._id,
        instructorName: instructor.fullName,
        maxScore: 100,
        passingScore: 70,
        weight: 30,
        // Explicit deadline 120 minutes in the past
        deadline: new Date(Date.now() - 120 * 60000),
        dueDate: new Date(Date.now() - 120 * 60000),
        lateGraceMinutes: 1440,
        latePenaltyPercent: 10,
        allowLateSubmission: true,
      });
    }

    // Clean prior submissions for student on these 2 assessments for idempotence
    await StudentSubmission.deleteMany({
      student: student._id,
      assessment: { $in: [quiz._id, lateAssignment._id] },
    });
    await AssessmentResult.deleteMany({
      student: student._id,
      assessment: { $in: [quiz._id, lateAssignment._id] },
    });

    console.log('  -> Database seeded with Quiz, Past Deadline Assignment, and clean submission state.\n');

    // -------------------------------------------------------------------
    // Step 1: Student Login
    // -------------------------------------------------------------------
    console.log('[STEP 1] Authenticating student youssef.student@egsa.gov.eg...');
    const studentLogin = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'youssef.student@egsa.gov.eg', password: 'Password123!' }),
    });

    const studentToken =
      studentLogin.data?.data?.accessToken ||
      studentLogin.data?.data?.token ||
      studentLogin.data?.tokens?.accessToken;

    if (!studentLogin.ok || !studentToken) {
      throw new Error(`Student login failed: ${JSON.stringify(studentLogin.data)}`);
    }
    console.log('  -> Student authenticated successfully. Token received.\n');

    // -------------------------------------------------------------------
    // Step 2: Student Submits Quiz -> Automated Instant Grading
    // -------------------------------------------------------------------
    console.log('[STEP 2] Student submits Technical Quiz answers...');
    const quizAnswers = [
      { questionIndex: 0, selectedOption: 0 }, // Correct (25 pts)
      { questionIndex: 1, selectedOption: 0 }, // Correct (25 pts)
      { questionIndex: 2, selectedOption: 0 }, // Correct (25 pts)
      { questionIndex: 3, selectedOption: 0 }, // Correct (25 pts)
    ];

    const quizRes = await req(`${API_BASE}/assessments/${quiz._id}/submit-quiz`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ answers: quizAnswers }),
    });

    console.log(`  -> Response status: ${quizRes.status}`);
    if (quizRes.status !== 201) {
      throw new Error(`Quiz submission failed with status ${quizRes.status}: ${JSON.stringify(quizRes.data)}`);
    }

    const quizData = quizRes.data;
    console.log(`  -> Auto-graded Score: ${quizData.score} / ${quizData.maxScore} (${quizData.percentage}%)`);
    console.log(`  -> Result Label: ${quizData.resultLabel}, Passed: ${quizData.passed}`);

    if (quizData.score !== 100 || quizData.resultLabel !== 'Passed' || !quizData.passed) {
      throw new Error(`Quiz grading mismatch: expected 100/100 Passed, got ${quizData.score} / ${quizData.resultLabel}`);
    }

    // Verify submission status in DB
    const quizSubInDb = await StudentSubmission.findOne({ assessment: quiz._id, student: student._id });
    if (!quizSubInDb || quizSubInDb.status !== 'Graded' || quizSubInDb.score !== 100) {
      throw new Error(`DB verification failed: StudentSubmission for quiz not marked Graded with score 100`);
    }

    const quizResInDb = await AssessmentResult.findOne({ assessment: quiz._id, student: student._id });
    if (!quizResInDb || quizResInDb.status !== 'Published' || quizResInDb.score !== 100) {
      throw new Error(`DB verification failed: AssessmentResult for quiz not marked Published with score 100`);
    }
    console.log('  -> [PASS] Quiz auto-graded, committed to grade book instantly without reload.\n');

    // -------------------------------------------------------------------
    // Step 3: Student Submits Assignment Past Deadline -> Verify isLate: true
    // -------------------------------------------------------------------
    console.log('[STEP 3] Student submits assignment past deadline...');
    const assignPayload = {
      submissionUrl: 'https://github.com/egsa-cadet/azimuth-elevation-rotator-calibration',
      notes: 'Implemented numerical TLE orbital tracking algorithm in Python with azimuth/elevation motor PID calibration logs.',
    };

    const assignRes = await req(`${API_BASE}/assessments/${lateAssignment._id}/submit-assignment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify(assignPayload),
    });

    console.log(`  -> Response status: ${assignRes.status}`);
    if (assignRes.status !== 201) {
      throw new Error(`Assignment submission failed with status ${assignRes.status}: ${JSON.stringify(assignRes.data)}`);
    }

    const assignData = assignRes.data;
    console.log(`  -> isLate Flag: ${assignData.isLate}`);
    console.log(`  -> Minutes Late: ${assignData.minutesLate}`);

    if (assignData.isLate !== true) {
      throw new Error(`Late logic failed: expected isLate === true, got ${assignData.isLate}`);
    }
    if (!assignData.minutesLate || assignData.minutesLate < 100) {
      throw new Error(`Late logic failed: expected minutesLate >= 100, got ${assignData.minutesLate}`);
    }

    // Check submission in DB
    const assignSubInDb = await StudentSubmission.findOne({ assessment: lateAssignment._id, student: student._id });
    if (!assignSubInDb || assignSubInDb.isLate !== true || assignSubInDb.minutesLate < 100) {
      throw new Error(`DB verification failed: StudentSubmission not flagged isLate: true with minutesLate`);
    }
    if (assignSubInDb.submissionUrl !== assignPayload.submissionUrl) {
      throw new Error(`DB verification failed: submissionUrl not persisted correctly`);
    }
    console.log('  -> [PASS] Assignment past deadline accurately flagged with isLate: true & minutesLate recorded.\n');

    // -------------------------------------------------------------------
    // Step 4: Instructor Authenticates & Grades the Assignment
    // -------------------------------------------------------------------
    console.log('[STEP 4] Instructor authenticates and grades cadet submission...');
    const instructorLogin = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'tarek.instructor@egsa.gov.eg', password: 'Password123!' }),
    });

    const instructorToken =
      instructorLogin.data?.data?.accessToken ||
      instructorLogin.data?.data?.token ||
      instructorLogin.data?.tokens?.accessToken;

    if (!instructorLogin.ok || !instructorToken) {
      throw new Error(`Instructor login failed: ${JSON.stringify(instructorLogin.data)}`);
    }
    console.log('  -> Instructor authenticated successfully.');

    // Query submissions queue for this assessment
    const queueRes = await req(`${API_BASE}/assessments/${lateAssignment._id}/submissions`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    console.log(`  -> Instructor submissions queue status: ${queueRes.status}, count: ${queueRes.data?.totalSubmissions}`);
    if (!queueRes.ok || !queueRes.data?.submissions?.length) {
      throw new Error(`Failed to fetch submissions queue for assessment: ${JSON.stringify(queueRes.data)}`);
    }

    const targetSub = queueRes.data.submissions[0];
    console.log(`  -> Found target submission ID: ${targetSub._id} from ${targetSub.student?.fullName || targetSub.student?.email}`);

    // Instructor inputs grade and qualitative feedback
    const gradingPayload = {
      score: 88,
      feedback: 'Excellent rotator calibration and telemetry parsing. Deducted 10% late grace penalty as per institutional specification.',
    };

    const gradeRes = await req(`${API_BASE}/assessments/submissions/${targetSub._id}/grade`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${instructorToken}` },
      body: JSON.stringify(gradingPayload),
    });

    console.log(`  -> Grading response status: ${gradeRes.status}`);
    if (!gradeRes.ok) {
      throw new Error(`Instructor grading failed with status ${gradeRes.status}: ${JSON.stringify(gradeRes.data)}`);
    }

    const gradeData = gradeRes.data;
    console.log(`  -> Assigned Score: ${gradeData.score} / ${gradeData.submission?.maxScore || 100}`);
    console.log(`  -> Qualitative Feedback: "${gradeData.feedback}"`);

    if (gradeData.score !== 88) {
      throw new Error(`Grading score mismatch: expected 88, got ${gradeData.score}`);
    }

    // Verify persistence in DB
    const gradedSubInDb = await StudentSubmission.findById(targetSub._id);
    if (!gradedSubInDb || gradedSubInDb.status !== 'Graded' || gradedSubInDb.score !== 88) {
      throw new Error(`DB verification failed: StudentSubmission not updated to status Graded with score 88`);
    }

    const resultInDb = await AssessmentResult.findOne({
      assessment: lateAssignment._id,
      student: student._id,
    });
    if (!resultInDb || resultInDb.status !== 'Published' || resultInDb.score !== 88) {
      throw new Error(`DB verification failed: AssessmentResult not published with score 88`);
    }
    console.log('  -> [PASS] Instructor grading and qualitative feedback persisted in database.\n');

    // -------------------------------------------------------------------
    // Step 5: Verify Student Academic View reflects graded status
    // -------------------------------------------------------------------
    console.log('[STEP 5] Verifying student academic assessment list reflects live state...');
    const studentAssessRes = await req(`${API_BASE}/assessments/my`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    if (!studentAssessRes.ok) {
      throw new Error(`Student get assessments failed: ${JSON.stringify(studentAssessRes.data)}`);
    }

    const allStudentItems = studentAssessRes.data?.data?.assessments || [];
    const gradedQuizItem = allStudentItems.find((a) => String(a.id || a.assessmentId) === String(quiz._id));
    const gradedAssignItem = allStudentItems.find((a) => String(a.id || a.assessmentId) === String(lateAssignment._id));

    console.log(`  -> Student Quiz status pill: ${gradedQuizItem?.status}`);
    console.log(`  -> Student Assignment status pill: ${gradedAssignItem?.status}, Score: ${gradedAssignItem?.score}`);

    if (gradedQuizItem?.status !== 'Graded') {
      throw new Error(`Expected Quiz status 'Graded', got '${gradedQuizItem?.status}'`);
    }
    if (gradedAssignItem?.status !== 'Graded' || gradedAssignItem?.score !== 88) {
      throw new Error(`Expected Assignment status 'Graded' with score 88, got '${gradedAssignItem?.status}', score: ${gradedAssignItem?.score}`);
    }
    console.log('  -> [PASS] Student academic view reflects Graded pills and live scores.\n');

    console.log('========================================================================');
    console.log('PHASE 9 VERIFICATION COMPLETE: ALL ASSESSMENTS & GRADING ASSERTIONS PASSED!');
    console.log('========================================================================');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  }
}

runPhase9Test().catch((err) => {
  console.error('\n[PHASE 9 TEST FAILED]', err);
  process.exit(1);
});
