import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Modal, Button, Form, Tab, Nav, Badge, Alert } from 'react-bootstrap';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Egyptian Space Agency (EgSA) — National Academy Platform
 * Student Commercial Engine & Payments Portal (§8 & §18 72-Hour Rule)
 */
export default function StudentPaymentsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightInvoiceId = searchParams.get('invoiceId');

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL'); // ALL, PENDING, PAID, OVERDUE, WAIVED

  // Pay Now Modal State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Vodafone Cash'); // 'Vodafone Cash', 'InstaPay', 'Credit Card'
  const [paymentForm, setPaymentForm] = useState({
    walletNumber: '01011112233',
    instaPayHandle: user?.email ? user.email.split('@')[0] + '@instapay' : 'cadet@instapay',
    cardHolder: user?.fullName || 'Cadet Trainee',
    cardNumber: '4123 4567 8901 2345',
    cardExpiry: '12/28',
    cardCvc: '888',
  });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Deadline check trigger state
  const [checkingDeadlines, setCheckingDeadlines] = useState(false);
  const [deadlineFeedback, setDeadlineFeedback] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/payments/my-invoices');
      const list = res.data?.data || [];
      setInvoices(list);

      // Auto-open if query param supplied
      if (highlightInvoiceId) {
        const found = list.find((i) => i._id === highlightInvoiceId);
        if (found && !['Paid', 'PAID', 'Waived'].includes(found.status)) {
          setSelectedInvoice(found);
          setShowPayModal(true);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tuition invoices from Egyptian Space Agency servers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [highlightInvoiceId]);

  // Find most urgent pending invoice for 72-hour banner
  const urgentPendingInvoice = invoices.find(
    (inv) => !['Paid', 'PAID', 'Waived'].includes(inv.status) && !inv.countdown?.isOverdue
  );

  const handleOpenPay = (inv) => {
    setSelectedInvoice(inv);
    setPayError('');
    setShowPayModal(true);
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setPaying(true);
    setPayError('');

    try {
      const payload = {
        invoiceId: selectedInvoice._id,
        method: paymentMethod,
        amount: selectedInvoice.balanceDue || selectedInvoice.amount,
        paymentDetails: paymentForm,
      };

      const res = await apiClient.post('/payments/pay', payload);
      if (res.data?.success) {
        setReceiptData({
          ...res.data.data,
          studentName: user?.fullName || 'Cadet',
          programTitle: selectedInvoice.course?.title || 'Space Academy Program',
          paidAt: new Date().toISOString(),
          paymentMethod,
        });
        setShowPayModal(false);
        setShowReceiptModal(true);
        fetchInvoices();
      }
    } catch (err) {
      setPayError(err.response?.data?.message || 'Payment simulation failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const triggerDeadlineCheck = async () => {
    setCheckingDeadlines(true);
    setDeadlineFeedback(null);
    try {
      const res = await apiClient.post('/payments/check-deadlines');
      setDeadlineFeedback(res.data?.message || '72-Hour deadline sweep completed.');
      fetchInvoices();
    } catch (err) {
      setDeadlineFeedback(err.response?.data?.message || 'Failed to execute deadline sweep.');
    } finally {
      setCheckingDeadlines(false);
    }
  };

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return ['Pending', 'Invoice Issued', 'PENDING'].includes(inv.status);
    if (filter === 'PAID') return ['Paid', 'PAID'].includes(inv.status);
    if (filter === 'OVERDUE') return ['Overdue', 'Expired'].includes(inv.status) || inv.countdown?.isOverdue;
    if (filter === 'WAIVED') return inv.status === 'Waived';
    return true;
  });

  return (
    <div className="container-fluid px-3 px-lg-4 py-4" style={{ overflowX: 'hidden', width: '100%', maxWidth: '100%' }}>
      {/* Page Title & Breadcrumbs */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span
              className="badge text-uppercase fw-bold"
              style={{ backgroundColor: '#D4B87C', color: '#000000', fontSize: '0.68rem', letterSpacing: '0.06em' }}
            >
              EgSA Commercial §8 & §18
            </span>
            <span className="text-muted small">Tuition & Enrollment Clearance</span>
          </div>
          <h2 className="fw-bold mb-0 text-dark">Tuition Payments & Invoices</h2>
          <p className="text-muted small mb-0">
            Authoritative financial ledger, 72-hour seat reservation countdowns, and commercial payment simulator.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={triggerDeadlineCheck}
            disabled={checkingDeadlines}
            title="Simulate EgSA 72-Hour Automated Deadline Check"
          >
            <i className={`fa-solid fa-clock-rotate-left me-1 ${checkingDeadlines ? 'fa-spin' : ''}`}></i>
            {checkingDeadlines ? 'Auditing Holds...' : 'Run 72h Seat Audit'}
          </button>
          <Link to="/student/dashboard" className="btn btn-outline-primary btn-sm">
            <i className="fa-solid fa-arrow-left me-1"></i> Dashboard
          </Link>
        </div>
      </div>

      {deadlineFeedback && (
        <Alert variant="info" dismissible onClose={() => setDeadlineFeedback(null)} className="mb-4 shadow-sm">
          <i className="fa-solid fa-circle-info me-2"></i>
          {deadlineFeedback}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" className="mb-4">
          <i className="fa-solid fa-triangle-exclamation me-2"></i>
          {error}
        </Alert>
      )}

      {/* 1. HIGH-VISIBILITY 72-HOUR COUNTDOWN BANNER */}
      {urgentPendingInvoice && (
        <div
          className={`p-3 p-md-4 rounded mb-4 shadow-sm border ${
            urgentPendingInvoice.countdown?.isUrgent ? 'animate-pulse' : ''
          }`}
          style={{
            backgroundColor: urgentPendingInvoice.countdown?.isUrgent
              ? 'rgba(223, 79, 76, 0.08)'
              : 'rgba(58, 105, 133, 0.08)',
            borderColor: urgentPendingInvoice.countdown?.isUrgent ? '#DF4F4C' : '#3A6985',
            borderWidth: 2,
          }}
        >
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <div className="d-flex align-items-start gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 text-white"
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: urgentPendingInvoice.countdown?.isUrgent ? '#DF4F4C' : '#3A6985',
                  fontSize: '1.25rem',
                }}
              >
                <i className="fa-solid fa-stopwatch"></i>
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="badge rounded-pill fw-bold"
                    style={{
                      backgroundColor: urgentPendingInvoice.countdown?.isUrgent ? '#DF4F4C' : '#D4B87C',
                      color: urgentPendingInvoice.countdown?.isUrgent ? '#FFFFFF' : '#000000',
                    }}
                  >
                    {urgentPendingInvoice.countdown?.isUrgent ? 'CRITICAL DEADLINE (<24H)' : 'STRICT 72-HOUR HOLD'}
                  </span>
                  <span className="fw-bold text-dark">
                    Invoice #{urgentPendingInvoice.invoiceNumber} — {urgentPendingInvoice.course?.title}
                  </span>
                </div>
                <div className="fw-bold text-dark fs-5">
                  <span
                    style={{
                      color: urgentPendingInvoice.countdown?.isUrgent ? '#DF4F4C' : '#1E7C85',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {urgentPendingInvoice.countdown?.remainingDays} Days :{' '}
                    {urgentPendingInvoice.countdown?.hoursMod} Hours :{' '}
                    {urgentPendingInvoice.countdown?.remainingMins} Mins until Seat Release
                  </span>
                </div>
                <p className="text-muted small mb-0 mt-1">
                  Egyptian Space Agency Platform Rule: If tuition ({urgentPendingInvoice.amount} EGP) is not settled
                  before the deadline, your provisional seat will be automatically released to the next waitlisted candidate.
                </p>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              <button
                type="button"
                className="btn btn-lg fw-bold px-4 shadow-sm"
                style={{
                  backgroundColor: urgentPendingInvoice.countdown?.isUrgent ? '#DF4F4C' : '#1E7C85',
                  borderColor: urgentPendingInvoice.countdown?.isUrgent ? '#DF4F4C' : '#1E7C85',
                  color: '#FFFFFF',
                }}
                onClick={() => handleOpenPay(urgentPendingInvoice)}
              >
                <i className="fa-solid fa-credit-card me-2"></i> Pay Now ({urgentPendingInvoice.amount} EGP)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="bg-white p-3 rounded border shadow-sm h-100" style={{ borderColor: '#CBD5E1' }}>
            <span className="text-muted small text-uppercase fw-semibold">Total Invoices</span>
            <div className="d-flex justify-content-between align-items-center mt-2">
              <span className="fs-4 fw-bold text-dark">{invoices.length}</span>
              <span className="text-primary-egsa fs-5" style={{ color: '#3A6985' }}>
                <i className="fa-solid fa-file-invoice"></i>
              </span>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="bg-white p-3 rounded border shadow-sm h-100" style={{ borderColor: '#CBD5E1' }}>
            <span className="text-muted small text-uppercase fw-semibold">Settled / Paid</span>
            <div className="d-flex justify-content-between align-items-center mt-2">
              <span className="fs-4 fw-bold text-success">
                {invoices.filter((i) => ['Paid', 'PAID', 'Waived'].includes(i.status)).length}
              </span>
              <span className="text-success fs-5">
                <i className="fa-solid fa-circle-check"></i>
              </span>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="bg-white p-3 rounded border shadow-sm h-100" style={{ borderColor: '#CBD5E1' }}>
            <span className="text-muted small text-uppercase fw-semibold">Pending Settlement</span>
            <div className="d-flex justify-content-between align-items-center mt-2">
              <span className="fs-4 fw-bold" style={{ color: '#D4B87C' }}>
                {invoices.filter((i) => ['Pending', 'Invoice Issued', 'PENDING'].includes(i.status)).length}
              </span>
              <span className="fs-5" style={{ color: '#D4B87C' }}>
                <i className="fa-solid fa-hourglass-half"></i>
              </span>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="bg-white p-3 rounded border shadow-sm h-100" style={{ borderColor: '#CBD5E1' }}>
            <span className="text-muted small text-uppercase fw-semibold">Outstanding Balance</span>
            <div className="d-flex justify-content-between align-items-center mt-2">
              <span className="fs-4 fw-bold text-dark">
                {invoices
                  .filter((i) => !['Paid', 'PAID', 'Waived'].includes(i.status))
                  .reduce((acc, curr) => acc + (curr.balanceDue != null ? curr.balanceDue : curr.amount), 0)}{' '}
                <span className="small fs-6 text-muted">EGP</span>
              </span>
              <span className="fs-5" style={{ color: '#1E7C85' }}>
                <i className="fa-solid fa-coins"></i>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. INTEGRATED INVOICES TABLE WITH FILTER PILLS */}
      <div className="bg-white p-4 rounded border shadow-sm mb-4" style={{ borderColor: '#CBD5E1' }}>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-3 border-bottom pb-3">
          <div>
            <h5 className="fw-bold mb-0 text-dark">Official Tuition Invoices Ledger</h5>
            <span className="text-muted small">Select an active invoice to initiate payment simulator</span>
          </div>

          {/* Filter Pills */}
          <div className="d-flex align-items-center gap-1 flex-wrap">
            {['ALL', 'PENDING', 'PAID', 'OVERDUE', 'WAIVED'].map((f) => (
              <button
                key={f}
                type="button"
                className={`btn btn-sm ${
                  filter === f ? 'btn-primary' : 'btn-outline-secondary'
                } rounded-pill px-3 fw-semibold`}
                style={
                  filter === f
                    ? { backgroundColor: '#1E7C85', borderColor: '#1E7C85', color: '#FFFFFF' }
                    : { borderColor: '#CBD5E1' }
                }
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary-egsa mb-2" role="status" style={{ color: '#1E7C85' }}></div>
            <p className="text-muted small">Loading invoices from Egyptian Space Agency servers...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-5">
            <i className="fa-solid fa-file-invoice text-muted fs-1 mb-2"></i>
            <h6 className="fw-bold text-dark">No Invoices Found</h6>
            <p className="text-muted small mb-0">No tuition invoices match the selected filter category.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-uppercase small" style={{ fontSize: '0.72rem', color: '#64748B' }}>
                <tr>
                  <th>Invoice #</th>
                  <th>Course & Cohort</th>
                  <th>Amount</th>
                  <th>72h Countdown / Due Date</th>
                  <th>Status</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const isPaid = ['Paid', 'PAID'].includes(inv.status);
                  const isWaived = inv.status === 'Waived';
                  const isOverdue = inv.countdown?.isOverdue;
                  const isUrgent = inv.countdown?.isUrgent;

                  return (
                    <tr key={inv._id}>
                      <td>
                        <span className="fw-bold text-dark">{inv.invoiceNumber}</span>
                        <div className="text-muted small" style={{ fontSize: '0.68rem' }}>
                          Ref: {inv.application?.referenceNumber || 'N/A'}
                        </div>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{inv.course?.title || 'Academic Course'}</div>
                        <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                          {inv.cohort?.name || 'Scheduled Cohort'} · {inv.packageType || 'Standard'}
                        </div>
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{inv.amount} EGP</div>
                        <div className="text-muted small" style={{ fontSize: '0.68rem' }}>
                          {isPaid || isWaived ? 'Fully Settled' : `Due: ${inv.balanceDue || inv.amount} EGP`}
                        </div>
                      </td>
                      <td>
                        {isPaid ? (
                          <span className="text-success small fw-semibold">
                            <i className="fa-solid fa-check-circle me-1"></i> Paid on{' '}
                            {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : 'Confirmed'}
                          </span>
                        ) : isWaived ? (
                          <span className="text-primary-egsa small fw-semibold" style={{ color: '#1E7C85' }}>
                            <i className="fa-solid fa-award me-1"></i> Government Tuition Waiver
                          </span>
                        ) : isOverdue ? (
                          <span className="text-danger small fw-semibold">
                            <i className="fa-solid fa-triangle-exclamation me-1"></i> Expired (Seat Released)
                          </span>
                        ) : (
                          <span
                            className={`small fw-bold ${isUrgent ? 'text-danger' : 'text-primary'}`}
                            style={{ color: isUrgent ? '#DF4F4C' : '#3A6985' }}
                          >
                            <i className="fa-regular fa-clock me-1"></i>
                            {inv.countdown?.formatted || 'Active 72h Hold'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge rounded-pill fw-bold"
                          style={{
                            backgroundColor: isPaid || isWaived
                              ? '#1E7C85'
                              : isUrgent
                              ? '#DF4F4C'
                              : isOverdue
                              ? '#64748B'
                              : '#D4B87C',
                            color: isPaid || isWaived || isUrgent || isOverdue ? '#FFFFFF' : '#000000',
                            fontSize: '0.7rem',
                            padding: '0.35rem 0.65rem',
                          }}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="text-end">
                        {!isPaid && !isWaived && !isOverdue ? (
                          <button
                            type="button"
                            className="btn btn-sm fw-bold px-3 shadow-sm"
                            style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85', color: '#FFFFFF' }}
                            onClick={() => handleOpenPay(inv)}
                          >
                            <i className="fa-solid fa-credit-card me-1"></i> Pay Now
                          </button>
                        ) : isPaid || isWaived ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary px-3"
                            onClick={() => {
                              setReceiptData({
                                transaction: inv.transactions?.[0] || {
                                  transactionId: inv.providerReference || 'TXN-CONFIRMED',
                                  method: inv.packageType || 'Electronic',
                                  amount: inv.amount,
                                },
                                invoice: inv,
                                studentName: user?.fullName || 'Cadet Trainee',
                                programTitle: inv.course?.title || 'Academic Program',
                                paidAt: inv.paidAt || inv.updatedAt,
                              });
                              setShowReceiptModal(true);
                            }}
                          >
                            <i className="fa-solid fa-receipt me-1"></i> View Receipt
                          </button>
                        ) : (
                          <span className="text-muted small">Seat Released</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. "PAY NOW" COMMERCIAL SIMULATOR MODAL */}
      <Modal show={showPayModal} onHide={() => setShowPayModal(false)} centered size="lg">
        <Modal.Header closeButton style={{ backgroundColor: '#071524', color: '#FFFFFF' }}>
          <Modal.Title className="fs-5 fw-bold d-flex align-items-center gap-2">
            <i className="fa-solid fa-lock text-accent-egsa" style={{ color: '#D4B87C' }}></i>
            Egyptian Space Agency — Secure Payment Simulator
          </Modal.Title>
        </Modal.Header>

        <Form onSubmit={handleProcessPayment}>
          <Modal.Body className="p-4" style={{ backgroundColor: '#F8FAFC' }}>
            {selectedInvoice && (
              <div className="bg-white p-3 rounded border mb-4 shadow-sm" style={{ borderColor: '#CBD5E1' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="text-muted small text-uppercase fw-bold">Settlement Target</span>
                    <h5 className="fw-bold text-dark mb-0">{selectedInvoice.course?.title}</h5>
                    <span className="text-muted small">Invoice #{selectedInvoice.invoiceNumber}</span>
                  </div>
                  <div className="text-end">
                    <span className="text-muted small text-uppercase fw-bold">Authorized Tuition</span>
                    <h3 className="fw-bold mb-0" style={{ color: '#1E7C85' }}>
                      {selectedInvoice.amount} EGP
                    </h3>
                  </div>
                </div>
              </div>
            )}

            {payError && (
              <Alert variant="danger" className="mb-3">
                <i className="fa-solid fa-circle-exclamation me-2"></i>
                {payError}
              </Alert>
            )}

            <Tab.Container activeKey={paymentMethod} onSelect={(k) => setPaymentMethod(k)}>
              <Nav variant="pills" className="nav-fill mb-4 p-1 bg-white border rounded shadow-sm gap-1">
                <Nav.Item>
                  <Nav.Link
                    eventKey="Vodafone Cash"
                    className="fw-bold d-flex align-items-center justify-content-center gap-2"
                  >
                    <i className="fa-solid fa-mobile-screen-button"></i> Vodafone Cash
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link
                    eventKey="InstaPay"
                    className="fw-bold d-flex align-items-center justify-content-center gap-2"
                  >
                    <i className="fa-solid fa-bolt"></i> InstaPay
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link
                    eventKey="Credit Card"
                    className="fw-bold d-flex align-items-center justify-content-center gap-2"
                  >
                    <i className="fa-regular fa-credit-card"></i> Credit / Debit Card
                  </Nav.Link>
                </Nav.Item>
              </Nav>

              <Tab.Content className="bg-white p-3 rounded border shadow-sm" style={{ borderColor: '#CBD5E1' }}>
                {/* Vodafone Cash Simulator */}
                <Tab.Pane eventKey="Vodafone Cash">
                  <div className="alert alert-light border small mb-3">
                    <i className="fa-solid fa-info-circle me-1 text-danger"></i>
                    Enter your Egyptian Vodafone Cash mobile wallet number. An instant authorization request will be simulated.
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold small">Vodafone Cash Wallet Mobile Number</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="010XXXXXXXX"
                      value={paymentForm.walletNumber}
                      onChange={(e) => setPaymentForm({ ...paymentForm, walletNumber: e.target.value })}
                      required
                    />
                    <Form.Text className="text-muted">Must be an active 11-digit Egyptian mobile wallet.</Form.Text>
                  </Form.Group>
                </Tab.Pane>

                {/* InstaPay Simulator */}
                <Tab.Pane eventKey="InstaPay">
                  <div className="alert alert-light border small mb-3">
                    <i className="fa-solid fa-bolt me-1 text-warning"></i>
                    Egyptian Central Bank Instant Payment Network (InstaPay). Enter your registered handle.
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold small">InstaPay Payment Address / Handle</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="username@instapay"
                      value={paymentForm.instaPayHandle}
                      onChange={(e) => setPaymentForm({ ...paymentForm, instaPayHandle: e.target.value })}
                      required
                    />
                  </Form.Group>
                </Tab.Pane>

                {/* Credit Card Simulator */}
                <Tab.Pane eventKey="Credit Card">
                  <div className="alert alert-light border small mb-3">
                    <i className="fa-solid fa-shield-halved me-1 text-primary"></i>
                    Simulated 256-bit encrypted gateway supporting Visa, Mastercard, and Meeza.
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold small">Cardholder Full Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={paymentForm.cardHolder}
                      onChange={(e) => setPaymentForm({ ...paymentForm, cardHolder: e.target.value })}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold small">Card Number</Form.Label>
                    <Form.Control
                      type="text"
                      value={paymentForm.cardNumber}
                      onChange={(e) => setPaymentForm({ ...paymentForm, cardNumber: e.target.value })}
                      required
                    />
                  </Form.Group>
                  <div className="row g-2">
                    <div className="col-6">
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold small">Expiry</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="MM/YY"
                          value={paymentForm.cardExpiry}
                          onChange={(e) => setPaymentForm({ ...paymentForm, cardExpiry: e.target.value })}
                          required
                        />
                      </Form.Group>
                    </div>
                    <div className="col-6">
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold small">CVC</Form.Label>
                        <Form.Control
                          type="password"
                          maxLength={4}
                          value={paymentForm.cardCvc}
                          onChange={(e) => setPaymentForm({ ...paymentForm, cardCvc: e.target.value })}
                          required
                        />
                      </Form.Group>
                    </div>
                  </div>
                </Tab.Pane>
              </Tab.Content>
            </Tab.Container>
          </Modal.Body>

          <Modal.Footer className="bg-white">
            <Button variant="secondary" onClick={() => setShowPayModal(false)} disabled={paying}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={paying}
              className="fw-bold px-4"
              style={{ backgroundColor: '#1E7C85', borderColor: '#1E7C85', color: '#FFFFFF' }}
            >
              {paying ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Processing Payment...
                </>
              ) : (
                `Confirm & Authorize ${selectedInvoice?.amount || ''} EGP`
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* 5. OFFICIAL RECEIPT MODAL */}
      <Modal show={showReceiptModal} onHide={() => setShowReceiptModal(false)} centered size="md">
        <Modal.Header closeButton style={{ backgroundColor: '#1E7C85', color: '#FFFFFF' }}>
          <Modal.Title className="fs-5 fw-bold d-flex align-items-center gap-2">
            <i className="fa-solid fa-circle-check"></i>
            Official Egyptian Space Agency Receipt
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 bg-white text-center">
          <div
            className="rounded-circle bg-success text-white d-inline-flex align-items-center justify-content-center mb-3"
            style={{ width: 64, height: 64, fontSize: '1.75rem' }}
          >
            <i className="fa-solid fa-check"></i>
          </div>

          <h5 className="fw-bold text-dark mb-1">Tuition Settled & Seat Confirmed!</h5>
          <p className="text-muted small mb-4">
            Transaction successfully cleared through Egyptian Space Agency commercial gateway.
          </p>

          {receiptData && (
            <div className="bg-light p-3 rounded border text-start small mb-4">
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Transaction ID:</span>
                <span className="fw-bold font-monospace text-dark">
                  {receiptData.transaction?.transactionId || 'TXN-SUCCESS'}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Invoice Number:</span>
                <span className="fw-bold text-dark">{receiptData.invoice?.invoiceNumber}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Payment Method:</span>
                <span className="fw-bold text-dark">{receiptData.paymentMethod || 'Commercial Gateway'}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Amount Cleared:</span>
                <span className="fw-bold text-success fs-6">{receiptData.invoice?.amount} EGP</span>
              </div>
              <div className="d-flex justify-content-between border-top pt-2">
                <span className="text-muted">Seat Status:</span>
                <span className="badge bg-success">Confirmed</span>
              </div>
            </div>
          )}

          <div className="d-flex gap-2 justify-content-center">
            <Link to="/student/training" className="btn btn-primary btn-sm px-4 fw-bold">
              Go to My Training
            </Link>
            <Button variant="outline-secondary" size="sm" onClick={() => window.print()}>
              <i className="fa-solid fa-print me-1"></i> Print Receipt
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}
