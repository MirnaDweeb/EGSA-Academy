import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseService } from '../../services/courseService';
import { admissionsService, applicationService, enrollmentService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import CourseCard from '../../components/CourseCard.jsx';
import EligibilityModal from '../../components/student/EligibilityModal.jsx';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

export default function CourseCatalogPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [courses, setCourses] = useState([]);
  const [userApplications, setUserApplications] = useState([]);
  const [userEnrollments, setUserEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', division: '', level: '', deliveryMode: '' });

  // Eligibility modal state
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    
    const promises = [courseService.list(params)];
    if (user) {
      promises.push(applicationService.my().catch(() => ({ data: [] })));
      promises.push(enrollmentService.my().catch(() => ({ data: [] })));
    }

    Promise.all(promises)
      .then(([coursesRes, appsRes, enrsRes]) => {
        setCourses(coursesRes.data || []);
        if (appsRes) setUserApplications(appsRes.data || []);
        if (enrsRes) setUserEnrollments(enrsRes.data || []);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load courses.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    load();
  };

  // Guided Multi-Step Application Flow
  const handleApplyNow = (course) => {
    if (!user) {
      navigate('/login', { state: { from: `/student/apply/${course._id}` } });
      return;
    }
    navigate(`/student/apply/${course._id}`);
  };

  const handleProceedToReadiness = async () => {
    if (!selectedCourse) return;
    try {
      await admissionsService.apply({ courseId: selectedCourse._id });
      setIsModalOpen(false);
      navigate(`/student/readiness/start?courseId=${selectedCourse._id}`);
    } catch (err) {
      setIsModalOpen(false);
      navigate(`/student/readiness/start?courseId=${selectedCourse._id}`);
    }
  };

  const handleEnrollFoundation = (recCourse) => {
    setIsModalOpen(false);
    if (recCourse && recCourse._id) {
      // Find course in catalog or navigate to course detail
      const target = courses.find((c) => String(c._id) === String(recCourse._id));
      if (target) {
        handleApplyNow(target);
      } else {
        navigate(`/student/courses/${recCourse._id}`);
      }
    }
  };

  const handleSubmitForReview = async () => {
    if (!selectedCourse) return;
    try {
      await admissionsService.apply({ courseId: selectedCourse._id });
      setIsModalOpen(false);
      navigate('/student/applications');
    } catch (err) {
      setActionNotice(err.response?.data?.message || 'Failed to submit application.');
    }
  };

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', padding: '1.5rem' }}>
      <PageHeader
        title="Courses"
        subtitle="Academic tracks & course offerings"
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Courses' },
        ]}
      />

      {actionNotice && (
        <div className="alert alert-info alert-dismissible fade show mb-3" role="alert">
          <i className="fa-solid fa-circle-info me-2"></i> {actionNotice}
          <button type="button" className="btn-close" onClick={() => setActionNotice('')}></button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="egsa-card p-3 mb-4 shadow-sm" style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
        <form className="row g-2 align-items-center" onSubmit={handleFilterSubmit}>
          <div className="col-md-3">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted border-end-0">
                <i className="fa-solid fa-magnifying-glass"></i>
              </span>
              <input
                className="form-control border-start-0"
                placeholder="Search by title, track, keywords…"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </div>
          </div>

          <div className="col-md-3">
            <select
              className="form-select form-select-sm"
              value={filters.division}
              onChange={(e) => setFilters((f) => ({ ...f, division: e.target.value }))}
            >
              <option value="">All Divisions</option>
              <option value="PRE_UNIVERSITY">Pre-University Division (Cadets)</option>
              <option value="UNIVERSITY">University Division (Undergrad/Grad)</option>
            </select>
          </div>

          <div className="col-md-3">
            <select
              className="form-select form-select-sm"
              value={filters.level}
              onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}
            >
              <option value="">All Academic Levels</option>
              <option value="Foundation">Foundation</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div className="col-md-2">
            <select
              className="form-select form-select-sm"
              value={filters.deliveryMode}
              onChange={(e) => setFilters((f) => ({ ...f, deliveryMode: e.target.value }))}
            >
              <option value="">All Delivery Modes</option>
              <option value="Onsite">Onsite</option>
              <option value="Online">Online</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>

          <div className="col-md-1">
            <button
              type="submit"
              className="btn btn-sm w-100 fw-bold text-white"
              style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {loading && <LoadingState label="Loading space academy curriculum..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && courses.length === 0 && (
        <EmptyState title="No courses found" message="Try adjusting your division, level, or search filters." />
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="row g-4">
          {courses.map((c) => {
            const isEnrolled = userEnrollments.some(
              (e) => String(e.course?._id || e.course) === String(c._id) && ['Confirmed', 'Active', 'Completed', 'enrolled', 'CONFIRMED'].includes(e.status)
            );
            const activeApp = userApplications.find(
              (a) => String(a.course?._id || a.course) === String(c._id) && !['Cancelled', 'Rejected', 'Withdrawn'].includes(a.status)
            );
            return (
              <div className="col-md-6 col-lg-4" key={c._id}>
                <CourseCard
                  course={c}
                  isEnrolled={isEnrolled}
                  activeApp={activeApp}
                  onApplyNow={handleApplyNow}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Eligibility Feedback Modal */}
      <EligibilityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        course={selectedCourse}
        eligibilityData={eligibilityData}
        loading={checkingEligibility}
        onProceedToReadiness={handleProceedToReadiness}
        onEnrollFoundation={handleEnrollFoundation}
        onSubmitForReview={handleSubmitForReview}
      />
    </div>
  );
}
