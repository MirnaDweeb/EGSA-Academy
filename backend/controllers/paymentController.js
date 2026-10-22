const Invoice = require('../models/Invoice');
const PaymentTransaction = require('../models/PaymentTransaction');
const Course = require('../models/Course');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const AuditLog = require('../models/AuditLog');
const Cohort = require('../models/Cohort');
const User = require('../models/User');
const paymentService = require('../services/paymentService');
const { AppError } = require('../middleware/error');

/**
 * Returns all invoices and payment transactions for the authenticated student.
 * GET /api/payments/my
 */
async function myPayments(req, res, next) {
  try {
    await paymentService.processExpiredInvoices();

    // Ensure all eligible applications have valid issued invoices discoverable by student
    try {
      const eligibleApps = await Application.find({
        student: req.user._id,
        eligibilityStatus: 'Eligible',
        status: { $in: ['Under Review', 'Submitted', 'Draft', 'Accepted', 'Eligible - Payment Pending'] },
      });
      for (const app of eligibleApps) {
        const invExists = await Invoice.exists({ application: app._id });
        if (!invExists) {
          const { autoAcceptAndReserveSeat } = require('../services/admissionService');
          await autoAcceptAndReserveSeat({ application: app });
        }
      }
    } catch (healErr) {
      console.error('[AUTO HEAL ERROR in myPayments]:', healErr.message);
    }

    const invoices = await Invoice.find({ student: req.user._id })
      .populate('course', 'title startDate price transportationPrice currency level')
      .populate('cohort', 'name startDate endDate')
      .populate('application', 'referenceNumber status selectedPackage')
      .sort({ createdAt: -1 });

    const invoiceIds = invoices.map((i) => i._id);
    const transactions = await PaymentTransaction.find({ invoice: { $in: invoiceIds } }).sort({ createdAt: -1 });
    const txMap = new Map();
    transactions.forEach((tx) => {
      const key = tx.invoice.toString();
      if (!txMap.has(key)) txMap.set(key, []);
      txMap.get(key).push(tx);
    });

    const enriched = invoices.map((inv) => {
      const obj = inv.toObject();
      obj.transactions = txMap.get(inv._id.toString()) || [];
      return obj;
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single invoice details for student (owner check) or admin.
 * GET /api/payments/invoices/:id
 */
async function getInvoiceDetails(req, res, next) {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('course', 'title startDate price transportationPrice currency level paymentPolicy refundPolicy')
      .populate('cohort', 'name startDate endDate')
      .populate('application', 'referenceNumber status selectedPackage submittedAt')
      .populate('student', 'fullName email phone registrationNumber');

    if (!invoice) {
      throw new AppError('Invoice not found.', 404);
    }

    const isOwner = req.user && req.user._id.toString() === invoice.student._id.toString();
    const isAdmin = req.user && ['admin', 'superadmin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: you do not have permission to view this invoice.', 403);
    }

    const transactions = await PaymentTransaction.find({ invoice: invoice._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        invoice,
        transactions,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Authoritative pricing calculator endpoint (never trusts frontend prices).
 * POST /api/payments/calculate
 */
async function calculatePrice(req, res, next) {
  try {
    const courseId = req.body?.courseId || req.query?.courseId;
    const cohortId = req.body?.cohortId || req.query?.cohortId;
    const packageType = req.body?.packageType || req.query?.packageType || 'WITHOUT_TRANSPORTATION';

    let course = null;
    if (courseId) {
      course = await Course.findById(courseId);
    } else if (cohortId) {
      const Cohort = require('../models/Cohort');
      const cohort = await Cohort.findById(cohortId).populate('course');
      course = cohort?.course;
    }

    if (!course) {
      throw new AppError('Valid courseId or cohortId is required.', 400);
    }

    const pricing = paymentService.calculatePricing(course, packageType);

    res.json({
      success: true,
      data: pricing,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Prepares an invoice for an accepted application.
 * POST /api/payments/prepare
 */
async function prepareInvoice(req, res, next) {
  try {
    const { applicationId, packageType } = req.body;
    if (!applicationId) {
      throw new AppError('applicationId is required.', 400);
    }

    const result = await paymentService.getOrCreateInvoiceForApplication({
      applicationId,
      studentId: req.user._id,
      packageType,
    });

    res.json({
      success: true,
      message: 'Invoice prepared successfully based on authoritative institutional pricing.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Initiates payment session with gateway adapter.
 * POST /api/payments/initiate
 * POST /api/payments/:invoiceId/initiate
 */
async function initiatePayment(req, res, next) {
  try {
    let invoiceId = req.params?.invoiceId || req.body?.invoiceId;
    const applicationId = req.body?.applicationId;

    if (!invoiceId && applicationId) {
      const inv = await Invoice.findOne({ application: applicationId });
      if (inv) {
        invoiceId = inv._id;
      } else {
        const prepared = await paymentService.getOrCreateInvoiceForApplication({
          applicationId,
          studentId: req.user._id,
          packageType: req.body.packageType,
        });
        invoiceId = prepared?.invoice?._id;
      }
    }

    if (!invoiceId) {
      throw new AppError('invoiceId or applicationId is required.', 400);
    }

    const { packageType, method, returnUrl } = req.body;

    const result = await paymentService.initiatePayment({
      invoiceId,
      studentId: req.user._id,
      packageType,
      method: method || 'Card',
      returnUrl,
    });

    res.status(201).json({
      success: true,
      message: 'Payment session initiated with gateway provider.',
      data: {
        ...result,
        redirectUrl: result.paymentUrl || result.redirectUrl,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Verifies gateway transaction outcome against authoritative provider records.
 * POST /api/payments/verify
 * Note: Never trusts client-supplied provider payloads or statuses.
 */
async function verifyPayment(req, res, next) {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      throw new AppError('transactionId is required.', 400);
    }

    // Strictly authenticate ownership and let backend query provider directly
    const result = await paymentService.verifyAndFinalizePayment({
      transactionId,
      studentId: req.user._id,
    });

    res.json({
      success: result.success,
      message: result.success
        ? 'Payment verified and confirmed successfully! Enrollment finalized.'
        : `Payment verification failed: ${result.failureReason || 'Not settled.'}`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Administrative offline payment settlement endpoint.
 * POST /api/payments/:invoiceId/pay
 * Strictly restricted to admin/superadmin for recording offline cash/bank-wire payments.
 * Direct student self-settlement without gateway verification is forbidden.
 */
async function payInvoice(req, res, next) {
  try {
    const isPrivileged = req.user && ['admin', 'superadmin'].includes(req.user.role);

    if (!isPrivileged) {
      throw new AppError('Direct student payment bypass is disabled. Tuition payments must be processed through the secure payment gateway.', 403);
    }

    const query = { _id: req.params.invoiceId };
    const invoice = await Invoice.findOne(query);
    if (!invoice) throw new AppError('Invoice not found.', 404);

    if (invoice.application) {
      const application = await Application.findById(invoice.application);
      if (application && !['Accepted', 'Eligible - Payment Pending'].includes(application.status)) {
        throw new AppError(`Payment not permitted: application status is ${application.status}. Applications must be accepted before payment.`, 400);
      }
    }

    if (['Paid', 'PAID'].includes(invoice.status)) {
      throw new AppError('Invoice has already been paid and settled.', 400);
    }

    if (['Cancelled', 'Overdue', 'Expired', 'Waived'].includes(invoice.status)) {
      throw new AppError(`Cannot pay an invoice that is ${invoice.status.toLowerCase()}. Please reapply or request a new invoice.`, 400);
    }

    if (invoice.dueDate && new Date() > new Date(invoice.dueDate) && invoice.amount > 0) {
      await paymentService.handleExpiredReservation(invoice);
      throw new AppError('The 72-hour payment deadline for this reservation has expired. Your seat has been released.', 400);
    }

    const { method, packageType } = req.body;
    const result = await paymentService.confirmPayment({ invoice, method: method || 'BankTransfer', packageType });

    res.json({
      success: true,
      message: 'Administrative payment confirmed successfully. Enrollment finalized.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: List all platform invoices and transactions.
 * GET /api/admin/payments
 */
async function adminList(req, res, next) {
  try {
    const data = await paymentService.adminListPayments(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Get detailed invoice & transaction audit history.
 * GET /api/admin/payments/:id
 */
async function adminGet(req, res, next) {
  try {
    const data = await paymentService.adminGetPaymentDetails(req.params.id);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Gateway Webhook Callback Handler
 * POST /api/payments/webhook
 * POST /api/payments/callback
 * Verifies Paymob cryptographic HMAC-SHA512 signature and idempotently finalizes transaction.
 */
async function handleGatewayWebhook(req, res, next) {
  // Paymob passes HMAC in query (for transaction callbacks) or in header
  const hmac =
    req.query?.hmac ||
    req.headers['x-paymob-hmac'] ||
    req.headers['hmac'] ||
    req.headers['stripe-signature']; // fallback check for compatibility

  if (!hmac) {
    return res.status(400).json({ error: 'Missing HMAC signature for callback verification.' });
  }

  const { getPaymentProvider } = require('../services/paymentProviders');
  const provider = getPaymentProvider('PAYMOB');

  // Transaction payload can be nested in req.body.obj or req.body or req.query
  const data = req.body?.obj || req.body || req.query;

  let isValidHmac = false;
  try {
    isValidHmac = provider.verifyWebhookHmac(data, hmac);
  } catch (err) {
    console.error('[GATEWAY WEBHOOK ERROR] HMAC check error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (!isValidHmac) {
    console.error('[GATEWAY WEBHOOK ERROR] Cryptographic HMAC mismatch.');
    return res.status(401).json({ success: false, message: 'Webhook Error: Invalid HMAC cryptographic signature.' });
  }

  try {
    const orderId = String(data.order?.id !== undefined ? data.order.id : data['order.id'] || data.order || '');
    const merchantTxId = data.merchant_order_id || data.order?.merchant_order_id;
    const gatewayTxId = String(data.id || '');

    // Resolve transaction
    let tx = null;
    if (merchantTxId) {
      tx = await PaymentTransaction.findOne({ transactionId: merchantTxId }).populate('invoice');
    }
    if (!tx && orderId) {
      tx = await PaymentTransaction.findOne({
        $or: [{ providerOrderId: orderId }, { providerReference: orderId }],
      }).populate('invoice');
    }
    if (!tx && gatewayTxId) {
      tx = await PaymentTransaction.findOne({ providerReference: gatewayTxId }).populate('invoice');
    }

    if (!tx) {
      console.warn(`[GATEWAY WEBHOOK] Ignored: no transaction found for order ${orderId} / tx ${gatewayTxId}`);
      return res.json({ received: true, ignored: true, reason: 'transaction_not_found' });
    }

    // Idempotency: if already settled, return immediately
    if (tx.status === 'Paid') {
      return res.json({ received: true, status: 'already_settled' });
    }

    // Currency verification
    const expectedCurrency = (tx.currency || 'EGP').toLowerCase();
    const receivedCurrency = String(data.currency || '').toLowerCase();
    if (receivedCurrency && receivedCurrency !== expectedCurrency) {
      console.error(`[GATEWAY WEBHOOK] Currency mismatch: received ${receivedCurrency}, expected ${expectedCurrency}`);
      return res.status(400).send('Currency mismatch.');
    }

    // Amount verification in cents
    const expectedCents = Math.round(Number(tx.amount) * 100);
    const receivedCents = Number(data.amount_cents);
    if (receivedCents && receivedCents !== expectedCents) {
      console.error(`[GATEWAY WEBHOOK] Amount mismatch: received ${receivedCents}, expected ${expectedCents}`);
      return res.status(400).send('Amount mismatch.');
    }

    // Check if invoice was already Overdue/Expired/Cancelled (Late payment handling)
    if (tx.invoice && ['Overdue', 'Expired', 'Cancelled'].includes(tx.invoice.status)) {
      console.error(`[GATEWAY WEBHOOK] REQUIRES MANUAL REFUND: Late payment received for ${tx.invoice.status} invoice ${tx.invoice._id}`);
      tx.status = 'Requires_Refund';
      tx.failureReason = `Late payment received after invoice ${tx.invoice.status}. Seat was released; manual financial reconciliation required.`;
      tx.providerReference = gatewayTxId || orderId;
      await tx.save();
      return res.json({ received: true, status: 'requires_refund' });
    }

    const isSuccess = data.success === true || data.success === 'true';

    if (isSuccess) {
      await paymentService.verifyAndFinalizePayment({
        transactionId: tx.transactionId,
        verifiedCallbackData: data,
        providerReference: gatewayTxId || orderId,
        providerPayload: data,
      });
      return res.json({ received: true, status: 'settled_successfully' });
    } else {
      tx.status = 'Failed';
      tx.failureReason = data.data?.message || 'Payment declined by card gateway.';
      await tx.save();

      if (tx.invoice && tx.invoice.status === 'Payment Initiated') {
        tx.invoice.status = 'Pending';
        await tx.invoice.save();
      }

      return res.json({ received: true, status: 'marked_failed' });
    }
  } catch (err) {
    console.error('[GATEWAY WEBHOOK HANDLER ERROR]:', err);
    res.status(500).json({ error: 'Webhook processing error', details: err.message });
  }
}

/**
 * Checks status of a payment session (for redirect return landing page).
 * GET /api/payments/session-status/:sessionId
 */
async function getPaymentSessionStatus(req, res, next) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      throw new AppError('sessionId parameter is required.', 400);
    }

    const transaction = await PaymentTransaction.findOne({
      $or: [
        { providerSessionId: sessionId },
        { providerOrderId: sessionId },
        { providerReference: sessionId },
        { transactionId: sessionId },
        { stripeCheckoutSessionId: sessionId },
        { 'metadata.sessionToken': sessionId },
        { 'metadata.paymentKey': sessionId },
      ],
    })
      .populate({ path: 'invoice', populate: [{ path: 'course' }, { path: 'cohort' }] })
      .populate('student', 'fullName email');

    if (!transaction) {
      throw new AppError('Payment transaction not found for this session.', 404);
    }

    const isOwner = req.user && String(transaction.student?._id || transaction.student) === String(req.user._id);
    const isAdmin = req.user && ['admin', 'superadmin'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: you cannot access another user payment session.', 403);
    }

    // If transaction is still initiated/pending, attempt live verification with provider
    if (transaction.status !== 'Paid') {
      try {
        const { getPaymentProvider } = require('../services/paymentProviders');
        const provider = getPaymentProvider(transaction.provider || 'PAYMOB');
        const verifyRes = await provider.verifyPayment({
          transactionId: transaction.transactionId,
          transaction,
          invoice: transaction.invoice,
          student: transaction.student,
          payload: { sessionId },
        });

        if (verifyRes.isVerified && verifyRes.status === 'SUCCESS') {
          await paymentService.verifyAndFinalizePayment({
            transactionId: transaction.transactionId,
            providerReference: verifyRes.providerReference,
          });
          const refreshed = await PaymentTransaction.findById(transaction._id)
            .populate({ path: 'invoice', populate: [{ path: 'course' }, { path: 'cohort' }] })
            .populate('student', 'fullName email');
          return res.json({
            success: true,
            status: refreshed.status,
            isSettled: refreshed.status === 'Paid',
            transaction: refreshed,
            invoice: refreshed.invoice,
          });
        } else if (verifyRes.status === 'CANCELLED') {
          transaction.status = 'Cancelled';
          transaction.failureReason = verifyRes.failureReason || 'Checkout session expired or cancelled.';
          await transaction.save();
          if (transaction.invoice && transaction.invoice.status === 'Payment Initiated') {
            await Invoice.findByIdAndUpdate(transaction.invoice._id, { status: 'Pending' });
          }
        }
      } catch (_) {
        // Fall back to returning current database state
      }
    }

    res.json({
      success: true,
      status: transaction.status,
      isSettled: transaction.status === 'Paid',
      transaction,
      invoice: transaction.invoice,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student: Get masked refund account destination.
 * GET /api/payments/refund-account
 */
async function getRefundAccount(req, res, next) {
  try {
    const acc = await paymentService.getStudentRefundAccount(req.user._id);
    res.json({
      success: true,
      data: {
        accountHolderName: acc?.accountHolderName,
        refundMethod: acc?.refundMethod,
        bankName: acc?.bankName,
        maskedAccount: acc?.accountNumberMasked,
        maskedIban: acc?.ibanMasked,
        swiftCode: acc?.swiftCode,
        isConfirmed: acc?.isConfirmed,
        confirmedAt: acc?.confirmedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student: Save / Update refund destination.
 * POST /api/payments/refund-account
 */
async function saveRefundAccount(req, res, next) {
  try {
    const { accountHolderName, refundMethod, bankName, accountNumber, iban, swiftCode } = req.body;
    const acc = await paymentService.saveStudentRefundAccount({
      studentId: req.user._id,
      accountHolderName,
      refundMethod,
      bankName,
      accountNumber,
      iban,
      swiftCode,
      actorId: req.user._id,
    });

    res.json({
      success: true,
      message: 'Refund destination saved securely under EGSA Academy financial policy.',
      data: {
        accountHolderName: acc.accountHolderName,
        refundMethod: acc.refundMethod,
        bankName: acc.bankName,
        maskedAccount: acc.accountNumberMasked,
        maskedIban: acc.ibanMasked,
        swiftCode: acc.swiftCode,
        isConfirmed: acc.isConfirmed,
        confirmedAt: acc.confirmedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student: Submit a refund request.
 * POST /api/payments/invoices/:invoiceId/refund-request
 */
async function requestRefund(req, res, next) {
  try {
    const { amount, reason } = req.body;
    const refundReq = await paymentService.requestRefund({
      invoiceId: req.params.invoiceId,
      studentId: req.user._id,
      amount,
      reason,
    });

    res.status(201).json({
      success: true,
      message: 'Refund request submitted successfully. It is now pending administrative review.',
      data: refundReq,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student: List my refund requests.
 * GET /api/payments/my-refunds
 */
async function myRefunds(req, res, next) {
  try {
    const refunds = await paymentService.listStudentRefunds(req.user._id);
    res.json({ success: true, data: refunds });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: List all platform refund requests.
 * GET /api/admin/refunds
 */
async function adminListRefunds(req, res, next) {
  try {
    const refunds = await paymentService.adminListRefunds(req.query);
    res.json({ success: true, data: refunds });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Get single refund request audit details.
 * GET /api/admin/refunds/:id
 */
async function adminGetRefund(req, res, next) {
  try {
    const refund = await paymentService.adminGetRefundDetails(req.params.id);
    res.json({ success: true, data: refund });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Review, approve, or reject refund request.
 * PATCH /api/admin/refunds/:id/review
 */
async function adminReviewRefund(req, res, next) {
  try {
    const { decision, decisionNote, approvedAmount } = req.body;
    const result = await paymentService.adminReviewRefund({
      refundRequestId: req.params.id,
      adminId: req.user._id,
      decision,
      decisionNote,
      approvedAmount,
    });

    res.json({
      success: true,
      message: `Refund request successfully ${decision.toLowerCase()}.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Execute and process approved refund.
 * POST /api/admin/refunds/:id/process
 */
async function adminProcessRefund(req, res, next) {
  try {
    const { settlementMethod, manualReference, notes } = req.body;
    const result = await paymentService.adminProcessRefund({
      refundRequestId: req.params.id,
      adminId: req.user._id,
      settlementMethod,
      manualReference,
      notes,
    });

    res.json({
      success: true,
      message: 'Refund settled and finalized successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/my-invoices
 * Fetches all issued invoices and active countdowns for the logged-in student.
 */
async function getMyInvoices(req, res, next) {
  try {
    const studentId = req.user._id;

    // Auto-heal any accepted/eligible apps missing invoices
    try {
      const eligibleApps = await Application.find({
        student: studentId,
        eligibilityStatus: 'Eligible',
        status: { $in: ['Under Review', 'Submitted', 'Draft', 'Accepted', 'Eligible - Payment Pending'] },
      });
      for (const app of eligibleApps) {
        const invExists = await Invoice.exists({ application: app._id });
        if (!invExists) {
          const { autoAcceptAndReserveSeat } = require('../services/admissionService');
          await autoAcceptAndReserveSeat({ application: app });
        }
      }
    } catch (healErr) {
      console.error('[AUTO HEAL ERROR in getMyInvoices]:', healErr.message);
    }

    const invoices = await Invoice.find({ student: studentId })
      .populate('course', 'title startDate endDate price transportationPrice currency level code division deliveryMode')
      .populate('cohort', 'name startDate endDate capacity')
      .populate('application', 'referenceNumber status selectedPackage submittedAt')
      .sort({ createdAt: -1 });

    const invoiceIds = invoices.map((i) => i._id);
    const transactions = await PaymentTransaction.find({ invoice: { $in: invoiceIds } }).sort({ createdAt: -1 });
    const txMap = new Map();
    transactions.forEach((tx) => {
      const k = tx.invoice.toString();
      if (!txMap.has(k)) txMap.set(k, []);
      txMap.get(k).push(tx);
    });

    const now = new Date();
    const enriched = invoices.map((inv) => {
      const obj = inv.toObject();
      obj.transactions = txMap.get(inv._id.toString()) || [];

      const dueAt = obj.dueAt || obj.dueDate || (obj.createdAt ? new Date(new Date(obj.createdAt).getTime() + 72 * 3600 * 1000) : new Date(now.getTime() + 72 * 3600 * 1000));
      obj.effectiveDueAt = dueAt;
      const remainingMs = Math.max(0, new Date(dueAt).getTime() - now.getTime());
      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const remainingDays = Math.floor(remainingHours / 24);
      const hoursMod = remainingHours % 24;
      const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

      const isPaid = ['Paid', 'PAID'].includes(obj.status);
      const isWaived = obj.status === 'Waived';
      const isOverdue = !isPaid && !isWaived && now > new Date(dueAt);
      const isUrgent = !isPaid && !isWaived && remainingHours < 24 && !isOverdue;

      obj.countdown = {
        remainingMs,
        remainingHours,
        remainingDays,
        hoursMod,
        remainingMins,
        isUrgent,
        isOverdue,
        formatted: isPaid
          ? 'Settled / Paid'
          : isWaived
          ? 'Waived / Sponsored'
          : isOverdue
          ? 'Expired / Seat Released'
          : `${remainingDays}d ${hoursMod}h ${remainingMins}m until Seat Release`,
      };

      obj.balanceDue = isPaid || isWaived ? 0 : (obj.balanceDue != null ? obj.balanceDue : obj.amount);
      return obj;
    });

    res.json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/pay
 * Simulates commercial payment (Vodafone Cash / InstaPay / Credit Card / Waiver).
 * Upon success: updates Invoice.status = 'Paid', sets Enrollment.seatStatus = 'Confirmed',
 * and updates Application.status = 'Confirmed'.
 */
async function simulatePayment(req, res, next) {
  try {
    const { invoiceId, method = 'Credit Card', paymentDetails = {}, amount } = req.body;

    if (!invoiceId) {
      throw new AppError('Invoice ID is required.', 400);
    }

    const invoice = await Invoice.findById(invoiceId)
      .populate('student', 'fullName email phone')
      .populate('course', 'title price currency')
      .populate('cohort', 'name startDate endDate');

    if (!invoice) {
      throw new AppError('Invoice not found.', 404);
    }

    const isOwner = req.user && req.user._id.toString() === invoice.student._id.toString();
    const isAdmin = req.user && ['admin', 'superadmin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: you do not have permission to pay this invoice.', 403);
    }

    const payAmount = Number(amount) || invoice.amount || 0;

    // Format transaction and reference based on method
    const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let externalReference = `SIM-${Date.now()}`;
    let provider = 'PAYMOB';

    if (method === 'Vodafone Cash') {
      const walletNum = paymentDetails.walletNumber || paymentDetails.phone || '01000000000';
      externalReference = `VF-CASH-${walletNum}-${Math.floor(1000 + Math.random() * 9000)}`;
      provider = 'VODAFONE_CASH';
    } else if (method === 'InstaPay') {
      const handle = paymentDetails.instaPayHandle || paymentDetails.handle || 'user@instapay';
      externalReference = `IPA-${handle.replace(/[@.]/g, '_')}-${Math.floor(1000 + Math.random() * 9000)}`;
      provider = 'INSTAPAY';
    } else if (method === 'Credit Card' || method === 'Card') {
      const last4 = paymentDetails.cardNumber ? String(paymentDetails.cardNumber).replace(/\s/g, '').slice(-4) : '4242';
      externalReference = `CARD-AUTH-${last4}-${Math.floor(1000 + Math.random() * 9000)}`;
      provider = 'CARD_GATEWAY';
    } else if (method === 'Waiver') {
      externalReference = paymentDetails.sponsor || 'EGSA-GOVERNMENT-WAIVER';
      provider = 'WAIVER';
    }

    // 1. Create PaymentTransaction
    const transaction = await PaymentTransaction.create({
      invoice: invoice._id,
      student: invoice.student._id || invoice.student,
      amount: payAmount,
      currency: invoice.currency || 'EGP',
      method: method === 'Card' ? 'Credit Card' : method,
      transactionId,
      provider,
      externalReference,
      providerReference: externalReference,
      status: 'Success',
      paymentDate: new Date(),
      metadata: {
        ...paymentDetails,
        simulatedAt: new Date(),
        initiatedBy: req.user._id,
      },
    });

    // 2. Update Invoice
    invoice.status = method === 'Waiver' ? 'Waived' : 'Paid';
    invoice.paidAt = new Date();
    invoice.balanceDue = 0;
    invoice.remainingAmount = 0;
    invoice.paymentReference = transaction._id;
    await invoice.save();

    // 3. Update or create Enrollment with confirmed seatStatus
    let enrollment = await Enrollment.findOne({
      student: invoice.student._id || invoice.student,
      course: invoice.course._id || invoice.course,
    });

    let resolvedCohort = invoice.cohort?._id || invoice.cohort;
    if (!resolvedCohort && invoice.application) {
      const appDoc = await Application.findById(invoice.application);
      resolvedCohort = appDoc?.cohort;
    }

    if (!enrollment) {
      enrollment = await Enrollment.create({
        student: invoice.student._id || invoice.student,
        course: invoice.course._id || invoice.course,
        cohort: resolvedCohort,
        application: invoice.application,
        status: 'Confirmed',
        seatStatus: 'Confirmed',
        paymentStatus: method === 'Waiver' ? 'Waived' : 'Paid',
        paidAmount: payAmount,
        paymentReference: transaction._id,
      });
    } else {
      enrollment.status = 'Confirmed';
      enrollment.seatStatus = 'Confirmed';
      enrollment.paymentStatus = method === 'Waiver' ? 'Waived' : 'Paid';
      enrollment.paidAmount = payAmount;
      enrollment.paymentReference = transaction._id;
      if (resolvedCohort) enrollment.cohort = resolvedCohort;
      await enrollment.save();
    }

    // 4. Update Application status
    if (invoice.application) {
      await Application.findByIdAndUpdate(invoice.application, {
        status: 'Confirmed',
        paymentStatus: 'Paid',
      });
    }

    // 5. Audit Logging
    try {
      await AuditLog.create({
        user: req.user._id,
        action: 'PAYMENT_PROCESSED',
        resource: 'Invoice',
        resourceId: invoice._id,
        details: {
          transactionId: transaction.transactionId,
          method: transaction.method,
          amount: transaction.amount,
          invoiceNumber: invoice.invoiceNumber,
          seatStatus: 'Confirmed',
        },
      });
    } catch (auditErr) {
      console.warn('[AuditLog warning]:', auditErr.message);
    }

    res.json({
      success: true,
      message: `Payment of ${payAmount} EGP settled successfully via ${method}. Seat confirmed!`,
      data: {
        transaction,
        invoice,
        enrollment,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/check-deadlines
 * Automated logic: Checks for unpaid invoices where now > dueAt.
 * Automatically releases seat (Enrollment.seatStatus = 'Released').
 * Promotes the next candidate from Waitlist with a new provisional hold.
 */
async function checkDeadlines(req, res, next) {
  try {
    const now = new Date();

    // Find all unpaid invoices whose deadline has passed
    const overdueInvoices = await Invoice.find({
      status: { $in: ['Pending', 'Invoice Issued', 'PENDING'] },
      $or: [
        { dueAt: { $lt: now } },
        { dueDate: { $lt: now } },
      ],
    })
      .populate('course', 'title price')
      .populate('cohort', 'name startDate endDate')
      .populate('student', 'fullName email phone');

    const releasedList = [];
    const promotedList = [];

    for (const inv of overdueInvoices) {
      // 1. Mark Invoice as Overdue
      inv.status = 'Overdue';
      await inv.save();

      // 2. Release seat in linked Enrollment
      const enrollment = await Enrollment.findOne({
        student: inv.student?._id || inv.student,
        course: inv.course?._id || inv.course,
      });

      if (enrollment) {
        enrollment.seatStatus = 'Released';
        enrollment.status = 'Cancelled';
        await enrollment.save();
      }

      // 3. Mark Application as Expired
      if (inv.application) {
        await Application.findByIdAndUpdate(inv.application, {
          status: 'Expired',
        });
      }

      releasedList.push({
        invoiceId: inv._id,
        invoiceNumber: inv.invoiceNumber,
        student: inv.student?.fullName || 'Unknown Student',
        course: inv.course?.title || 'Unknown Course',
        dueAt: inv.dueAt,
      });

      // 4. Promote next candidate from Waitlist for this cohort or course
      const filter = {
        course: inv.course?._id || inv.course,
        status: 'Waitlisted',
      };
      if (inv.cohort) {
        filter.cohort = inv.cohort._id || inv.cohort;
      }

      const nextCandidateApp = await Application.findOne(filter)
        .sort({ waitlistPosition: 1, createdAt: 1 })
        .populate('student', 'fullName email phone');

      if (nextCandidateApp) {
        // Promote candidate: status = 'Eligible - Payment Pending'
        nextCandidateApp.status = 'Eligible - Payment Pending';
        nextCandidateApp.promotedFromWaitlistAt = new Date();
        await nextCandidateApp.save();

        // Create or update provisional Enrollment with seatStatus = 'Hold'
        let candidateEnrollment = await Enrollment.findOne({
          student: nextCandidateApp.student?._id || nextCandidateApp.student,
          course: nextCandidateApp.course,
        });

        if (!candidateEnrollment) {
          candidateEnrollment = await Enrollment.create({
            student: nextCandidateApp.student?._id || nextCandidateApp.student,
            course: nextCandidateApp.course,
            cohort: nextCandidateApp.cohort,
            application: nextCandidateApp._id,
            status: 'Pending Payment',
            seatStatus: 'Hold',
            paymentStatus: 'Pending',
          });
        } else {
          candidateEnrollment.seatStatus = 'Hold';
          candidateEnrollment.status = 'Pending Payment';
          candidateEnrollment.paymentStatus = 'Pending';
          await candidateEnrollment.save();
        }

        // Issue new 72-hour invoice for promoted candidate
        const newDueAt = new Date(Date.now() + 72 * 3600 * 1000);
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const promotedInvoice = await Invoice.create({
          invoiceNumber: `INV-${new Date().getFullYear()}-${randomNum}`,
          student: nextCandidateApp.student?._id || nextCandidateApp.student,
          application: nextCandidateApp._id,
          course: nextCandidateApp.course,
          cohort: nextCandidateApp.cohort,
          amount: inv.amount,
          balanceDue: inv.amount,
          currency: 'EGP',
          status: 'Pending',
          dueAt: newDueAt,
          dueDate: newDueAt,
          issuedAt: new Date(),
        });

        promotedList.push({
          candidateApplicationId: nextCandidateApp._id,
          candidateName: nextCandidateApp.student?.fullName || 'Waitlisted Candidate',
          invoiceNumber: promotedInvoice.invoiceNumber,
          dueAt: newDueAt,
        });

        // Audit Log promotion
        try {
          await AuditLog.create({
            user: req.user?._id || inv.student?._id || inv.student,
            action: 'WAITLIST_PROMOTED',
            resource: 'Application',
            resourceId: nextCandidateApp._id,
            details: {
              promotedApplicationId: nextCandidateApp._id,
              newInvoiceNumber: promotedInvoice.invoiceNumber,
              releasedFromStudent: inv.student?.fullName,
            },
          });
        } catch (audErr) {
          console.warn('[Audit error]:', audErr.message);
        }
      }
    }

    res.json({
      success: true,
      message: `Deadline check completed. ${releasedList.length} seats released, ${promotedList.length} waitlisted candidates promoted.`,
      expiredCount: releasedList.length,
      promotedCount: promotedList.length,
      releasedSeats: releasedList,
      promotions: promotedList,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/payments/override-late
 * Admin can confirm a seat after deadline with mandatory justification reason logged in AuditLog.
 */
async function overrideLateSeat(req, res, next) {
  try {
    const { invoiceId, enrollmentId, reason } = req.body;

    if (!reason || !reason.trim()) {
      throw new AppError('Mandatory justification reason is required for administrative late seat override.', 400);
    }

    let targetInvoice = null;
    let targetEnrollment = null;

    if (invoiceId) {
      targetInvoice = await Invoice.findById(invoiceId).populate('student', 'fullName email');
    }

    if (enrollmentId) {
      targetEnrollment = await Enrollment.findById(enrollmentId).populate('student', 'fullName email');
    } else if (targetInvoice) {
      targetEnrollment = await Enrollment.findOne({
        student: targetInvoice.student?._id || targetInvoice.student,
        course: targetInvoice.course,
      });
    }

    if (!targetInvoice && !targetEnrollment) {
      throw new AppError('Invoice or Enrollment not found.', 404);
    }

    // Confirm seat in Enrollment
    if (targetEnrollment) {
      targetEnrollment.seatStatus = 'Confirmed';
      targetEnrollment.status = 'Confirmed';
      targetEnrollment.paymentStatus = 'Paid';
      await targetEnrollment.save();
    }

    // Update invoice if exists
    if (targetInvoice) {
      targetInvoice.status = 'Paid';
      targetInvoice.paidAt = new Date();
      targetInvoice.balanceDue = 0;
      await targetInvoice.save();

      if (targetInvoice.application) {
        await Application.findByIdAndUpdate(targetInvoice.application, {
          status: 'Confirmed',
        });
      }
    }

    // Log in AuditLog
    await AuditLog.create({
      user: req.user._id,
      action: 'LATE_SEAT_OVERRIDE',
      resource: 'Enrollment',
      resourceId: targetEnrollment?._id || targetInvoice?._id,
      details: {
        adminName: req.user.fullName || req.user.email,
        reason: reason.trim(),
        invoiceNumber: targetInvoice?.invoiceNumber,
        student: targetEnrollment?.student?.fullName || targetInvoice?.student?.fullName,
      },
    });

    res.json({
      success: true,
      message: 'Late seat override confirmed successfully and logged in official audit records.',
      data: {
        invoice: targetInvoice,
        enrollment: targetEnrollment,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/payments/sponsor-waiver
 * Admin grants official institutional / government tuition waiver.
 */
async function sponsorWaiver(req, res, next) {
  try {
    const { invoiceId, sponsorName = 'Egyptian Space Agency Scholarship', reason } = req.body;

    if (!invoiceId) {
      throw new AppError('Invoice ID is required.', 400);
    }

    const invoice = await Invoice.findById(invoiceId)
      .populate('student', 'fullName email')
      .populate('course', 'title');

    if (!invoice) {
      throw new AppError('Invoice not found.', 404);
    }

    const transactionId = `TXN-WAIVER-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const tx = await PaymentTransaction.create({
      invoice: invoice._id,
      student: invoice.student._id || invoice.student,
      amount: invoice.amount,
      currency: invoice.currency || 'EGP',
      method: 'Waiver',
      transactionId,
      provider: 'WAIVER',
      externalReference: sponsorName,
      providerReference: sponsorName,
      status: 'Success',
      paymentDate: new Date(),
      metadata: {
        sponsorName,
        reason: reason || 'Approved Institutional Tuition Waiver',
        grantedBy: req.user._id,
      },
    });

    invoice.status = 'Waived';
    invoice.paidAt = new Date();
    invoice.balanceDue = 0;
    invoice.remainingAmount = 0;
    invoice.paymentReference = tx._id;
    await invoice.save();

    let enrollment = await Enrollment.findOne({
      student: invoice.student._id || invoice.student,
      course: invoice.course._id || invoice.course,
    });

    if (enrollment) {
      enrollment.seatStatus = 'Confirmed';
      enrollment.status = 'Confirmed';
      enrollment.paymentStatus = 'Waived';
      enrollment.paidAmount = invoice.amount;
      enrollment.paymentReference = tx._id;
      await enrollment.save();
    } else {
      enrollment = await Enrollment.create({
        student: invoice.student._id || invoice.student,
        course: invoice.course._id || invoice.course,
        cohort: invoice.cohort,
        application: invoice.application,
        status: 'Confirmed',
        seatStatus: 'Confirmed',
        paymentStatus: 'Waived',
        paidAmount: invoice.amount,
        paymentReference: tx._id,
      });
    }

    if (invoice.application) {
      await Application.findByIdAndUpdate(invoice.application, {
        status: 'Confirmed',
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'SPONSOR_WAIVER_GRANTED',
      resource: 'Invoice',
      resourceId: invoice._id,
      details: {
        adminName: req.user.fullName || req.user.email,
        sponsorName,
        reason,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    res.json({
      success: true,
      message: `Tuition waiver sponsored by "${sponsorName}" successfully applied.`,
      data: {
        invoice,
        enrollment,
        transaction: tx,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/payments/overview & GET /api/payments/admin/overview
 * KPI Stat Cards: Collected Revenue (EGP), Outstanding Balance (EGP), Confirmed Seats, Released Seats.
 * Invoices table with filter pills (All, Paid, Pending, Overdue <72h, Waived).
 */
async function adminPaymentsOverview(req, res, next) {
  try {
    const invoices = await Invoice.find({})
      .populate('student', 'fullName email phone nationalId')
      .populate('course', 'title price currency level division')
      .populate('cohort', 'name startDate endDate')
      .populate('application', 'referenceNumber status submittedAt selectedPackage')
      .sort({ createdAt: -1 });

    const enrollments = await Enrollment.find({});

    let collectedRevenue = 0;
    let outstandingBalance = 0;

    const now = new Date();

    const enrichedInvoices = invoices.map((inv) => {
      const obj = inv.toObject();
      const isPaid = ['Paid', 'PAID'].includes(obj.status);
      const isWaived = obj.status === 'Waived';

      if (isPaid) {
        collectedRevenue += Number(obj.amount) || 0;
      } else if (!isWaived) {
        outstandingBalance += Number(obj.balanceDue != null ? obj.balanceDue : obj.amount) || 0;
      }

      const dueAt = obj.dueAt || obj.dueDate || (obj.createdAt ? new Date(new Date(obj.createdAt).getTime() + 72 * 3600 * 1000) : new Date(now.getTime() + 72 * 3600 * 1000));
      obj.effectiveDueAt = dueAt;
      const remainingMs = Math.max(0, new Date(dueAt).getTime() - now.getTime());
      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const isOverdue = !isPaid && !isWaived && now > new Date(dueAt);
      const isUrgent = !isPaid && !isWaived && remainingHours < 24 && !isOverdue;

      obj.countdown = {
        remainingMs,
        remainingHours,
        isUrgent,
        isOverdue,
      };

      return obj;
    });

    const confirmedSeats = enrollments.filter((e) => e.seatStatus === 'Confirmed' || e.status === 'Confirmed').length;
    const releasedSeats = enrollments.filter((e) => e.seatStatus === 'Released' || e.status === 'Cancelled').length;

    res.json({
      success: true,
      metrics: {
        collectedRevenue,
        outstandingBalance,
        confirmedSeats,
        releasedSeats,
        totalInvoices: invoices.length,
      },
      invoices: enrichedInvoices,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  myPayments,
  getMyInvoices,
  simulatePayment,
  checkDeadlines,
  overrideLateSeat,
  sponsorWaiver,
  adminPaymentsOverview,
  getInvoiceDetails,
  calculatePrice,
  prepareInvoice,
  initiatePayment,
  verifyPayment,
  payInvoice,
  adminList,
  adminGet,
  handleGatewayWebhook,
  handleStripeWebhook: handleGatewayWebhook, // Backward-compatible alias
  getPaymentSessionStatus,
  getRefundAccount,
  saveRefundAccount,
  requestRefund,
  myRefunds,
  adminListRefunds,
  adminGetRefund,
  adminReviewRefund,
  adminProcessRefund,
};


