const mongoose = require('mongoose');

const StudentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    division: { type: String, enum: ['PRE_UNIVERSITY', 'UNIVERSITY'], default: 'UNIVERSITY' },

    // Structured Specification Sections (Sections 4, 6, 10.1, 17)
    personalInfo: {
      nationalId: { type: String, trim: true, default: '' },
      dateOfBirth: { type: Date },
      gender: { type: String, enum: ['male', 'female', 'other', 'unspecified', ''], default: '' },
      phone: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
      guardianContact: {
        name: { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        relation: { type: String, trim: true, default: '' },
      },
    },

    academicInfo: {
      institutionName: { type: String, trim: true, default: '' },
      faculty: { type: String, trim: true, default: '' },
      department: { type: String, trim: true, default: '' },
      studyYear: { type: String, trim: true, default: '' },
      graduationYear: { type: Number },
      studentIdCardUrl: { type: String, trim: true, default: '' },
    },

    spaceExperience: {
      backgroundSummary: { type: String, trim: true, default: '' },
      technicalSkills: [{ type: String, trim: true }],
      completedExternalCourses: [{ type: String, trim: true }],
      portfolioUrl: { type: String, trim: true, default: '' },
    },

    profileCompletionPercentage: { type: Number, default: 0, min: 0, max: 100 },

    // Backward compatibility fields
    dateOfBirth: { type: Date },
    status: { type: String, enum: ['student', 'graduate'], default: 'student' },
    university: { type: String, default: '' },
    faculty: { type: String, default: '' },
    department: { type: String, default: '' },
    academicYear: { type: String, default: '' },
    graduationYear: { type: Number },
    skills: [{ type: String }],
    experience: [{ type: String }],
    previousTraining: [{ type: String }],
    learningGoal: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningGoal' },
    completedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    profileCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Method to compute profile completion percentage dynamically (0 - 100%)
StudentProfileSchema.methods.calculateCompletionPercentage = function (userDoc = null) {
  let score = 0;

  // 1. Personal & Contact (35%)
  const nationalId = this.personalInfo?.nationalId || userDoc?.nationalId;
  if (nationalId && nationalId.trim().length >= 6) score += 10;

  const dob = this.personalInfo?.dateOfBirth || this.dateOfBirth;
  if (dob) score += 10;

  const phone = this.personalInfo?.phone || userDoc?.phone;
  if (phone && phone.trim().length >= 6) score += 5;

  if (this.personalInfo?.gender) score += 5;

  if (this.division === 'PRE_UNIVERSITY') {
    if (this.personalInfo?.guardianContact?.phone || this.personalInfo?.guardianContact?.name) {
      score += 5;
    }
  } else {
    if (this.personalInfo?.address || this.personalInfo?.guardianContact?.name) {
      score += 5;
    }
  }

  // 2. Academic Affiliation (35%)
  const inst = this.academicInfo?.institutionName || this.university;
  if (inst && inst.trim().length > 0) score += 15;

  const fac = this.academicInfo?.faculty || this.faculty;
  if (fac && fac.trim().length > 0) score += 10;

  const yr = this.academicInfo?.studyYear || this.academicYear;
  if (yr && yr.trim().length > 0) score += 5;

  const gradYr = this.academicInfo?.graduationYear || this.graduationYear;
  if (gradYr) score += 5;

  // 3. Space Experience & Skills (30%)
  const skillsCount = (this.spaceExperience?.technicalSkills?.length || 0) + (this.skills?.length || 0);
  if (skillsCount > 0) score += 15;

  const summary = this.spaceExperience?.backgroundSummary || (this.experience && this.experience[0]);
  if (summary && summary.trim().length > 0) score += 10;

  const courses = (this.spaceExperience?.completedExternalCourses?.length || 0) + (this.previousTraining?.length || 0);
  const portfolio = this.spaceExperience?.portfolioUrl;
  if (courses > 0 || (portfolio && portfolio.trim().length > 0)) score += 5;

  return Math.min(100, Math.max(0, score));
};

StudentProfileSchema.pre('save', function (next) {
  // Sync division
  if (!this.division || this.division === 'UNIVERSITY') {
    const textToCheck = `${this.university || ''} ${this.academicInfo?.institutionName || ''} ${this.faculty || ''} ${this.academicYear || ''}`.toLowerCase();
    if (
      textToCheck.includes('pre-university') ||
      textToCheck.includes('grade') ||
      textToCheck.includes('school') ||
      textToCheck.includes('cadet')
    ) {
      this.division = 'PRE_UNIVERSITY';
    }
  }

  // Ensure sub-objects exist
  if (!this.personalInfo) this.personalInfo = {};
  if (!this.academicInfo) this.academicInfo = {};
  if (!this.spaceExperience) this.spaceExperience = {};

  // Bidirectional Synchronization: Academic Info
  if (this.academicInfo.institutionName && !this.university) {
    this.university = this.academicInfo.institutionName;
  } else if (this.university && !this.academicInfo.institutionName) {
    this.academicInfo.institutionName = this.university;
  }

  if (this.academicInfo.faculty && !this.faculty) {
    this.faculty = this.academicInfo.faculty;
  } else if (this.faculty && !this.academicInfo.faculty) {
    this.academicInfo.faculty = this.faculty;
  }

  if (this.academicInfo.department && !this.department) {
    this.department = this.academicInfo.department;
  } else if (this.department && !this.academicInfo.department) {
    this.academicInfo.department = this.department;
  }

  if (this.academicInfo.studyYear && !this.academicYear) {
    this.academicYear = this.academicInfo.studyYear;
  } else if (this.academicYear && !this.academicInfo.studyYear) {
    this.academicInfo.studyYear = this.academicYear;
  }

  if (this.academicInfo.graduationYear && !this.graduationYear) {
    this.graduationYear = this.academicInfo.graduationYear;
  } else if (this.graduationYear && !this.academicInfo.graduationYear) {
    this.academicInfo.graduationYear = this.graduationYear;
  }

  // Bidirectional Synchronization: Space Experience
  if (this.spaceExperience.technicalSkills && this.spaceExperience.technicalSkills.length > 0) {
    if (!this.skills || this.skills.length === 0) {
      this.skills = [...this.spaceExperience.technicalSkills];
    }
  } else if (this.skills && this.skills.length > 0) {
    this.spaceExperience.technicalSkills = [...this.skills];
  }

  if (this.spaceExperience.completedExternalCourses && this.spaceExperience.completedExternalCourses.length > 0) {
    if (!this.previousTraining || this.previousTraining.length === 0) {
      this.previousTraining = [...this.spaceExperience.completedExternalCourses];
    }
  } else if (this.previousTraining && this.previousTraining.length > 0) {
    this.spaceExperience.completedExternalCourses = [...this.previousTraining];
  }

  if (this.spaceExperience.backgroundSummary) {
    if (!this.experience || this.experience.length === 0) {
      this.experience = [this.spaceExperience.backgroundSummary];
    }
  } else if (this.experience && this.experience.length > 0) {
    this.spaceExperience.backgroundSummary = this.experience.join('; ');
  }

  // Bidirectional Synchronization: Personal Info
  if (this.personalInfo.dateOfBirth && !this.dateOfBirth) {
    this.dateOfBirth = this.personalInfo.dateOfBirth;
  } else if (this.dateOfBirth && !this.personalInfo.dateOfBirth) {
    this.personalInfo.dateOfBirth = this.dateOfBirth;
  }

  // Compute completion percentage
  this.profileCompletionPercentage = this.calculateCompletionPercentage();
  this.profileCompleted = this.profileCompletionPercentage >= 70;

  next();
});

module.exports = mongoose.model('StudentProfile', StudentProfileSchema);
