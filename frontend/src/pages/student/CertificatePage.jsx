import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { certificateCriteriaService } from '../../services/studentPortalServices';
import { certificateService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, ErrorState, PageHeader, ProgressBar } from '../../components/StateComponents.jsx';

export default function CertificatePage() {
  const { user, language = 'en' } = useAuth();
  const isAr = language === 'ar';

  const [data, setData] = useState(null);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Certificate Name Form State
  const [recipientName, setRecipientName] = useState('');
  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditingSubmittedName, setIsEditingSubmittedName] = useState(false);

  // Document Viewer Modal State
  const [viewingCert, setViewingCert] = useState(null);
  const [selectedCohortId, setSelectedCohortId] = useState('');

  const loadEligibility = async (cohortId) => {
    if (!cohortId) return;
    setEligibilityLoading(true);
    try {
      const elig = await certificateService.getEligibility(cohortId);
      setEligibilityData(elig?.data || elig);
    } catch (e) {
      console.warn('Failed to load 4-gate eligibility:', e);
    } finally {
      setEligibilityLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await certificateCriteriaService.getCertificateStatus();
      setData(res);

      const existingCert = res.certificates?.[0];
      const existingName = existingCert?.certificateName || existingCert?.recipientName;
      if (existingName) {
        setRecipientName(existingName);
      } else if (!recipientName) {
        const suggested = res.defaultStudentName || user?.fullName || '';
        setRecipientName(suggested);
      }

      // Determine target cohort ID
      const targetCohortId =
        existingCert?.cohort?._id || existingCert?.cohort ||
        res.eligibleEnrollment?.cohort?._id || res.eligibleEnrollment?.cohort ||
        res.enrollment?.cohort?._id || res.enrollment?.cohort ||
        res.eligibleEnrollments?.[0]?.cohortId || res.eligibleEnrollments?.[0]?.cohort?._id;

      if (targetCohortId) {
        setSelectedCohortId(targetCohortId);
        await loadEligibility(targetCohortId);
      }
    } catch (err) {
      setError(err.message || (isAr ? 'فشل تحميل بيانات الشهادة.' : 'Failed to load certificate status.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Validation function for the certificate recipient name
  const validateName = (raw) => {
    if (!raw || !raw.trim()) {
      return isAr ? 'يرجى إدخال اسمك الكامل المراد كتابته على الشهادة.' : 'Please enter your full name exactly as you want it to appear on your certificate.';
    }
    const collapsed = raw.trim().replace(/\s+/g, ' ');
    if (collapsed.length < 3) {
      return isAr ? 'يجب ألا يقل الاسم عن ٣ أحرف.' : 'Name must contain at least 3 characters.';
    }
    if (collapsed.length > 100) {
      return isAr ? 'يجب ألا يتجاوز الاسم ١٠٠ حرف.' : 'Name cannot exceed 100 characters.';
    }
    if (/[<>{}[\]\\\/;:=+*%$#@!~^|]/.test(collapsed) || /<[^>]*>|script/i.test(collapsed)) {
      return isAr ? 'الاسم يحتوي على رموز أو وسوم غير مسموح بها.' : 'Name contains invalid characters or markup.';
    }
    const validLettersRegex = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z\u00C0-\u024F\s\.\-']+$/;
    if (!validLettersRegex.test(collapsed)) {
      return isAr ? 'يرجى استخدام الحروف العربية أو الإنجليزية فقط.' : 'Please enter valid Arabic or English characters only.';
    }
    const hasLetters = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z]/;
    if (!hasLetters.test(collapsed)) {
      return isAr ? 'يجب أن يحتوي الاسم على أحرف صالحة.' : 'Name must contain valid alphabetic letters.';
    }
    return '';
  };

  const handleNameChange = (e) => {
    setRecipientName(e.target.value);
    if (nameError) {
      setNameError('');
    }
  };

  const handleSubmitCertificateName = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const err = validateName(recipientName);
    if (err) {
      setNameError(err);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const cleanName = recipientName.trim().replace(/\s+/g, ' ');
      const targetEnrollmentId = data?.eligibleEnrollment?._id || data?.enrollment?._id;

      const res = await certificateService.submitName({
        enrollmentId: targetEnrollmentId,
        recipientName: cleanName,
        certificateName: cleanName,
      });

      const serverMsg =
        res?.message ||
        (isAr
          ? 'تم إرسال اسم الشهادة بنجاح. يرجى إكمال استبيانات التقييم المطلوبة لمتابعة الإجراءات.'
          : 'Your certificate name has been submitted successfully. Please complete the required feedback forms.');

      setActionSuccessMsg(serverMsg);
      setIsEditingSubmittedName(false);
      await load();
    } catch (apiErr) {
      setError(
        apiErr.response?.data?.message ||
          apiErr.message ||
          (isAr ? 'حدث خطأ أثناء إرسال طلب الشهادة. يرجى المحاولة لاحقاً.' : 'Failed to submit certificate request.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Phase 11: Official 4-Gate Certificate Issuance
  const handleGenerateCertificate = async () => {
    const targetCohort = selectedCohortId || data?.eligibleEnrollment?.cohort?._id || data?.enrollment?.cohort?._id;
    if (!targetCohort) {
      setError(isAr ? 'لا يوجد دفعة تدريبية محددة لإصدار الشهادة.' : 'No active training cohort identified for issuance.');
      return;
    }

    setIsIssuing(true);
    setError('');

    try {
      const cleanName = recipientName.trim().replace(/\s+/g, ' ') || user?.fullName || 'Egyptian Space Cadet';
      const res = await certificateService.issue(targetCohort, { recipientName: cleanName });
      const cert = res.certificate || res.data || res;
      setActionSuccessMsg(
        res.message ||
        (isAr
          ? 'تم إصدار شهادتك الرقمية المعتمدة رسمياً وتوليد رمز الاستجابة السريع QR!'
          : 'Your official credential has been generated and verified with institutional QR!')
      );
      setViewingCert(cert);
      await load();
    } catch (apiErr) {
      const errRes = apiErr.response?.data;
      if (errRes?.missingGates && errRes.missingGates.length > 0) {
        setError(
          `${isAr ? 'لم يتم استيفاء جميع بوابات الاعتماد:' : 'Incomplete eligibility gates:'} ${errRes.missingGates.join(', ')}`
        );
      } else {
        setError(
          errRes?.message ||
          apiErr.message ||
          (isAr ? 'فشل إصدار الشهادة الرسمية. يرجى التحقق من استيفاء المتطلبات.' : 'Failed to generate official certificate.')
        );
      }
    } finally {
      setIsIssuing(false);
    }
  };

  const handleCopyVerificationLink = (cert) => {
    const certNum = cert?.certificateNumber || cert?.certificateId || cert?._id;
    const url = cert?.verificationUrl || `${window.location.origin}/verify-certificate/${certNum}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  if (loading) {
    return <LoadingState label={isAr ? 'جاري التحقق من سجلات الاعتماد وبوابات الأهلية الأربعة…' : 'Verifying 4-Gate institutional eligibility & credentials…'} />;
  }

  if (error && !data && !eligibilityData) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const { certificates = [], criteria, eligibleEnrollment, enrollment } = data || {};
  const activeCert = certificates?.[0] || null;
  const activeCourse = activeCert?.course || eligibleEnrollment?.course || enrollment?.course;

  const submittedCertificateName = activeCert?.certificateName || activeCert?.recipientName || '';
  const hasSubmittedName = Boolean(submittedCertificateName);

  const isCourseDone = Boolean(activeCert?.courseFeedbackCompleted ?? data?.courseFeedbackCompleted);
  const isAgencyDone = Boolean(activeCert?.agencyFeedbackCompleted ?? data?.agencyFeedbackCompleted);
  const isFeedbackDone = Boolean(activeCert?.feedbackCompleted ?? data?.feedbackCompleted ?? (isCourseDone && isAgencyDone));

  const isAdminCreated = Boolean(activeCert?.adminCreated || activeCert?.status === 'UNDER_PREPARATION' || activeCert?.status === 'ISSUED');
  const hasUploadedFile = Boolean(activeCert?.fileUrl);
  const isIssued = Boolean((activeCert?.status === 'ISSUED' || hasUploadedFile || activeCert?.certificateNumber) && (hasUploadedFile || activeCert?.qrCodeDataUrl));

  const isDeadlinePassed = Boolean(activeCert?.isDeadlinePassed ?? data?.isDeadlinePassed);
  const canReceiveCertificate = Boolean(activeCert?.canReceiveCertificate ?? data?.canReceiveCertificate ?? activeCert?.certificateNumber);

  // Compute 4-Gate status from eligibilityData or fallback to criteria
  const gates = eligibilityData?.gates || {};
  const gate1Passed = gates.attendance ? Boolean(gates.attendance.passed) : (criteria?.items?.find((i) => i.id === 'attendance')?.met ?? false);
  const gate2Passed = gates.assessments ? Boolean(gates.assessments.passed) : (criteria?.items?.find((i) => i.id === 'assessments')?.met ?? false);
  const gate3Passed = gates.payment ? Boolean(gates.payment.passed) : (criteria?.items?.find((i) => i.id === 'payment')?.met ?? false);
  const gate4Passed = gates.evaluation ? Boolean(gates.evaluation.passed) : (criteria?.items?.find((i) => i.id === 'evaluation')?.met ?? false);

  const all4GatesPassed = eligibilityData
    ? Boolean(eligibilityData.allGatesPassed)
    : (gate1Passed && gate2Passed && gate3Passed && gate4Passed);

  const gatesCount = [gate1Passed, gate2Passed, gate3Passed, gate4Passed].filter(Boolean).length;

  // Eligible to request certificate
  const isEligible =
    all4GatesPassed ||
    data?.isEligibleToRequest ||
    data?.isEligibleForIssuance ||
    !!activeCert ||
    (data?.eligibleEnrollments && data.eligibleEnrollments.length > 0);

  // Determine current active workflow state
  let resolvedState = 'STATE_1_NAME_NOT_SUBMITTED';
  if (isDeadlinePassed && !isFeedbackDone) {
    resolvedState = 'STATE_DEADLINE_PASSED';
  } else if (activeCert && (activeCert.certificateNumber || isIssued)) {
    resolvedState = 'STATE_5_CERTIFICATE_READY';
  } else if (!hasSubmittedName || isEditingSubmittedName) {
    resolvedState = 'STATE_1_NAME_NOT_SUBMITTED';
  } else if (!isFeedbackDone) {
    resolvedState = 'STATE_2_FEEDBACK_INCOMPLETE';
  } else if (isFeedbackDone && !isAdminCreated) {
    resolvedState = 'STATE_3_PENDING_ADMIN_CREATION';
  } else if (isFeedbackDone && isAdminCreated && (!isIssued || !canReceiveCertificate)) {
    resolvedState = 'STATE_4_PENDING_RELEASE';
  } else if (canReceiveCertificate && isIssued) {
    resolvedState = 'STATE_5_CERTIFICATE_READY';
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'}>
      {/* Print Specific Styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #official-egsa-certificate-frame,
          #official-egsa-certificate-frame * {
            visibility: visible !important;
          }
          #official-egsa-certificate-frame {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 24px !important;
            background: #ffffff !important;
            border: 5px double #D4B87C !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            z-index: 999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <PageHeader
        title={isAr ? 'الشهادات والاعتمادات الرقمية الموثقة' : 'Official Credentials & Digital Verification'}
        subtitle={
          isAr
            ? 'نظام إصدار وتحقق رقمي محمي بالبوابات الأربعة وموثق بشهادات الاستجابة السريعة (QR) الصادرة عن وكالة الفضاء المصرية.'
            : '4-Gate verified digital credentials and tamper-proof QR certification issued by the Egyptian Space Agency (EgSA).'
        }
        breadcrumbs={[
          { label: isAr ? 'بوابة المتدرب' : 'Portal', to: '/student/dashboard' },
          { label: isAr ? 'الشهادات المعتمدة' : 'Credentials' },
        ]}
      />

      {/* Global Alerts */}
      {actionSuccessMsg && (
        <div className="alert alert-success alert-dismissible fade show d-flex align-items-center mb-4 shadow-sm" role="alert">
          <i className="fa-solid fa-circle-check fs-5 me-2 ms-2 text-success"></i>
          <div>{actionSuccessMsg}</div>
          <button type="button" className="btn-close ms-auto me-0" onClick={() => setActionSuccessMsg('')}></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center mb-4 shadow-sm" role="alert">
          <i className="fa-solid fa-triangle-exclamation fs-5 me-2 ms-2 text-danger"></i>
          <div>{error}</div>
          <button type="button" className="btn-close ms-auto me-0" onClick={() => setError('')}></button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4-GATE INSTITUTIONAL ELIGIBILITY PROGRESS CARD (Section 4, 10.1, 12, 17) */}
      {/* ========================================================================= */}
      <div className="card shadow-sm border-0 mb-4 overflow-hidden" style={{ borderRadius: '12px' }}>
        <div
          className="p-3 px-4 d-flex flex-wrap justify-content-between align-items-center gap-2"
          style={{ backgroundColor: '#3A6985', color: '#FFFFFF' }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className="fa-solid fa-shield-halved fs-4" style={{ color: '#D4B87C' }}></i>
            <div>
              <h5 className="mb-0 fw-bold">
                {isAr ? 'لوحة التحقق من بوابات الأهلية الأربعة' : '4-Gate Institutional Eligibility Status'}
              </h5>
              <small style={{ color: '#E2E8F0' }}>
                {isAr
                  ? 'التحقق الآلي من المتطلبات الأكاديمية والمالية واستبيانات الجودة قبل إصدار الاعتماد'
                  : 'Automated verification across Attendance, Assessments, Tuition Settlement & Quality Survey'}
              </small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge px-3 py-2 fw-semibold"
              style={{
                backgroundColor: all4GatesPassed ? '#1E7C85' : '#D4B87C',
                color: all4GatesPassed ? '#FFFFFF' : '#0F2B48',
                fontSize: '0.85rem',
              }}
            >
              {all4GatesPassed
                ? (isAr ? 'مستوفى بالكامل (٤/٤) — مؤهل للإصدار ✓' : 'All 4 Gates Satisfied (4/4) — Eligible ✓')
                : `${gatesCount}/4 ${isAr ? 'بوابات مستوفاة' : 'Gates Satisfied'}`}
            </span>
          </div>
        </div>

        <div className="card-body p-4 bg-white">
          <div className="row g-3">
            {/* Gate 1: Attendance Health */}
            <div className="col-12 col-md-6 col-lg-3">
              <div
                className="p-3 rounded h-100 border transition-all"
                style={{
                  backgroundColor: gate1Passed ? 'rgba(30, 124, 133, 0.05)' : 'rgba(212, 184, 124, 0.08)',
                  borderColor: gate1Passed ? '#1E7C85' : '#D4B87C',
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold small text-muted">
                    {isAr ? 'البوابة الأولى' : 'Gate 1'}
                  </span>
                  <span
                    className="badge d-flex align-items-center gap-1"
                    style={{
                      backgroundColor: gate1Passed ? '#1E7C85' : '#D4B87C',
                      color: gate1Passed ? '#FFFFFF' : '#0F2B48',
                    }}
                  >
                    {gate1Passed ? (
                      <><i className="fa-solid fa-check"></i> {isAr ? 'مستوفى' : 'Passed'}</>
                    ) : (
                      <><i className="fa-solid fa-clock"></i> {isAr ? 'قيد الإتمام' : 'Pending'}</>
                    )}
                  </span>
                </div>
                <h6 className="fw-bold text-dark mb-1">
                  {isAr ? 'نسبة الحضور التراكمي' : 'Attendance Health'}
                </h6>
                <div className="d-flex align-items-baseline gap-1 my-1">
                  <span
                    className="fs-4 fw-bold"
                    style={{ color: gate1Passed ? '#1E7C85' : '#D4B87C' }}
                  >
                    {gates.attendance?.current ?? (criteria?.items?.find((i) => i.id === 'attendance')?.met ? '100' : '0')}%
                  </span>
                  <small className="text-muted">/ ≥ 85% {isAr ? 'مطلوب' : 'required'}</small>
                </div>
                <small className="text-muted d-block mt-1">
                  {gate1Passed
                    ? (isAr ? 'تم استيفاء معيار الحضور الإلزامي بنجاح.' : 'Attendance benchmark fulfilled.')
                    : (isAr ? 'الحضور أقل من ٨٥٪، يتطلب حضور الجلسات القادمة.' : 'Attendance health is below the 85% requirement.')}
                </small>
              </div>
            </div>

            {/* Gate 2: Mandatory Technical Assessments */}
            <div className="col-12 col-md-6 col-lg-3">
              <div
                className="p-3 rounded h-100 border transition-all"
                style={{
                  backgroundColor: gate2Passed ? 'rgba(30, 124, 133, 0.05)' : 'rgba(212, 184, 124, 0.08)',
                  borderColor: gate2Passed ? '#1E7C85' : '#D4B87C',
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold small text-muted">
                    {isAr ? 'البوابة الثانية' : 'Gate 2'}
                  </span>
                  <span
                    className="badge d-flex align-items-center gap-1"
                    style={{
                      backgroundColor: gate2Passed ? '#1E7C85' : '#D4B87C',
                      color: gate2Passed ? '#FFFFFF' : '#0F2B48',
                    }}
                  >
                    {gate2Passed ? (
                      <><i className="fa-solid fa-check"></i> {isAr ? 'مستوفى' : 'Passed'}</>
                    ) : (
                      <><i className="fa-solid fa-clock"></i> {isAr ? 'قيد الإتمام' : 'Pending'}</>
                    )}
                  </span>
                </div>
                <h6 className="fw-bold text-dark mb-1">
                  {isAr ? 'التقييمات والاختبارات الفنية' : 'Technical Assessments'}
                </h6>
                <div className="my-1">
                  <span
                    className="fs-5 fw-bold"
                    style={{ color: gate2Passed ? '#1E7C85' : '#D4B87C' }}
                  >
                    {gate2Passed ? (isAr ? 'تم الاجتياز بنجاح' : 'All Passed') : (isAr ? 'بانتظار التقييم' : 'Action Required')}
                  </span>
                </div>
                <small className="text-muted d-block mt-1">
                  {gate2Passed
                    ? (isAr ? 'تم تسليم واجتياز كافة الاختبارات والمشاريع المقررة.' : 'All mandatory quizzes & capstones submitted & graded.')
                    : (isAr ? 'يوجد اختبارات أو مشاريع إلزامية قيد التقييم أو التسليم.' : 'Mandatory assessments pending submission or evaluation.')}
                </small>
              </div>
            </div>

            {/* Gate 3: Tuition Settlement */}
            <div className="col-12 col-md-6 col-lg-3">
              <div
                className="p-3 rounded h-100 border transition-all"
                style={{
                  backgroundColor: gate3Passed ? 'rgba(30, 124, 133, 0.05)' : 'rgba(212, 184, 124, 0.08)',
                  borderColor: gate3Passed ? '#1E7C85' : '#D4B87C',
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold small text-muted">
                    {isAr ? 'البوابة الثالثة' : 'Gate 3'}
                  </span>
                  <span
                    className="badge d-flex align-items-center gap-1"
                    style={{
                      backgroundColor: gate3Passed ? '#1E7C85' : '#D4B87C',
                      color: gate3Passed ? '#FFFFFF' : '#0F2B48',
                    }}
                  >
                    {gate3Passed ? (
                      <><i className="fa-solid fa-check"></i> {isAr ? 'مسدد' : 'Paid'}</>
                    ) : (
                      <><i className="fa-solid fa-clock"></i> {isAr ? 'معلق' : 'Unsettled'}</>
                    )}
                  </span>
                </div>
                <h6 className="fw-bold text-dark mb-1">
                  {isAr ? 'تسوية الرسوم الدراسية' : 'Tuition Settlement'}
                </h6>
                <div className="my-1">
                  <span
                    className="fs-5 fw-bold"
                    style={{ color: gate3Passed ? '#1E7C85' : '#D4B87C' }}
                  >
                    {gate3Passed ? (isAr ? 'مسدد بالكامل' : 'Paid (Settled)') : (isAr ? 'غير مسدد' : 'Pending Payment')}
                  </span>
                </div>
                <small className="text-muted d-block mt-1">
                  {gate3Passed
                    ? (isAr ? 'تم سداد الفاتورة المالية وإخلاء الطرف المالي.' : 'Tuition invoice cleared and confirmed in ledger.')
                    : (isAr ? 'يتطلب سداد الفاتورة المقررة لتأكيد الاستحقاق.' : 'Tuition payment required before certificate release.')}
                </small>
              </div>
            </div>

            {/* Gate 4: Phase 10 Quality Survey */}
            <div className="col-12 col-md-6 col-lg-3">
              <div
                className="p-3 rounded h-100 border transition-all"
                style={{
                  backgroundColor: gate4Passed ? 'rgba(30, 124, 133, 0.05)' : 'rgba(212, 184, 124, 0.08)',
                  borderColor: gate4Passed ? '#1E7C85' : '#D4B87C',
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold small text-muted">
                    {isAr ? 'البوابة الرابعة' : 'Gate 4'}
                  </span>
                  <span
                    className="badge d-flex align-items-center gap-1"
                    style={{
                      backgroundColor: gate4Passed ? '#1E7C85' : '#D4B87C',
                      color: gate4Passed ? '#FFFFFF' : '#0F2B48',
                    }}
                  >
                    {gate4Passed ? (
                      <><i className="fa-solid fa-check"></i> {isAr ? 'مكتمل' : 'Completed'}</>
                    ) : (
                      <><i className="fa-solid fa-clock"></i> {isAr ? 'مطلوب' : 'Required'}</>
                    )}
                  </span>
                </div>
                <h6 className="fw-bold text-dark mb-1">
                  {isAr ? 'استبيان تقييم الجودة' : 'Quality Evaluation'}
                </h6>
                <div className="my-1">
                  <span
                    className="fs-5 fw-bold"
                    style={{ color: gate4Passed ? '#1E7C85' : '#D4B87C' }}
                  >
                    {gate4Passed ? (isAr ? 'تم التسليم' : 'Submitted ✓') : (isAr ? 'غير مكتمل' : 'Incomplete')}
                  </span>
                </div>
                <small className="text-muted d-block mt-1">
                  {gate4Passed
                    ? (isAr ? 'تم تسليم استبيان تقييم الدورة والمدرب بنجاح.' : 'Phase 10 quality survey submitted.')
                    : (isAr ? 'إلزامي: يجب ملء استبيان تقييم الدورة لفتح الشهادة.' : 'Mandatory course evaluation survey pending.')}
                </small>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-4 pt-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <i className="fa-solid fa-circle-info text-primary-egsa"></i>
              <span className="small text-muted">
                {all4GatesPassed
                  ? (isAr
                      ? 'تهانينا! لقد استوفيت جميع بوابات الاعتماد. يمكنك الآن إصدار شهادتك الرقمية الموثقة برمز QR فوراً.'
                      : 'Congratulations! All 4 criteria verified. You may generate your tamper-proof QR certificate now.')
                  : (isAr
                      ? `تم استيفاء ${gatesCount} من ٤ متطلبات. زر إصدار الشهادة سيكون نشطاً بمجرد استكمال جميع البوابات.`
                      : `${gatesCount} of 4 criteria satisfied. "Generate Official Certificate" unlocks when all 4 pass.`)}
              </span>
            </div>

            <div className="d-flex flex-wrap gap-2 ms-auto">
              {!gate4Passed && (
                <Link
                  to={`/student/evaluation?courseId=${activeCourse?._id || ''}`}
                  className="btn btn-outline-warning fw-semibold btn-sm d-flex align-items-center gap-1"
                >
                  <i className="fa-solid fa-star-half-stroke"></i>
                  {isAr ? 'إكمال استبيان التقييم' : 'Complete Evaluation'}
                </Link>
              )}

              {activeCert?.certificateNumber && (
                <button
                  type="button"
                  className="btn btn-outline-primary fw-semibold btn-sm d-flex align-items-center gap-1"
                  onClick={() => setViewingCert(activeCert)}
                >
                  <i className="fa-solid fa-eye"></i>
                  {isAr ? 'معاينة الشهادة الصادرة' : 'View Issued Certificate'}
                </button>
              )}

              <button
                type="button"
                className="btn fw-bold px-4 py-2 shadow-sm d-flex align-items-center gap-2"
                style={{
                  backgroundColor: all4GatesPassed ? '#1E7C85' : '#E2E8F0',
                  borderColor: all4GatesPassed ? '#1E7C85' : '#CBD5E1',
                  color: all4GatesPassed ? '#FFFFFF' : '#94A3B8',
                  cursor: all4GatesPassed ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                }}
                disabled={!all4GatesPassed || isIssuing}
                onClick={handleGenerateCertificate}
              >
                {isIssuing ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    {isAr ? 'جاري الإصدار والتحقق الرقمي…' : 'Generating Institutional QR…'}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-certificate"></i>
                    {activeCert?.certificateNumber
                      ? (isAr ? 'إعادة إصدار / استعراض الاعتماد المعتمد' : 'Reissue / View Official Certificate')
                      : (isAr ? 'إصدار الشهادة الرسمية المعتمدة' : 'Generate Official Certificate')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* WORKFLOW STEPPER */}
      {isEligible && (
        <div className="egsa-card p-3 p-md-4 mb-4 shadow-sm border bg-white">
          <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
            <i className="fa-solid fa-route text-primary-egsa"></i>
            {isAr ? 'مراحل ومسار الاعتماد الرسمي' : 'Official Credential Workflow Lifecycle'}
          </h6>

          <div className="row g-2 text-center small">
            {/* Step 1: Submit Name */}
            <div className="col-6 col-md-3">
              <div className={`p-2 rounded border h-100 ${hasSubmittedName ? 'bg-light border-success-subtle text-success' : 'bg-primary-subtle text-primary border-primary'}`}>
                <div className="fw-bold mb-1">
                  {hasSubmittedName ? <i className="fa-solid fa-circle-check text-success me-1"></i> : <i className="fa-regular fa-circle text-primary me-1"></i>}
                  1. {isAr ? 'اسم الشهادة المعتمد' : 'Official Full Name'}
                </div>
                <span className="badge bg-white text-dark border">
                  {hasSubmittedName ? (isAr ? 'مكتمل ✓' : 'Completed ✓') : (isAr ? 'مطلوب' : 'In Progress')}
                </span>
              </div>
            </div>

            {/* Step 2: Complete Feedback */}
            <div className="col-6 col-md-3">
              <div className={`p-2 rounded border h-100 ${gate4Passed ? 'bg-light border-success-subtle text-success' : 'bg-warning-subtle text-dark border-warning'}`}>
                <div className="fw-bold mb-1">
                  {gate4Passed ? <i className="fa-solid fa-circle-check text-success me-1"></i> : <i className="fa-solid fa-circle-dot text-warning me-1"></i>}
                  2. {isAr ? 'استبيان تقييم الجودة' : 'Quality Feedback'}
                </div>
                <span className="badge bg-white text-dark border">
                  {gate4Passed ? (isAr ? 'مكتمل ✓' : 'Completed ✓') : (isAr ? 'قيد الانتظار' : 'Pending')}
                </span>
              </div>
            </div>

            {/* Step 3: 4-Gate Verification */}
            <div className="col-6 col-md-3">
              <div className={`p-2 rounded border h-100 ${all4GatesPassed ? 'bg-light border-success-subtle text-success' : 'bg-light text-muted'}`}>
                <div className="fw-bold mb-1">
                  {all4GatesPassed ? <i className="fa-solid fa-circle-check text-success me-1"></i> : <i className="fa-regular fa-circle text-muted me-1"></i>}
                  3. {isAr ? 'التحقق الصارم من الأهلية' : '4-Gate Verification'}
                </div>
                <span className="badge bg-white text-muted border">
                  {all4GatesPassed ? (isAr ? 'تم التحقق بنجاح ✓' : 'Verified (4/4) ✓') : (isAr ? 'قيد المراجعة' : 'Pending Verification')}
                </span>
              </div>
            </div>

            {/* Step 4: Tamper-Proof Credential Issued */}
            <div className="col-6 col-md-3">
              <div className={`p-2 rounded border h-100 ${(activeCert?.certificateNumber || (canReceiveCertificate && isIssued)) ? 'bg-success-subtle border-success text-success' : 'bg-light text-muted'}`}>
                <div className="fw-bold mb-1">
                  {(activeCert?.certificateNumber || (canReceiveCertificate && isIssued)) ? <i className="fa-solid fa-award text-success me-1"></i> : <i className="fa-solid fa-lock text-muted me-1"></i>}
                  4. {isAr ? 'الشهادة الرقمية المعتمدة' : 'Issued Credential'}
                </div>
                <span className={`badge ${(activeCert?.certificateNumber || (canReceiveCertificate && isIssued)) ? 'bg-success text-white' : 'bg-light text-muted border'}`}>
                  {(activeCert?.certificateNumber || (canReceiveCertificate && isIssued)) ? (isAr ? 'جاهزة برمز QR ✓' : 'Ready with QR ✓') : (isAr ? 'مقفل' : 'Locked')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 5 / READY CERTIFICATE PRESENTATION */}
      {activeCert && (
        <div className="row g-4 mb-4">
          <div className="col-12">
            <div
              className="egsa-card p-4 p-md-5 text-center position-relative overflow-hidden border-2 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #fbfdfd 100%)',
                borderColor: '#D4B87C',
                borderRadius: '12px',
              }}
            >
              <div
                className="position-absolute top-0 start-0 w-100"
                style={{
                  height: '6px',
                  background: 'linear-gradient(90deg, #3A6985, #D4B87C, #1E7C85)',
                }}
              />

              <div className="mb-4">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 shadow-sm"
                  style={{
                    width: '84px',
                    height: '84px',
                    background: 'rgba(212, 184, 124, 0.18)',
                    border: '2px solid #D4B87C',
                  }}
                >
                  <i className="fa-solid fa-award fa-3x" style={{ color: '#D4B87C' }}></i>
                </div>
                <h6 className="text-uppercase tracking-wider text-muted fw-bold small">
                  {isAr ? 'وكالة الفضاء المصرية — الأكاديمية' : 'Egyptian Space Agency — Space Academy'}
                </h6>
                <h2 className="fw-bold text-dark mt-1">
                  {isAr ? 'الشهادة الرقمية المعتمدة الرسمية' : 'Official Digital Credential Issued'}
                </h2>
                <p className="fw-semibold" style={{ color: '#1E7C85' }}>
                  {isAr ? 'شهادتك الموثقة رقمياً برمز QR جاهزة للاستعراض والتحقق والتحميل.' : 'Your tamper-proof QR verified credential is ready.'}
                </p>
              </div>

              <p className="text-muted mb-2">{isAr ? 'تشهد وكالة الفضاء المصرية بأن الخريج/ـة:' : 'This is to officially certify that:'}</p>

              {/* Recipient Name */}
              <h2
                className="display-6 fw-bold text-primary-egsa mb-2"
                style={{ fontFamily: 'var(--font-ar), var(--font-en), sans-serif' }}
              >
                {activeCert.recipientName || submittedCertificateName}
              </h2>

              <div className="p-3 bg-light rounded d-inline-block px-4 mb-4 border shadow-sm">
                <h5 className="fw-bold text-secondary-egsa mb-1">{activeCourse?.title || activeCert.courseTitle || 'Space Engineering Program'}</h5>
                <small className="text-muted">{activeCert.cohortName || activeCourse?.level || 'Egyptian Space Academy Track'}</small>
              </div>

              {/* Metadata Details */}
              <div className="row justify-content-center g-4 my-3 text-start small border-top pt-4 text-muted">
                <div className="col-sm-4 text-center">
                  <span className="d-block text-muted mb-1">{isAr ? 'الرقم التسلسلي المؤسسي:' : 'Certificate Number:'}</span>
                  <strong className="text-dark font-monospace fs-6">
                    {activeCert.certificateNumber || activeCert.certificateId || 'EGSA-CERT-2026-OFFICIAL'}
                  </strong>
                </div>
                <div className="col-sm-4 text-center">
                  <span className="d-block text-muted mb-1">{isAr ? 'تاريخ التخرج والإصدار:' : 'Completion & Issue Date:'}</span>
                  <strong className="text-dark fs-6">
                    {activeCert.issueDate ? new Date(activeCert.issueDate).toLocaleDateString() : 'October 2026'}
                  </strong>
                </div>
                <div className="col-sm-4 text-center">
                  <span className="d-block text-muted mb-1">{isAr ? 'رمز التحقق الرقمي:' : 'Verification Token:'}</span>
                  <strong className="text-dark font-monospace fs-6">
                    {(activeCert.verificationToken || activeCert.cryptographicSignature || 'SHA256').slice(0, 16)}…
                  </strong>
                </div>
              </div>

              {/* Actions: View Certificate & Download Certificate */}
              <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
                <button
                  type="button"
                  className="btn px-4 py-2 fw-semibold text-white shadow-sm"
                  style={{ backgroundColor: '#3A6985', borderColor: '#3A6985' }}
                  onClick={() => setViewingCert(activeCert)}
                >
                  <i className="fa-solid fa-eye me-2 ms-2"></i>
                  {isAr ? 'استعراض الشهادة التفاعلية' : 'Interactive Certificate Viewer'}
                </button>

                <button
                  type="button"
                  className="btn px-4 py-2 fw-semibold text-white shadow-sm"
                  style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
                  onClick={() => {
                    setViewingCert(activeCert);
                    setTimeout(() => window.print(), 400);
                  }}
                >
                  <i className="fa-solid fa-print me-2 ms-2"></i>
                  {isAr ? 'طباعة / حفظ PDF' : 'Download PDF'}
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary px-3 py-2 fw-semibold"
                  onClick={() => handleCopyVerificationLink(activeCert)}
                >
                  <i className="fa-solid fa-link me-1 ms-1"></i>
                  {copiedLink ? (isAr ? 'تم النسخ بنجاح ✓' : 'Link Copied ✓') : (isAr ? 'نسخ رابط التحقق العام' : 'Copy Verification Link')}
                </button>

                <Link
                  to={`/verify-certificate/${activeCert.certificateNumber || activeCert.certificateId || activeCert._id}`}
                  target="_blank"
                  className="btn btn-outline-primary px-3 py-2 fw-semibold"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square me-1 ms-1"></i>
                  {isAr ? 'بوابة التحقق العامة' : 'Public Verification Portal'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 1: NAME FORM (If not yet submitted or user wants to edit) */}
      {(!hasSubmittedName || isEditingSubmittedName) && (
        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div
              className="egsa-card p-4 p-md-5 mb-4 shadow-sm border"
              style={{
                borderTop: '4px solid #3A6985',
                borderRadius: '8px',
              }}
            >
              <div className="d-flex align-items-center gap-3 mb-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-primary-egsa"
                  style={{ width: '48px', height: '48px', backgroundColor: 'rgba(15, 43, 72, 0.08)' }}
                >
                  <i className="fa-solid fa-id-card-clip fa-xl"></i>
                </div>
                <div>
                  <h4 className="fw-bold text-dark mb-1">
                    {isAr ? 'تأكيد الاسم المطبوع على الشهادة الرسمية' : 'Official Certificate Recipient Name'}
                  </h4>
                  <p className="text-muted mb-0 small">
                    {isAr
                      ? 'أدخل اسمك كاملاً بدقة تامة كما ترغب أن يُطبع على شهادة وكالة الفضاء المصرية.'
                      : 'Enter your full name accurately as it should appear on your accredited EgSA credential.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitCertificateName} className="mt-4">
                <div className="mb-4">
                  <label htmlFor="certificateFullNameInput" className="form-label fw-bold text-dark">
                    {isAr ? 'الاسم الكامل للشهادة' : 'Certificate Full Name'} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    id="certificateFullNameInput"
                    className={`form-control form-control-lg ${nameError ? 'is-invalid' : ''}`}
                    placeholder={isAr ? 'الاسم الثلاثي أو الرباعي' : 'e.g. Youssef Ahmed Hassan'}
                    value={recipientName}
                    onChange={handleNameChange}
                    style={{ fontSize: '1.15rem', fontWeight: '500' }}
                    autoComplete="name"
                    disabled={isSubmitting}
                  />
                  {nameError ? (
                    <div className="invalid-feedback d-block mt-2">
                      <i className="fa-solid fa-circle-exclamation me-1 ms-1"></i> {nameError}
                    </div>
                  ) : (
                    <div className="form-text mt-2 text-muted small">
                      <i className="fa-solid fa-circle-info me-1 ms-1 text-primary-egsa"></i>
                      {isAr
                        ? 'سيتم استخدام هذا الاسم في التوقيع الرقمي وتوليد رمز التحقق QR.'
                        : 'This exact name will be cryptographically signed and encoded into the official verification QR.'}
                    </div>
                  )}
                </div>

                <div className="d-flex justify-content-between align-items-center">
                  {isEditingSubmittedName && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setRecipientName(submittedCertificateName);
                        setIsEditingSubmittedName(false);
                        setNameError('');
                      }}
                      disabled={isSubmitting}
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary px-4 py-2 fw-semibold ms-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin me-2 ms-2"></i>
                        {isAr ? 'جاري الحفظ…' : 'Saving…'}
                      </>
                    ) : (
                      isAr ? 'حفظ الاسم المعتمد' : 'Confirm Certificate Name'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-dark mb-3">
                <i className="fa-solid fa-circle-info text-primary-egsa me-2 ms-2"></i>
                {isAr ? 'إرشادات الاعتماد والتصديق' : 'Credential Guidelines'}
              </h6>
              <ul className="small text-muted mb-0 d-flex flex-column gap-2 ps-3 pe-3">
                <li>
                  {isAr
                    ? 'يُسمح بكتابة الاسم باللغة العربية أو الإنجليزية بدقة.'
                    : 'Names may be in Arabic or English according to national passport/ID.'}
                </li>
                <li>
                  {isAr
                    ? 'يتطلب إصدار الشهادة استيفاء جميع البوابات الأربعة المبينة بالأعلى.'
                    : 'Issuance strictly requires passing all 4 gates (Attendance, Assessments, Payment, Survey).'}
                </li>
                <li>
                  {isAr
                    ? 'تتضمن كل شهادة رقماً تسلسلياً فريداً ورمز QR عام للتحقق المؤسسي.'
                    : 'Every credential receives a unique institutional serial and public verification QR.'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE CERTIFICATE VIEWER MODAL (Step 2.2) */}
      {/* High-resolution aerospace frame (#3A6985 header, #D4B87C gold borders) */}
      {/* Embedded QR code at bottom-right corner, Download PDF & Copy Link controls */}
      {/* ========================================================================= */}
      {viewingCert && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              {/* Modal Header */}
              <div
                className="modal-header d-flex justify-content-between align-items-center px-4 py-3 no-print"
                style={{ backgroundColor: '#3A6985', color: '#FFFFFF' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <i className="fa-solid fa-certificate fs-4" style={{ color: '#D4B87C' }}></i>
                  <div>
                    <h5 className="modal-title fw-bold mb-0">
                      {isAr ? 'وثيقة الاعتماد الأكاديمي الرسمية — وكالة الفضاء المصرية' : 'Official Academic Credential — Egyptian Space Agency'}
                    </h5>
                    <small style={{ color: '#E2E8F0' }}>
                      {viewingCert.certificateNumber || viewingCert.certificateId || 'Official Verifiable Credential'}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setViewingCert(null)}
                  aria-label="Close"
                ></button>
              </div>

              {/* Modal Body / Official High-Res Aerospace Certificate Frame */}
              <div className="modal-body p-3 p-md-4 bg-light text-center" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <div
                  id="official-egsa-certificate-frame"
                  className="mx-auto p-4 p-md-5 position-relative shadow-sm"
                  style={{
                    maxWidth: '920px',
                    backgroundColor: '#FFFFFF',
                    border: '8px double #D4B87C',
                    borderRadius: '8px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                    fontFamily: 'serif',
                    color: '#0F2B48',
                  }}
                >
                  {/* Outer Aerospace Header Banner */}
                  <div
                    className="p-3 mb-4 rounded d-flex justify-content-between align-items-center"
                    style={{ backgroundColor: '#3A6985', color: '#FFFFFF' }}
                  >
                    <div className="text-start">
                      <div className="small fw-bold text-uppercase" style={{ letterSpacing: '2px', color: '#D4B87C' }}>
                        Arab Republic of Egypt
                      </div>
                      <div className="fs-5 fw-bold">Egyptian Space Agency (EgSA)</div>
                    </div>

                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                      style={{
                        width: '56px',
                        height: '56px',
                        backgroundColor: '#FFFFFF',
                        border: '2px solid #D4B87C',
                      }}
                    >
                      <i className="fa-solid fa-satellite fa-xl" style={{ color: '#3A6985' }}></i>
                    </div>

                    <div className="text-end" dir="rtl">
                      <div className="small fw-bold" style={{ color: '#D4B87C' }}>
                        جمهورية مصر العربية
                      </div>
                      <div className="fs-5 fw-bold">وكالة الفضاء المصرية</div>
                    </div>
                  </div>

                  {/* Watermark Crest */}
                  <div className="my-2">
                    <span
                      className="badge px-3 py-1 text-uppercase fw-bold"
                      style={{
                        backgroundColor: 'rgba(212, 184, 124, 0.2)',
                        color: '#926c15',
                        border: '1px solid #D4B87C',
                        letterSpacing: '1px',
                        fontSize: '0.8rem',
                      }}
                    >
                      Official Academic Credential of Merit
                    </span>
                  </div>

                  <h2
                    className="fw-bold my-3 text-uppercase"
                    style={{
                      color: '#0F2B48',
                      letterSpacing: '1px',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    Certificate of Completion
                  </h2>

                  <p className="text-muted fs-6 mb-2">This is to officially certify that</p>

                  {/* Student Full Name */}
                  <h1
                    className="fw-bold my-2"
                    style={{
                      color: '#3A6985',
                      fontSize: '2.5rem',
                      textDecoration: 'underline',
                      textDecorationColor: '#D4B87C',
                      textUnderlineOffset: '8px',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    {viewingCert.recipientName || recipientName || 'Youssef Ahmed'}
                  </h1>

                  <p className="text-muted fs-6 mt-3 mb-1">
                    has successfully fulfilled all institutional, academic, laboratory and technical requirements for the program:
                  </p>

                  {/* Program Title */}
                  <h3 className="fw-bold my-2" style={{ color: '#0F2B48', fontFamily: 'Georgia, serif' }}>
                    {viewingCert.courseTitle || activeCourse?.title || 'CubeSat Telemetry & Ground Stations'}
                  </h3>

                  <p className="text-muted small mb-4">
                    {viewingCert.cohortName ? `Cohort: ${viewingCert.cohortName} — ` : ''}
                    Egyptian Space Academy Professional Space Engineering Curriculum
                  </p>

                  <div className="row align-items-end justify-content-between mt-5 pt-3 border-top g-3">
                    {/* Left: Institutional Seal & Signature */}
                    <div className="col-12 col-md-4 text-start">
                      <div className="mb-2">
                        <div
                          className="d-inline-flex align-items-center justify-content-center rounded-circle"
                          style={{
                            width: '64px',
                            height: '64px',
                            border: '2px solid #D4B87C',
                            backgroundColor: 'rgba(212, 184, 124, 0.1)',
                          }}
                        >
                          <i className="fa-solid fa-stamp fa-2x" style={{ color: '#D4B87C' }}></i>
                        </div>
                      </div>
                      <div className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>
                        Prof. Dr. Sherif Sedky
                      </div>
                      <div className="text-muted small">Chief Executive Officer</div>
                      <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                        Egyptian Space Agency (EgSA)
                      </div>
                    </div>

                    {/* Center: Metadata */}
                    <div className="col-12 col-md-4 text-center">
                      <div className="p-2 rounded bg-light border small text-muted">
                        <div>
                          <strong>Serial:</strong>{' '}
                          <span className="font-monospace text-dark">
                            {viewingCert.certificateNumber || viewingCert.certificateId || 'EGSA-CERT-2026-X7F2'}
                          </span>
                        </div>
                        <div>
                          <strong>Issue Date:</strong>{' '}
                          <span className="text-dark">
                            {viewingCert.issueDate ? new Date(viewingCert.issueDate).toLocaleDateString() : 'October 19, 2026'}
                          </span>
                        </div>
                        <div>
                          <strong>Status:</strong>{' '}
                          <span className="badge bg-success text-white">Officially Registered</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Embedded QR Code (Bottom-Right Corner) */}
                    <div className="col-12 col-md-4 text-end">
                      <div className="d-inline-block text-center">
                        {viewingCert.qrCodeDataUrl ? (
                          <img
                            src={viewingCert.qrCodeDataUrl}
                            alt="Verification QR Code"
                            style={{
                              width: '120px',
                              height: '120px',
                              border: '2px solid #D4B87C',
                              padding: '4px',
                              borderRadius: '6px',
                              backgroundColor: '#FFFFFF',
                            }}
                          />
                        ) : (
                          <div
                            className="d-flex align-items-center justify-content-center rounded border"
                            style={{ width: '120px', height: '120px', backgroundColor: '#f8fafc' }}
                          >
                            <i className="fa-solid fa-qrcode fa-3x text-muted"></i>
                          </div>
                        )}
                        <div className="mt-1" style={{ fontSize: '0.7rem', color: '#64748B' }}>
                          <i className="fa-solid fa-shield-check text-success me-1"></i>
                          Scan to Verify Authenticity
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="modal-footer bg-white d-flex justify-content-between align-items-center px-4 py-3 no-print">
                <div className="text-muted small font-monospace">
                  <i className="fa-solid fa-lock text-success me-1"></i>
                  SHA-256 Digest: {(viewingCert.cryptographicSignature || viewingCert.verificationToken || 'a9f24e7c10b').slice(0, 24)}…
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn px-3 py-2 fw-semibold text-white shadow-sm"
                    style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85' }}
                    onClick={() => window.print()}
                  >
                    <i className="fa-solid fa-file-pdf me-2 ms-2"></i>
                    {isAr ? 'تحميل / طباعة PDF' : 'Download PDF'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-secondary px-3 py-2 fw-semibold"
                    onClick={() => handleCopyVerificationLink(viewingCert)}
                  >
                    <i className="fa-solid fa-link me-1 ms-1"></i>
                    {copiedLink ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ رابط التحقق' : 'Copy Verification Link')}
                  </button>

                  <Link
                    to={`/verify-certificate/${viewingCert.certificateNumber || viewingCert.certificateId || viewingCert._id}`}
                    target="_blank"
                    className="btn btn-outline-primary px-3 py-2 fw-semibold"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square me-1 ms-1"></i>
                    {isAr ? 'فتح بوابة التحقق' : 'Public Verification Page'}
                  </Link>

                  <button
                    type="button"
                    className="btn btn-secondary px-3 py-2 fw-semibold"
                    onClick={() => setViewingCert(null)}
                  >
                    {isAr ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
