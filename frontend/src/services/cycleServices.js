import api from './api';

export const readinessService = {
  start: (courseId, options = {}) => api.post('/readiness/start', { courseId, ...options }).then((r) => r.data),
  getAttempt: (attemptId) => api.get(`/readiness/${attemptId}`).then((r) => r.data),
  status: (courseId) => api.get(`/readiness/status/${courseId}`).then((r) => r.data),
  submit: (attemptId, answers) => api.post(`/readiness/${attemptId}/submit`, { answers }).then((r) => r.data),
  submitEngine: (payload) => api.post('/readiness/submit', payload).then((r) => r.data),
  result: (attemptId) => api.get(`/readiness/${attemptId}/result`).then((r) => r.data),
  getCourseQuestions: (courseId) => api.get(`/readiness/course/${courseId}`).then((r) => r.data),
  // Division Admin Oversight & Override
  adminAttempts: (params) => api.get('/readiness/admin/attempts', { params }).then((r) => r.data),
  adminOverride: (attemptId, reason) => api.post(`/readiness/admin/override/${attemptId}`, { reason }).then((r) => r.data),
  // Admin Question Authoring
  createQuestion: (payload) => api.post('/readiness/admin/questions', payload).then((r) => r.data),
  bulkCreateQuestions: (courseId, questions) => api.post('/readiness/admin/questions/bulk', { courseId, questions }).then((r) => r.data),
  listQuestions: (courseId) => api.get('/readiness/admin/questions', { params: { courseId } }).then((r) => r.data),
  deleteQuestion: (questionId) => api.delete(`/readiness/admin/questions/${questionId}`).then((r) => r.data),
};

export const admissionsService = {
  startFlow: (payload) => api.post('/admissions/start-flow', payload).then((r) => r.data),
  completeAssessment: (payload) => api.post('/admissions/complete-assessment', payload).then((r) => r.data),
  checkEligibility: (courseId) => api.post('/admissions/check-eligibility', { courseId }).then((r) => r.data),
  apply: (payload) => api.post('/admissions/apply', payload).then((r) => r.data),
  adminApplications: (params) => api.get('/admissions/admin/applications', { params }).then((r) => r.data),
  approveOverride: (id, reason) => api.post(`/admissions/admin/applications/${id}/override`, { reason }).then((r) => r.data),
  requestInfo: (id, note) => api.post(`/admissions/admin/applications/${id}/request-info`, { note, requiredItem: note }).then((r) => r.data),
  reject: (id, reason) => api.post(`/admissions/admin/applications/${id}/reject`, { reason }).then((r) => r.data),
  auditLogs: (params) => api.get('/admissions/admin/audit-logs', { params }).then((r) => r.data),
};

export const applicationService = {
  create: (payload) => api.post('/applications', payload).then((r) => r.data),
  checkEligibility: (courseId) => api.post('/admissions/check-eligibility', { courseId }).then((r) => r.data),
  apply: (payload) => api.post('/admissions/apply', payload).then((r) => r.data),
  my: () => api.get('/applications/my').then((r) => r.data),
  get: (id) => api.get(`/applications/${id}`).then((r) => r.data),
  directEnroll: (id, payload = {}) => api.post(`/applications/${id}/direct-enroll`, payload).then((r) => r.data),
  cancel: (id) => api.patch(`/applications/${id}/cancel`).then((r) => r.data),
};

export const paymentService = {
  my: () => api.get('/payments/my').then((r) => r.data),
  getInvoice: (id) => api.get(`/payments/invoices/${id}`).then((r) => r.data),
  calculatePrice: (courseId, packageType) =>
    api.post('/payments/calculate', { courseId, packageType }).then((r) => r.data),
  prepareInvoice: (payload) => api.post('/payments/prepare', payload).then((r) => r.data),
  initiate: (payload) => api.post('/payments/initiate', payload).then((r) => r.data),
  verify: (payload) => api.post('/payments/verify', payload).then((r) => r.data),
  getSessionStatus: (sessionId) => api.get(`/payments/session-status/${sessionId}`).then((r) => r.data),
  pay: (invoiceId, payload = {}) => {
    const body = typeof payload === 'string' ? { method: payload } : payload;
    return api.post('/payments/pay', { invoiceId, ...body }).then((r) => r.data);
  },
  // Refund Management (Student)
  getRefundAccount: () => api.get('/payments/refund-account').then((r) => r.data),
  saveRefundAccount: (payload) => api.post('/payments/refund-account', payload).then((r) => r.data),
  requestRefund: (invoiceId, payload) =>
    api.post(`/payments/invoices/${invoiceId}/refund-request`, payload).then((r) => r.data),
  myRefunds: () => api.get('/payments/my-refunds').then((r) => r.data),
};

