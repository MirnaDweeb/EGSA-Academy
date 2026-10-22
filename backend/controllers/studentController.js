const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const Certificate = require('../models/Certificate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/ApiResponse');
const { AppError } = require('../middleware/error');
const { escapeRegex } = require('../utils/helpers');

// --- Student Self-Service Endpoints ---

async function getProfile(req, res, next) {
  try {
    let profile = await StudentProfile.findOne({ user: req.user._id })
      .populate('learningGoal')
      .populate('completedCourses', 'title level');

    if (!profile) {
      profile = await StudentProfile.create({
        user: req.user._id,
        division: req.user.division || 'UNIVERSITY',
        personalInfo: {
          phone: req.user.phone || '',
          nationalId: req.user.nationalId || '',
        },
      });
    }

    const userDoc = await User.findById(req.user._id);

    // Sync personalInfo phone & nationalId from user if missing
    let needsSave = false;
    if (userDoc) {
      if (!profile.personalInfo) profile.personalInfo = {};
      if (!profile.personalInfo.phone && userDoc.phone) {
        profile.personalInfo.phone = userDoc.phone;
        needsSave = true;
      }
      if (!profile.personalInfo.nationalId && userDoc.nationalId) {
        profile.personalInfo.nationalId = userDoc.nationalId;
        needsSave = true;
      }
      if (userDoc.division && profile.division !== userDoc.division) {
        profile.division = userDoc.division;
        needsSave = true;
      }
      const calculated = profile.calculateCompletionPercentage(userDoc);
      if (profile.profileCompletionPercentage !== calculated) {
        profile.profileCompletionPercentage = calculated;
        needsSave = true;
      }
    }
    if (needsSave) {
      await profile.save();
    }

    const safeUser = userDoc
      ? (userDoc.toSafeObject
          ? userDoc.toSafeObject()
          : {
              id: userDoc._id,
              fullName: userDoc.fullName,
              email: userDoc.email,
              phone: userDoc.phone,
              nationalId: userDoc.nationalId,
              division: userDoc.division,
              accountStatus: userDoc.accountStatus,
              registrationNumber: userDoc.registrationNumber,
            })
      : {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          phone: req.user.phone,
          division: req.user.division,
        };

    const profileObj = profile.toObject();

    return res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        ...profileObj,
        user: safeUser,
        profile: profileObj,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    let profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = new StudentProfile({ user: req.user._id });
    }

    const userDoc = await User.findById(req.user._id);
    let userNeedsSave = false;

    // 1. Division sync
    const newDivision = req.body.division || req.body.academicInfo?.division;
    if (newDivision && ['PRE_UNIVERSITY', 'UNIVERSITY'].includes(newDivision)) {
      profile.division = newDivision;
      if (userDoc && userDoc.division !== newDivision) {
        userDoc.division = newDivision;
        userNeedsSave = true;
      }
    }

    // 2. Personal Info & User phone/nationalId sync
    if (req.body.personalInfo && typeof req.body.personalInfo === 'object') {
      profile.personalInfo = {
        ...(profile.personalInfo?.toObject ? profile.personalInfo.toObject() : profile.personalInfo || {}),
        ...req.body.personalInfo,
      };

      if (req.body.personalInfo.guardianContact) {
        profile.personalInfo.guardianContact = {
          ...(profile.personalInfo.guardianContact?.toObject
            ? profile.personalInfo.guardianContact.toObject()
            : profile.personalInfo.guardianContact || {}),
          ...req.body.personalInfo.guardianContact,
        };
      }

      if (req.body.personalInfo.phone && userDoc && userDoc.phone !== req.body.personalInfo.phone.trim()) {
        userDoc.phone = req.body.personalInfo.phone.trim();
        userNeedsSave = true;
      }
      if (
        req.body.personalInfo.nationalId &&
        userDoc &&
        (!userDoc.nationalId || userDoc.nationalId !== req.body.personalInfo.nationalId.trim())
      ) {
        userDoc.nationalId = req.body.personalInfo.nationalId.trim();
        userNeedsSave = true;
      }
    }

    // Direct phone or nationalId or fullName on body
    if (req.body.phone && userDoc && userDoc.phone !== req.body.phone.trim()) {
      userDoc.phone = req.body.phone.trim();
      profile.personalInfo = profile.personalInfo || {};
      profile.personalInfo.phone = req.body.phone.trim();
      userNeedsSave = true;
    }
    if (req.body.nationalId && userDoc && (!userDoc.nationalId || userDoc.nationalId !== req.body.nationalId.trim())) {
      userDoc.nationalId = req.body.nationalId.trim();
      profile.personalInfo = profile.personalInfo || {};
      profile.personalInfo.nationalId = req.body.nationalId.trim();
      userNeedsSave = true;
    }
    if (req.body.fullName && userDoc && userDoc.fullName !== req.body.fullName.trim()) {
      userDoc.fullName = req.body.fullName.trim();
      userNeedsSave = true;
    }

    if (userNeedsSave && userDoc) {
      await userDoc.save();
    }

    // 3. Academic Info
    if (req.body.academicInfo && typeof req.body.academicInfo === 'object') {
      profile.academicInfo = {
        ...(profile.academicInfo?.toObject ? profile.academicInfo.toObject() : profile.academicInfo || {}),
        ...req.body.academicInfo,
      };
    }

    // 4. Space Experience
    if (req.body.spaceExperience && typeof req.body.spaceExperience === 'object') {
      profile.spaceExperience = {
        ...(profile.spaceExperience?.toObject ? profile.spaceExperience.toObject() : profile.spaceExperience || {}),
        ...req.body.spaceExperience,
      };
      if (Array.isArray(req.body.spaceExperience.technicalSkills)) {
        profile.spaceExperience.technicalSkills = req.body.spaceExperience.technicalSkills
          .map((s) => String(s).trim())
          .filter(Boolean);
      }
      if (Array.isArray(req.body.spaceExperience.completedExternalCourses)) {
        profile.spaceExperience.completedExternalCourses = req.body.spaceExperience.completedExternalCourses
          .map((s) => String(s).trim())
          .filter(Boolean);
      }
    }

    // 5. Backward compatibility top-level fields
    const topLevelFields = [
      'dateOfBirth',
      'status',
      'university',
      'faculty',
      'department',
      'academicYear',
      'graduationYear',
      'skills',
      'experience',
      'previousTraining',
    ];
    topLevelFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        profile[field] = req.body[field];
      }
    });

    // Recompute percentage
    profile.profileCompletionPercentage = profile.calculateCompletionPercentage(userDoc);
    profile.profileCompleted = profile.profileCompletionPercentage >= 70;

    await profile.save();

    await profile.populate('learningGoal');
    await profile.populate('completedCourses', 'title level');

    const safeUser = userDoc
      ? (userDoc.toSafeObject
          ? userDoc.toSafeObject()
          : {
              id: userDoc._id,
              fullName: userDoc.fullName,
              email: userDoc.email,
              phone: userDoc.phone,
              nationalId: userDoc.nationalId,
              division: userDoc.division,
              accountStatus: userDoc.accountStatus,
              registrationNumber: userDoc.registrationNumber,
            })
      : {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          phone: req.user.phone,
          division: req.user.division,
        };

    const profileObj = profile.toObject();

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        ...profileObj,
        user: safeUser,
        profile: profileObj,
      },
    });
  } catch (err) {
    next(err);
  }
}

