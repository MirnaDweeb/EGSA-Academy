require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { TRACKS, LEVEL_LABELS, CURRENCY } = require('./data/officialCourseCatalog');

// Core Models
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const StudentReference = require('../models/StudentReference');
const InstructorProfile = require('../models/InstructorProfile');
const LearningGoal = require('../models/LearningGoal');
const LearningPath = require('../models/LearningPath');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const CourseBundle = require('../models/CourseBundle');
const ReadinessQuestion = require('../models/ReadinessQuestion');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const EnrollmentReference = require('../models/EnrollmentReference');
const Invoice = require('../models/Invoice');
const PaymentTransaction = require('../models/PaymentTransaction');
const Notification = require('../models/Notification');
const TrainingSession = require('../models/TrainingSession');
const Session = require('../models/Session');
const AttendanceRecord = require('../models/AttendanceRecord');
const Attendance = require('../models/Attendance');
const AttendanceDispute = require('../models/AttendanceDispute');
const Media = require('../models/Media');
const Assessment = require('../models/Assessment');
const AssessmentResult = require('../models/AssessmentResult');
const AssessmentSubmission = require('../models/AssessmentSubmission');
const Assignment = require('../models/Assignment');
const Certificate = require('../models/Certificate');
const ProgramAssessment = require('../models/ProgramAssessment');
const StudentSubmission = require('../models/StudentSubmission');
const Evaluation = require('../models/Evaluation');
const AdminScope = require('../models/AdminScope');
const AuditLog = require('../models/AuditLog');
const SystemConfig = require('../models/SystemConfig');

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[()'’&]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function seed() {
  await connectDB();
  console.log('[SEED] Clearing all existing database collections...');
  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    StudentReference.deleteMany({}),
    InstructorProfile.deleteMany({}),
    LearningGoal.deleteMany({}),
    LearningPath.deleteMany({}),
    Course.deleteMany({}),
    Cohort.deleteMany({}),
    CourseBundle.deleteMany({}),
    ReadinessQuestion.deleteMany({}),
    ReadinessAttempt.deleteMany({}),
    Application.deleteMany({}),
    Enrollment.deleteMany({}),
    EnrollmentReference.deleteMany({}),
    Invoice.deleteMany({}),
    PaymentTransaction.deleteMany({}),
    Notification.deleteMany({}),
    TrainingSession.deleteMany({}),
    Session.deleteMany({}),
    AttendanceRecord.deleteMany({}),
    Attendance.deleteMany({}),
    AttendanceDispute.deleteMany({}),
    Media.deleteMany({}),
    Assessment.deleteMany({}),
    AssessmentResult.deleteMany({}),
    AssessmentSubmission.deleteMany({}),
    Assignment.deleteMany({}),
    Certificate.deleteMany({}),
    ProgramAssessment.deleteMany({}),
    StudentSubmission.deleteMany({}),
    Evaluation.deleteMany({}),
    AdminScope.deleteMany({}),
    AuditLog.deleteMany({}),
    SystemConfig.deleteMany({}),
  ]);

  // Seed Institutional System Configuration Singleton
  await SystemConfig.create({
    seatReservationHours: 72,
    minimumAttendanceGate: 85,
    passingAssessmentThreshold: 70,
    academicYear: '2026/2027',
    institutionName: 'Egyptian Space Agency (EgSA) Space Academy',
  });

  // =====================================================================
  // 1. Seed Required Users (Students, Instructors, Admin) with Password123!
  // =====================================================================
  console.log('[SEED] Provisioning required users & profiles...');

  // 1. Student (University): Omar Hassan
  const student1 = await User.create({
    fullName: 'Omar Hassan',
    email: 'omar.student@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201011112233',
    nationalId: '29801011234567',
    role: 'student',
    accountStatus: 'active',
    isEmailVerified: true,
    registrationNumber: 'EGSA-2026-1001',
    preferredLanguage: 'en',
    division: 'UNIVERSITY',
  });

  await StudentProfile.create({
    user: student1._id,
    status: 'student',
    profileCompleted: true,
    division: 'UNIVERSITY',
    university: 'Cairo University',
    faculty: 'Faculty of Engineering',
    department: 'Aerospace Engineering',
    academicYear: 'Senior (4th Year)',
    experience: ['RF Circuits', 'Basic Signal Processing', 'Aerospace Dynamics'],
    personalInfo: {
      nationalId: '29801011234567',
      dateOfBirth: new Date('2001-01-10'),
      gender: 'male',
      phone: '+201011112233',
      address: 'Giza, Egypt',
      guardianContact: { name: 'Hassan Mohamed', phone: '+201011112200', relation: 'Father' },
    },
    academicInfo: {
      institutionName: 'Cairo University',
      faculty: 'Faculty of Engineering',
      department: 'Aerospace Engineering',
      studyYear: 'Senior (4th Year)',
      graduationYear: 2026,
    },
    spaceExperience: {
      backgroundSummary: 'Participated in university aerospace dynamics lab and RF signal telemetry.',
      technicalSkills: ['RF Circuits', 'Basic Signal Processing', 'Aerospace Dynamics', 'MATLAB'],
      completedExternalCourses: ['Space Technology Fundamentals Workshop 2025'],
    },
  });

  const studentRef1 = await StudentReference.create({
    externalStudentId: String(student1._id),
    name: student1.fullName,
    email: student1.email,
  });

  // 1B. Student (University): Youssef Mohamed
  const studentYoussef = await User.create({
    fullName: 'Youssef Mohamed',
    email: 'youssef.student@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201098765432',
    nationalId: '29810151234567',
    role: 'student',
    accountStatus: 'active',
    isEmailVerified: true,
    registrationNumber: 'EGSA-2026-1011',
    preferredLanguage: 'en',
    division: 'UNIVERSITY',
  });

  await StudentProfile.create({
    user: studentYoussef._id,
    status: 'student',
    profileCompleted: true,
    division: 'UNIVERSITY',
    university: 'Ain Shams University',
    faculty: 'Faculty of Engineering',
    department: 'Aerospace & Aeronautical Systems',
    academicYear: 'Senior (4th Year)',
    experience: ['CanSat Avionics Sub-system', 'CubeSat Bus Architecture', 'Flight Telemetry Software'],
    skills: ['Orbital Mechanics', 'C++', 'MATLAB/Simulink', 'Telemetry Analysis', 'CanSat Avionics', 'RTOS'],
    personalInfo: {
      nationalId: '29810151234567',
      dateOfBirth: new Date('2002-05-14'),
      gender: 'male',
      phone: '+201098765432',
      address: 'Nasr City, Cairo, Egypt',
      guardianContact: { name: 'Mohamed Adel', phone: '+201098765430', relation: 'Father' },
    },
    academicInfo: {
      institutionName: 'Ain Shams University',
      faculty: 'Faculty of Engineering',
      department: 'Aerospace & Aeronautical Systems',
      studyYear: 'Senior (4th Year)',
      graduationYear: 2026,
      studentIdCardUrl: 'https://cdn.egsa.gov.eg/docs/ids/youssef_student_id.pdf',
    },
    spaceExperience: {
      backgroundSummary: 'Lead avionics sub-team member for Egyptian Universities CanSat competition; focused on telemetry packets and telemetry flight software in C++.',
      technicalSkills: ['Orbital Mechanics', 'C++', 'MATLAB/Simulink', 'Telemetry Analysis', 'CanSat Avionics', 'RTOS'],
      completedExternalCourses: ['EgSA Satellite Engineering Fundamentals 2024', 'NASA Open Science Data Literacy'],
      portfolioUrl: 'https://github.com/youssef-egsa/space-avionics-portfolio',
    },
  });

  const studentRefYoussef = await StudentReference.create({
    externalStudentId: String(studentYoussef._id),
    name: studentYoussef.fullName,
    email: studentYoussef.email,
  });

  // 2. Student (Pre-University): Mariam Khaled
  const student2 = await User.create({
    fullName: 'Mariam Khaled',
    email: 'mariam.cadet@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201022223344',
    nationalId: '29905051234568',
    role: 'student',
    accountStatus: 'active',
    isEmailVerified: true,
    registrationNumber: 'EGSA-2026-1002',
    preferredLanguage: 'en',
    division: 'PRE_UNIVERSITY',
  });

  await StudentProfile.create({
    user: student2._id,
    status: 'student',
    profileCompleted: true,
    division: 'PRE_UNIVERSITY',
    university: 'Pre-University Division',
    faculty: 'STEM Space Cadets Academy',
    department: 'Avionics & Space Sciences',
    academicYear: 'Grade 12 (Pre-College)',
    experience: ['Basic STEM Physics', 'Introductory Electronics'],
    personalInfo: {
      nationalId: '29905051234568',
      dateOfBirth: new Date('2008-05-05'),
      gender: 'female',
      phone: '+201022223344',
      address: 'New Cairo, Egypt',
      guardianContact: { name: 'Khaled Mahmoud', phone: '+201022223300', relation: 'Father' },
    },
    academicInfo: {
      institutionName: 'Pre-University Division',
      faculty: 'STEM Space Cadets Academy',
      department: 'Avionics & Space Sciences',
      studyYear: 'Grade 12 (Pre-College)',
      graduationYear: 2026,
    },
    spaceExperience: {
      backgroundSummary: 'High school space enthusiast focusing on STEM physics and introductory electronics.',
      technicalSkills: ['Basic STEM Physics', 'Introductory Electronics', 'Arduino'],
      completedExternalCourses: ['Junior Astronaut Workshop 2025'],
    },
  });

  const studentRef2 = await StudentReference.create({
    externalStudentId: String(student2._id),
    name: student2.fullName,
    email: student2.email,
  });

  // 2B. Student (Pre-University): Nour Mansour
  const studentNour = await User.create({
    fullName: 'Nour Mansour',
    email: 'nour.cadet@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201123456789',
    nationalId: '30704041234568',
    role: 'student',
    accountStatus: 'active',
    isEmailVerified: true,
    registrationNumber: 'EGSA-2026-1012',
    preferredLanguage: 'en',
    division: 'PRE_UNIVERSITY',
  });

  await StudentProfile.create({
    user: studentNour._id,
    status: 'student',
    profileCompleted: true,
    division: 'PRE_UNIVERSITY',
    university: 'Maadi STEM High School for Girls',
    faculty: 'Pre-University Cadets Division',
    department: 'Space Science & Rocketry Club',
    academicYear: 'Grade 11',
    experience: ['Model Rocketry Payload System', 'Arduino Sensor Suite'],
    skills: ['Arduino C', 'Python Basics', 'Model Rocketry', 'Physics Simulations', 'Sensor Calibration'],
    personalInfo: {
      nationalId: '30704041234568',
      dateOfBirth: new Date('2007-04-04'),
      gender: 'female',
      phone: '+201123456789',
      address: 'Maadi, Cairo, Egypt',
      guardianContact: { name: 'Mansour Tarek', phone: '+201123456700', relation: 'Father' },
    },
    academicInfo: {
      institutionName: 'Maadi STEM High School for Girls',
      faculty: 'Pre-University Cadets Division',
      department: 'Space Science & Rocketry Club',
      studyYear: 'Grade 11',
      graduationYear: 2027,
      studentIdCardUrl: 'https://cdn.egsa.gov.eg/docs/ids/nour_cadet_id.pdf',
    },
    spaceExperience: {
      backgroundSummary: 'High school rocketry finalist, designed model solid rocket motor casing and payload deployment sensor with Arduino.',
      technicalSkills: ['Arduino C', 'Python Basics', 'Model Rocketry', 'Physics Simulations', 'Sensor Calibration'],
      completedExternalCourses: ['EgSA Junior Space Camp 2024', 'Intro to Astronomy by Planetarium Science Center'],
      portfolioUrl: 'https://github.com/nour-space-cadet/science-fair-rocketry',
    },
  });

  await StudentReference.create({
    externalStudentId: String(studentNour._id),
    name: studentNour.fullName,
    email: studentNour.email,
  });

  // 3. Instructor: Eng. Tarek ElKady
  const instructor1 = await User.create({
    fullName: 'Eng. Tarek ElKady',
    email: 'tarek.instructor@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201033334455',
    nationalId: '28503031234569',
    role: 'instructor',
    accountStatus: 'active',
    isEmailVerified: true,
    preferredLanguage: 'en',
  });

  await InstructorProfile.create({
    user: instructor1._id,
    division: 'UNIVERSITY',
    divisions: ['UNIVERSITY', 'PRE_UNIVERSITY'],
    title: 'Senior Ground Station & Telemetry Lead',
    specialization: 'CubeSat Satellite Communications & Earth Tracking',
    bio: 'Lead engineer for orbital telemetry operations and satellite ground tracking at the Egyptian Space Agency.',
    phone: instructor1.phone,
  });

  // Secondary Instructor: Dr. Amr Mohamed
  const instructor2 = await User.create({
    fullName: 'Dr. Amr Mohamed',
    email: 'dr.amr@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201044445566',
    nationalId: '27807071234570',
    role: 'instructor',
    accountStatus: 'active',
    isEmailVerified: true,
    preferredLanguage: 'en',
  });

  await InstructorProfile.create({
    user: instructor2._id,
    division: 'UNIVERSITY',
    divisions: ['UNIVERSITY', 'PRE_UNIVERSITY'],
    title: 'Director of Space Robotics Laboratory',
    specialization: 'Autonomous Orbital Manipulators & Space Avionics',
    bio: 'Ph.D. in Space Systems Engineering with over 15 years specializing in microgravity robotic manipulators and avionics buses.',
    phone: instructor2.phone,
  });

  // 4. University Admin: Sara Mostafa
  const adminUser = await User.create({
    fullName: 'Sara Mostafa',
    email: 'sara.univadmin@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201055556677',
    nationalId: '29209091234571',
    role: 'admin',
    division: 'UNIVERSITY',
    accountStatus: 'active',
    isEmailVerified: true,
    preferredLanguage: 'en',
  });

  await AdminScope.create({
    user: adminUser._id,
    division: 'UNIVERSITY',
  });

  // 5. Super Admin: Eng. Ayman Ahmed
  const superAdminUser = await User.create({
    fullName: 'Eng. Ayman Ahmed',
    email: 'ayman.superadmin@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201066667788',
    nationalId: '28101011234575',
    role: 'SUPER_ADMIN',
    accountStatus: 'active',
    isEmailVerified: true,
    preferredLanguage: 'en',
  });

  // 6. Pre-University Admin: Eng. Noha Farouk
  const preUnivAdminUser = await User.create({
    fullName: 'Eng. Noha Farouk',
    email: 'noha.preunivadmin@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201077778899',
    nationalId: '29308081234588',
    role: 'admin',
    division: 'PRE_UNIVERSITY',
    accountStatus: 'active',
    isEmailVerified: true,
    preferredLanguage: 'en',
  });

  await AdminScope.create({
    user: preUnivAdminUser._id,
    division: 'PRE_UNIVERSITY',
  });

  // Backwards-compatible aliases for previous automated scripts
  await User.create({
    fullName: 'Omar Hassan (Alias)',
    email: 'omar.hassan@eng.cu.edu.eg',
    password: 'Password123!',
    phone: '+201011112299',
    nationalId: '29801011234599',
    role: 'student',
    accountStatus: 'active',
    isEmailVerified: true,
  });

  await User.create({
    fullName: 'Mariam Khaled (Alias)',
    email: 'mariam.khaled@eng.asu.edu.eg',
    password: 'Password123!',
    phone: '+201022223398',
    nationalId: '29905051234598',
    role: 'student',
    accountStatus: 'active',
    isEmailVerified: true,
  });

  await User.create({
    fullName: 'Eng. Tarek ElKady (Alias)',
    email: 'tarek.elkady@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201033334497',
    nationalId: '28503031234597',
    role: 'instructor',
    accountStatus: 'active',
    isEmailVerified: true,
  });

  await User.create({
    fullName: 'Sara Mostafa (Alias)',
    email: 'sara.mostafa@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201055556696',
    nationalId: '29209091234596',
    role: 'admin',
    accountStatus: 'active',
    isEmailVerified: true,
  });

  const demoStudent = await User.create({
    fullName: 'Sara Ahmed',
    email: 'sara.demo@egsa-academy.example',
    password: 'Password123!',
    phone: '+201099887766',
    nationalId: '29812121234572',
    role: 'student',
    accountStatus: 'active',
    isEmailVerified: true,
    registrationNumber: 'EGSA-2026-1003',
  });

  await StudentReference.create({
    externalStudentId: String(demoStudent._id),
    name: demoStudent.fullName,
    email: demoStudent.email,
  });

  const aliWaitlist = await User.create({
    fullName: 'Ali Nour',
    email: 'ali.waitlist@egsa.gov.eg',
    password: 'Password123!',
    phone: '+201099112233',
    nationalId: '29903031234588',
    role: 'student',
    accountStatus: 'active',
    isEmailVerified: true,
    registrationNumber: 'EGSA-2026-1004',
    division: 'UNIVERSITY',
  });

  await StudentProfile.create({
    user: aliWaitlist._id,
    status: 'student',
    profileCompleted: true,
    division: 'UNIVERSITY',
    university: 'Ain Shams University',
    faculty: 'Faculty of Engineering',
    degreeLevel: 'undergraduate',
    department: 'Aerospace Engineering',
    currentYear: '3rd Year',
    graduationYear: 2027,
  });

  const demoAdmin = await User.create({
    fullName: 'Platform Administrator',
    email: 'admin@egsa-academy.example',
    password: 'AdminPass123!',
    phone: '+201088776655',
    nationalId: '28001011234573',
    role: 'admin',
    accountStatus: 'active',
    isEmailVerified: true,
  });

  // =====================================================================
  // 2. Seed Learning Goals
  // =====================================================================
  console.log('[SEED] Creating learning goals...');
  await LearningGoal.insertMany([
    { key: 'space-tech', title: 'Explore Space Technologies', description: 'General introduction to space systems and mission technology.', icon: 'fa-rocket' },
    { key: 'advanced-tech', title: 'Learn Advanced/Embedded Technologies', description: 'Programming, embedded systems, and AI engineering.', icon: 'fa-microchip' },
    { key: 'cybersecurity', title: 'Learn Cybersecurity', description: 'IT security fundamentals through advanced governance.', icon: 'fa-shield-halved' },
    { key: 'remote-sensing', title: 'Learn Remote Sensing & Geospatial Analytics', description: 'Earth observation, GIS, and geospatial data analysis.', icon: 'fa-globe' },
    { key: 'electronics', title: 'Learn Electronics & Technology Manufacturing', description: 'Circuit design, PCB, and hardware production.', icon: 'fa-bolt' },
    { key: 'environment', title: 'Learn Environment & Space Weather', description: 'Environmental science and space-weather resilience.', icon: 'fa-cloud-bolt' },
    { key: 'robotics', title: 'Learn Robotics & Autonomous Systems', description: 'Mechatronics through autonomous mission systems.', icon: 'fa-robot' },
    { key: 'entrepreneurship', title: 'Learn Technology Entrepreneurship', description: 'Turning technology innovation into ventures.', icon: 'fa-lightbulb' },
    { key: 'project-management', title: 'Learn Project & Program Management', description: 'Project, program, and portfolio management.', icon: 'fa-diagram-project' },
    { key: 'unsure', title: "I'm not sure yet", description: 'Explore all tracks before committing.', icon: 'fa-question' },
  ]);

  // =====================================================================
  // 3. Seed Courses: 2 Pre-University & 2 University (Phase 2A Specification)
  // =====================================================================
  console.log('[SEED] Creating Phase 2A courses (2 Pre-University & 2 University)...');

  // University Course 1: CubeSat Telemetry & Ground Stations
  const course1 = await Course.create({
    title: 'CubeSat Telemetry & Ground Stations',
    titleEn: 'CubeSat Telemetry & Ground Stations',
    slug: 'cubesat-telemetry-ground-stations',
    category: 'Space Technologies',
    division: 'UNIVERSITY',
    level: 'Intermediate',
    levelTier: 2,
    duration: 10,
    price: 3500,
    basePrice: 3500,
    currency: 'EGP',
    capacity: 25,
    targetAudience: 'Undergraduate Engineering Students (Aerospace, Communications, Electronics)',
    minExperience: 'Knowledge of RF principles, circuits, and signals',
    prerequisites: [],
    readinessThreshold: 70,
    instructor: instructor1.fullName,
    location: 'EGSA Main Ground Station & Tracking Facility, Cairo',
    published: true,
    active: true,
    isActive: true,
    status: 'Open',
    contentStatus: 'Published',
    overview: 'Comprehensive hands-on training program covering CubeSat communication architectures, RF link budgeting, Doppler tracking, AX.25 telemetry packet extraction, and SDR satellite ground reception.',
    whyThisCourse: 'Provides practical flight telemetry operations experience essential for aerospace communication engineers.',
    whoIsItFor: 'Aerospace, electronics, and telecommunications undergraduate cadets.',
    modules: [
      { day: 1, title: 'Satellite Telemetry Fundamentals & Frequency Spectrum', focus: 'RF Architecture', activities: ['Link budget formulation', 'Atmospheric loss calculations'] },
      { day: 2, title: 'Ground Station Antennas & Rotor Tracking', focus: 'Antenna Arrays', activities: ['Azimuth/Elevation rotor alignment', 'Crossed Yagi phasing'] },
      { day: 3, title: 'Software Defined Radio (SDR) Demodulation', focus: 'SDR Processing', activities: ['GNU Radio pipeline design', 'Downlink carrier tracking'] },
      { day: 4, title: 'Doppler Shift Correction & Low-Orbit Satellite Passes', focus: 'Real-Time Tracking', activities: ['Automated Doppler retuning', 'Live TLE propagation'] },
      { day: 5, title: 'AX.25 Telemetry Framing & Packet Decoding', focus: 'Data Protocols', activities: ['Packet parsing', 'Subsystem housekeeping telemetry decoding'] },
      { day: 6, title: 'Automated Ground Station Automation & Webhooks', focus: 'Network Infrastructure', activities: ['Remote TCP server configuration', 'Alert triggering'] },
      { day: 7, title: 'Telemetry Telecommand (TM/TC) Security & Encryption', focus: 'Command Uplink Security', activities: ['AES-GCM command authentication', 'Key management'] },
      { day: 8, title: 'Cleanroom Flight Hardware Integration Testing', focus: 'Cleanroom Operations', activities: ['Receiver sensitivity measurement', 'Noise figure testing'] },
      { day: 9, title: 'Simulated CubeSat Pass Drill & Anomaly Detection', focus: 'Operations Drill', activities: ['Tumble anomaly recovery', 'Weak signal extraction'] },
      { day: 10, title: 'Capstone Telemetry Station Defense & Certification', focus: 'Defense & Review', activities: ['Live satellite tracking defense', 'Final technical review'] },
    ],
  });

  // University Course: Satellite Systems Fundamentals (Recommended Preparatory Foundation Course)
  const courseSatelliteFundamentals = await Course.create({
    title: 'Satellite Systems Fundamentals',
    titleEn: 'Satellite Systems Fundamentals',
    slug: 'satellite-systems-fundamentals',
    category: 'Space Technologies',
    division: 'UNIVERSITY',
    level: 'Foundation',
    levelTier: 1,
    duration: 5,
    price: 1500,
    basePrice: 1500,
    currency: 'EGP',
    capacity: 35,
    targetAudience: 'Engineering undergraduates and cadets needing core foundations in satellite subsystems',
    minExperience: 'Introductory physics and basic circuits',
    prerequisites: [],
    readinessThreshold: 60,
    instructor: instructor1.fullName,
    location: 'EGSA Main Academic Lecture Hall, Cairo',
    published: true,
    active: true,
    isActive: true,
    status: 'Open',
    contentStatus: 'Published',
    overview: 'Introductory foundation covering satellite subsystems: Electrical Power Systems (EPS), telemetry architectures, orbital geometry, and payload integration.',
    whyThisCourse: 'Essential preparatory training bridge before enrolling in advanced telemetry and power courses.',
    whoIsItFor: 'Students with technical gaps in power systems, RF, or orbital mechanics.',
    modules: [
      { day: 1, title: 'Introduction to Space Environments & Orbits', focus: 'Astrodynamics', activities: ['Orbital mechanics basics', 'Eclipse calculations'] },
      { day: 2, title: 'Satellite Subsystem Architectures', focus: 'System Engineering', activities: ['Bus integration', 'Payload interfaces'] },
      { day: 3, title: 'Electrical Power Subsystems (EPS) Fundamentals', focus: 'Power Systems', activities: ['Solar cell I-V curves', 'Battery balancing'] },
      { day: 4, title: 'Telemetry & Radio Communications', focus: 'RF & Data', activities: ['Link budget fundamentals', 'Packet structure'] },
      { day: 5, title: 'Mission Assurance & Satellite Operations', focus: 'Operations', activities: ['Ground pass drills', 'Review & evaluation'] },
    ],
  });

  course1.recommendedPreviousCourses = [courseSatelliteFundamentals._id];
  await course1.save();

  // Seed question bank for CubeSat Telemetry & Ground Stations (EPS, Telemetry, Orbital Mechanics)
  console.log('[SEED] Seeding question bank for CubeSat Telemetry & Ground Stations (EPS, Telemetry, Orbital Mechanics)...');
  await ReadinessQuestion.insertMany([
    // Electrical Power Systems (EPS)
    {
      course: course1._id,
      topic: 'Electrical Power Systems (EPS)',
      questionText: 'What is the primary operational function of Maximum Power Point Tracking (MPPT) in a satellite Electrical Power System (EPS)?',
      question: 'What is the primary operational function of Maximum Power Point Tracking (MPPT) in a satellite Electrical Power System (EPS)?',
      options: [
        'Maximizing power extraction from photovoltaic solar arrays across varying orbital illumination angles',
        'Converting alternating current to direct current battery bus rails',
        'Preventing battery thermal runaway by automatically detaching non-essential scientific payloads',
        'Steering onboard magnetic torquers along geomagnetic lines',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Medium',
      weight: 1,
    },
    {
      course: course1._id,
      topic: 'Electrical Power Systems (EPS)',
      questionText: 'During orbital eclipse when solar panels produce zero current, which component powers the CubeSat subsystems?',
      question: 'During orbital eclipse when solar panels produce zero current, which component powers the CubeSat subsystems?',
      options: [
        'Secondary rechargeable lithium-ion battery pack',
        'Reverse-biased bypass diodes',
        'Radioisotope thermoelectric auxiliary decay unit',
        'Ground station RF wireless power beam',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Easy',
      weight: 1,
    },
    {
      course: course1._id,
      topic: 'Electrical Power Systems (EPS)',
      questionText: 'What protection system prevents catastrophic lithium battery cell degradation during prolonged CubeSat tumbling or low-generation orbits?',
      question: 'What protection system prevents catastrophic lithium battery cell degradation during prolonged CubeSat tumbling or low-generation orbits?',
      options: [
        'Under-Voltage Lockout / Low Voltage Disconnect (LVD)',
        'Automatic Doppler Frequency Discriminator',
        'Zenith-facing patch shunt',
        'Faraday cage isolator switch',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Medium',
      weight: 1,
    },
    {
      course: course1._id,
      topic: 'Electrical Power Systems (EPS)',
      questionText: 'What is the typical unregulated bus voltage range for a 3U CubeSat EPS with a 2S lithium battery configuration?',
      question: 'What is the typical unregulated bus voltage range for a 3U CubeSat EPS with a 2S lithium battery configuration?',
      options: [
        '6.0V to 8.4V',
        '24V to 28V',
        '1.2V to 2.4V',
        '48V to 54V',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Hard',
      weight: 1,
    },

    // Telemetry & Communications
    {
      course: course1._id,
      topic: 'Telemetry & Communications',
      questionText: 'Which data link framing protocol is universally standard in educational CubeSat downlink packets?',
      question: 'Which data link framing protocol is universally standard in educational CubeSat downlink packets?',
      options: [
        'AX.25 packet radio protocol',
        'TCP/IP over Ethernet 802.3',
        'Modbus Industrial RTU',
        'HTTP REST envelope',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Easy',
      weight: 1,
    },
    {
      course: course1._id,
      topic: 'Telemetry & Communications',
      questionText: 'What physical phenomenon shifts the received RF frequency higher as a LEO satellite approaches and lower as it recedes?',
      question: 'What physical phenomenon shifts the received RF frequency higher as a LEO satellite approaches and lower as it recedes?',
      options: [
        'Doppler Shift',
        'Faraday Rotation',
        'Ionospheric Scintillation',
        'Atmospheric Rayleigh Scattering',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Easy',
      weight: 1,
    },
    {
      course: course1._id,
      topic: 'Telemetry & Communications',
      questionText: 'In link budget analysis, which factor contributes most heavily to free-space signal attenuation for a 437 MHz UHF CubeSat downlink?',
      question: 'In link budget analysis, which factor contributes most heavily to free-space signal attenuation for a 437 MHz UHF CubeSat downlink?',
      options: [
        'Free Space Path Loss (FSPL) proportional to slant range distance squared',
        'Rain fade and oxygen molecular absorption resonance',
        'Thermal noise inside the solar cell glass coating',
        'Battery internal impedance fluctuations',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Medium',
      weight: 1,
    },
    {
      course: course1._id,
      topic: 'Telemetry & Communications',
      questionText: 'Why do UHF/VHF satellite ground stations deploy circularly polarized crossed-Yagi antennas instead of linear dipoles?',
      question: 'Why do UHF/VHF satellite ground stations deploy circularly polarized crossed-Yagi antennas instead of linear dipoles?',
      options: [
        'To eliminate polarization mismatch loss caused by satellite tumbling and Faraday rotation',
        'To increase transmission bandwidth by a factor of four',
        'To shield the receiver from terrestrial Wi-Fi interference',
        'To allow passive solar thermal heating of the feedline',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Hard',
      weight: 1,
    },

    // Orbital Mechanics
    {
      course: course1._id,
      topic: 'Orbital Mechanics',
      questionText: 'What data structure is standard for tracking CubeSat orbital positions across ground station rotors?',
      question: 'What data structure is standard for tracking CubeSat orbital positions across ground station rotors?',
      options: [
        'Two-Line Element set (TLE / NORAD Ephemeris)',
        'GPS NMEA-0183 GGA sentence',
        'Mercator Projection Matrix',
        'Geostationary Slot Catalog ID',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Easy',
      weight: 1,
    },
    {
      course: course1._id,
      topic: 'Orbital Mechanics',
      questionText: 'What is the approximate orbital period for a CubeSat orbiting in Low Earth Orbit (LEO) at ~500 km altitude?',
      question: 'What is the approximate orbital period for a CubeSat orbiting in Low Earth Orbit (LEO) at ~500 km altitude?',
      options: [
        '90 to 95 minutes',
        '24 hours (1 solar day)',
        '12 hours',
        '45 minutes',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Medium',
      weight: 1,
    },
    {
      course: course1._id,
      topic: 'Orbital Mechanics',
      questionText: 'Which Keplerian orbital element dictates the orientation of the orbital plane with respect to Earth equator?',
      question: 'Which Keplerian orbital element dictates the orientation of the orbital plane with respect to Earth equator?',
      options: [
        'Inclination (i)',
        'Semi-Major Axis (a)',
        'Argument of Perigee (omega)',
        'Mean Anomaly (M)',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Medium',
      weight: 1,
    },
    {
      course: course1._id,
      topic: 'Orbital Mechanics',
      questionText: 'What type of orbit precesses at exactly the same rate as the Earth revolves around the Sun, maintaining consistent local solar time?',
      question: 'What type of orbit precesses at exactly the same rate as the Earth revolves around the Sun, maintaining consistent local solar time?',
      options: [
        'Sun-Synchronous Orbit (SSO)',
        'Geostationary Earth Orbit (GEO)',
        'Molniya Orbit',
        'Lagrange Point Halo Orbit',
      ],
      correctOptionIndex: 0,
      correctAnswerIndex: 0,
      difficulty: 'Hard',
      weight: 1,
    },
  ]);

  // University Course 2: Advanced Satellite EPS (Requires CubeSat Telemetry as prerequisite)
  const courseAdvEps = await Course.create({
    title: 'Advanced Satellite EPS',
    titleEn: 'Advanced Satellite EPS',
    slug: 'advanced-satellite-eps',
    category: 'Electronics & Technology Manufacturing',
    division: 'UNIVERSITY',
    level: 'Advanced',
    levelTier: 4,
    duration: 12,
    price: 4200,
    basePrice: 4200,
    currency: 'EGP',
    capacity: 20,
    targetAudience: 'Senior Electrical, Aerospace, and Mechatronics Engineering Students',
    minExperience: 'Orbital power systems and completed CubeSat Telemetry',
    prerequisites: [course1._id],
    readinessThreshold: 75,
    instructor: instructor2.fullName,
    location: 'EGSA Space Cleanroom Power Bay, Cairo',
    published: true,
    active: true,
    isActive: true,
    status: 'Open',
    contentStatus: 'Published',
    overview: 'Design, thermal analysis, and flight testing of advanced CubeSat Electrical Power Subsystems (EPS) with Maximum Power Point Tracking (MPPT).',
    whyThisCourse: 'Essential qualification for high-reliability spacecraft power and battery system integration.',
    whoIsItFor: 'Senior engineering cadets specializing in space mission power hardware.',
    modules: [
      { day: 1, title: 'Solar Array Sizing & Solar Cell Space Degradation', focus: 'Solar Power', activities: ['Solar constant modeling', 'End-of-life efficiency derating'] },
      { day: 2, title: 'MPPT Architectures & Battery Charge Regulation', focus: 'Power Conditioning', activities: ['Buck-boost converter testing', 'CC/CV charge profile programming'] },
    ],
  });

  // Pre-University Course 1: CanSat Junior Rocketry
  const courseCanSat = await Course.create({
    title: 'CanSat Junior Rocketry',
    titleEn: 'CanSat Junior Rocketry',
    slug: 'cansat-junior-rocketry',
    category: 'Space Technologies',
    division: 'PRE_UNIVERSITY',
    level: 'Beginner',
    levelTier: 1,
    duration: 6,
    price: 1800,
    basePrice: 1800,
    currency: 'EGP',
    capacity: 30,
    targetAudience: 'Pre-University High School Students (Grades 10-12)',
    minExperience: 'High school STEM foundation and physics curiosity',
    prerequisites: [],
    readinessThreshold: 60,
    instructor: instructor1.fullName,
    location: 'EGSA Pre-University Youth Space Lab, Cairo',
    published: true,
    active: true,
    isActive: true,
    status: 'Open',
    contentStatus: 'Published',
    overview: 'Hands-on can-sized satellite prototyping, miniature sensor integration, atmospheric descent recovery, and telemetry transmission.',
    whyThisCourse: 'First-hand engineering experience launching real sensor payloads.',
    whoIsItFor: 'Secondary school students and STEM space cadets.',
    modules: [
      { day: 1, title: 'CanSat System Architecture & Payload Sizing', focus: 'Miniature Spacecraft', activities: ['Structure layout', 'Mass budget balancing'] },
      { day: 2, title: 'Sensors, Microcontrollers & Real-Time Telemetry', focus: 'Avionics', activities: ['Barometer calibration', 'Radio downlink configuration'] },
      { day: 3, title: 'Parachute Aerodynamics & Drop Deployment', focus: 'Recovery', activities: ['Descent velocity sizing', 'Tether testing'] },
    ],
  });

  // Pre-University Course 2: Space Robotics for Schools
  const courseRoboticsSchools = await Course.create({
    title: 'Space Robotics for Schools',
    titleEn: 'Space Robotics for Schools',
    slug: 'space-robotics-for-schools',
    category: 'Robotics & Autonomous Systems',
    division: 'PRE_UNIVERSITY',
    level: 'Foundation',
    levelTier: 1,
    duration: 8,
    price: 1500,
    basePrice: 1500,
    currency: 'EGP',
    capacity: 25,
    targetAudience: 'Pre-University Cadets & School Students (Grades 8-12)',
    minExperience: 'Introductory visual logic or beginner Arduino interest',
    prerequisites: [],
    readinessThreshold: 60,
    instructor: instructor2.fullName,
    location: 'EGSA Space Robotics Hub, Cairo',
    published: true,
    active: true,
    isActive: true,
    status: 'Open',
    contentStatus: 'Published',
    overview: 'Introduction to planetary rover locomotion, ultrasonic distance tracking, micro-servo robotic arms, and mission obstacle navigation.',
    whyThisCourse: 'Sparking early passion for space exploration robotics.',
    whoIsItFor: 'Middle and high school students passionate about space exploration.',
    modules: [
      { day: 1, title: 'Introduction to Planetary Rover Chassis & Motors', focus: 'Mechanical Mobility', activities: ['Differential drive assembly', 'Wheel traction tests'] },
      { day: 2, title: 'Ultrasonic Obstacle Avoidance & Autonomous Steering', focus: 'Sensor Integration', activities: ['Echo timing calculation', 'Obstacle bypass logic'] },
    ],
  });

  // Course 2: Space Robotics & Avionics
  const course2 = await Course.create({
    title: 'Space Robotics & Avionics',
    titleEn: 'Space Robotics & Avionics',
    slug: 'space-robotics-avionics',
    category: 'Robotics & Autonomous Systems',
    division: 'UNIVERSITY',
    level: 'Specialization/Integration/Applications',
    levelTier: 3,
    duration: 12,
    price: 4200,
    basePrice: 4200,
    currency: 'EGP',
    capacity: 20,
    targetAudience: 'Mechatronics, Computer Engineering, and Robotics Senior Students',
    minExperience: 'Microcontroller programming and linear algebra',
    prerequisites: [],
    readinessThreshold: 70,
    instructor: instructor2.fullName,
    location: 'EGSA Space Robotics & Microgravity Bay, Cairo',
    published: true,
    active: true,
    isActive: true,
    status: 'Open',
    contentStatus: 'Published',
    overview: 'Advanced hands-on program on space robotic arms, multi-DOF kinematic Jacobians, radiation-hardened microcontroller architectures, CAN/SpaceWire avionics, and fault-tolerant servo control in microgravity.',
    whyThisCourse: 'Essential training for engineers building orbital servicing robotics and high-reliability spacecraft avionics.',
    whoIsItFor: 'Mechatronics, computer engineering, and robotics senior students.',
    modules: [
      { day: 1, title: 'Spacecraft Avionics Bus Standards & CAN Protocol', focus: 'Avionics Buses', activities: ['CAN bus differential physical layer', 'Identifier priority analysis'] },
      { day: 2, title: 'Radiation-Tolerant Microcontroller Architectures', focus: 'Embedded Hardware', activities: ['SEU mitigation', 'Watchdog reset circuitry'] },
      { day: 3, title: 'Forward & Inverse Kinematics for Orbital Robotic Arms', focus: 'Kinematics', activities: ['DH parameter derivation', 'Workspace boundary mapping'] },
      { day: 4, title: 'Jacobian Velocity & Singularity Damping', focus: 'Trajectory Control', activities: ['Damped least-squares inversion', 'Singularity detection'] },
      { day: 5, title: 'Microgravity Robotic Simulation & Joint Torques', focus: 'Physics Simulation', activities: ['Zero-G dynamics modeling', 'Torque limit checking'] },
    ],
  });

  // Course 3: Orbital Mechanics
  const course3 = await Course.create({
    title: 'Orbital Mechanics',
    titleEn: 'Orbital Mechanics',
    slug: 'orbital-mechanics',
    category: 'Space Technologies',
    division: 'UNIVERSITY',
    level: 'Core Skills',
    levelTier: 2,
    duration: 8,
    price: 2800,
    basePrice: 2800,
    currency: 'EGP',
    capacity: 30,
    targetAudience: 'Aerospace, Mathematics, and Physics Undergraduate Cadets',
    minExperience: 'Calculus, differential equations, and classical mechanics',
    prerequisites: [],
    readinessThreshold: 70,
    instructor: instructor1.fullName,
    location: 'Astrodynamics Computer Simulation Lab, Cairo',
    published: true,
    active: true,
    isActive: true,
    status: 'Open',
    contentStatus: 'Published',
    overview: 'Rigorous course on Keplerian two-body problem, orbital perturbations (J2, atmospheric drag, solar radiation), Hohmann and bi-elliptic orbit transfers, constellation design, and numerical orbit propagation.',
    whyThisCourse: 'Fundamental mathematical foundation for space mission trajectory planning and orbital tracking.',
    whoIsItFor: 'Aerospace, mathematics, and physics undergraduate cadets.',
    modules: [
      { day: 1, title: 'Two-Body Orbital Equations & Kepler Laws', focus: 'Classical Astrodynamics', activities: ['Orbital element calculations', 'Vis-Viva equation modeling'] },
      { day: 2, title: 'Orbital Perturbations & J2 Earth Oblateness', focus: 'Non-Keplerian Effects', activities: ['Nodal regression calculations', 'Sun-synchronous orbit tuning'] },
      { day: 3, title: 'Hohmann & Bi-Elliptic Orbital Transfers', focus: 'Maneuver Planning', activities: ['Delta-V budgeting', 'Transfer trajectory simulation'] },
    ],
  });

  // Course 4: Payload Power Systems
  const course4 = await Course.create({
    title: 'Payload Power Systems',
    titleEn: 'Payload Power Systems',
    slug: 'payload-power-systems',
    category: 'Electronics & Technology Manufacturing',
    division: 'UNIVERSITY',
    level: 'Specialization/Integration/Applications',
    levelTier: 3,
    duration: 10,
    price: 3800,
    basePrice: 3800,
    currency: 'EGP',
    capacity: 25,
    targetAudience: 'Electrical, Power, and Hardware Engineering Students',
    minExperience: 'Electronic devices and circuit analysis',
    prerequisites: [],
    readinessThreshold: 70,
    instructor: instructor2.fullName,
    location: 'Cleanroom Power & Thermal Lab, Cairo',
    published: true,
    active: true,
    isActive: true,
    status: 'Open',
    contentStatus: 'Published',
    overview: 'Design, modeling, and flight validation of space payload electrical power systems (EPS), Maximum Power Point Tracking (MPPT), lithium iron phosphate battery protection, and space thermal regulation.',
    whyThisCourse: 'Prepares engineers to design resilient power systems that survive extreme eclipse thermal cycles in orbit.',
    whoIsItFor: 'Electrical, power, and hardware engineering students.',
    modules: [
      { day: 1, title: 'Solar Array Sizing & Solar Cell Space Degradation', focus: 'Solar Power', activities: ['Solar constant modeling', 'End-of-life efficiency derating'] },
      { day: 2, title: 'MPPT Architectures & Battery Charge Regulation', focus: 'Power Conditioning', activities: ['Buck-boost converter testing', 'CC/CV charge profile programming'] },
    ],
  });

  // Populate remainder of official catalog so exploration pages are populated
  for (const track of TRACKS) {
    for (const level of track.levels) {
      for (const c of level.courses) {
        if ([
          'CubeSat Telemetry & Ground Stations',
          'Advanced Satellite EPS',
          'CanSat Junior Rocketry',
          'Space Robotics for Schools',
          'Space Robotics & Avionics',
          'Orbital Mechanics',
          'Payload Power Systems',
        ].includes(c.title)) {
          continue;
        }
        await Course.create({
          title: c.title,
          titleEn: c.title,
          slug: slugify(`${track.category}-${c.title}`),
          category: track.category,
          level: LEVEL_LABELS[level.tier - 1],
          levelTier: level.tier,
          duration: c.days,
          price: c.price,
          currency: CURRENCY,
          published: true,
          active: true,
          isActive: true,
          status: 'Open',
          contentStatus: 'Published',
          instructor: 'EGSA Faculty',
        }).catch(() => {});
      }
    }
  }

  // =====================================================================
  // 4. Seed Cohorts & Enrollments for the Courses
  // =====================================================================
  console.log('[SEED] Creating cohorts and student enrollments...');

  // Cohort 1: CubeSat Telemetry
  const cohort1 = await Cohort.create({
    course: course1._id,
    instructor: instructor1._id,
    name: 'CubeSat Cohort Alpha-2026',
    startDate: new Date(Date.now() - 14 * 86400000),
    endDate: new Date(Date.now() + 30 * 86400000),
    capacity: 25,
    seatsTaken: 18,
    status: 'InProgress',
  });

  // Cohort 2: Space Robotics & Avionics
  const cohort2 = await Cohort.create({
    course: course2._id,
    instructor: instructor2._id,
    name: 'Avionics Batch Beta-2026',
    startDate: new Date(Date.now() - 10 * 86400000),
    endDate: new Date(Date.now() + 40 * 86400000),
    capacity: 20,
    seatsTaken: 14,
    status: 'InProgress',
  });

  // Cohort 3: Orbital Mechanics
  const cohort3 = await Cohort.create({
    course: course3._id,
    instructor: instructor1._id,
    name: 'Orbital Mechanics Batch Gamma-2026',
    startDate: new Date(Date.now() - 20 * 86400000),
    endDate: new Date(Date.now() + 20 * 86400000),
    capacity: 30,
    seatsTaken: 22,
    status: 'InProgress',
  });

  // Cohort 4: Payload Power Systems
  const cohort4 = await Cohort.create({
    course: course4._id,
    instructor: instructor2._id,
    name: 'Power Systems Delta-2026',
    startDate: new Date(Date.now() - 7 * 86400000),
    endDate: new Date(Date.now() + 45 * 86400000),
    capacity: 25,
    seatsTaken: 16,
    status: 'InProgress',
  });

  // Cohort 5: Advanced Satellite EPS
  const cohortAdvEps = await Cohort.create({
    course: courseAdvEps._id,
    instructor: instructor2._id,
    name: 'Advanced EPS Cohort Delta-2026',
    startDate: new Date(Date.now() + 10 * 86400000),
    endDate: new Date(Date.now() + 60 * 86400000),
    capacity: 20,
    seatsTaken: 5,
    status: 'Upcoming',
  });

  // Cohort 6: CanSat Junior Rocketry
  const cohortCanSat = await Cohort.create({
    course: courseCanSat._id,
    instructor: instructor1._id,
    name: 'CanSat Junior Cadet Batch 1',
    startDate: new Date(Date.now() + 7 * 86400000),
    endDate: new Date(Date.now() + 35 * 86400000),
    capacity: 30,
    seatsTaken: 12,
    status: 'Upcoming',
  });

  // Cohort 7: Space Robotics for Schools
  const cohortRoboticsSchools = await Cohort.create({
    course: courseRoboticsSchools._id,
    instructor: instructor2._id,
    name: 'School Robotics Pioneers Batch 1',
    startDate: new Date(Date.now() + 14 * 86400000),
    endDate: new Date(Date.now() + 45 * 86400000),
    capacity: 25,
    seatsTaken: 8,
    status: 'Upcoming',
  });

  // Applications & Enrollments for Student 1 (Omar Hassan) - Confirmed & Paid
  const appOmar1 = await Application.create({
    student: student1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Confirmed',
    submittedAt: new Date(Date.now() - 20 * 86400000),
  });
  const enrOmar1 = await Enrollment.create({
    student: student1._id,
    course: course1._id,
    cohort: cohort1._id,
    application: appOmar1._id,
    status: 'Confirmed',
    seatStatus: 'Confirmed',
    paymentStatus: 'Paid',
    enrollmentDate: new Date(Date.now() - 18 * 86400000),
  });
  await EnrollmentReference.create({
    student: studentRef1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'active',
  });

  // Invoice 1: Omar Hassan - Confirmed & Paid via Vodafone Cash
  const invOmar1 = await Invoice.create({
    invoiceNumber: 'INV-2026-0042',
    student: student1._id,
    application: appOmar1._id,
    cohort: cohort1._id,
    course: course1._id,
    amount: 3500,
    balanceDue: 0,
    dueAt: new Date(cohort1.startDate.getTime() - 72 * 3600 * 1000),
    status: 'Paid',
    paidAt: new Date(Date.now() - 18 * 86400000),
    paymentMethod: 'Vodafone Cash',
    notes: 'Tuition fully paid via official mobile wallet.',
  });
  await PaymentTransaction.create({
    transactionId: 'TXN-VODAFONE-998811',
    invoice: invOmar1._id,
    student: student1._id,
    amount: 3500,
    method: 'Vodafone Cash',
    externalReference: '01011112233',
    status: 'Success',
    notes: 'Institutional mobile wallet simulated payment confirmed.',
  });

  const appOmar2 = await Application.create({
    student: student1._id,
    course: course2._id,
    cohort: cohort2._id,
    status: 'Confirmed',
    submittedAt: new Date(Date.now() - 15 * 86400000),
  });
  const enrOmar2 = await Enrollment.create({
    student: student1._id,
    course: course2._id,
    cohort: cohort2._id,
    application: appOmar2._id,
    status: 'Confirmed',
    seatStatus: 'Confirmed',
    paymentStatus: 'Paid',
    enrollmentDate: new Date(Date.now() - 12 * 86400000),
  });
  await EnrollmentReference.create({
    student: studentRef1._id,
    course: course2._id,
    cohort: cohort2._id,
    status: 'active',
  });

  // Invoice 2: Omar Hassan - Course 2 Paid via InstaPay
  const invOmar2 = await Invoice.create({
    invoiceNumber: 'INV-2026-0043',
    student: student1._id,
    application: appOmar2._id,
    cohort: cohort2._id,
    course: course2._id,
    amount: 4200,
    balanceDue: 0,
    dueAt: new Date(cohort2.startDate.getTime() - 72 * 3600 * 1000),
    status: 'Paid',
    paidAt: new Date(Date.now() - 12 * 86400000),
    paymentMethod: 'InstaPay',
    notes: 'Paid via InstaPay network.',
  });
  await PaymentTransaction.create({
    transactionId: 'TXN-INSTAPAY-445522',
    invoice: invOmar2._id,
    student: student1._id,
    amount: 4200,
    method: 'InstaPay',
    externalReference: 'omar.hassan@instapay',
    status: 'Success',
    notes: 'InstaPay instant transfer confirmed.',
  });

  // Applications & Enrollments for Student 2 (Mariam Khaled)
  const appMariam1 = await Application.create({
    student: student2._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Confirmed',
    submittedAt: new Date(Date.now() - 22 * 86400000),
  });
  const enrMariam1 = await Enrollment.create({
    student: student2._id,
    course: course1._id,
    cohort: cohort1._id,
    application: appMariam1._id,
    status: 'Confirmed',
    seatStatus: 'Confirmed',
    paymentStatus: 'Paid',
    enrollmentDate: new Date(Date.now() - 19 * 86400000),
  });
  await EnrollmentReference.create({
    student: studentRef2._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'active',
  });

  const appMariam2 = await Application.create({
    student: student2._id,
    course: course3._id,
    cohort: cohort3._id,
    status: 'Confirmed',
    submittedAt: new Date(Date.now() - 25 * 86400000),
  });
  const enrMariam2 = await Enrollment.create({
    student: student2._id,
    course: course3._id,
    cohort: cohort3._id,
    application: appMariam2._id,
    status: 'Confirmed',
    seatStatus: 'Confirmed',
    paymentStatus: 'Paid',
    enrollmentDate: new Date(Date.now() - 21 * 86400000),
  });
  await EnrollmentReference.create({
    student: studentRef2._id,
    course: course3._id,
    cohort: cohort3._id,
    status: 'active',
  });

  // Demo user enrollment for course 1
  const appDemo = await Application.create({
    student: demoStudent._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Confirmed',
    submittedAt: new Date(Date.now() - 16 * 86400000),
  });
  await Enrollment.create({
    student: demoStudent._id,
    course: course1._id,
    cohort: cohort1._id,
    application: appDemo._id,
    status: 'Confirmed',
    seatStatus: 'Confirmed',
    paymentStatus: 'Paid',
    enrollmentDate: new Date(Date.now() - 15 * 86400000),
  });
  await EnrollmentReference.create({
    student: demoStudent._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'active',
  }).catch(() => {});

  // Youssef Mohamed (youssef.student@egsa.gov.eg) - Enrolled in CubeSat Telemetry & Ground Stations (Phase 6)
  const appYoussef1 = await Application.create({
    student: studentYoussef._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Confirmed',
    eligibilityStatus: 'Eligible',
    submittedAt: new Date(Date.now() - 15 * 86400000),
  });
  const enrYoussef1 = await Enrollment.create({
    student: studentYoussef._id,
    course: course1._id,
    cohort: cohort1._id,
    application: appYoussef1._id,
    status: 'Completed',
    seatStatus: 'Confirmed',
    paymentStatus: 'Paid',
    enrollmentDate: new Date(Date.now() - 14 * 86400000),
    evaluationCompleted: true,
    evaluationSubmittedAt: new Date(Date.now() - 2 * 86400000),
  });
  await EnrollmentReference.create({
    student: studentRefYoussef._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'active',
  }).catch(() => {});
  const invYoussef1 = await Invoice.create({
    invoiceNumber: 'INV-2026-0088',
    student: studentYoussef._id,
    application: appYoussef1._id,
    cohort: cohort1._id,
    course: course1._id,
    amount: 3500,
    balanceDue: 0,
    dueAt: new Date(cohort1.startDate.getTime() - 72 * 3600 * 1000),
    status: 'Paid',
    paidAt: new Date(Date.now() - 14 * 86400000),
    paymentMethod: 'InstaPay',
    notes: 'Paid in full via official InstaPay instant transfer.',
  });
  await PaymentTransaction.create({
    transactionId: 'TXN-INSTAPAY-YOUSSEF',
    invoice: invYoussef1._id,
    student: studentYoussef._id,
    amount: 3500,
    method: 'InstaPay',
    externalReference: 'youssef.mohamed@instapay',
    status: 'Success',
    notes: 'InstaPay transaction confirmed.',
  });

  // =====================================================================
  // Phase 3 Commercial & 72-Hour Rule Test Records:
  // 1. Mariam Khaled: Pending invoice with active > 72h countdown (CanSat Junior Rocketry)
  // 2. Overdue test cohort: Demo student with expired < 72h invoice + Waitlisted applicant
  // =====================================================================
  console.log('[SEED] Provisioning Phase 3 commercial invoices & 72-hour countdowns...');

  // Mariam Khaled: Pending Invoice with active countdown (> 72h)
  const appMariamCanSat = await Application.create({
    student: student2._id,
    course: courseCanSat._id,
    cohort: cohortCanSat._id,
    status: 'Eligible - Payment Pending',
    eligibilityStatus: 'Eligible',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 2 * 86400000),
  });
  const enrMariamCanSat = await Enrollment.create({
    student: student2._id,
    course: courseCanSat._id,
    cohort: cohortCanSat._id,
    application: appMariamCanSat._id,
    status: 'Hold',
    seatStatus: 'Hold',
    paymentStatus: 'Pending',
    enrollmentDate: new Date(Date.now() - 1 * 86400000),
  });
  const invMariamCanSat = await Invoice.create({
    invoiceNumber: 'INV-2026-0089',
    student: student2._id,
    application: appMariamCanSat._id,
    cohort: cohortCanSat._id,
    course: courseCanSat._id,
    amount: 1800,
    balanceDue: 1800,
    dueAt: new Date(cohortCanSat.startDate.getTime() - 72 * 3600 * 1000), // > 72 hours countdown!
    status: 'Pending',
    notes: 'Provisional seat reservation subject to official 72-hour payment window.',
  });

  // Overdue Test Cohort (Starts in 36h -> dueAt was 36h ago -> EXPIRED)
  const cohortOverdueTest = await Cohort.create({
    course: courseSatelliteFundamentals._id,
    instructor: instructor1._id,
    name: 'Satellite Systems Fundamentals - Commercial Deadline Test Batch',
    startDate: new Date(Date.now() + 36 * 3600 * 1000),
    endDate: new Date(Date.now() + 7 * 86400000),
    capacity: 25,
    seatsTaken: 1,
    status: 'Upcoming',
  });

  // Overdue Candidate: Sara Ahmed (demoStudent) with expired invoice (< 72h remaining / past dueAt)
  const appDemoOverdue = await Application.create({
    student: demoStudent._id,
    course: courseSatelliteFundamentals._id,
    cohort: cohortOverdueTest._id,
    status: 'Eligible - Payment Pending',
    eligibilityStatus: 'Eligible',
    submittedAt: new Date(Date.now() - 4 * 86400000),
  });
  const enrDemoOverdue = await Enrollment.create({
    student: demoStudent._id,
    course: courseSatelliteFundamentals._id,
    cohort: cohortOverdueTest._id,
    application: appDemoOverdue._id,
    status: 'Hold',
    seatStatus: 'Hold',
    paymentStatus: 'Pending',
    enrollmentDate: new Date(Date.now() - 4 * 86400000),
  });
  const invDemoOverdue = await Invoice.create({
    invoiceNumber: 'INV-2026-0099',
    student: demoStudent._id,
    application: appDemoOverdue._id,
    cohort: cohortOverdueTest._id,
    course: courseSatelliteFundamentals._id,
    amount: 1500,
    balanceDue: 1500,
    dueAt: new Date(Date.now() - 6 * 3600 * 1000), // Expired 6 hours ago!
    status: 'Pending',
    notes: 'Overdue commercial tuition payment. Seat scheduled for automatic release under 72h rule.',
  });

  // Waitlisted Applicant on same cohort ready for automated FIFO promotion
  const appAliWaitlist = await Application.create({
    student: aliWaitlist._id,
    course: courseSatelliteFundamentals._id,
    cohort: cohortOverdueTest._id,
    status: 'Waitlisted',
    eligibilityStatus: 'Eligible',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 3 * 86400000),
  });

  // University Pending Invoice ready for Tuition Waiver testing
  const appDemoWaiver = await Application.create({
    student: demoStudent._id,
    course: courseAdvEps._id,
    cohort: cohortAdvEps._id,
    status: 'Eligible - Payment Pending',
    eligibilityStatus: 'Eligible',
    submittedAt: new Date(Date.now() - 2 * 86400000),
  });
  const enrDemoWaiver = await Enrollment.create({
    student: demoStudent._id,
    course: courseAdvEps._id,
    cohort: cohortAdvEps._id,
    application: appDemoWaiver._id,
    status: 'Hold',
    seatStatus: 'Hold',
    paymentStatus: 'Pending',
    enrollmentDate: new Date(Date.now() - 1 * 86400000),
  });
  const invDemoWaiver = await Invoice.create({
    invoiceNumber: 'INV-2026-0076',
    student: demoStudent._id,
    application: appDemoWaiver._id,
    cohort: cohortAdvEps._id,
    course: courseAdvEps._id,
    amount: 4200,
    balanceDue: 4200,
    dueAt: new Date(Date.now() + 48 * 3600 * 1000), // active countdown
    status: 'Pending',
    notes: 'Awaiting institutional tuition payment or sponsorship waiver.',
  });
  enrDemoWaiver.invoice = invDemoWaiver._id;
  await enrDemoWaiver.save();

  // =====================================================================
  // Phase 2A Applications (Structured Admissions & Automated Eligibility)
  // =====================================================================
  console.log('[SEED] Creating Phase 2A applications (Eligible, Foundation Required, Manual Review)...');

  // Application 1: Fully eligible (Omar Hassan -> CubeSat Telemetry)
  await Application.create({
    student: student1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Eligible',
    eligibilityStatus: 'Eligible',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 2 * 86400000),
  });

  // Application 2: Triggering Foundation Required (Omar Hassan -> Advanced Satellite EPS)
  await Application.create({
    student: student1._id,
    course: courseAdvEps._id,
    cohort: cohortAdvEps._id,
    status: 'Foundation Required',
    eligibilityStatus: 'Foundation Required',
    missingRequirements: ['Missing mandatory prerequisite course(s): CubeSat Telemetry & Ground Stations'],
    submittedAt: new Date(Date.now() - 1 * 86400000),
  });

  // Application 3: Pre-University Manual Review (Mariam Khaled -> CubeSat Telemetry, division mismatch)
  await Application.create({
    student: student2._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Manual Review',
    eligibilityStatus: 'Manual Review',
    missingRequirements: [
      'Division mismatch: Applicant is enrolled in PRE_UNIVERSITY division, while target course is designated for UNIVERSITY. Requires Academic Affairs review.',
    ],
    submittedAt: new Date(Date.now() - 4 * 86400000),
  });

  // Phase 14 Seeded Applications: Division Admin Governance & Overrides
  // 1. University Application in Manual Review: Youssef Mohamed -> Advanced Satellite EPS
  const appYoussefManual = await Application.create({
    student: studentYoussef._id,
    course: courseAdvEps._id,
    cohort: cohortAdvEps._id,
    status: 'Manual Review',
    eligibilityStatus: 'Manual Review',
    missingRequirements: ['Prerequisite course clearance review required by Division Admin'],
    submittedAt: new Date(Date.now() - 3 * 86400000),
  });

  // 2. Pre-University Application: Nour Mansour -> CanSat Junior Rocketry
  const appNourPreUni = await Application.create({
    student: studentNour._id,
    course: courseCanSat._id,
    cohort: cohortCanSat._id,
    status: 'Submitted',
    eligibilityStatus: 'Submitted',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 1 * 86400000),
  });

  // =====================================================================
  // 5. Seed Sessions: 8 Structured Sessions for CubeSat Telemetry
  //    (2 Past Completed, 1 Live Today with Materials & Active QR, 5 Scheduled)
  // =====================================================================
  console.log('[SEED] Creating structured session schedule (Sessions 1 to 8 with topics & materials)...');

  // Past Session 1 (Completed 8 days ago)
  const pastDate1 = new Date(Date.now() - 8 * 86400000);
  const trainSess1 = await TrainingSession.create({
    course: course1._id,
    cohort: cohort1._id,
    sessionNumber: 1,
    title: 'Session 1: Ground Station Architecture & Orbital Antenna Tracking',
    topic: 'RF & Data',
    focus: 'Antenna Pointing & Rotors',
    activities: ['Azimuth-Elevation rotor calibration', 'Yagi-Uda phasing harness testing'],
    date: pastDate1,
    startTime: '10:00 AM',
    endTime: '02:00 PM',
    instructor: instructor1.fullName,
    location: 'EGSA Main Ground Station & Tracking Facility',
    classroom: 'Antenna Array Bay 1 & Rotor Pedestal',
    deliveryMode: 'Onsite',
    status: 'Completed',
    materials: [
      {
        title: 'RF Link Budget Engineering Slides.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/cubesat-rf-link-budget.pdf',
        type: 'PDF',
        size: '3.8 MB',
      },
      {
        title: 'Yagi Antenna Calibration Protocols.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/yagi-antenna-calibration.pdf',
        type: 'PDF',
        size: '2.1 MB',
      },
    ],
    attendanceWindow: {
      opensAt: new Date(pastDate1.getTime() - 15 * 60000),
      closesAt: new Date(pastDate1.getTime() + 4 * 3600000),
    },
    qrCode: {
      token: 'EGSA-QR-SESS-1-PAST',
      expiresAt: new Date(pastDate1.getTime() + 4 * 3600000),
      isActive: false,
    },
  });
  const sess1 = await Session.create({
    title: trainSess1.title,
    course: course1._id,
    cohort: cohort1._id,
    date: pastDate1,
    startTime: '10:00',
    endTime: '14:00',
    location: trainSess1.location,
    status: 'completed',
  });

  // Past Session 2 (Completed 5 days ago)
  const pastDate2 = new Date(Date.now() - 5 * 86400000);
  const trainSess2 = await TrainingSession.create({
    course: course1._id,
    cohort: cohort1._id,
    sessionNumber: 2,
    title: 'Session 2: Satellite Telemetry Demodulation & SDR Calibration',
    topic: 'Avionics',
    focus: 'SDR Receiver Tuning',
    activities: ['RTL-SDR & HackRF noise floor testing', 'GNU Radio block design'],
    date: pastDate2,
    startTime: '10:00 AM',
    endTime: '02:00 PM',
    instructor: instructor1.fullName,
    location: 'Cleanroom Telemetry Lab 3',
    classroom: 'Avionics SDR Integration Bench',
    deliveryMode: 'Onsite',
    status: 'Completed',
    materials: [
      {
        title: 'Software Defined Radio Telemetry Manual.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/sdr-telemetry-manual.pdf',
        type: 'PDF',
        size: '4.5 MB',
      },
      {
        title: 'AX.25 Packet Structure Guide.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/ax25-packet-guide.pdf',
        type: 'PDF',
        size: '1.9 MB',
      },
    ],
    attendanceWindow: {
      opensAt: new Date(pastDate2.getTime() - 15 * 60000),
      closesAt: new Date(pastDate2.getTime() + 4 * 3600000),
    },
    qrCode: {
      token: 'EGSA-QR-SESS-2-PAST',
      expiresAt: new Date(pastDate2.getTime() + 4 * 3600000),
      isActive: false,
    },
  });
  const sess2 = await Session.create({
    title: trainSess2.title,
    course: course1._id,
    cohort: cohort1._id,
    date: pastDate2,
    startTime: '10:00',
    endTime: '14:00',
    location: trainSess2.location,
    status: 'completed',
  });

  // Session 3: LIVE TODAY with Materials & Active QR Code
  const liveDateToday = new Date();
  const trainSess3 = await TrainingSession.create({
    course: course1._id,
    cohort: cohort1._id,
    sessionNumber: 3,
    title: 'Session 3: Live Doppler Frequency Correction & Downlink Packet Capture',
    topic: 'Telemetry',
    focus: 'Real-Time Satellite Orbit Pass',
    activities: ['Doppler shift frequency tracking', 'Real-time telemetry packet extraction'],
    date: liveDateToday,
    startTime: '10:00 AM',
    endTime: '03:00 PM',
    instructor: instructor1.fullName,
    location: 'EGSA Satellite Operations Control Room',
    classroom: 'Operations Console 4 & Live Tracking Desk',
    meetingUrl: 'https://meet.egsa.gov.eg/live-cubesat-pass',
    deliveryMode: 'Hybrid',
    status: 'In_Progress',
    actualStartTime: new Date(Date.now() - 30 * 60000),
    materials: [
      {
        title: 'Live Doppler Tracking Lab Guide.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/live-doppler-tracking-lab.pdf',
        type: 'PDF',
        size: '5.2 MB',
      },
      {
        title: 'CubeSat Real-Time Telemetry Flowchart.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/cubesat-telemetry-flowchart.pdf',
        type: 'PDF',
        size: '2.7 MB',
      },
    ],
    attendanceWindow: {
      opensAt: new Date(Date.now() - 60 * 60000),
      closesAt: new Date(Date.now() + 6 * 3600000),
    },
    qrCode: {
      token: 'EGSA-QR-CUBESAT-LIVE-2026',
      code: 'CSAT26',
      generatedAt: new Date(Date.now() - 30 * 60000),
      expiresAt: new Date(Date.now() + 6 * 3600000),
      isActive: true,
    },
  });
  const sess3 = await Session.create({
    title: trainSess3.title,
    course: course1._id,
    cohort: cohort1._id,
    instructor: instructor1._id,
    date: liveDateToday,
    startTime: '10:00',
    endTime: '15:00',
    actualStartTime: new Date(Date.now() - 30 * 60000),
    location: trainSess3.location,
    status: 'in_progress',
    qrCode: {
      token: 'EGSA-QR-CUBESAT-LIVE-2026',
      code: 'CSAT26',
      generatedAt: new Date(Date.now() - 30 * 60000),
      expiresAt: new Date(Date.now() + 6 * 3600000),
      isActive: true,
    },
  });

  // Scheduled Sessions 4 to 8 for CubeSat Telemetry
  const trainSess4 = await TrainingSession.create({
    course: course1._id,
    cohort: cohort1._id,
    sessionNumber: 4,
    title: 'Session 4: Orbital Mechanics & SGP4 TLE Satellite Propagation',
    topic: 'Astrodynamics',
    focus: 'Orbital Ephemeris & Pass Windows',
    activities: ['SGP4 propagator math', 'NORAD TLE data ingest'],
    date: new Date(Date.now() + 3 * 86400000),
    startTime: '10:00 AM',
    endTime: '02:00 PM',
    instructor: instructor1.fullName,
    location: 'EGSA Orbit Simulation Theater',
    classroom: 'Astrodynamics Lab 2',
    deliveryMode: 'Onsite',
    status: 'Scheduled',
    materials: [
      {
        title: 'SGP4 Orbit Propagation Handbook.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/sgp4-orbit-propagation.pdf',
        type: 'PDF',
        size: '3.1 MB',
      },
    ],
  });

  const trainSess5 = await TrainingSession.create({
    course: course1._id,
    cohort: cohort1._id,
    sessionNumber: 5,
    title: 'Session 5: Flight Avionics Bus Protocols & CAN Transceiver Testing',
    topic: 'Avionics',
    focus: 'Bus Integrity & Signal Routing',
    activities: ['CAN frame arbitration', 'Differential voltage probe'],
    date: new Date(Date.now() + 7 * 86400000),
    startTime: '10:00 AM',
    endTime: '02:00 PM',
    instructor: instructor1.fullName,
    location: 'Avionics Cleanroom Bay',
    classroom: 'Cleanroom Bench 5',
    deliveryMode: 'Onsite',
    status: 'Scheduled',
    materials: [
      {
        title: 'Spacecraft Bus Standards & CAN Protocol.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/can-bus-standards.pdf',
        type: 'PDF',
        size: '2.5 MB',
      },
    ],
  });

  const trainSess6 = await TrainingSession.create({
    course: course1._id,
    cohort: cohort1._id,
    sessionNumber: 6,
    title: 'Session 6: Telemetry Packets Demultiplexing & Subsystem Monitoring',
    topic: 'Telemetry',
    focus: 'Packet Extraction & Health Telemetry',
    activities: ['Payload packet demux', 'Subsystem housekeeping telemetry decoding'],
    date: new Date(Date.now() + 11 * 86400000),
    startTime: '10:00 AM',
    endTime: '02:00 PM',
    instructor: instructor1.fullName,
    location: 'EGSA Data Operations Center',
    classroom: 'Telemetry Analysis Cluster',
    deliveryMode: 'Onsite',
    status: 'Scheduled',
    materials: [
      {
        title: 'Housekeeping Telemetry Extraction Guide.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/housekeeping-telemetry.pdf',
        type: 'PDF',
        size: '3.3 MB',
      },
    ],
  });

  const trainSess7 = await TrainingSession.create({
    course: course1._id,
    cohort: cohort1._id,
    sessionNumber: 7,
    title: 'Session 7: Earth-Space Link Budget Margin Validation & RF Sweeps',
    topic: 'RF & Data',
    focus: 'Link Margin & Receiver Sensitivity',
    activities: ['Spectrum analyzer sweep', 'Noise floor calibration'],
    date: new Date(Date.now() + 15 * 86400000),
    startTime: '10:00 AM',
    endTime: '02:00 PM',
    instructor: instructor1.fullName,
    location: 'RF Anechoic Chamber',
    classroom: 'Chamber Test Bench 1',
    deliveryMode: 'Onsite',
    status: 'Scheduled',
    materials: [
      {
        title: 'Anechoic Chamber Measurement Protocol.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/chamber-protocol.pdf',
        type: 'PDF',
        size: '4.1 MB',
      },
    ],
  });

  const trainSess8 = await TrainingSession.create({
    course: course1._id,
    cohort: cohort1._id,
    sessionNumber: 8,
    title: 'Session 8: Capstone Satellite Pass Execution & Flight Telemetry Defense',
    topic: 'Astrodynamics',
    focus: 'Live Pass Defense & Final Certification',
    activities: ['Live pass tracking drill', 'Technical review committee presentation'],
    date: new Date(Date.now() + 19 * 86400000),
    startTime: '10:00 AM',
    endTime: '03:00 PM',
    instructor: instructor1.fullName,
    location: 'EGSA Main Auditorium & Command Room',
    classroom: 'Main Briefing Auditorium',
    deliveryMode: 'Onsite',
    status: 'Scheduled',
    materials: [
      {
        title: 'Capstone Mission Evaluation Rubric.pdf',
        fileUrl: 'https://cdn.egsa.gov.eg/materials/capstone-rubric.pdf',
        type: 'PDF',
        size: '1.5 MB',
      },
    ],
  });

  // Dual-seed scheduled Session counterparts for Cohort 1 & 100% attendance for high-achiever Youssef
  for (const ts of [trainSess4, trainSess5, trainSess6, trainSess7, trainSess8]) {
    const s = await Session.create({
      title: ts.title,
      course: course1._id,
      cohort: cohort1._id,
      instructor: instructor1._id,
      date: ts.date,
      startTime: '10:00',
      endTime: '14:00',
      location: ts.location,
      status: 'scheduled',
    });
    await AttendanceRecord.create({
      session: ts._id,
      student: studentYoussef._id,
      enrollment: enrYoussef1._id,
      course: course1._id,
      cohort: cohort1._id,
      status: 'Present',
      verified: true,
      verifiedAt: new Date(),
      verifiedBy: instructor1._id,
      checkInTime: new Date(),
      checkInMethod: 'QR_Scan',
      notes: 'Verified attendance for high-achiever cadet',
    });
    await Attendance.create({
      session: s._id,
      cohort: cohort1._id,
      student: studentRefYoussef._id,
      status: 'present',
      verified: true,
      verifiedAt: new Date(),
      verifiedBy: instructor1._id,
      markedAt: new Date(),
      markedBy: instructor1._id,
      source: 'qr_checkin',
      qrCheckIn: {
        timestamp: new Date(),
        method: 'qr_code',
        verified: true,
      },
      notes: 'Verified attendance',
    });
  }

  // Past Session for Cohort 2 (Space Robotics)
  const pastDateRobo = new Date(Date.now() - 3 * 86400000);
  const trainSessRobo1 = await TrainingSession.create({
    course: course2._id,
    cohort: cohort2._id,
    sessionNumber: 1,
    title: 'Session 1: Flight Avionics Bus Protocols & CAN Transceiver Testing',
    topic: 'Avionics',
    focus: 'Avionics Bus Signaling',
    activities: ['CAN differential voltage probe', 'Frame arbitration stress tests'],
    date: pastDateRobo,
    startTime: '09:30 AM',
    endTime: '01:30 PM',
    instructor: instructor2.fullName,
    location: 'Avionics System Integration Bay',
    deliveryMode: 'Onsite',
    status: 'Completed',
  });
  const sessRobo1 = await Session.create({
    title: trainSessRobo1.title,
    course: course2._id,
    cohort: cohort2._id,
    date: pastDateRobo,
    startTime: '09:30',
    endTime: '13:30',
    location: trainSessRobo1.location,
    status: 'completed',
  });

  // Live Session for Cohort 2 (Space Robotics)
  const trainSessRobo2 = await TrainingSession.create({
    course: course2._id,
    cohort: cohort2._id,
    sessionNumber: 2,
    title: 'Session 2: Space Manipulator Autonomous Trajectory Calibration',
    topic: 'Astrodynamics',
    focus: 'Microgravity Robotics Simulation',
    activities: ['Arm joint trajectory planning', 'Sensor feedback loop closure'],
    date: liveDateToday,
    startTime: '11:00 AM',
    endTime: '04:00 PM',
    instructor: instructor2.fullName,
    location: 'Robotics Micro-Gravity Simulation Lab',
    deliveryMode: 'Onsite',
    status: 'Active',
    attendanceWindow: {
      opensAt: new Date(Date.now() - 45 * 60000),
      closesAt: new Date(Date.now() + 6 * 3600000),
    },
    qrCode: {
      token: 'EGSA-QR-ROBOTICS-LIVE-2026',
      generatedAt: new Date(Date.now() - 20 * 60000),
      expiresAt: new Date(Date.now() + 6 * 3600000),
      isActive: true,
    },
  });
  const sessRobo2 = await Session.create({
    title: trainSessRobo2.title,
    course: course2._id,
    cohort: cohort2._id,
    date: liveDateToday,
    startTime: '11:00',
    endTime: '16:00',
    location: trainSessRobo2.location,
    status: 'scheduled',
  });

  // =====================================================================
  // 6. Seed Attendance Records:
  //    - 4 pending_instructor_verification
  //    - 6 verified with instructor timestamps
  //    - 2 absence excuses submitted with student notes
  // =====================================================================
  console.log('[SEED] Seeding verified and pending attendance records & excuses...');

  // --- 6 Verified Attendance Records (Past Sessions with instructor timestamps) ---
  // Record 1: Omar in Session 1
  await AttendanceRecord.create({
    session: trainSess1._id,
    student: student1._id,
    enrollment: enrOmar1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'verified',
    verified: true,
    verifiedAt: new Date(pastDate1.getTime() + 60 * 60000),
    verifiedBy: instructor1._id,
    checkInTime: new Date(pastDate1.getTime() + 15 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Verified by Instructor Eng. Tarek ElKady',
  });
  await Attendance.create({
    session: sess1._id,
    cohort: cohort1._id,
    student: studentRef1._id,
    status: 'present',
    verified: true,
    verifiedAt: new Date(pastDate1.getTime() + 60 * 60000),
    verifiedBy: instructor1._id,
    markedAt: new Date(pastDate1.getTime() + 60 * 60000),
    markedBy: instructor1._id,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(pastDate1.getTime() + 15 * 60000),
      method: 'qr_code',
      verified: true,
    },
    notes: 'On-time attendance verified at tracking console',
  });

  // Record 2: Mariam in Session 1
  await AttendanceRecord.create({
    session: trainSess1._id,
    student: student2._id,
    enrollment: enrMariam1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'verified',
    verified: true,
    verifiedAt: new Date(pastDate1.getTime() + 60 * 60000),
    verifiedBy: instructor1._id,
    checkInTime: new Date(pastDate1.getTime() + 10 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Verified by Instructor Eng. Tarek ElKady',
  });
  await Attendance.create({
    session: sess1._id,
    cohort: cohort1._id,
    student: studentRef2._id,
    status: 'present',
    verified: true,
    verifiedAt: new Date(pastDate1.getTime() + 60 * 60000),
    verifiedBy: instructor1._id,
    markedAt: new Date(pastDate1.getTime() + 60 * 60000),
    markedBy: instructor1._id,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(pastDate1.getTime() + 10 * 60000),
      method: 'qr_code',
      verified: true,
    },
    notes: 'On-time attendance verified at tracking console',
  });

  // Record 2B: Youssef in Session 1 (Past Completed with attendance)
  await AttendanceRecord.create({
    session: trainSess1._id,
    student: studentYoussef._id,
    enrollment: enrYoussef1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Present',
    verified: true,
    verifiedAt: new Date(pastDate1.getTime() + 60 * 60000),
    verifiedBy: instructor1._id,
    checkInTime: new Date(pastDate1.getTime() + 12 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Verified by Instructor Eng. Tarek ElKady',
  });
  await Attendance.create({
    session: sess1._id,
    cohort: cohort1._id,
    student: studentRefYoussef._id,
    status: 'present',
    verified: true,
    verifiedAt: new Date(pastDate1.getTime() + 60 * 60000),
    verifiedBy: instructor1._id,
    markedAt: new Date(pastDate1.getTime() + 60 * 60000),
    markedBy: instructor1._id,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(pastDate1.getTime() + 12 * 60000),
      method: 'qr_code',
      verified: true,
    },
    notes: 'On-time ground station rotor tracking verified',
  });

  // Record 3: Omar in Session 2
  await AttendanceRecord.create({
    session: trainSess2._id,
    student: student1._id,
    enrollment: enrOmar1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'verified',
    verified: true,
    verifiedAt: new Date(pastDate2.getTime() + 50 * 60000),
    verifiedBy: instructor1._id,
    checkInTime: new Date(pastDate2.getTime() + 12 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Verified by Instructor Eng. Tarek ElKady',
  });
  await Attendance.create({
    session: sess2._id,
    cohort: cohort1._id,
    student: studentRef1._id,
    status: 'present',
    verified: true,
    verifiedAt: new Date(pastDate2.getTime() + 50 * 60000),
    verifiedBy: instructor1._id,
    markedAt: new Date(pastDate2.getTime() + 50 * 60000),
    markedBy: instructor1._id,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(pastDate2.getTime() + 12 * 60000),
      method: 'qr_code',
      verified: true,
    },
    notes: 'Cleanroom bench telemetry check verified',
  });

  // Record 4: Mariam in Session 2
  await AttendanceRecord.create({
    session: trainSess2._id,
    student: student2._id,
    enrollment: enrMariam1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'verified',
    verified: true,
    verifiedAt: new Date(pastDate2.getTime() + 50 * 60000),
    verifiedBy: instructor1._id,
    checkInTime: new Date(pastDate2.getTime() + 18 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Verified by Instructor Eng. Tarek ElKady',
  });
  await Attendance.create({
    session: sess2._id,
    cohort: cohort1._id,
    student: studentRef2._id,
    status: 'present',
    verified: true,
    verifiedAt: new Date(pastDate2.getTime() + 50 * 60000),
    verifiedBy: instructor1._id,
    markedAt: new Date(pastDate2.getTime() + 50 * 60000),
    markedBy: instructor1._id,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(pastDate2.getTime() + 18 * 60000),
      method: 'qr_code',
      verified: true,
    },
    notes: 'Cleanroom bench telemetry check verified',
  });

  // Record 4B: Youssef in Session 2 (Past Completed with attendance)
  await AttendanceRecord.create({
    session: trainSess2._id,
    student: studentYoussef._id,
    enrollment: enrYoussef1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Present',
    verified: true,
    verifiedAt: new Date(pastDate2.getTime() + 50 * 60000),
    verifiedBy: instructor1._id,
    checkInTime: new Date(pastDate2.getTime() + 10 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Verified by Instructor Eng. Tarek ElKady',
  });
  await Attendance.create({
    session: sess2._id,
    cohort: cohort1._id,
    student: studentRefYoussef._id,
    status: 'present',
    verified: true,
    verifiedAt: new Date(pastDate2.getTime() + 50 * 60000),
    verifiedBy: instructor1._id,
    markedAt: new Date(pastDate2.getTime() + 50 * 60000),
    markedBy: instructor1._id,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(pastDate2.getTime() + 10 * 60000),
      method: 'qr_code',
      verified: true,
    },
    notes: 'SDR receiver tuning telemetry check verified',
  });

  // Record 4C: Youssef in Session 3 (Past Completed with attendance)
  await AttendanceRecord.create({
    session: trainSess3._id,
    student: studentYoussef._id,
    enrollment: enrYoussef1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Present',
    verified: true,
    verifiedAt: new Date(liveDateToday.getTime() - 15 * 60000),
    verifiedBy: instructor1._id,
    checkInTime: new Date(liveDateToday.getTime() - 30 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Verified by Instructor Eng. Tarek ElKady',
  });
  await Attendance.create({
    session: sess3._id,
    cohort: cohort1._id,
    student: studentRefYoussef._id,
    status: 'present',
    verified: true,
    verifiedAt: new Date(liveDateToday.getTime() - 15 * 60000),
    verifiedBy: instructor1._id,
    markedAt: new Date(liveDateToday.getTime() - 15 * 60000),
    markedBy: instructor1._id,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(liveDateToday.getTime() - 30 * 60000),
      method: 'qr_code',
      verified: true,
    },
    notes: 'Ground station telemetry pass verified',
  });

  // Record 5: Omar in Session 1 (Robotics)
  await AttendanceRecord.create({
    session: trainSessRobo1._id,
    student: student1._id,
    enrollment: enrOmar2._id,
    course: course2._id,
    cohort: cohort2._id,
    status: 'verified',
    verified: true,
    verifiedAt: new Date(pastDateRobo.getTime() + 45 * 60000),
    verifiedBy: instructor2._id,
    checkInTime: new Date(pastDateRobo.getTime() + 5 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Verified by Instructor Dr. Amr Mohamed',
  });
  await Attendance.create({
    session: sessRobo1._id,
    cohort: cohort2._id,
    student: studentRef1._id,
    status: 'present',
    verified: true,
    verifiedAt: new Date(pastDateRobo.getTime() + 45 * 60000),
    verifiedBy: instructor2._id,
    markedAt: new Date(pastDateRobo.getTime() + 45 * 60000),
    markedBy: instructor2._id,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(pastDateRobo.getTime() + 5 * 60000),
      method: 'qr_code',
      verified: true,
    },
    notes: 'Avionics CAN lab presence confirmed',
  });

  // Record 6: Mariam in Session 1 (Robotics guest lab)
  await AttendanceRecord.create({
    session: trainSessRobo1._id,
    student: student2._id,
    enrollment: enrMariam1._id,
    course: course2._id,
    cohort: cohort2._id,
    status: 'verified',
    verified: true,
    verifiedAt: new Date(pastDateRobo.getTime() + 45 * 60000),
    verifiedBy: instructor2._id,
    checkInTime: new Date(pastDateRobo.getTime() + 8 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Verified by Instructor Dr. Amr Mohamed',
  });
  await Attendance.create({
    session: sessRobo1._id,
    cohort: cohort2._id,
    student: studentRef2._id,
    status: 'present',
    verified: true,
    verifiedAt: new Date(pastDateRobo.getTime() + 45 * 60000),
    verifiedBy: instructor2._id,
    markedAt: new Date(pastDateRobo.getTime() + 45 * 60000),
    markedBy: instructor2._id,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(pastDateRobo.getTime() + 8 * 60000),
      method: 'qr_code',
      verified: true,
    },
    notes: 'Avionics CAN lab presence confirmed',
  });

  // --- 4 Pending Instructor Verification Records (Live / Awaiting verification) ---
  // Pending 1: Omar in Live Session 3 (CubeSat)
  await AttendanceRecord.create({
    session: trainSess3._id,
    student: student1._id,
    enrollment: enrOmar1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'pending_instructor_verification',
    verified: false,
    checkInTime: new Date(Date.now() - 25 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Awaiting instructor verification for live satellite tracking session',
  });
  await Attendance.create({
    session: sess3._id,
    cohort: cohort1._id,
    student: studentRef1._id,
    status: 'pending',
    verified: false,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(Date.now() - 25 * 60000),
      method: 'qr_code',
      verified: false,
    },
    notes: 'Scanned live QR code - awaiting instructor verification',
  });

  // Pending 2: Mariam in Live Session 3 (CubeSat)
  await AttendanceRecord.create({
    session: trainSess3._id,
    student: student2._id,
    enrollment: enrMariam1._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'pending_instructor_verification',
    verified: false,
    checkInTime: new Date(Date.now() - 20 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Awaiting instructor verification for live satellite tracking session',
  });
  await Attendance.create({
    session: sess3._id,
    cohort: cohort1._id,
    student: studentRef2._id,
    status: 'pending',
    verified: false,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(Date.now() - 20 * 60000),
      method: 'qr_code',
      verified: false,
    },
    notes: 'Scanned live QR code - awaiting instructor verification',
  });

  // Pending 3: Omar in Live Session 2 (Robotics)
  await AttendanceRecord.create({
    session: trainSessRobo2._id,
    student: student1._id,
    enrollment: enrOmar2._id,
    course: course2._id,
    cohort: cohort2._id,
    status: 'pending_instructor_verification',
    verified: false,
    checkInTime: new Date(Date.now() - 15 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Awaiting instructor verification in Robotics Lab',
  });
  await Attendance.create({
    session: sessRobo2._id,
    cohort: cohort2._id,
    student: studentRef1._id,
    status: 'pending',
    verified: false,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(Date.now() - 15 * 60000),
      method: 'qr_code',
      verified: false,
    },
    notes: 'Scanned live robotics QR - awaiting verification',
  });

  // Pending 4: Mariam in Session 2 (Robotics)
  await AttendanceRecord.create({
    session: trainSessRobo2._id,
    student: student2._id,
    enrollment: enrMariam1._id,
    course: course2._id,
    cohort: cohort2._id,
    status: 'pending_instructor_verification',
    verified: false,
    checkInTime: new Date(Date.now() - 10 * 60000),
    checkInMethod: 'QR_Scan',
    notes: 'Awaiting instructor verification in Robotics Lab',
  });
  await Attendance.create({
    session: sessRobo2._id,
    cohort: cohort2._id,
    student: studentRef2._id,
    status: 'pending',
    verified: false,
    source: 'qr_checkin',
    qrCheckIn: {
      timestamp: new Date(Date.now() - 10 * 60000),
      method: 'qr_code',
      verified: false,
    },
    notes: 'Scanned live QR code - awaiting instructor verification',
  });

  // --- 2 Absence Excuses Submitted with Student Notes ---
  // Excuse 1: Omar Hassan (University Mid-Term Examination)
  await AttendanceDispute.create({
    student: student1._id,
    session: trainSess1._id,
    enrollment: enrOmar1._id,
    type: 'Excuse',
    reason: 'Official mid-term examination at Cairo University Faculty of Engineering (Aerospace Structures II). Official university schedule letter submitted.',
    documentation: '/uploads/disputes/cairo_university_exam_schedule.pdf',
    status: 'Pending',
  });

  // Excuse 2: Mariam Khaled (Medical Clinic Report)
  await AttendanceDispute.create({
    student: student2._id,
    session: trainSess2._id,
    enrollment: enrMariam1._id,
    type: 'Medical_Excuse',
    reason: 'Acute seasonal eye infection treated at Ain Shams University Hospital clinic. Medical certificate uploaded.',
    documentation: '/uploads/disputes/medical_clinic_report.pdf',
    status: 'Pending',
  });

  // =====================================================================
  // 7. Seed Quizzes & Assignments:
  //    - 2 active quizzes with 4 MCQs each (testing auto-grading)
  //    - 2 assignments (1 ongoing with countdown, 1 past deadline testing isLate: true)
  // =====================================================================
  console.log('[SEED] Creating active quizzes and assignments...');

  // Quiz 1: CubeSat Radio Telemetry & Link Budget Quiz (4 MCQs)
  await ProgramAssessment.create({
    title: 'CubeSat Radio Telemetry & Link Budget Quiz',
    description: 'Auto-graded practical quiz assessing RF link budget parameters, telemetry modulation, and Doppler compensation in LEO orbits.',
    instructions: 'Select the single best answer for each question. Immediate automated grading will compute your percentage upon submission.',
    program: course1._id,
    division: 'PRE_UNIVERSITY',
    createdBy: instructor1._id,
    passingPercentage: 75,
    questions: [
      {
        questionText: 'What is the primary frequency band allocated for amateur CubeSat telemetry downlinks?',
        questionType: 'SINGLE_CHOICE',
        options: ['144-146 MHz (VHF) and 435-438 MHz (UHF)', '2.4 GHz ISM WiFi Band', '50-54 MHz 6-meter band', '10.5 GHz X-Band terrestrial only'],
        correctAnswer: '144-146 MHz (VHF) and 435-438 MHz (UHF)',
        weight: 25,
      },
      {
        questionText: 'Which modulation scheme is standard for low-power AX.25 satellite packet telemetry?',
        questionType: 'SINGLE_CHOICE',
        options: ['1200/9600 baud AFSK / GFSK', '64-QAM Quadrature Modulation', 'OFDM 802.11ax', 'Pure unmodulated CW only'],
        correctAnswer: '1200/9600 baud AFSK / GFSK',
        weight: 25,
      },
      {
        questionText: 'What physical phenomenon causes Doppler frequency shifts in low Earth orbit (LEO) satellite communications?',
        questionType: 'SINGLE_CHOICE',
        options: ['High relative velocity between the satellite and the ground tracking station', 'Atmospheric humidity fluctuations in the troposphere', 'Solar array shadow transitions in the eclipse phase', 'Spacecraft battery discharge voltage drop'],
        correctAnswer: 'High relative velocity between the satellite and the ground tracking station',
        weight: 25,
      },
      {
        questionText: 'In a satellite link budget calculation, what does the ratio Eb/N0 represent?',
        questionType: 'SINGLE_CHOICE',
        options: ['Energy per bit to noise power spectral density ratio', 'Effective battery voltage to nominal circuit current', 'Earth bounce to noise coefficient', 'Electromagnetic baseline index'],
        correctAnswer: 'Energy per bit to noise power spectral density ratio',
        weight: 25,
      },
    ],
  });

  const assessQuiz1 = await Assessment.create({
    title: 'CubeSat Radio Telemetry & Link Budget Quiz',
    description: 'Auto-graded technical quiz covering link budget parameters, telemetry modulation, and Doppler compensation in LEO orbits.',
    type: 'Quiz',
    course: course1._id,
    cohort: cohort1._id,
    session: trainSess4._id,
    instructor: instructor1._id,
    instructorName: instructor1.fullName,
    maxScore: 100,
    passingScore: 75,
    weight: 20,
    status: 'In_Progress',
    assessmentDate: new Date(),
    dueDate: new Date(Date.now() + 7 * 86400000),
    deadline: new Date(Date.now() + 7 * 86400000),
    isMandatory: true,
    questions: [
      {
        questionText: 'What is the primary frequency band allocated for amateur CubeSat telemetry downlinks?',
        options: ['144-146 MHz (VHF) and 435-438 MHz (UHF)', '2.4 GHz ISM WiFi Band', '50-54 MHz 6-meter band', '10.5 GHz X-Band terrestrial only'],
        correctOptionIndex: 0,
        points: 25,
        explanation: 'VHF (144-146 MHz) and UHF (435-438 MHz) are designated IARU frequency allocations for low-power satellite telemetry downlinks.',
      },
      {
        questionText: 'Which modulation scheme is standard for low-power AX.25 satellite packet telemetry?',
        options: ['1200/9600 baud AFSK / GFSK', '64-QAM Quadrature Modulation', 'OFDM 802.11ax', 'Pure unmodulated CW only'],
        correctOptionIndex: 0,
        points: 25,
        explanation: 'Audio Frequency Shift Keying (AFSK) at 1200 baud and Gaussian Frequency Shift Keying (GFSK) at 9600 baud are the global CubeSat AX.25 standards.',
      },
      {
        questionText: 'What physical phenomenon causes Doppler frequency shifts in low Earth orbit (LEO) satellite communications?',
        options: ['High relative velocity between the satellite and the ground tracking station', 'Atmospheric humidity fluctuations in the troposphere', 'Solar array shadow transitions in the eclipse phase', 'Spacecraft battery discharge voltage drop'],
        correctOptionIndex: 0,
        points: 25,
        explanation: 'The relative velocity of ~7.5 km/s in LEO produces significant carrier Doppler compression and dilation.',
      },
      {
        questionText: 'In a satellite link budget calculation, what does the ratio Eb/N0 represent?',
        options: ['Energy per bit to noise power spectral density ratio', 'Effective battery voltage to nominal circuit current', 'Earth bounce to noise coefficient', 'Electromagnetic baseline index'],
        correctOptionIndex: 0,
        points: 25,
        explanation: 'Eb/N0 is the normalized signal-to-noise ratio measure that determines digital bit error rate (BER).',
      },
    ],
  });

  // Quiz 2: Avionics CAN Bus & Embedded Architecture Quiz (4 MCQs)
  await ProgramAssessment.create({
    title: 'Avionics CAN Bus & Embedded Architecture Quiz',
    description: 'Auto-graded assessment on flight microcontroller architectures, CAN bus differential transmission, and SEU radiation tolerance.',
    instructions: 'Choose the correct response. Instant automated scoring will evaluate your knowledge of space avionics systems.',
    program: course2._id,
    division: 'UNIVERSITY',
    createdBy: instructor2._id,
    passingPercentage: 75,
    questions: [
      {
        questionText: 'What is the characteristic differential line impedance of a standard aerospace CAN avionics bus?',
        questionType: 'SINGLE_CHOICE',
        options: ['120 Ohms', '50 Ohms', '75 Ohms', '300 Ohms'],
        correctAnswer: '120 Ohms',
        weight: 25,
      },
      {
        questionText: 'Which collision prevention mechanism allows multiple avionics nodes to transmit simultaneously on CAN?',
        questionType: 'SINGLE_CHOICE',
        options: ['Bitwise arbitration based on message identifier dominance', 'Random exponential backoff timer', 'Central master computer continuous polling', 'Token ring network circulation'],
        correctAnswer: 'Bitwise arbitration based on message identifier dominance',
        weight: 25,
      },
      {
        questionText: 'Why are radiation-hardened microcontrollers preferred in space avionics over commercial CPUs?',
        questionType: 'SINGLE_CHOICE',
        options: ['Immunity to Single Event Upsets (SEU) and Total Ionizing Dose (TID)', 'Higher clock frequency above 5.0 GHz', 'Lower retail purchasing cost', 'Smaller flash memory footprint'],
        correctAnswer: 'Immunity to Single Event Upsets (SEU) and Total Ionizing Dose (TID)',
        weight: 25,
      },
      {
        questionText: 'What is the typical bus voltage for a 3U CubeSat electrical power system (EPS) unregulated battery rail?',
        questionType: 'SINGLE_CHOICE',
        options: ['6.4V to 8.4V (2S Li-ion battery rail)', '110V AC single phase', '48V DC telecom standard', '1.2V core logic only'],
        correctAnswer: '6.4V to 8.4V (2S Li-ion battery rail)',
        weight: 25,
      },
    ],
  });

  const assessQuiz2 = await Assessment.create({
    title: 'Avionics CAN Bus & Embedded Architecture Quiz',
    description: 'Auto-graded assessment on flight microcontroller architectures, CAN bus differential transmission, and SEU radiation tolerance.',
    type: 'Quiz',
    course: course2._id,
    cohort: cohort2._id,
    session: trainSess5._id,
    instructor: instructor2._id,
    instructorName: instructor2.fullName,
    maxScore: 100,
    passingScore: 75,
    weight: 20,
    status: 'In_Progress',
    assessmentDate: new Date(),
    dueDate: new Date(Date.now() + 10 * 86400000),
    deadline: new Date(Date.now() + 10 * 86400000),
    isMandatory: true,
  });

  // Assignment 1: Ongoing with Countdown Timer (Due in 5 days)
  const assign1DueDate = new Date(Date.now() + 5 * 86400000);
  await Assignment.create({
    cohort: cohort1._id,
    title: 'CubeSat Ground Station Antenna Array Tracking & Azimuth/Elevation Calibration',
    description: 'Design and calibrate an automated AZ/EL rotator controller script that accepts TLE orbit vectors and maintains tracking alignment within 1.5 degrees during an active satellite pass.',
    dueDate: assign1DueDate,
    maxScore: 100,
    createdBy: instructor1._id,
  });

  const assessAssign1 = await Assessment.create({
    title: 'CubeSat Ground Station Antenna Array Tracking & Azimuth/Elevation Calibration',
    description: 'Design and calibrate an automated AZ/EL rotator controller script that accepts TLE orbit vectors and maintains tracking alignment within 1.5 degrees during an active satellite pass.',
    type: 'Assignment',
    course: course1._id,
    cohort: cohort1._id,
    instructor: instructor1._id,
    instructorName: instructor1.fullName,
    maxScore: 100,
    passingScore: 70,
    weight: 30,
    status: 'In_Progress',
    assessmentDate: new Date(Date.now() - 2 * 86400000),
    dueDate: assign1DueDate,
    deadline: assign1DueDate,
    isMandatory: true,
    allowLateSubmission: true,
  });

  // Assignment 2: Past Deadline Testing `isLate: true` (Due 3 days ago)
  const assign2DueDate = new Date(Date.now() - 3 * 86400000);
  const assign2 = await Assignment.create({
    cohort: cohort2._id,
    title: 'Space Manipulator Kinematic DH-Parameter Analysis & Inverse Jacobians',
    description: 'Compute Denavit-Hartenberg parameters for a 3-DOF satellite robotic servicing arm and implement the numerical inverse Jacobian in Python with damped least-squares singularity avoidance.',
    dueDate: assign2DueDate,
    maxScore: 100,
    createdBy: instructor2._id,
  });

  const assessAssign2 = await Assessment.create({
    title: 'Space Manipulator Kinematic DH-Parameter Analysis & Inverse Jacobians',
    description: 'Compute Denavit-Hartenberg parameters for a 3-DOF satellite robotic servicing arm and implement the numerical inverse Jacobian in Python with damped least-squares singularity avoidance.',
    type: 'Assignment',
    course: course2._id,
    cohort: cohort2._id,
    instructor: instructor2._id,
    instructorName: instructor2.fullName,
    maxScore: 100,
    passingScore: 70,
    weight: 30,
    status: 'Completed',
    assessmentDate: new Date(Date.now() - 7 * 86400000),
    dueDate: assign2DueDate,
    deadline: assign2DueDate,
    isMandatory: true,
    allowLateSubmission: true,
  });

  // Seed Late Submission for Assignment 2 by Omar Hassan
  const lateSubmitDate = new Date(Date.now() - 1 * 86400000); // Submitted 2 days after due date!
  await StudentSubmission.create({
    assessment: assessAssign2._id,
    student: student1._id,
    course: course2._id,
    cohort: cohort2._id,
    enrollment: enrOmar2._id,
    submissionType: 'both',
    textAnswer: 'Attached numerical Python implementation for 3-DOF robotic arm forward kinematics and inverse Jacobian with damped least-squares damping factor lambda=0.05.',
    file: {
      fileName: 'Robotic_Arm_Kinematics_Late_Submission.py',
      originalName: 'Robotic_Arm_Kinematics_Late_Submission.py',
      fileUrl: '/uploads/submissions/Robotic_Arm_Kinematics.py',
      mimeType: 'text/x-python',
      sizeBytes: 8192,
      uploadedAt: lateSubmitDate,
    },
    status: 'Evaluated',
    score: 82,
    feedback: 'Accurate Jacobian derivation and cleanly handled singularity boundaries. Marked 82/100 due to institutional late submission policy penalty (-10%).',
    submittedAt: lateSubmitDate,
    isLate: true,
    evaluatedAt: new Date(Date.now() - 12 * 3600000),
    evaluatedBy: instructor2._id,
    evaluatorName: instructor2.fullName,
  });

  await AssessmentSubmission.create({
    assessment: assessAssign2._id,
    cohort: cohort2._id,
    student: studentRef1._id,
    content: 'Attached numerical Python implementation for 3-DOF robotic arm forward kinematics and inverse Jacobian with damped least-squares damping factor lambda=0.05.',
    submittedAt: lateSubmitDate,
    status: 'evaluated',
  });

  await AssessmentResult.create({
    assessment: assessAssign2._id,
    student: student1._id,
    enrollment: enrOmar2._id,
    instructor: instructor2._id,
    course: course2._id,
    cohort: cohort2._id,
    score: 82,
    maxScore: 100,
    percentage: 82,
    status: 'Published',
    resultLabel: 'Passed',
    feedback: 'Accurate Jacobian derivation and cleanly handled singularity boundaries. Marked 82/100 due to institutional late submission policy penalty (-10%).',
    strengths: 'Solid mathematical rigor in DH-parameter transformation matrices and damped least-squares singularity avoidance.',
    improvementAreas: 'Submit future deliverables before deadline to avoid automatic grade penalties.',
    evaluatedAt: new Date(Date.now() - 12 * 3600000),
    finalizedAt: new Date(Date.now() - 12 * 3600000),
    publishedAt: new Date(Date.now() - 6 * 3600000),
  });

  // =====================================================================
  // Phase 11: Youssef Mohamed - 4-Gate Satisfaction Records (CubeSat Telemetry)
  // Gate 1: Attendance >= 85% (already verified 100% in Sessions 1 & 2)
  // Gate 2: Mandatory Technical Assessments & Capstones Passed
  // Gate 3: Payment Settled (Status: Paid)
  // Gate 4: Institutional Quality Survey Submitted
  // =====================================================================
  await StudentSubmission.create({
    assessment: assessQuiz1._id,
    student: studentYoussef._id,
    course: course1._id,
    cohort: cohort1._id,
    enrollment: enrYoussef1._id,
    submissionType: 'text',
    textAnswer: 'Submitted orbital pass telemetry questions and Doppler calculations.',
    status: 'Evaluated',
    score: 95,
    submittedAt: new Date(Date.now() - 5 * 86400000),
    evaluatedAt: new Date(Date.now() - 4 * 86400000),
    evaluatedBy: instructor1._id,
    evaluatorName: instructor1.fullName,
    feedback: 'Flawless orbital pass Doppler calculation and telemetry frame synchronization.',
  });

  await AssessmentResult.create({
    assessment: assessQuiz1._id,
    student: studentYoussef._id,
    enrollment: enrYoussef1._id,
    instructor: instructor1._id,
    course: course1._id,
    cohort: cohort1._id,
    score: 95,
    maxScore: 100,
    percentage: 95,
    status: 'Published',
    resultLabel: 'Passed',
    feedback: 'Flawless orbital pass Doppler calculation and telemetry frame synchronization.',
    evaluatedAt: new Date(Date.now() - 4 * 86400000),
    publishedAt: new Date(Date.now() - 3 * 86400000),
  });

  await StudentSubmission.create({
    assessment: assessAssign1._id,
    student: studentYoussef._id,
    course: course1._id,
    cohort: cohort1._id,
    enrollment: enrYoussef1._id,
    submissionType: 'file',
    file: {
      fileName: 'Youssef_CubeSat_Antenna_Calibration.py',
      originalName: 'Youssef_CubeSat_Antenna_Calibration.py',
      fileUrl: '/uploads/submissions/Youssef_CubeSat_Antenna_Calibration.py',
      mimeType: 'text/x-python',
      sizeBytes: 10240,
      uploadedAt: new Date(Date.now() - 4 * 86400000),
    },
    status: 'Evaluated',
    score: 92,
    submittedAt: new Date(Date.now() - 4 * 86400000),
    isLate: false,
    evaluatedAt: new Date(Date.now() - 3 * 86400000),
    evaluatedBy: instructor1._id,
    evaluatorName: instructor1.fullName,
    feedback: 'Excellent automated AZ/EL tracking script with high pointing accuracy under 1 degree.',
  });

  await AssessmentResult.create({
    assessment: assessAssign1._id,
    student: studentYoussef._id,
    enrollment: enrYoussef1._id,
    instructor: instructor1._id,
    course: course1._id,
    cohort: cohort1._id,
    score: 92,
    maxScore: 100,
    percentage: 92,
    status: 'Published',
    resultLabel: 'Passed',
    feedback: 'Excellent automated AZ/EL tracking script with high pointing accuracy under 1 degree.',
    evaluatedAt: new Date(Date.now() - 3 * 86400000),
    publishedAt: new Date(Date.now() - 3 * 86400000),
  });

  // Gate 4: Evaluation Quality Survey
  await Evaluation.create({
    student: studentYoussef._id,
    course: course1._id,
    cohort: cohort1._id,
    enrollment: enrYoussef1._id,
    overallRating: 5,
    ratings: {
      content: 5,
      instructor: 5,
      platform: 5,
      facilities: 5,
    },
    comments: 'Outstanding practical telemetry exercises, antenna tracking laboratory, and exceptional instructor support.',
    isAnonymous: false,
    courseFeedbackCompleted: true,
    agencyFeedbackCompleted: true,
    submittedAt: new Date(Date.now() - 2 * 86400000),
  });

  // At-Risk Student Academic Performance: Omar Hassan in Cohort 1 (<85% Attendance, Low Scores)
  await StudentSubmission.create({
    assessment: assessQuiz1._id,
    student: student1._id,
    course: course1._id,
    cohort: cohort1._id,
    enrollment: enrOmar1._id,
    submissionType: 'text',
    textAnswer: 'Initial attempt on telemetry frames and Doppler link calculation.',
    status: 'Evaluated',
    score: 58,
    submittedAt: new Date(Date.now() - 3 * 86400000),
    evaluatedAt: new Date(Date.now() - 2 * 86400000),
    evaluatedBy: instructor1._id,
    evaluatorName: instructor1.fullName,
    feedback: 'Multiple fundamental RF link budget errors. Mandatory academic tutorial required.',
  });

  await AssessmentResult.create({
    assessment: assessQuiz1._id,
    student: student1._id,
    enrollment: enrOmar1._id,
    instructor: instructor1._id,
    course: course1._id,
    cohort: cohort1._id,
    score: 58,
    maxScore: 100,
    percentage: 58,
    status: 'Published',
    resultLabel: 'Failed',
    feedback: 'Multiple fundamental RF link budget errors. Mandatory academic tutorial required.',
    evaluatedAt: new Date(Date.now() - 2 * 86400000),
    publishedAt: new Date(Date.now() - 2 * 86400000),
  });

  // =====================================================================
  // 8. Seed Administrative Clearance (إفادة):
  //    - 2 pending requests (Summer Training, Syndicate verification)
  //    - 1 stamped/sealed clearance displaying official EGSA stamp number
  // =====================================================================
  console.log('[SEED] Seeding official clearance requests & sealed certificates...');

  // Clearance 1: Pending Request for Summer Training (Omar Hassan)
  await Certificate.create({
    student: student1._id,
    course: course1._id,
    cohort: cohort1._id,
    enrollment: enrOmar1._id,
    recipientName: 'Omar Hassan',
    certificateName: 'Summer Training Clearance (إفادة تدريب صيفي - هندسة القاهرة)',
    type: 'clearance',
    purpose: 'Summer Training Academic Endorsement (إفادة تدريب صيفي)',
    status: 'NAME_SUBMITTED',
    submittedAt: new Date(Date.now() - 2 * 86400000),
    nameConfirmedAt: new Date(Date.now() - 2 * 86400000),
    nameConfirmedBy: 'student',
    adminNotes: 'Requested by cadet for submission to Cairo University Faculty of Engineering Student Affairs for academic summer training credit.',
  });

  // Clearance 2: Pending Request for Syndicate Verification (Mariam Khaled)
  await Certificate.create({
    student: student2._id,
    course: course1._id,
    cohort: cohort1._id,
    enrollment: enrMariam1._id,
    recipientName: 'Mariam Khaled',
    certificateName: 'Engineering Syndicate Membership Verification Clearance (إفادة نقابة المهندسين)',
    type: 'clearance',
    purpose: 'Egyptian Engineering Syndicate Registration (إفادة نقابة المهندسين المصرية)',
    status: 'NAME_SUBMITTED',
    submittedAt: new Date(Date.now() - 1 * 86400000),
    nameConfirmedAt: new Date(Date.now() - 1 * 86400000),
    nameConfirmedBy: 'student',
    adminNotes: 'Requested by cadet for submission to Egyptian Engineers Syndicate accreditation committee.',
  });

  // Clearance 3: Stamped & Sealed Clearance with Official EGSA Stamp Number
  await Certificate.create({
    student: student1._id,
    course: course2._id,
    cohort: cohort2._id,
    enrollment: enrOmar2._id,
    recipientName: 'Omar Hassan',
    certificateName: 'Official Training Clearance & Clearance Certificate (إفادة تدريب معتمدة ومختومة)',
    type: 'clearance',
    purpose: 'Official EGSA Institutional Clearance & Space Technology Credential',
    status: 'ISSUED',
    officialStampNumber: 'EGSA-SEAL-2026-9041',
    certificateId: 'EGSA-CLR-2026-9041',
    verificationToken: 'b7f94e21a0d84c6395e87a3b4c1e6f9a',
    issueDate: new Date(Date.now() - 5 * 86400000),
    submittedAt: new Date(Date.now() - 10 * 86400000),
    adminCreated: true,
    createdByAdmin: adminUser._id,
    adminCreatedAt: new Date(Date.now() - 6 * 86400000),
    issuedBy: adminUser._id,
    fileUrl: '/uploads/certificates/EGSA-CLEARANCE-STAMPED-9041.pdf',
    fileName: 'EGSA-CLEARANCE-STAMPED-9041.pdf',
    fileMimeType: 'application/pdf',
    fileSizeBytes: 245760,
    adminNotes: 'Official EGSA Space Academy stamp applied with seal registry number EGSA-SEAL-2026-9041.',
    feedbackCompleted: true,
    courseFeedbackCompleted: true,
    agencyFeedbackCompleted: true,
  });

  // =====================================================================
  // 9. Comprehensive Multi-Division Admin Operational Seeding
  //    (Applications across all states, Invoices, Attendance Risk Flags, Evals, Audit Logs)
  // =====================================================================
  console.log('[SEED] Provisioning comprehensive multi-division administrative data...');

  // 9.1 Seed Diverse Cadet Profiles across Universities & STEM Schools
  const cadetProfilesData = [
    {
      fullName: 'Kareem Adel',
      email: 'kareem.adel@zewailcity.edu.eg',
      phone: '+201099010001',
      nationalId: '29901011234501',
      division: 'UNIVERSITY',
      university: 'Zewail City of Science and Technology',
      faculty: 'Faculty of Engineering',
      department: 'Aerospace Engineering',
      academicYear: 'Senior (4th Year)',
      registrationNumber: 'EGSA-2026-CADET-01',
      experience: ['RF Circuit Design', 'Satellite Link Budgeting'],
    },
    {
      fullName: 'Salma Mansour',
      email: 'salma.mansour@eng.asu.edu.eg',
      phone: '+201099020002',
      nationalId: '29902021234502',
      division: 'UNIVERSITY',
      university: 'Ain Shams University',
      faculty: 'Faculty of Engineering',
      department: 'Electronics & Communications',
      academicYear: 'Junior (3rd Year)',
      registrationNumber: 'EGSA-2026-CADET-02',
      experience: ['Digital Signal Processing', 'SDR Demodulation'],
    },
    {
      fullName: 'Hossam Farid',
      email: 'hossam.farid@eng.cu.edu.eg',
      phone: '+201099030003',
      nationalId: '29903031234503',
      division: 'UNIVERSITY',
      university: 'Cairo University',
      faculty: 'Faculty of Engineering',
      department: 'Mechanical Engineering (Robotics)',
      academicYear: 'Senior (4th Year)',
      registrationNumber: 'EGSA-2026-CADET-03',
      experience: ['Microgravity Robotic Simulation', 'Kinematic Manipulators'],
    },
    {
      fullName: 'Dina Ezzat',
      email: 'dina.ezzat@alexu.edu.eg',
      phone: '+201099040004',
      nationalId: '29904041234504',
      division: 'UNIVERSITY',
      university: 'Alexandria University',
      faculty: 'Faculty of Engineering',
      department: 'Computer Engineering',
      academicYear: 'Junior (3rd Year)',
      registrationNumber: 'EGSA-2026-CADET-04',
      experience: ['Embedded Systems', 'RTOS Firmware'],
    },
    {
      fullName: 'Ahmed Zaki',
      email: 'ahmed.zaki@zewailcity.edu.eg',
      phone: '+201099050005',
      nationalId: '29905051234505',
      division: 'UNIVERSITY',
      university: 'Zewail City of Science and Technology',
      faculty: 'School of Science',
      department: 'Applied Physics & Nanotechnology',
      academicYear: 'Senior (4th Year)',
      registrationNumber: 'EGSA-2026-CADET-05',
      experience: ['Solar Cell Degradation', 'Photovoltaics'],
    },
    {
      fullName: 'Layla Mostafa',
      email: 'layla.stem@stem.moe.gov.eg',
      phone: '+201099060006',
      nationalId: '30706061234506',
      division: 'PRE_UNIVERSITY',
      university: 'STEM High School 6th of October',
      faculty: 'Secondary STEM Division',
      department: 'Space Science Club',
      academicYear: 'Grade 11',
      registrationNumber: 'EGSA-2026-CADET-06',
      experience: ['Arduino Prototyping', 'Model Rocketry'],
    },
    {
      fullName: 'Tamer Fouad',
      email: 'tamer.stem@stem.moe.gov.eg',
      phone: '+201099070007',
      nationalId: '30707071234507',
      division: 'PRE_UNIVERSITY',
      university: 'Maadi STEM High School',
      faculty: 'Secondary STEM Division',
      department: 'Astrophysics & CanSat Club',
      academicYear: 'Grade 12',
      registrationNumber: 'EGSA-2026-CADET-07',
      experience: ['CanSat Sensor Pods', 'Atmospheric Barometry'],
    },
    {
      fullName: 'Yasmine Nabil',
      email: 'yasmine.nabil@eng.cu.edu.eg',
      phone: '+201099080008',
      nationalId: '29908081234508',
      division: 'UNIVERSITY',
      university: 'Cairo University',
      faculty: 'Faculty of Engineering',
      department: 'Aerospace Engineering',
      academicYear: 'Sophomore (2nd Year)',
      registrationNumber: 'EGSA-2026-CADET-08',
      experience: ['Orbital Dynamics', 'MATLAB Modeling'],
    },
    {
      fullName: 'Mostafa Kamel',
      email: 'mostafa.kamel@eng.asu.edu.eg',
      phone: '+201099090009',
      nationalId: '29909091234509',
      division: 'UNIVERSITY',
      university: 'Ain Shams University',
      faculty: 'Faculty of Engineering',
      department: 'Mechatronics Engineering',
      academicYear: 'Senior (4th Year)',
      registrationNumber: 'EGSA-2026-CADET-09',
      experience: ['CAN Bus Protocol', 'Servo Actuators'],
    },
    {
      fullName: 'Rania Shenouda',
      email: 'rania.shenouda@zewailcity.edu.eg',
      phone: '+201099100010',
      nationalId: '29910101234510',
      division: 'UNIVERSITY',
      university: 'Zewail City of Science and Technology',
      faculty: 'Faculty of Engineering',
      department: 'Space Systems & Astrodynamics',
      academicYear: 'Junior (3rd Year)',
      registrationNumber: 'EGSA-2026-CADET-10',
      experience: ['Two-Body Mechanics', 'Constellation Design'],
    },
    {
      fullName: 'Ziad Sherif',
      email: 'ziad.stem@stem.moe.gov.eg',
      phone: '+201099110011',
      nationalId: '30711111234511',
      division: 'PRE_UNIVERSITY',
      university: 'STEM High School Alexandria',
      faculty: 'Secondary STEM Division',
      department: 'Robotics Team',
      academicYear: 'Grade 10',
      registrationNumber: 'EGSA-2026-CADET-11',
      experience: ['Planetary Rover Wheels', 'Ultrasonic Sensors'],
    },
    {
      fullName: 'Farah Hegazy',
      email: 'farah.hegazy@eng.cu.edu.eg',
      phone: '+201099120012',
      nationalId: '29912121234512',
      division: 'UNIVERSITY',
      university: 'Cairo University',
      faculty: 'Faculty of Engineering',
      department: 'Electrical Power & Machines',
      academicYear: 'Senior (4th Year)',
      registrationNumber: 'EGSA-2026-CADET-12',
      experience: ['Lithium Battery Charging', 'MPPT Power Modules'],
    },
    {
      fullName: 'Nader Tawfik',
      email: 'nader.tawfik@eng.asu.edu.eg',
      phone: '+201099130013',
      nationalId: '29913131234513',
      division: 'UNIVERSITY',
      university: 'Ain Shams University',
      faculty: 'Faculty of Engineering',
      department: 'Aeronautical Systems',
      academicYear: 'Senior (4th Year)',
      registrationNumber: 'EGSA-2026-CADET-13',
      experience: ['Orbital Trajectory Calculus', 'Vis-Viva Equations'],
    },
    {
      fullName: 'Heba Soliman',
      email: 'heba.stem@stem.moe.gov.eg',
      phone: '+201099140014',
      nationalId: '30714141234514',
      division: 'PRE_UNIVERSITY',
      university: 'STEM High School Obour',
      faculty: 'Secondary STEM Division',
      department: 'Junior Aerospace Society',
      academicYear: 'Grade 11',
      registrationNumber: 'EGSA-2026-CADET-14',
      experience: ['CanSat Parachute Recovery', 'Telemetry Transmitters'],
    },
    {
      fullName: 'Bassem Galal',
      email: 'bassem.galal@zewailcity.edu.eg',
      phone: '+201099150015',
      nationalId: '29915151234515',
      division: 'UNIVERSITY',
      university: 'Zewail City of Science and Technology',
      faculty: 'School of Science',
      department: 'Applied Physics',
      academicYear: 'Junior (3rd Year)',
      registrationNumber: 'EGSA-2026-CADET-15',
      experience: ['RF Spectrum Analysis', 'Ground Station Rotor Control'],
    },
  ];

  const seededCadets = [];
  for (const cData of cadetProfilesData) {
    const user = await User.create({
      fullName: cData.fullName,
      email: cData.email,
      password: 'Password123!',
      phone: cData.phone,
      nationalId: cData.nationalId,
      role: 'student',
      accountStatus: 'active',
      isEmailVerified: true,
      registrationNumber: cData.registrationNumber,
      preferredLanguage: 'en',
      division: cData.division,
    });

    await StudentProfile.create({
      user: user._id,
      status: 'student',
      profileCompleted: true,
      division: cData.division,
      university: cData.university,
      faculty: cData.faculty,
      department: cData.department,
      academicYear: cData.academicYear,
      experience: cData.experience,
      personalInfo: {
        nationalId: cData.nationalId,
        dateOfBirth: new Date('2003-03-15'),
        gender: 'male',
        phone: cData.phone,
        address: 'Egypt',
      },
      academicInfo: {
        institutionName: cData.university,
        faculty: cData.faculty,
        department: cData.department,
        studyYear: cData.academicYear,
        graduationYear: 2026,
      },
    });

    const studentRef = await StudentReference.create({
      externalStudentId: String(user._id),
      name: user.fullName,
      email: user.email,
    });

    seededCadets.push({ user, studentRef, meta: cData });
  }

  // 9.2 Seed Diverse Applications Spanning All Target Administrative States
  // States: Submitted, In_Review / Under Review, Eligible, Provisional_Seat_Hold, Accepted, Rejected, Needs Information, Manual Review, Foundation Required
  const appCadet1 = await Application.create({
    student: seededCadets[0].user._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Submitted',
    eligibilityStatus: 'Submitted',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 1 * 86400000),
  });

  const appCadet2 = await Application.create({
    student: seededCadets[1].user._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Under Review',
    eligibilityStatus: 'Submitted',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 2 * 86400000),
  });

  const appCadet3 = await Application.create({
    student: seededCadets[2].user._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Eligible',
    eligibilityStatus: 'Eligible',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 3 * 86400000),
  });

  const appCadet4 = await Application.create({
    student: seededCadets[3].user._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Provisional_Seat_Hold',
    eligibilityStatus: 'Eligible',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 2 * 86400000),
  });

  const appCadet5 = await Application.create({
    student: seededCadets[4].user._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Accepted',
    eligibilityStatus: 'Eligible',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 5 * 86400000),
  });

  const appCadet6 = await Application.create({
    student: seededCadets[5].user._id,
    course: courseCanSat._id,
    cohort: cohortCanSat._id,
    status: 'Rejected',
    eligibilityStatus: 'Rejected',
    rejectionReason: 'Does not meet minimum secondary school mathematics requirements for telemetry budgeting.',
    missingRequirements: ['Prerequisite secondary advanced mathematics certification'],
    submittedAt: new Date(Date.now() - 6 * 86400000),
  });

  const appCadet7 = await Application.create({
    student: seededCadets[6].user._id,
    course: courseCanSat._id,
    cohort: cohortCanSat._id,
    status: 'Needs Information',
    eligibilityStatus: 'Submitted',
    missingRequirements: ['Official Academic Transcript', 'Parental Consent Form'],
    submittedAt: new Date(Date.now() - 4 * 86400000),
  });

  const appCadet8 = await Application.create({
    student: seededCadets[7].user._id,
    course: course2._id,
    cohort: cohort2._id,
    status: 'Manual Review',
    eligibilityStatus: 'Manual Review',
    missingRequirements: ['Prerequisite course clearance review required by Division Admin'],
    submittedAt: new Date(Date.now() - 3 * 86400000),
  });

  const appCadet9 = await Application.create({
    student: seededCadets[8].user._id,
    course: courseAdvEps._id,
    cohort: cohortAdvEps._id,
    status: 'Foundation Required',
    eligibilityStatus: 'Foundation Required',
    missingRequirements: ['Missing mandatory prerequisite course: CubeSat Telemetry & Ground Stations'],
    submittedAt: new Date(Date.now() - 4 * 86400000),
  });

  const appCadet10 = await Application.create({
    student: seededCadets[9].user._id,
    course: course3._id,
    cohort: cohort3._id,
    status: 'Eligible',
    eligibilityStatus: 'Eligible',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 2 * 86400000),
  });

  const appCadet11 = await Application.create({
    student: seededCadets[10].user._id,
    course: courseRoboticsSchools._id,
    cohort: cohortRoboticsSchools._id,
    status: 'Under Review',
    eligibilityStatus: 'Submitted',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 1 * 86400000),
  });

  const appCadet12 = await Application.create({
    student: seededCadets[11].user._id,
    course: course2._id,
    cohort: cohort2._id,
    status: 'Provisional_Seat_Hold',
    eligibilityStatus: 'Eligible',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 2 * 86400000),
  });

  const appCadet13 = await Application.create({
    student: seededCadets[12].user._id,
    course: course3._id,
    cohort: cohort3._id,
    status: 'Accepted',
    eligibilityStatus: 'Eligible',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 4 * 86400000),
  });

  const appCadet14 = await Application.create({
    student: seededCadets[13].user._id,
    course: courseCanSat._id,
    cohort: cohortCanSat._id,
    status: 'Submitted',
    eligibilityStatus: 'Submitted',
    missingRequirements: [],
    submittedAt: new Date(Date.now() - 1 * 86400000),
  });

  const appCadet15 = await Application.create({
    student: seededCadets[14].user._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Needs Information',
    eligibilityStatus: 'Submitted',
    missingRequirements: ['National ID / Registration Scan'],
    submittedAt: new Date(Date.now() - 3 * 86400000),
  });

  // 9.3 Seed Commercial Invoices Across States (Paid, Pending Active 72h, Expired, Waived, Refunded)
  // 1. Paid Invoice via InstaPay (Cadet 5)
  const invCadet5 = await Invoice.create({
    invoiceNumber: 'INV-2026-0501',
    student: seededCadets[4].user._id,
    application: appCadet5._id,
    cohort: cohort1._id,
    course: course1._id,
    amount: 3500,
    balanceDue: 0,
    dueAt: new Date(cohort1.startDate.getTime() - 72 * 3600 * 1000),
    status: 'Paid',
    paidAt: new Date(Date.now() - 4 * 86400000),
    paymentMethod: 'InstaPay',
    providerReference: 'INSTAPAY-CADET5-7721',
    notes: 'Paid via official InstaPay instant transfer.',
  });
  await PaymentTransaction.create({
    transactionId: 'TXN-INSTAPAY-CADET5-7721',
    invoice: invCadet5._id,
    student: seededCadets[4].user._id,
    amount: 3500,
    method: 'InstaPay',
    externalReference: 'ahmed.zaki@instapay',
    status: 'Success',
    notes: 'InstaPay transfer verified.',
  });

  // 2. Paid Invoice via Vodafone Cash (Cadet 13)
  const invCadet13 = await Invoice.create({
    invoiceNumber: 'INV-2026-0502',
    student: seededCadets[12].user._id,
    application: appCadet13._id,
    cohort: cohort3._id,
    course: course3._id,
    amount: 2800,
    balanceDue: 0,
    dueAt: new Date(cohort3.startDate.getTime() - 72 * 3600 * 1000),
    status: 'Paid',
    paidAt: new Date(Date.now() - 3 * 86400000),
    paymentMethod: 'Vodafone Cash',
    providerReference: 'VF-CASH-CADET13-8832',
    notes: 'Vodafone Cash wallet transfer settled.',
  });
  await PaymentTransaction.create({
    transactionId: 'TXN-VFCASH-CADET13-8832',
    invoice: invCadet13._id,
    student: seededCadets[12].user._id,
    amount: 2800,
    method: 'Vodafone Cash',
    externalReference: '01099130013',
    status: 'Success',
    notes: 'Vodafone Cash wallet settlement confirmed.',
  });

  // 3. Pending Invoice with Active 72h Countdown (Cadet 4)
  const invCadet4 = await Invoice.create({
    invoiceNumber: 'INV-2026-0503',
    student: seededCadets[3].user._id,
    application: appCadet4._id,
    cohort: cohort1._id,
    course: course1._id,
    amount: 3500,
    balanceDue: 3500,
    dueAt: new Date(Date.now() + 48 * 3600 * 1000), // 48 hours remaining (>0, active 72h countdown)
    status: 'Pending',
    notes: 'Provisional seat hold. 72-hour countdown timer active.',
  });

  // 4. Pending Invoice with Active 72h Countdown (Cadet 12)
  const invCadet12 = await Invoice.create({
    invoiceNumber: 'INV-2026-0504',
    student: seededCadets[11].user._id,
    application: appCadet12._id,
    cohort: cohort2._id,
    course: course2._id,
    amount: 4200,
    balanceDue: 4200,
    dueAt: new Date(Date.now() + 36 * 3600 * 1000), // 36 hours remaining
    status: 'Pending',
    notes: 'Provisional seat hold in space robotics program.',
  });

  // 5. Expired Invoice (Cadet 10)
  const invCadet10 = await Invoice.create({
    invoiceNumber: 'INV-2026-0505',
    student: seededCadets[9].user._id,
    application: appCadet10._id,
    cohort: cohort3._id,
    course: course3._id,
    amount: 2800,
    balanceDue: 2800,
    dueAt: new Date(Date.now() - 14 * 3600 * 1000), // expired 14 hours ago
    expiredAt: new Date(Date.now() - 14 * 3600 * 1000),
    status: 'Expired',
    notes: 'Payment deadline elapsed under institutional 72-hour seat reservation rule.',
  });

  // 6. Waived Invoice Sponsored by EGSA (Cadet 3)
  const invCadet3 = await Invoice.create({
    invoiceNumber: 'INV-2026-0506',
    student: seededCadets[2].user._id,
    application: appCadet3._id,
    cohort: cohort1._id,
    course: course1._id,
    amount: 3500,
    balanceDue: 0,
    waivedAmount: 3500,
    status: 'Waived',
    sponsorWaiver: {
      applied: true,
      waiverType: 'Full',
      waiverPercent: 100,
      sponsorName: 'Egyptian Space Agency Scholarship',
      reason: 'Presidential Space Technology Fellowship for Excellence',
      originalAmount: 3500,
      waivedAmount: 3500,
      appliedBy: adminUser._id,
      appliedAt: new Date(Date.now() - 3 * 86400000),
    },
    notes: 'Full institutional sponsorship waiver granted.',
  });

  // 7. Refunded Invoice (Cadet 8)
  const invCadet8 = await Invoice.create({
    invoiceNumber: 'INV-2026-0507',
    student: seededCadets[7].user._id,
    application: appCadet8._id,
    cohort: cohort2._id,
    course: course2._id,
    amount: 4200,
    balanceDue: 0,
    status: 'Refunded',
    refundStatus: 'Refunded',
    refundAmount: 4200,
    refundReason: 'Cadet selected for International Astronautical Federation (IAF) Symposium in Milan.',
    refundedAt: new Date(Date.now() - 2 * 86400000),
    refundedBy: adminUser._id,
    paidAt: new Date(Date.now() - 8 * 86400000),
    paymentMethod: 'InstaPay',
    notes: 'Official institutional tuition refund processed and approved.',
  });

  // 9.4 Enrollments & Attendance Records for Healthy (>85%) and At-Risk (<85%) Cadets
  // Cadet 5: Confirmed enrollment in Cohort 1 (CubeSat) - HEALTHY (>85%)
  const enrCadet5 = await Enrollment.create({
    student: seededCadets[4].user._id,
    course: course1._id,
    cohort: cohort1._id,
    application: appCadet5._id,
    status: 'Confirmed',
    seatStatus: 'Confirmed',
    paymentStatus: 'Paid',
    invoice: invCadet5._id,
    enrollmentDate: new Date(Date.now() - 10 * 86400000),
  });

  // Cadet 5 attended all 3 sessions (100% attendance -> Healthy)
  for (const s of [trainSess1, trainSess2, trainSess3]) {
    await AttendanceRecord.create({
      session: s._id,
      student: seededCadets[4].user._id,
      enrollment: enrCadet5._id,
      course: course1._id,
      cohort: cohort1._id,
      status: 'verified',
      verified: true,
      verifiedAt: new Date(),
      verifiedBy: instructor1._id,
      checkInTime: new Date(s.date || Date.now()),
      checkInMethod: 'QR_Scan',
      notes: 'On-time laboratory attendance confirmed',
    }).catch(() => {});
  }

  // Cadet 3: Confirmed enrollment in Cohort 1 (CubeSat) - AT-RISK (<85%)
  const enrCadet3 = await Enrollment.create({
    student: seededCadets[2].user._id,
    course: course1._id,
    cohort: cohort1._id,
    application: appCadet3._id,
    status: 'Confirmed',
    seatStatus: 'Confirmed',
    paymentStatus: 'Paid',
    invoice: invCadet3._id,
    enrollmentDate: new Date(Date.now() - 10 * 86400000),
  });

  // Cadet 3 was Absent in Session 1, Absent in Session 2, Present in Session 3 (1/3 = 33% -> AT-RISK!)
  await AttendanceRecord.create({
    session: trainSess1._id,
    student: seededCadets[2].user._id,
    enrollment: enrCadet3._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Absent',
    verified: true,
    verifiedAt: new Date(),
    verifiedBy: instructor1._id,
    checkInMethod: 'Manual_Instructor',
    notes: 'Unexcused absence recorded',
  }).catch(() => {});

  await AttendanceRecord.create({
    session: trainSess2._id,
    student: seededCadets[2].user._id,
    enrollment: enrCadet3._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'Absent',
    verified: true,
    verifiedAt: new Date(),
    verifiedBy: instructor1._id,
    checkInMethod: 'Manual_Instructor',
    notes: 'Unexcused absence recorded',
  }).catch(() => {});

  await AttendanceRecord.create({
    session: trainSess3._id,
    student: seededCadets[2].user._id,
    enrollment: enrCadet3._id,
    course: course1._id,
    cohort: cohort1._id,
    status: 'verified',
    verified: true,
    verifiedAt: new Date(),
    verifiedBy: instructor1._id,
    checkInTime: new Date(),
    checkInMethod: 'QR_Scan',
    notes: 'Present for Doppler pass session',
  }).catch(() => {});

  // Cadet 13: Confirmed enrollment in Cohort 3 (Orbital Mechanics) - HEALTHY
  const enrCadet13 = await Enrollment.create({
    student: seededCadets[12].user._id,
    course: course3._id,
    cohort: cohort3._id,
    application: appCadet13._id,
    status: 'Confirmed',
    seatStatus: 'Confirmed',
    paymentStatus: 'Paid',
    invoice: invCadet13._id,
    enrollmentDate: new Date(Date.now() - 8 * 86400000),
  });

  // 9.5 Course Evaluations with High Ratings (4.5 to 5.0 Stars) & Qualitative Feedback
  await Evaluation.create({
    student: seededCadets[4].user._id,
    course: course1._id,
    cohort: cohort1._id,
    enrollment: enrCadet5._id,
    overallRating: 5.0,
    ratings: { content: 5, instructor: 5, platform: 5, facilities: 5 },
    comments: 'Exceptional hands-on telemetry experience at the EGSA ground station. Real tracking pass was extraordinary!',
    isAnonymous: false,
    courseFeedbackCompleted: true,
    agencyFeedbackCompleted: true,
    submittedAt: new Date(Date.now() - 3 * 86400000),
  });

  await Evaluation.create({
    student: seededCadets[12].user._id,
    course: course3._id,
    cohort: cohort3._id,
    enrollment: enrCadet13._id,
    overallRating: 4.8,
    ratings: { content: 5, instructor: 5, platform: 4, facilities: 5 },
    comments: 'Superb orbital mechanics derivations, vis-viva equation exercises, and constellation coverage simulations.',
    isAnonymous: false,
    courseFeedbackCompleted: true,
    agencyFeedbackCompleted: true,
    submittedAt: new Date(Date.now() - 2 * 86400000),
  });

  await Evaluation.create({
    student: student1._id,
    course: course2._id,
    cohort: cohort2._id,
    enrollment: enrOmar2._id,
    overallRating: 4.9,
    ratings: { content: 5, instructor: 5, platform: 5, facilities: 4 },
    comments: 'Outstanding kinematics and CAN avionics laboratory. The microgravity simulator provided deep practical insights.',
    isAnonymous: false,
    courseFeedbackCompleted: true,
    agencyFeedbackCompleted: true,
    submittedAt: new Date(Date.now() - 1 * 86400000),
  });

  // 9.6 Immutable Institutional Audit Logs
  console.log('[SEED] Seeding active immutable audit logs for governance & compliance...');
  await AuditLog.insertMany([
    {
      actor: adminUser._id,
      user: adminUser._id,
      action: 'ADMIN_OVERRIDE',
      entity: 'Application',
      resource: 'Application',
      entityId: appCadet3._id,
      resourceId: appCadet3._id,
      division: 'UNIVERSITY',
      before: { status: 'Manual Review' },
      after: { status: 'Eligible' },
      reason: 'Academic Affairs Council validated equivalent RF signal laboratory credits from Cairo University.',
      details: {
        previousStatus: 'Manual Review',
        newStatus: 'Eligible',
        reason: 'Academic Affairs Council validated equivalent RF signal laboratory credits from Cairo University.',
        studentName: 'Hossam Farid',
      },
      timestamp: new Date(Date.now() - 3 * 86400000),
    },
    {
      actor: adminUser._id,
      user: adminUser._id,
      action: 'SPONSOR_WAIVER',
      entity: 'Invoice',
      resource: 'Invoice',
      entityId: invCadet3._id,
      resourceId: invCadet3._id,
      division: 'UNIVERSITY',
      before: { status: 'Pending', balanceDue: 3500 },
      after: { status: 'Waived', balanceDue: 0 },
      reason: 'Presidential Space Technology Fellowship for Excellence granted full tuition waiver.',
      details: {
        sponsorName: 'Egyptian Space Agency Scholarship',
        waiverType: 'Full',
        waiverPercent: 100,
        waivedAmount: 3500,
        studentName: 'Hossam Farid',
        invoiceNumber: 'INV-2026-0506',
      },
      timestamp: new Date(Date.now() - 3 * 86400000),
    },
    {
      actor: adminUser._id,
      user: adminUser._id,
      action: 'WAITLIST_PROMOTION',
      entity: 'Application',
      resource: 'Application',
      entityId: appAliWaitlist._id,
      resourceId: appAliWaitlist._id,
      division: 'UNIVERSITY',
      before: { status: 'Waitlisted' },
      after: { status: 'Accepted' },
      reason: 'Promoted from waitlist queue following automated 72h expiration of unpaid provisional hold.',
      details: {
        previousStatus: 'Waitlisted',
        newStatus: 'Accepted',
        reason: 'Promoted from waitlist queue following automated 72h expiration of unpaid provisional hold.',
        studentName: 'Ali Mahmoud',
      },
      timestamp: new Date(Date.now() - 2 * 86400000),
    },
    {
      actor: superAdminUser._id,
      user: superAdminUser._id,
      action: 'SYSTEM_CONFIG_UPDATE',
      entity: 'SystemConfig',
      resource: 'SystemConfig',
      division: null,
      before: { seatReservationHours: 48, minimumAttendanceGate: 80 },
      after: { seatReservationHours: 72, minimumAttendanceGate: 85 },
      reason: 'Aligned platform governance with EGSA Space Academy 2026 Institutional Charter.',
      details: {
        seatReservationHours: 72,
        minimumAttendanceGate: 85,
        passingAssessmentThreshold: 70,
      },
      timestamp: new Date(Date.now() - 5 * 86400000),
    },
    {
      actor: preUnivAdminUser._id,
      user: preUnivAdminUser._id,
      action: 'REJECT_APPLICATION',
      entity: 'Application',
      resource: 'Application',
      entityId: appCadet6._id,
      resourceId: appCadet6._id,
      division: 'PRE_UNIVERSITY',
      before: { status: 'Submitted' },
      after: { status: 'Rejected' },
      reason: 'Does not meet minimum secondary school mathematics requirements for telemetry budgeting.',
      details: {
        previousStatus: 'Submitted',
        newStatus: 'Rejected',
        reason: 'Does not meet minimum secondary school mathematics requirements for telemetry budgeting.',
        studentName: 'Layla Mostafa',
      },
      timestamp: new Date(Date.now() - 4 * 86400000),
    },
    {
      actor: adminUser._id,
      user: adminUser._id,
      action: 'REQUEST_INFO',
      entity: 'Application',
      resource: 'Application',
      entityId: appCadet15._id,
      resourceId: appCadet15._id,
      division: 'UNIVERSITY',
      before: { status: 'Under Review' },
      after: { status: 'Needs Information' },
      reason: 'Official National ID scan required for security clearance at ground station.',
      details: {
        previousStatus: 'Under Review',
        newStatus: 'Needs Information',
        missingRequirements: ['National ID / Registration Scan'],
        studentName: 'Bassem Galal',
      },
      timestamp: new Date(Date.now() - 2 * 86400000),
    },
  ]);


  // =====================================================================
  // 10. Seed Notifications for All Users
  // =====================================================================
  console.log('[SEED] Creating notifications...');
  await Notification.insertMany([
    {
      recipient: student1._id,
      title: 'Active Session QR Code Available',
      message: 'Live Session 4 is now in progress. Scan the classroom QR code to record your telemetry lab attendance.',
      type: 'info',
      isRead: false,
      relatedCourse: course1._id,
      createdAt: new Date(Date.now() - 30 * 60000),
    },
    {
      recipient: student1._id,
      title: 'Assignment Graded',
      message: 'Your submission for "Space Manipulator Kinematic DH-Parameter Analysis" has been evaluated (Score: 82/100).',
      type: 'info',
      isRead: false,
      relatedCourse: course2._id,
      createdAt: new Date(Date.now() - 6 * 3600000),
    },
    {
      recipient: student2._id,
      title: 'Active Session QR Code Available',
      message: 'Live Session 4 is now in progress. Scan the classroom QR code to record your telemetry lab attendance.',
      type: 'info',
      isRead: false,
      relatedCourse: course1._id,
      createdAt: new Date(Date.now() - 25 * 60000),
    },
    {
      recipient: instructor1._id,
      title: 'Attendance Verifications Pending',
      message: 'Cadets have scanned into Live Session 4. 2 check-in records are awaiting your verification.',
      type: 'warning',
      isRead: false,
      createdAt: new Date(Date.now() - 20 * 60000),
    },
    {
      recipient: instructor2._id,
      title: 'Robotics Lab Check-Ins Pending',
      message: '2 student check-in records in Session 5 are awaiting your instructor sign-off.',
      type: 'warning',
      isRead: false,
      createdAt: new Date(Date.now() - 15 * 60000),
    },
    {
      recipient: adminUser._id,
      title: 'Administrative Clearance Requests Pending',
      message: '2 new clearance requests (Summer Training & Syndicate Verification) have been submitted for review.',
      type: 'warning',
      isRead: false,
      createdAt: new Date(Date.now() - 12 * 3600000),
    },
  ]);

  // Seed default readiness assessment questions & crossfit course
  const { ensureCrossfitCourse } = require('../services/crossfitInitService');
  await ensureCrossfitCourse().catch(() => {});
  const { ensureDefaultReadinessQuestions } = require('../services/defaultReadinessInitService');
  await ensureDefaultReadinessQuestions().catch(() => {});

  console.log('[SEED] Phase 1 Core Auth accounts seeded successfully!');
  console.log('========================================================================');
  console.log('CORE AUTH SEED ACCOUNTS (All with password: Password123!):');
  console.log('1. Student (University):     omar.student@egsa.gov.eg');
  console.log('2. Student (Pre-University): mariam.cadet@egsa.gov.eg');
  console.log('3. Instructor:               tarek.instructor@egsa.gov.eg');
  console.log('4. University Admin:         sara.univadmin@egsa.gov.eg');
  console.log('5. Super Admin:              ayman.superadmin@egsa.gov.eg');
  console.log('------------------------------------------------------------------------');
  console.log('Additional Aliases:');
  console.log('   omar.hassan@eng.cu.edu.eg, mariam.khaled@eng.asu.edu.eg');
  console.log('   tarek.elkady@egsa.gov.eg, dr.amr@egsa.gov.eg, sara.mostafa@egsa.gov.eg');
  console.log('========================================================================');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