export const adminService = {
  overview: () => api.get('/admin/overview').then((r) => r.data),
  applications: (params) => api.get('/admin/applications', { params }).then((r) => r.data),
  acceptApplication: (id, note) => api.patch(`/admin/applications/${id}/accept`, { note }).then((r) => r.data),
  reviewApplication: (id, note) => api.patch(`/admin/applications/${id}/review`, { note }).then((r) => r.data),
  waitlistApplication: (id, note) => api.patch(`/admin/applications/${id}/waitlist`, { note }).then((r) => r.data),
  rejectApplication: (id, reason) => api.patch(`/admin/applications/${id}/reject`, { reason }).then((r) => r.data),
  promoteWaitlist: (id) => api.patch(`/admin/applications/${id}/promote`).then((r) => r.data),
  // Payment management
  payments: (params) => api.get('/admin/payments', { params }).then((r) => r.data),
  paymentDetails: (id) => api.get(`/admin/payments/${id}`).then((r) => r.data),
  // Refund management
  refunds: (params) => api.get('/admin/refunds', { params }).then((r) => r.data),
  refundDetails: (id) => api.get(`/admin/refunds/${id}`).then((r) => r.data),
  reviewRefund: (id, payload) => api.patch(`/admin/refunds/${id}/review`, payload).then((r) => r.data),
  processRefund: (id, payload) => api.post(`/admin/refunds/${id}/process`, payload).then((r) => r.data),
  // Certificate management
  certificates: (params) => api.get('/admin/certificates', { params }).then((r) => r.data),
  certificateDetails: (id) => api.get(`/admin/certificates/${id}`).then((r) => r.data),
  createCertificate: (id) => api.post(`/admin/certificates/${id}/create`).then((r) => r.data),
  uploadCertificate: (id, formData) =>
    api
      .post(`/admin/certificates/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
  issueCertificate: (id) => api.post(`/admin/certificates/${id}/issue`).then((r) => r.data),
  updateCertificateStatus: (id, status) =>
    api.patch(`/admin/certificates/${id}/status`, { status }).then((r) => r.data),
  correctCertificateName: (id, payload) =>
    api.patch(`/admin/certificates/${id}/correct-name`, payload).then((r) => r.data),
  // Cohorts & Capacity Management
  cohorts: (params) => api.get('/admin/cohorts', { params }).then((r) => r.data),
  createCohort: (payload) => api.post('/admin/cohorts', payload).then((r) => r.data),
  updateCohort: (id, payload) => api.patch(`/admin/cohorts/${id}`, payload).then((r) => r.data),
  // Sessions & Attendance
  sessions: (params) => api.get('/admin/sessions', { params }).then((r) => r.data),
  createSession: (payload) => api.post('/admin/sessions', payload).then((r) => r.data),
  generateQR: (sessionId) => api.post(`/attendance/sessions/${sessionId}/qr`).then((r) => r.data),
  disputes: () => api.get('/attendance/disputes').then((r) => r.data),
  reviewDispute: (id, payload) => api.put(`/attendance/disputes/${id}`, payload).then((r) => r.data),
  attendanceLedger: (params) => api.get('/attendance/admin/ledger', { params }).then((r) => r.data),
};

export const enrollmentService = {
  my: () => api.get('/enrollments/my').then((r) => r.data),
};

export const notificationService = {
  list: () => api.get('/notifications').then((r) => r.data),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
};

export const certificateService = {
  my: () => api.get('/certificates/my').then((r) => r.data),
  getById: (id) => api.get(`/certificates/${id}`).then((r) => r.data),
  issue: (cohortId, payload = {}) => api.post(`/certificates/issue/${cohortId}`, payload).then((r) => r.data),
  getEligibility: (cohortId) => api.get(`/certificates/eligibility/${cohortId}`).then((r) => r.data),
  submitName: (payload) => api.post('/certificates/submit-name', payload).then((r) => r.data),
  confirmName: (payload) => api.post('/certificates/confirm-name', payload).then((r) => r.data),
  correctName: (id, payload) => api.patch(`/certificates/${id}/correct-name`, payload).then((r) => r.data),
  verify: (tokenOrId) => api.get(`/certificates/verify/${tokenOrId}`).then((r) => r.data),
};

export const assessmentService = {
  my: (params) => api.get('/assessments/my', { params }).then((r) => r.data),
  getById: (id) => api.get(`/assessments/${id}`).then((r) => r.data),
  submit: (id, formData) =>
    api
      .post(`/assessments/${id}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
  submitQuiz: (id, answers) =>
    api.post(`/assessments/${id}/submit-quiz`, { answers }).then((r) => r.data),
  submitAssignment: (id, payload) => {
    if (payload instanceof FormData) {
      return api
        .post(`/assessments/${id}/submit-assignment`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    }
    return api.post(`/assessments/${id}/submit-assignment`, payload).then((r) => r.data);
  },
  getSubmissions: (id) => api.get(`/assessments/${id}/submissions`).then((r) => r.data),
  gradeSubmission: (id, payload) => api.post(`/assessments/submissions/${id}/grade`, payload).then((r) => r.data),
};

export const evaluationService = {
  check: (cohortId) => api.get(`/evaluations/check/${cohortId}`).then((r) => r.data),
  submit: (payload) => api.post('/evaluations', payload).then((r) => r.data),
  my: () => api.get('/evaluations/my').then((r) => r.data),
  status: (courseId) => api.get(`/evaluations/status/${courseId}`).then((r) => r.data),
  instructorSummary: () => api.get('/evaluations/instructor/summary').then((r) => r.data),
  adminSummary: (params) => api.get('/evaluations/admin/summary', { params }).then((r) => r.data),
};

export const financeService = {
  overview: (params) => api.get('/finance/overview', { params }).then((r) => r.data),
  invoices: (params) => api.get('/finance/invoices', { params }).then((r) => r.data),
  waive: (id, payload) => api.post(`/finance/invoices/${id}/waive`, payload).then((r) => r.data),
  sweep: () => api.post('/finance/sweep-expired').then((r) => r.data),
  refund: (id, payload = {}) => api.post(`/finance/invoices/${id}/refund`, payload).then((r) => r.data),
};

export const superAdminService = {
  strategicOverview: () => api.get('/admin/super/strategic-overview').then((r) => r.data),
  auditLogs: (params) => api.get('/admin/super/audit-logs', { params }).then((r) => r.data),
  getConfig: () => api.get('/admin/super/config').then((r) => r.data),
  updateConfig: (payload) => api.put('/admin/super/config', payload).then((r) => r.data),
};