const getMe = getProfile;
const updateMe = updateProfile;

async function setGoal(req, res, next) {
  try {
    const { goalId } = req.body;
    if (!goalId) throw new AppError('goalId is required.', 400);

    const profile = await StudentProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { learningGoal: goalId } },
      { new: true }
    ).populate('learningGoal');
    if (!profile) throw new AppError('Profile not found.', 404);

    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

// --- Platform Admin Endpoints ---

const createStudentAdmin = asyncHandler(async (req, res) => {
  const { fullName, email, password, phone, division } = req.body;
  const nameVal = (fullName || req.body.name || '').trim();
  if (!nameVal || !email || !password) {
    throw ApiError.badRequest('Full name, email, and password are required');
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    fullName: nameVal,
    email: email.toLowerCase().trim(),
    passwordHash,
    role: 'student',
    phone: phone ? phone.trim() : undefined,
    division: division || req.scopeDivision || 'pre-university',
    isActive: true,
  });

  const profile = await StudentProfile.create({
    user: user._id,
    division: user.division,
  });

  return sendSuccess(res, 'Student provisioned successfully', {
    student: user.toSafeObject ? user.toSafeObject() : user,
    profile,
  }, 201);
});

const listStudents = asyncHandler(async (req, res) => {
  const { search = '', isActive, page = 1, limit = 20 } = req.query;
  const filter = { role: 'student' };

  if (req.scopeDivision && req.scopeDivision !== 'all') {
    filter.division = req.scopeDivision;
  }
  if (isActive !== undefined && isActive !== '') {
    filter.isActive = isActive === 'true' || isActive === true;
  }
  if (search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  const userIds = users.map((u) => u._id);
  const profiles = await StudentProfile.find({ user: { $in: userIds } });
  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

  const students = users.map((u) => {
    const safeUser = u.toSafeObject ? u.toSafeObject() : u.toObject();
    return {
      ...safeUser,
      profile: profileMap.get(String(u._id)) || null,
    };
  });

  return sendSuccess(
    res,
    'Students retrieved',
    { students },
    200,
    { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 }
  );
});

const getStudentById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'student') throw ApiError.notFound('Student not found');

  const profile = await StudentProfile.findOne({ user: user._id }).populate('learningGoal');
  const [applications, enrollments] = await Promise.all([
    Application.find({ student: user._id }).populate('course', 'title level price').sort({ createdAt: -1 }),
    Enrollment.find({ student: user._id }).populate('course', 'title level code').sort({ createdAt: -1 }),
  ]);

  return sendSuccess(res, 'Student retrieved', {
    student: user.toSafeObject ? user.toSafeObject() : user,
    profile,
    applications,
    enrollments,
  });
});

const updateStudentStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') throw ApiError.badRequest('isActive must be a boolean');

  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'student') throw ApiError.notFound('Student not found');

  user.isActive = isActive;
  await user.save();

  return sendSuccess(res, 'Student status updated', {
    student: user.toSafeObject ? user.toSafeObject() : user,
  });
});

const updateStudentAdmin = asyncHandler(async (req, res) => {
  const { fullName, email, phone, division } = req.body;
  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'student') throw ApiError.notFound('Student not found');

  if (fullName) user.fullName = fullName.trim();
  if (email) user.email = email.toLowerCase().trim();
  if (phone !== undefined) user.phone = phone.trim();
  if (division) user.division = division;

  await user.save();
  return sendSuccess(res, 'Student updated successfully', {
    student: user.toSafeObject ? user.toSafeObject() : user,
  });
});

const getStudentOverviewAdmin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'student') throw ApiError.notFound('Student not found');

  const profile = await StudentProfile.findOne({ user: user._id }).populate('learningGoal');
  const [applications, enrollments, certificates] = await Promise.all([
    Application.find({ student: user._id }).populate('course', 'title level price category').sort({ createdAt: -1 }),
    Enrollment.find({ student: user._id }).populate('course', 'title level code').populate('cohort', 'name startDate endDate').sort({ createdAt: -1 }),
    Certificate.find({ student: user._id }).sort({ issuedAt: -1 }),
  ]);

  return sendSuccess(res, 'Student overview retrieved', {
    student: user.toSafeObject ? user.toSafeObject() : user,
    profile,
    overview: {
      applicationCount: applications.length,
      enrollmentCount: enrollments.length,
      certificateCount: certificates ? certificates.length : 0,
      activeEnrollments: enrollments.filter((e) => e.status === 'Enrolled' || e.status === 'Active').length,
    },
    applications,
    enrollments,
    certificates: certificates || [],
  });
});

const getStudentReportPdfAdmin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'student') throw ApiError.notFound('Student not found');

  const filename = `EGSA_Student_${user._id}_Report.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);
  doc.fillColor('#3A6985').fontSize(18).text('Egyptian Space Agency — Student Academic Report', { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#222222').fontSize(12).text(`Student Name: ${user.fullName}`);
  doc.text(`Email: ${user.email}`);
  doc.text(`Phone: ${user.phone || 'N/A'}`);
  doc.text(`Division: ${user.division || 'General'}`);
  doc.text(`Registration Date: ${user.createdAt ? user.createdAt.toISOString().split('T')[0] : 'N/A'}`);
  doc.end();
});

module.exports = {
  getProfile,
  updateProfile,
  getMe,
  updateMe,
  setGoal,
  createStudentAdmin,
  listStudents,
  getStudentById,
  updateStudentStatus,
  updateStudentAdmin,
  getStudentOverviewAdmin,
  getStudentReportPdfAdmin,
};
