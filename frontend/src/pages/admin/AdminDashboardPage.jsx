import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/cycleServices';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = () => {
    setLoading(true);
    setError('');
    adminService
      .overview()
      .then((res) => setStats(res.data || {}))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load administration overview.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadOverview, []);

  if (loading) return <LoadingState label="Loading Command Center telemetry..." />;
  if (error) return <ErrorState message={error} onRetry={loadOverview} />;

  const {
    studentCount = 0,
    courseCount = 0,
    applicationCount = 0,
    enrollmentCount = 0,
  } = stats || {};

  return (
    <div className="container-fluid py-4 px-md-5">
      <PageHeader
        title="Dashboard"
        subtitle="Platform metrics & operational status"
        breadcrumbs={[{ label: 'Admin Command' }]}
        actions={
          <button className="btn btn-outline-secondary btn-sm" onClick={loadOverview}>
            <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="row g-3 row-cols-1 row-cols-md-2 row-cols-xl-4 mb-4">
        <div className="col">
          <div className="card p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted text-uppercase fw-semibold small">Registered Students</span>
              <span className="badge-status-neutral">Active</span>
            </div>
            <h3 className="fw-bold text-dark mb-0">{studentCount}</h3>
          </div>
        </div>

        <div className="col">
          <div className="card p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted text-uppercase fw-semibold small">Training Programs</span>
              <span className="badge-status-ready">Catalog</span>
            </div>
            <h3 className="fw-bold text-dark mb-0">{courseCount}</h3>
          </div>
        </div>

        <div className="col">
          <div className="card p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted text-uppercase fw-semibold small">Total Applications</span>
              <span className="badge-status-pending">Review</span>
            </div>
            <h3 className="fw-bold text-dark mb-0">{applicationCount}</h3>
          </div>
        </div>

        <div className="col">
          <div className="card p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted text-uppercase fw-semibold small">Confirmed Enrollments</span>
              <span className="badge-status-ready">Enrolled</span>
            </div>
            <h3 className="fw-bold text-dark mb-0">{enrollmentCount}</h3>
          </div>
        </div>
      </div>

      {/* Quick Action Operation Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-6 col-lg-4">
          <div className="card p-3 h-100 d-flex flex-column justify-content-between">
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="fa-solid fa-file-signature text-secondary fs-6"></i>
                <h6 className="fw-bold mb-0">Admissions Queue</h6>
              </div>
              <small className="text-muted">Applicant evaluation & waitlist queue</small>
            </div>
            <Link to="/admin/applications" className="btn btn-outline-secondary btn-sm w-100">
              Applications <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

        <div className="col-md-6 col-lg-4">
          <div className="card p-3 h-100 d-flex flex-column justify-content-between">
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="fa-solid fa-layer-group text-secondary fs-6"></i>
                <h6 className="fw-bold mb-0">Cohorts & Capacity</h6>
              </div>
              <small className="text-muted">Seat quotas & intake timelines</small>
            </div>
            <Link to="/admin/cohorts" className="btn btn-outline-secondary btn-sm w-100">
              Cohorts <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

        <div className="col-md-6 col-lg-4">
          <div className="card p-3 h-100 d-flex flex-column justify-content-between">
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="fa-solid fa-clipboard-user text-secondary fs-6"></i>
                <h6 className="fw-bold mb-0">Sessions & Attendance</h6>
              </div>
              <small className="text-muted">Live QR tokens & attendance tracking</small>
            </div>
            <Link to="/admin/attendance" className="btn btn-outline-secondary btn-sm w-100">
              Attendance <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

        <div className="col-md-6 col-lg-4">
          <div className="card p-3 h-100 d-flex flex-column justify-content-between">
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="fa-solid fa-credit-card text-secondary fs-6"></i>
                <h6 className="fw-bold mb-0">Commercial Ledger</h6>
              </div>
              <small className="text-muted">Invoices, settlements & receipts</small>
            </div>
            <Link to="/admin/payments" className="btn btn-outline-secondary btn-sm w-100">
              Invoices <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

        <div className="col-md-6 col-lg-4">
          <div className="card p-3 h-100 d-flex flex-column justify-content-between">
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="fa-solid fa-award text-secondary fs-6"></i>
                <h6 className="fw-bold mb-0">Certificates</h6>
              </div>
              <small className="text-muted">Validation gates & digital credentials</small>
            </div>
            <Link to="/admin/certificates" className="btn btn-outline-secondary btn-sm w-100">
              Certificates <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

        <div className="col-md-6 col-lg-4">
          <div className="card p-3 h-100 d-flex flex-column justify-content-between">
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="fa-solid fa-photo-film text-secondary fs-6"></i>
                <h6 className="fw-bold mb-0">Media Gallery</h6>
              </div>
              <small className="text-muted">Submissions & approvals</small>
            </div>
            <Link to="/admin/media" className="btn btn-outline-secondary btn-sm w-100">
              Media <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
