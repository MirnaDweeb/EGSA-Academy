import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { studentService } from '../../services/studentService';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'academic' | 'experience' | 'documents'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  // Data from backend
  const [user, setUser] = useState({});
  const [profile, setProfile] = useState({});

  // Form State
  const [formData, setFormData] = useState({
    division: 'UNIVERSITY',
    // Personal
    phone: '',
    nationalId: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    guardianName: '',
    guardianPhone: '',
    guardianRelation: '',
    // Academic
    institutionName: '',
    faculty: '',
    department: '',
    studyYear: '',
    graduationYear: '',
    status: 'student',
    studentIdCardUrl: '',
    // Space Experience
    backgroundSummary: '',
    technicalSkills: [],
    completedExternalCourses: [],
    portfolioUrl: '',
    cvUrl: '',
  });

  // Tag inputs helper state
  const [skillInput, setSkillInput] = useState('');
  const [courseInput, setCourseInput] = useState('');

  const suggestedSkills = [
    'Orbital Mechanics',
    'C++',
    'Python',
    'MATLAB/Simulink',
    'Telemetry & Tracking',
    'CanSat Avionics',
    'RTOS',
    'Arduino C',
    'RF Systems',
    'CAD & SolidWorks',
    'CubeSat Bus Design',
  ];

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await studentService.getProfile();
      const p = res.data?.profile || res.data || {};
      const u = res.data?.user || p.user || {};

      setUser(u);
      setProfile(p);

      const dobString = p.personalInfo?.dateOfBirth || p.dateOfBirth
        ? new Date(p.personalInfo?.dateOfBirth || p.dateOfBirth).toISOString().split('T')[0]
        : '';

      const techSkills = p.spaceExperience?.technicalSkills?.length
        ? p.spaceExperience.technicalSkills
        : (p.skills || []);

      const extCourses = p.spaceExperience?.completedExternalCourses?.length
        ? p.spaceExperience.completedExternalCourses
        : (p.previousTraining || []);

      setFormData({
        division: p.division || u.division || 'UNIVERSITY',
        // Personal
        phone: p.personalInfo?.phone || u.phone || '',
        nationalId: p.personalInfo?.nationalId || u.nationalId || '',
        dateOfBirth: dobString,
        gender: p.personalInfo?.gender || '',
        address: p.personalInfo?.address || '',
        guardianName: p.personalInfo?.guardianContact?.name || '',
        guardianPhone: p.personalInfo?.guardianContact?.phone || '',
        guardianRelation: p.personalInfo?.guardianContact?.relation || '',
        // Academic
        institutionName: p.academicInfo?.institutionName || p.university || '',
        faculty: p.academicInfo?.faculty || p.faculty || '',
        department: p.academicInfo?.department || p.department || '',
        studyYear: p.academicInfo?.studyYear || p.academicYear || '',
        graduationYear: p.academicInfo?.graduationYear || p.graduationYear || '',
        status: p.status || 'student',
        studentIdCardUrl: p.academicInfo?.studentIdCardUrl || '',
        // Space Experience
        backgroundSummary: p.spaceExperience?.backgroundSummary || (p.experience && p.experience.join('\n')) || '',
        technicalSkills: techSkills,
        completedExternalCourses: extCourses,
        portfolioUrl: p.spaceExperience?.portfolioUrl || '',
        cvUrl: p.cvUrl || '',
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Skill tag pill handlers
  const handleAddSkill = (skillToAdd) => {
    const val = (skillToAdd || skillInput).trim();
    if (val && !formData.technicalSkills.includes(val)) {
      setFormData((prev) => ({
        ...prev,
        technicalSkills: [...prev.technicalSkills, val],
      }));
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData((prev) => ({
      ...prev,
      technicalSkills: prev.technicalSkills.filter((s) => s !== skillToRemove),
    }));
  };

  const handleAddCourse = () => {
    const val = courseInput.trim();
    if (val && !formData.completedExternalCourses.includes(val)) {
      setFormData((prev) => ({
        ...prev,
        completedExternalCourses: [...prev.completedExternalCourses, val],
      }));
      setCourseInput('');
    }
  };

  const handleRemoveCourse = (courseToRemove) => {
    setFormData((prev) => ({
      ...prev,
      completedExternalCourses: prev.completedExternalCourses.filter((c) => c !== courseToRemove),
    }));
  };

  // Form submit handler with Zero Page Reload
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const payload = {
        division: formData.division,
        phone: formData.phone,
        nationalId: formData.nationalId,
        personalInfo: {
          nationalId: formData.nationalId,
          dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : undefined,
          gender: formData.gender,
          phone: formData.phone,
          address: formData.address,
          guardianContact: {
            name: formData.guardianName,
            phone: formData.guardianPhone,
            relation: formData.guardianRelation,
          },
        },
        academicInfo: {
          institutionName: formData.institutionName,
          faculty: formData.faculty,
          department: formData.department,
          studyYear: formData.studyYear,
          graduationYear: formData.graduationYear ? Number(formData.graduationYear) : undefined,
          studentIdCardUrl: formData.studentIdCardUrl,
        },
        spaceExperience: {
          backgroundSummary: formData.backgroundSummary,
          technicalSkills: formData.technicalSkills,
          completedExternalCourses: formData.completedExternalCourses,
          portfolioUrl: formData.portfolioUrl,
        },
        // Legacy top-level sync
        status: formData.status,
        university: formData.institutionName,
        faculty: formData.faculty,
        department: formData.department,
        academicYear: formData.studyYear,
        graduationYear: formData.graduationYear ? Number(formData.graduationYear) : undefined,
        skills: formData.technicalSkills,
        previousTraining: formData.completedExternalCourses,
        experience: formData.backgroundSummary ? [formData.backgroundSummary] : [],
      };

      const res = await studentService.updateProfile(payload);
      const updatedProfile = res.data?.profile || res.data || {};
      const updatedUser = res.data?.user || updatedProfile.user || user;

      setProfile(updatedProfile);
      setUser(updatedUser);
      setSavedMessage(res.message || 'Profile updated successfully');

      // Scroll smoothly to top of card to notice feedback
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) return <LoadingState label="Loading your Egyptian Space Academy student profile…" />;
  if (error && !profile.user && !user.fullName) return <ErrorState message={error} onRetry={loadProfile} />;

  const isCadet = formData.division === 'PRE_UNIVERSITY';
  const completionPercentage = profile.profileCompletionPercentage !== undefined
    ? profile.profileCompletionPercentage
    : (profile.profileCompleted ? 100 : 50);

  return (
    <div className={styles.pageContainer}>
      <PageHeader
        title="Comprehensive Student Profile & Credentials"
        subtitle="Manage your academic credentials, STEM competencies, verified national identity, and space research experience."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Learner Profile' },
        ]}
      />

      {/* Floating / Dismissible Save Alert */}
      {savedMessage && (
        <div className={styles.alertSuccessToast} role="alert">
          <div className="d-flex align-items-center gap-3">
            <i className="fa-solid fa-circle-check fs-4"></i>
            <div>
              <strong className="d-block">{savedMessage}</strong>
              <small className="text-muted">Database record and authentication identity synchronized successfully.</small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-link text-decoration-none text-success"
            onClick={() => setSavedMessage('')}
            aria-label="Dismiss alert"
          >
            <i className="fa-solid fa-xmark fs-5"></i>
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fa-solid fa-triangle-exclamation me-2"></i> {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Aerospace Header Card */}
      <div className={styles.headerCard}>
        <div className="row align-items-center gy-4">
          <div className="col-md-auto text-center">
            <div className={styles.avatarWrapper}>
              {user.fullName
                ? user.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                : 'EA'}
            </div>
          </div>

          <div className="col-md">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <h3 className="fw-bold mb-0 text-white">{user.fullName || 'EgSA Academy Student'}</h3>
              <span className={isCadet ? styles.divisionPillCadet : styles.divisionPillUniv}>
                <i className={isCadet ? 'fa-solid fa-rocket me-1' : 'fa-solid fa-user-graduate me-1'}></i>
                {isCadet ? 'Cadet (Pre-University)' : 'University Student'}
              </span>
              {user.accountStatus === 'active' && (
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                  <i className="fa-solid fa-shield-check me-1"></i> Active Record
                </span>
              )}
            </div>

            <p className="text-light mb-3 opacity-75 small">
              <i className="fa-regular fa-envelope me-2"></i>{user.email || 'student@egsa.gov.eg'}
              <span className="mx-2">•</span>
              <i className="fa-solid fa-phone me-2"></i>{formData.phone || 'No phone recorded'}
              {user.registrationNumber && (
                <>
                  <span className="mx-2">•</span>
                  <i className="fa-solid fa-id-badge me-2"></i>{user.registrationNumber}
                </>
              )}
            </p>

            {/* Profile Completion Bar */}
            <div className="col-lg-8 col-xl-7">
              <div className="d-flex justify-content-between align-items-center text-white small">
                <span>Profile Completion & Verification</span>
                <span className="fw-bold text-white">{completionPercentage}%</span>
              </div>
              <div className={styles.progressContainer}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${completionPercentage}%` }}
                  role="progressbar"
                  aria-valuenow={completionPercentage}
                  aria-valuemin="0"
                  aria-valuemax="100"
                ></div>
              </div>
            </div>
          </div>

          <div className="col-md-auto text-md-end">
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Saving Profile…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i> Save Profile
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation (Zero Page Reload) */}
      <div className={styles.tabsContainer}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'personal' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          <i className="fa-solid fa-id-card"></i> 1. Personal & Contact
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'academic' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('academic')}
        >
          <i className="fa-solid fa-graduation-cap"></i> 2. Academic Affiliation
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'experience' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('experience')}
        >
          <i className="fa-solid fa-satellite"></i> 3. Space Experience & Skills
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'documents' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <i className="fa-solid fa-file-contract"></i> 4. Credentials & Documents
        </button>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="row g-4">
          <div className="col-lg-8">
            <div className={styles.contentCard}>
              {/* TAB 1: Personal & Contact */}
              {activeTab === 'personal' && (
                <div>
                  <h4 className={styles.sectionTitle}>
                    <i className="fa-solid fa-user-circle text-primary"></i> Personal & Contact Details
                  </h4>
                  <p className={styles.sectionSubtitle}>
                    Official identification and primary contact details aligned with national space registry protocols.
                  </p>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className={styles.formLabel}>Full Legal Name</label>
                      <input
                        type="text"
                        className={`${styles.formControl} ${styles.formControlReadOnly}`}
                        value={user.fullName || ''}
                        disabled
                      />
                      <small className="text-muted">Verified by Egyptian Space Agency Identity Service.</small>
                    </div>

                    <div className="col-md-6">
                      <label className={styles.formLabel}>Registered Email</label>
                      <input
                        type="email"
                        className={`${styles.formControl} ${styles.formControlReadOnly}`}
                        value={user.email || ''}
                        disabled
                      />
                      <small className="text-muted">Primary communication channel for cohort admissions.</small>
                    </div>

                    <div className="col-md-6">
                      <label className={styles.formLabel}>
                        Mobile Phone Number <span className="text-danger">*</span>
                      </label>
                      <input
                        type="tel"
                        className={styles.formControl}
                        placeholder="+201XXXXXXXXX"
                        value={formData.phone}
                        onChange={handleChange('phone')}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className={styles.formLabel}>
                        National ID / Birth Certificate Number <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={styles.formControl}
                        placeholder="14-digit Egyptian National ID"
                        value={formData.nationalId}
                        onChange={handleChange('nationalId')}
                        maxLength={14}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className={styles.formLabel}>Date of Birth</label>
                      <input
                        type="date"
                        className={styles.formControl}
                        value={formData.dateOfBirth}
                        onChange={handleChange('dateOfBirth')}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className={styles.formLabel}>Gender</label>
                      <select
                        className={styles.formControl}
                        value={formData.gender}
                        onChange={handleChange('gender')}
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="unspecified">Prefer not to say</option>
                      </select>
                    </div>

                    <div className="col-12">
                      <label className={styles.formLabel}>Residential Address / Governorate</label>
                      <input
                        type="text"
                        className={styles.formControl}
                        placeholder="e.g., Nasr City, Cairo Governorate, Egypt"
                        value={formData.address}
                        onChange={handleChange('address')}
                      />
                    </div>

                    {/* Guardian Contact Information (Mandatory/Prominent for Pre-University Cadets) */}
                    <div className="col-12 mt-4 pt-3 border-top">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <h6 className="fw-bold mb-0 text-dark">
                          <i className="fa-solid fa-users me-2 text-secondary"></i>
                          Guardian & Emergency Contact {isCadet && <span className="badge bg-danger-subtle text-danger ms-2">Required for Cadets</span>}
                        </h6>
                        <small className="text-muted">Emergency notifications & legal clearance contact</small>
                      </div>

                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className={styles.formLabel}>Guardian Full Name</label>
                          <input
                            type="text"
                            className={styles.formControl}
                            placeholder="e.g., Mohamed Adel"
                            value={formData.guardianName}
                            onChange={handleChange('guardianName')}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className={styles.formLabel}>Guardian Phone</label>
                          <input
                            type="tel"
                            className={styles.formControl}
                            placeholder="+201XXXXXXXXX"
                            value={formData.guardianPhone}
                            onChange={handleChange('guardianPhone')}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className={styles.formLabel}>Relationship</label>
                          <select
                            className={styles.formControl}
                            value={formData.guardianRelation}
                            onChange={handleChange('guardianRelation')}
                          >
                            <option value="">Select Relation</option>
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Legal Guardian">Legal Guardian</option>
                            <option value="Sibling">Older Sibling</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Academic Affiliation */}
              {activeTab === 'academic' && (
                <div>
                  <h4 className={styles.sectionTitle}>
                    <i className="fa-solid fa-building-columns text-primary"></i> Academic Affiliation & STEM Track
                  </h4>
                  <p className={styles.sectionSubtitle}>
                    {isCadet
                      ? 'Pre-University High School or STEM Academy enrollment details.'
                      : 'Higher education institution, engineering specialization, and anticipated graduation status.'}
                  </p>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className={styles.formLabel}>Platform Division</label>
                      <select
                        className={styles.formControl}
                        value={formData.division}
                        onChange={handleChange('division')}
                      >
                        <option value="UNIVERSITY">University & Engineering Division</option>
                        <option value="PRE_UNIVERSITY">Pre-University Space Cadets Division</option>
                      </select>
                      <small className="text-muted">Controls targeted aerospace curriculum and admission tracks.</small>
                    </div>

                    <div className="col-md-6">
                      <label className={styles.formLabel}>
                        {isCadet ? 'High School / STEM Academy' : 'University / Higher Institute'}{' '}
                        <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={styles.formControl}
                        placeholder={isCadet ? 'e.g., Maadi STEM School for Girls' : 'e.g., Cairo University'}
                        value={formData.institutionName}
                        onChange={handleChange('institutionName')}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className={styles.formLabel}>
                        {isCadet ? 'Cadet Academic Unit' : 'Faculty / School'}{' '}
                        <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={styles.formControl}
                        placeholder={isCadet ? 'e.g., Pre-University Space Cadets' : 'e.g., Faculty of Engineering'}
                        value={formData.faculty}
                        onChange={handleChange('faculty')}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className={styles.formLabel}>
                        {isCadet ? 'STEM Track / Club' : 'Department / Specialization'}
                      </label>
                      <input
                        type="text"
                        className={styles.formControl}
                        placeholder={isCadet ? 'e.g., Rocketry & Space Physics' : 'e.g., Aerospace Engineering, Mechatronics'}
                        value={formData.department}
                        onChange={handleChange('department')}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className={styles.formLabel}>
                        {isCadet ? 'Current School Grade' : 'Current Academic Study Year'}{' '}
                        <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={styles.formControl}
                        placeholder={isCadet ? 'e.g., Grade 11 (2nd Secondary)' : 'e.g., Senior (4th Year) / 3rd Year'}
                        value={formData.studyYear}
                        onChange={handleChange('studyYear')}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className={styles.formLabel}>Expected / Graduation Year</label>
                      <input
                        type="number"
                        className={styles.formControl}
                        placeholder="e.g., 2026"
                        min="2020"
                        max="2035"
                        value={formData.graduationYear}
                        onChange={handleChange('graduationYear')}
                      />
                    </div>

                    {!isCadet && (
                      <div className="col-md-6">
                        <label className={styles.formLabel}>Enrollment Status</label>
                        <select
                          className={styles.formControl}
                          value={formData.status}
                          onChange={handleChange('status')}
                        >
                          <option value="student">Undergraduate Student</option>
                          <option value="graduate">Graduated Engineer / STEM Professional</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Space Experience & Skills */}
              {activeTab === 'experience' && (
                <div>
                  <h4 className={styles.sectionTitle}>
                    <i className="fa-solid fa-microchip text-primary"></i> Space Experience & Engineering Skills
                  </h4>
                  <p className={styles.sectionSubtitle}>
                    Document your technical proficiencies, robotics/rocketry projects, and space training history.
                  </p>

                  <div className="row g-3">
                    {/* Technical Skills Input */}
                    <div className="col-12">
                      <label className={styles.formLabel}>
                        Technical Skills & Tools (Press Enter or click Add)
                      </label>
                      <div className="input-group">
                        <input
                          type="text"
                          className={styles.formControl}
                          placeholder="e.g., Orbital Mechanics, Python, CanSat Avionics, RTOS"
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSkill();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary px-3"
                          onClick={() => handleAddSkill()}
                        >
                          <i className="fa-solid fa-plus me-1"></i> Add Skill
                        </button>
                      </div>

                      {/* Active Tag Pills */}
                      <div className={styles.tagsBox}>
                        {formData.technicalSkills.map((skill, idx) => (
                          <span key={idx} className={styles.tagPill}>
                            {skill}
                            <button
                              type="button"
                              className={styles.tagRemoveBtn}
                              onClick={() => handleRemoveSkill(skill)}
                              aria-label={`Remove ${skill}`}
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </span>
                        ))}
                        {formData.technicalSkills.length === 0 && (
                          <small className="text-muted fst-italic">No skills added yet. Click suggestions below to add quickly.</small>
                        )}
                      </div>

                      {/* Quick Suggestions */}
                      <div className="d-flex flex-wrap align-items-center gap-1 mt-2">
                        <small className="text-muted me-1">Quick Add:</small>
                        {suggestedSkills.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={styles.suggestedTag}
                            onClick={() => handleAddSkill(s)}
                          >
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Background Summary */}
                    <div className="col-12 mt-3">
                      <label className={styles.formLabel}>
                        Aerospace Experience & Research Background
                      </label>
                      <textarea
                        className={styles.formControl}
                        rows="4"
                        placeholder="Describe your aerospace project involvement, university competition teams (CanSat, Rover, CubeSat), laboratory internships, or rocketry research..."
                        value={formData.backgroundSummary}
                        onChange={handleChange('backgroundSummary')}
                      />
                    </div>

                    {/* External Space Courses */}
                    <div className="col-12 mt-3">
                      <label className={styles.formLabel}>
                        Completed External Courses & Space Workshops
                      </label>
                      <div className="input-group mb-2">
                        <input
                          type="text"
                          className={styles.formControl}
                          placeholder="e.g., EgSA Satellite Engineering Fundamentals 2024"
                          value={courseInput}
                          onChange={(e) => setCourseInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCourse();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary px-3"
                          onClick={handleAddCourse}
                        >
                          <i className="fa-solid fa-plus me-1"></i> Add Course
                        </button>
                      </div>

                      <div className={styles.tagsBox}>
                        {formData.completedExternalCourses.map((c, idx) => (
                          <span key={idx} className={styles.tagPill}>
                            <i className="fa-solid fa-certificate me-1"></i> {c}
                            <button
                              type="button"
                              className={styles.tagRemoveBtn}
                              onClick={() => handleRemoveCourse(c)}
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Portfolio URL */}
                    <div className="col-12 mt-2">
                      <label className={styles.formLabel}>
                        Technical Portfolio / GitHub / Project Showcase URL
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <i className="fa-brands fa-github text-muted"></i>
                        </span>
                        <input
                          type="url"
                          className={styles.formControl}
                          placeholder="https://github.com/username/space-portfolio"
                          value={formData.portfolioUrl}
                          onChange={handleChange('portfolioUrl')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Official Credentials & Documents */}
              {activeTab === 'documents' && (
                <div>
                  <h4 className={styles.sectionTitle}>
                    <i className="fa-solid fa-file-shield text-primary"></i> Official Credentials & Document Hub
                  </h4>
                  <p className={styles.sectionSubtitle}>
                    Verification slot for national identity cards, academic letters, and engineering portfolios.
                  </p>

                  <div className="row g-4">
                    {/* Student ID Card / National ID Slot */}
                    <div className="col-md-6">
                      <div className={styles.docSlot}>
                        <div className="mb-3">
                          <i className="fa-solid fa-address-card text-primary display-5"></i>
                        </div>
                        <h6 className="fw-bold mb-1">Student ID / University Card</h6>
                        <p className="text-muted small mb-3">
                          Upload front/back scan or provide official document cloud URL for eligibility verification.
                        </p>
                        <input
                          type="url"
                          className={`${styles.formControl} mb-2`}
                          placeholder="https://cdn.egsa.gov.eg/docs/ids/card.pdf"
                          value={formData.studentIdCardUrl}
                          onChange={handleChange('studentIdCardUrl')}
                        />
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1">
                          <i className="fa-solid fa-cloud-arrow-up me-1"></i> Ready for Verification
                        </span>
                      </div>
                    </div>

                    {/* Curriculum Vitae / Resume Slot */}
                    <div className="col-md-6">
                      <div className={styles.docSlot}>
                        <div className="mb-3">
                          <i className="fa-solid fa-file-pdf text-danger display-5"></i>
                        </div>
                        <h6 className="fw-bold mb-1">Curriculum Vitae (CV)</h6>
                        <p className="text-muted small mb-3">
                          Attach your engineering resume highlighting STEM research and project milestones.
                        </p>
                        <input
                          type="url"
                          className={`${styles.formControl} mb-2`}
                          placeholder="https://drive.google.com/... or portfolio URL"
                          value={formData.cvUrl}
                          onChange={handleChange('cvUrl')}
                        />
                        <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-3 py-1">
                          <i className="fa-solid fa-link me-1"></i> Document Linked
                        </span>
                      </div>
                    </div>

                    {/* Account Security Information */}
                    <div className="col-12 mt-4 pt-3 border-top">
                      <h6 className="fw-bold text-dark mb-3">Security & Session Management</h6>

                      <div className="p-3 bg-light rounded border mb-3 d-flex flex-wrap justify-content-between align-items-center">
                        <div>
                          <strong>Password & Authentication</strong>
                          <div className="small text-muted">Password reset requires verified email access token.</div>
                        </div>
                        <Link to="/forgot-password" className="btn btn-sm btn-outline-primary mt-2 mt-sm-0">
                          <i className="fa-solid fa-key me-1"></i> Change Password
                        </Link>
                      </div>

                      <div className="p-3 bg-light rounded border d-flex flex-wrap justify-content-between align-items-center">
                        <div>
                          <strong>Sign Out of Session</strong>
                          <div className="small text-muted">Safely end this session on your current device.</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger mt-2 mt-sm-0"
                          onClick={handleLogout}
                        >
                          <i className="fa-solid fa-arrow-right-from-bracket me-1"></i> Log Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Save Action Button */}
              <div className="mt-4 pt-4 border-top d-flex justify-content-between align-items-center">
                <span className="text-muted small">
                  <i className="fa-solid fa-lock me-1"></i> All updates saved securely under EgSA data governance.
                </span>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Saving Profile…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i> Save Profile Details
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Profile Status & Specialization Overview */}
          <div className="col-lg-4">
            <div className={styles.sidebarCard}>
              <h5 className="fw-bold text-dark mb-3">
                <i className="fa-solid fa-compass me-2 text-primary"></i> Academy Status
              </h5>

              <div className="d-flex flex-column gap-3 small">
                <div className="p-3 bg-light rounded border">
                  <div className="text-muted mb-1">Division Affiliation:</div>
                  <strong className="text-dark d-block">
                    {isCadet ? 'Pre-University Space Cadets' : 'University & Higher Engineering'}
                  </strong>
                </div>

                <div className="p-3 bg-light rounded border">
                  <div className="text-muted mb-1">Current Academic Focus:</div>
                  <strong className="text-dark d-block">
                    {profile.learningGoal?.title || 'Aerospace Systems Engineering'}
                  </strong>
                </div>

                <div className="p-3 bg-light rounded border">
                  <div className="text-muted mb-1">Completed Academy Courses:</div>
                  <strong className="text-dark d-block">
                    {profile.completedCourses?.length || 0} Courses Verified
                  </strong>
                </div>

                <div className="p-3 bg-light rounded border">
                  <div className="text-muted mb-1">Active Technical Skills:</div>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                    {formData.technicalSkills.length} Verified Competencies
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-top">
                <Link to="/student/catalog" className="btn btn-outline-primary btn-sm w-100 mb-2">
                  <i className="fa-solid fa-binoculars me-1"></i> Browse Course Catalog
                </Link>
                <Link to="/student/readiness" className="btn btn-outline-secondary btn-sm w-100">
                  <i className="fa-solid fa-wand-magic-sparkles me-1"></i> AI Readiness Assessment
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
