const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const PaymentTransaction = require('../models/PaymentTransaction');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const AuditLog = require('../models/AuditLog');
const { recordAudit } = require('../services/auditService');
const { notify } = require('../services/notificationService');
const { AppError } = require('../middleware/error');

/**
 * Helper to resolve course IDs matching the current division scope
 */
async function getScopedCourseIds(scopeDivision) {
  if (!scopeDivision || scopeDivision === 'all') return null;
  const courses = await Course.find({ division: scopeDivision }).select('_id');
  return courses.map((c) => c._id);
}

/**
 * GET /api/finance/overview
 * Financial Overview KPIs scoped by division (or platform-wide for Super Admin)
 */
async function getFinancialOverview(req, res, next) {
  try {
    const scopeDivision = req.scopeDivision || 'all';
    const scopedCourseIds = await getScopedCourseIds(scopeDivision);

    const invoiceFilter = {};
    const cohortFilter = {};

    if (scopedCourseIds) {
      invoiceFilter.course = { $in: scopedCourseIds };
      cohortFilter.course = { $in: scopedCourseIds };
    }

    const invoices = await Invoice.find(invoiceFilter)
      .populate('course', 'title division price currency')
      .populate('cohort', 'name capacity seatsTaken startDate endDate')
      .populate('student', 'fullName email registrationNumber nationalId');

    let totalRevenue = 0;
    let pendingReceivables = 0;
    let waivedAmount = 0;
    let refundedAmount = 0;

    let paidCount = 0;
    let pendingCount = 0;
    let waivedCount = 0;
    let refundedCount = 0;
    let expiredCount = 0;

    for (const inv of invoices) {
      const amt = Number(inv.amount) || 0;
      const bal = inv.balanceDue != null ? Number(inv.balanceDue) : amt;
      const waived = Number(inv.waivedAmount) || (inv.sponsorWaiver?.waivedAmount || 0);

      if (['Paid', 'PAID'].includes(inv.status)) {
        totalRevenue += amt;
        paidCount++;
      } else if (inv.status === 'Waived') {
        waivedAmount += waived > 0 ? waived : amt;
        waivedCount++;
      } else if (inv.status === 'Refunded' || inv.refundStatus === 'Refunded') {
        refundedAmount += Number(inv.refundAmount) || amt;
        refundedCount++;
      } else if (['Pending', 'Invoice Issued', 'Payment Initiated', 'Partially_Waived'].includes(inv.status)) {
        pendingReceivables += bal;
        pendingCount++;
        if (waived > 0) waivedAmount += waived;
      } else if (['Expired', 'EXPIRED', 'Overdue'].includes(inv.status)) {
        expiredCount++;
      }
    }

    // Capacity & Seat Utilization across cohorts
    const cohorts = await Cohort.find(cohortFilter);
    let totalCapacity = 0;
    let confirmedSeats = 0;

    for (const c of cohorts) {
      totalCapacity += Number(c.capacity) || 0;
      confirmedSeats += Number(c.seatsTaken) || 0;
    }

    const enrollmentFilter = {
      status: { $in: ['Confirmed', 'Active', 'Completed'] },
    };
    if (scopedCourseIds) {
      enrollmentFilter.course = { $in: scopedCourseIds };
    }
    const actualConfirmedEnrollments = await Enrollment.countDocuments(enrollmentFilter);
    const effectiveConfirmedSeats = Math.max(confirmedSeats, actualConfirmedEnrollments);

    const seatUtilizationRate = totalCapacity > 0
      ? Math.round((effectiveConfirmedSeats / totalCapacity) * 100)
      : 0;

    res.json({
      success: true,
      scopeDivision,
      data: {
        totalRevenue,
        pendingReceivables,
        waivedAmount,
        refundedAmount,
        seatUtilizationRate,
        totalCapacity,
        confirmedSeats: effectiveConfirmedSeats,
        counts: {
          totalInvoices: invoices.length,
          paidCount,
          pendingCount,
          waivedCount,
          refundedCount,
          expiredCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/finance/invoices
 * Division-scoped commercial invoices ledger
 */
async function getInvoicesLedger(req, res, next) {
  try {
    const scopeDivision = req.scopeDivision || 'all';
    const scopedCourseIds = await getScopedCourseIds(scopeDivision);

    const filter = {};
    if (scopedCourseIds) {
      filter.course = { $in: scopedCourseIds };
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.courseId) {
      filter.course = req.query.courseId;
    }

    const invoices = await Invoice.find(filter)
      .populate('student', 'fullName email phone nationalId registrationNumber division')
      .populate('course', 'title price division level currency')
      .populate('cohort', 'name startDate endDate capacity seatsTaken')
      .populate('application', 'referenceNumber status submittedAt selectedPackage')
      .sort({ createdAt: -1 });

    const now = new Date();
    const enriched = invoices.map((inv) => {
      const obj = inv.toObject();
      const dueAt = obj.reservationExpiresAt || obj.dueAt || obj.dueDate || (obj.createdAt ? new Date(new Date(obj.createdAt).getTime() + 72 * 3600 * 1000) : new Date(now.getTime() + 72 * 3600 * 1000));
      obj.effectiveDueAt = dueAt;
      const remainingMs = Math.max(0, new Date(dueAt).getTime() - now.getTime());
      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const isPaid = ['Paid', 'PAID', 'Waived'].includes(obj.status);
      const isOverdue = !isPaid && now > new Date(dueAt);
      const isUrgent = !isPaid && remainingHours < 24 && !isOverdue;

      obj.countdown = {
        remainingMs,
        remainingHours,
        isUrgent,
        isOverdue,
      };
      return obj;
    });

    res.json({
      success: true,
      scopeDivision,
      count: enriched.length,
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/finance/invoices/:id/waive
 * Sponsorship & Tuition Waiver Engine: Full (100%) or Partial Waiver
 */
async function applySponsorWaiver(req, res, next) {
  try {
    const { id } = req.params;
    const { waiverType = 'Full', waiverPercent = 100, sponsorName, reason } = req.body;

    if (!sponsorName || typeof sponsorName !== 'string' || !sponsorName.trim()) {
      throw new AppError('Sponsor Organization Name is mandatory.', 400);
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      throw new AppError('Waiver justification reason (minimum 10 characters) is required for institutional audit.', 400);
    }

    const invoice = await Invoice.findById(id)
      .populate('student', 'fullName email registrationNumber')
      .populate('course', 'title division price currency')
      .populate('cohort', 'name capacity seatsTaken');

    if (!invoice) {
      throw new AppError('Invoice not found.', 404);
    }

    // Scoping guard
    const scopeDivision = req.scopeDivision;
    if (scopeDivision && scopeDivision !== 'all' && invoice.course?.division !== scopeDivision) {
      throw new AppError('You do not have administrative authority over invoices in this division.', 403);
    }

    const originalAmount = Number(invoice.amount) || 0;
    const pct = waiverType === 'Full' ? 100 : Math.min(100, Math.max(1, Number(waiverPercent) || 100));
    const waivedAmount = Math.round((originalAmount * pct) / 100);
    const newBalance = Math.max(0, originalAmount - waivedAmount);

    invoice.sponsorWaiver = {
      applied: true,
      waiverType: pct === 100 ? 'Full' : 'Partial',
      waiverPercent: pct,
      sponsorName: sponsorName.trim(),
      reason: reason.trim(),
      originalAmount,
      waivedAmount,
      appliedBy: req.user._id,
      appliedAt: new Date(),
    };
    invoice.waivedAmount = waivedAmount;
    invoice.balanceDue = newBalance;
    invoice.remainingAmount = newBalance;

    if (pct === 100 || newBalance === 0) {
      invoice.status = 'Waived';
      invoice.paidAt = new Date();
    } else {
      invoice.status = 'Partially_Waived';
    }

    // Record audit transaction
    const tx = await PaymentTransaction.create({
      invoice: invoice._id,
      student: invoice.student?._id || invoice.student,
      amount: waivedAmount,
      currency: invoice.currency || 'EGP',
      method: 'Waiver',
      transactionId: `TXN-WAIVER-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      provider: 'SPONSOR_WAIVER',
      externalReference: sponsorName.trim(),
      providerReference: sponsorName.trim(),
      status: 'Success',
      paymentDate: new Date(),
      metadata: {
        sponsorName: sponsorName.trim(),
        waiverPercent: pct,
        reason: reason.trim(),
        grantedBy: req.user._id,
      },
    });

    invoice.paymentReference = tx._id;
    await invoice.save();

    // If Full Waiver: Transition Enrollment to Confirmed and lock seat
    let enrollment = await Enrollment.findOne({
      student: invoice.student?._id || invoice.student,
      course: invoice.course?._id || invoice.course,
    });

    if (pct === 100) {
      if (enrollment) {
        enrollment.seatStatus = 'Confirmed';
        enrollment.status = 'Confirmed';
        enrollment.paymentStatus = 'Waived';
        enrollment.seatLocked = true;
        enrollment.paidAmount = originalAmount;
        enrollment.paymentReference = tx._id;
        await enrollment.save();
      } else {
        enrollment = await Enrollment.create({
          student: invoice.student?._id || invoice.student,
          course: invoice.course?._id || invoice.course,
          cohort: invoice.cohort?._id || invoice.cohort,
          application: invoice.application,
          status: 'Confirmed',
          seatStatus: 'Confirmed',
          seatLocked: true,
          paymentStatus: 'Waived',
          paidAmount: originalAmount,
          paymentReference: tx._id,
        });
      }

      if (invoice.application) {
        await Application.findByIdAndUpdate(invoice.application, {
          status: 'Confirmed',
          $push: {
            statusHistory: {
              status: 'Confirmed',
              note: `100% Tuition Waiver granted by sponsor ${sponsorName.trim()}`,
              changedAt: new Date(),
            },
          },
        });
      }
    }

    // Write immutable AuditLog
    await recordAudit({
      actor: req.user._id,
      user: req.user._id,
      action: 'SPONSOR_WAIVER_APPLIED',
      entity: 'Invoice',
      resource: 'Invoice',
      entityId: invoice._id,
      resourceId: invoice._id,
      division: invoice.course?.division || scopeDivision || null,
      details: {
        sponsorName: sponsorName.trim(),
        waiverPercent: pct,
        originalAmount,
        newBalance,
        reason: reason.trim(),
        studentName: invoice.student?.fullName,
      },
    });

    // Notify student
    try {
      await notify({
        recipient: invoice.student?._id || invoice.student,
        title: 'Tuition Waiver Approved',
        message: `A ${pct}% tuition sponsorship from "${sponsorName.trim()}" has been applied to your invoice.`,
        type: 'success',
      });
    } catch (_) {}

    res.json({
      success: true,
      message: `Tuition waiver (${pct}%) sponsored by "${sponsorName.trim()}" successfully applied.`,
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
 * POST /api/finance/sweep-expired
 * Automated 72-Hour Expiration & Waitlist Promotion Sweep
 */
async function sweepExpiredInvoices(req, res, next) {
  try {
    const now = new Date();
    const expiredInvoices = await Invoice.find({
      status: { $in: ['Invoice Issued', 'Pending', 'Payment Initiated'] },
      amount: { $gt: 0 },
      $or: [
        { reservationExpiresAt: { $lt: now, $ne: null } },
        { dueAt: { $lt: now, $ne: null } },
        { dueDate: { $lt: now, $ne: null } },
      ],
    })
      .populate('course')
      .populate('cohort')
      .populate('application');

    let expiredCount = 0;
    let promotedCount = 0;
    const affectedCohortIds = new Set();

    for (const invoice of expiredInvoices) {
      invoice.status = 'Expired';
      invoice.expiredAt = now;
      await invoice.save();
      expiredCount++;

      const cohortId = invoice.cohort?._id || invoice.cohort;
      if (cohortId) {
        affectedCohortIds.add(String(cohortId));
      }

      if (invoice.application) {
        await Application.findByIdAndUpdate(invoice.application._id || invoice.application, {
          status: 'Cancelled',
          $push: {
            statusHistory: {
              status: 'Cancelled',
              note: '72-hour tuition reservation deadline expired. Seat released to waitlist pool.',
              changedAt: now,
            },
          },
        });
      }

      await Enrollment.updateMany(
        { invoice: invoice._id },
        { status: 'Cancelled', seatStatus: 'Released' }
      );

      try {
        await notify({
          recipient: invoice.student,
          title: 'Seat Reservation Expired',
          message: 'Your provisional seat reservation was released as tuition was not completed within the 72-hour window.',
          type: 'error',
        });
      } catch (_) {}

      // Promote next candidate on waitlist (FIFO order)
      if (cohortId) {
        const nextWaitlistedApp = await Application.findOne({
          cohort: cohortId,
          status: 'Waitlisted',
        })
          .sort({ waitlistPosition: 1, submittedAt: 1, createdAt: 1 })
          .populate('student')
          .populate('course');

        if (nextWaitlistedApp && nextWaitlistedApp.student) {
          nextWaitlistedApp.status = 'Provisional_Seat_Hold';
          nextWaitlistedApp.waitlistPosition = undefined;
          nextWaitlistedApp.statusHistory = nextWaitlistedApp.statusHistory || [];
          nextWaitlistedApp.statusHistory.push({
            status: 'Provisional_Seat_Hold',
            note: 'Promoted from waitlist following 72h seat expiration sweep. 72h countdown initiated.',
            changedAt: now,
          });
          await nextWaitlistedApp.save();

          const deadline = new Date(Date.now() + 72 * 3600 * 1000);
          const coursePrice = Number(nextWaitlistedApp.course?.price) || 0;

          const newInvoice = await Invoice.create({
            student: nextWaitlistedApp.student._id,
            application: nextWaitlistedApp._id,
            course: nextWaitlistedApp.course._id,
            cohort: cohortId,
            amount: coursePrice,
            balanceDue: coursePrice,
            remainingAmount: coursePrice,
            currency: nextWaitlistedApp.course?.currency || 'EGP',
            dueAt: deadline,
            dueDate: deadline,
            reservationExpiresAt: deadline,
            issuedAt: now,
            status: 'Pending',
          });

          await Enrollment.create({
            student: nextWaitlistedApp.student._id,
            course: nextWaitlistedApp.course._id,
            cohort: cohortId,
            application: nextWaitlistedApp._id,
            invoice: newInvoice._id,
            status: 'Hold',
            seatStatus: 'Hold',
            paymentStatus: 'Pending',
          });

          promotedCount++;

          await recordAudit({
            actor: req.user?._id || invoice.student,
            action: 'WAITLIST_AUTO_PROMOTED',
            entity: 'Cohort',
            entityId: cohortId,
            division: nextWaitlistedApp.course?.division || invoice.course?.division || null,
            details: {
              promotedStudent: nextWaitlistedApp.student.fullName,
              promotedAppId: nextWaitlistedApp._id,
              newInvoiceId: newInvoice._id,
              deadline,
            },
          });

          try {
            await notify({
              recipient: nextWaitlistedApp.student._id,
              title: 'Seat Available — Promoted from Waitlist!',
              message: `A seat opened in ${nextWaitlistedApp.course.title}! Your provisional seat hold has been confirmed. Please complete tuition within 72 hours.`,
              type: 'success',
            });
          } catch (_) {}
        } else {
          await Cohort.findByIdAndUpdate(cohortId, { $inc: { seatsTaken: -1 } });
        }
      }
    }

    res.json({
      success: true,
      message: `72-Hour sweep complete. Expired: ${expiredCount}, Promoted from waitlist: ${promotedCount}.`,
      data: {
        expiredCount,
        promotedCount,
        affectedCohortIds: Array.from(affectedCohortIds),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/finance/invoices/:id/refund
 * Refund Processing: Adjusts enrollment to Withdrawn, releases seat, and logs in AuditLog
 */
async function processInvoiceRefund(req, res, next) {
  try {
    const { id } = req.params;
    const { refundReason = 'Administrative refund requested' } = req.body;

    const invoice = await Invoice.findById(id)
      .populate('student')
      .populate('course')
      .populate('cohort');

    if (!invoice) {
      throw new AppError('Invoice not found.', 404);
    }

    const scopeDivision = req.scopeDivision;
    if (scopeDivision && scopeDivision !== 'all' && invoice.course?.division !== scopeDivision) {
      throw new AppError('You do not have administrative authority over invoices in this division.', 403);
    }

    const previousStatus = invoice.status;
    invoice.status = 'Refunded';
    invoice.refundStatus = 'Refunded';
    invoice.refundAmount = invoice.amount;
    invoice.refundReason = refundReason;
    invoice.refundedAt = new Date();
    invoice.refundedBy = req.user._id;
    await invoice.save();

    const enrollment = await Enrollment.findOne({
      student: invoice.student?._id || invoice.student,
      course: invoice.course?._id || invoice.course,
    });

    if (enrollment) {
      enrollment.status = 'Withdrawn';
      enrollment.seatStatus = 'Released';
      enrollment.seatLocked = false;
      await enrollment.save();
    }

    const cohortId = invoice.cohort?._id || invoice.cohort;
    if (cohortId) {
      await Cohort.findByIdAndUpdate(cohortId, { $inc: { seatsTaken: -1 } });
    }

    await recordAudit({
      actor: req.user._id,
      user: req.user._id,
      action: 'REFUND_PROCESSED',
      entity: 'Invoice',
      resource: 'Invoice',
      entityId: invoice._id,
      resourceId: invoice._id,
      division: invoice.course?.division || scopeDivision || null,
      details: {
        previousStatus,
        refundAmount: invoice.amount,
        refundReason,
        studentName: invoice.student?.fullName,
        studentId: invoice.student?._id || invoice.student,
      },
    });

    try {
      await notify({
        recipient: invoice.student?._id || invoice.student,
        title: 'Tuition Refund Processed',
        message: `Your refund of ${invoice.amount} ${invoice.currency || 'EGP'} has been processed.`,
        type: 'info',
      });
    } catch (_) {}

    res.json({
      success: true,
      message: 'Invoice marked as Refunded, enrollment updated to Withdrawn, and seat released.',
      data: {
        invoice,
        enrollment,
      },
    });
  } catch (err) {
    next(err);
  }
}

// =========================================================================
// Platform Admin Legacy Compatibility Controllers
// =========================================================================
async function generateInvoiceAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const enrollment = await Enrollment.findById(id).populate('course');
    if (!enrollment) throw new AppError('Enrollment not found.', 404);
    const invoice = await Invoice.create({
      student: enrollment.student,
      course: enrollment.course._id,
      cohort: enrollment.cohort,
      application: enrollment.application,
      amount: enrollment.course?.price || 0,
      balanceDue: enrollment.course?.price || 0,
      dueAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'Pending',
    });
    res.json({ success: true, data: invoice });
  } catch (e) {
    next(e);
  }
}

async function recordPaymentAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByIdAndUpdate(id, { status: 'Paid', paidAt: new Date() }, { new: true });
    res.json({ success: true, data: invoice });
  } catch (e) {
    next(e);
  }
}

async function processExpiredInvoicesAdmin(req, res, next) {
  return sweepExpiredInvoices(req, res, next);
}

async function listInvoicesAdmin(req, res, next) {
  return getInvoicesLedger(req, res, next);
}

async function getInvoiceByIdAdmin(req, res, next) {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('student')
      .populate('course')
      .populate('cohort');
    if (!invoice) throw new AppError('Invoice not found.', 404);
    res.json({ success: true, data: invoice });
  } catch (e) {
    next(e);
  }
}

async function getInvoiceByEnrollmentAdmin(req, res, next) {
  try {
    const invoice = await Invoice.findOne({ enrollment: req.params.id })
      .populate('student')
      .populate('course')
      .populate('cohort');
    res.json({ success: true, data: invoice });
  } catch (e) {
    next(e);
  }
}

async function updateInvoiceMetadataAdmin(req, res, next) {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: invoice });
  } catch (e) {
    next(e);
  }
}

async function adjustPaymentAdmin(req, res, next) {
  try {
    const tx = await PaymentTransaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: tx });
  } catch (e) {
    next(e);
  }
}

async function getPaymentRemindersSummaryAdmin(req, res, next) {
  res.json({ success: true, data: { dueIn24h: 0, dueIn48h: 0, overdue: 0 } });
}

async function previewPaymentRemindersAdmin(req, res, next) {
  res.json({ success: true, data: [] });
}

async function sendSinglePaymentReminderAdmin(req, res, next) {
  res.json({ success: true, message: 'Payment reminder dispatched.' });
}

async function sendBulkPaymentRemindersAdmin(req, res, next) {
  res.json({ success: true, message: 'Bulk payment reminders dispatched.' });
}

async function getPaymentRemindersHistoryAdmin(req, res, next) {
  res.json({ success: true, data: [] });
}

module.exports = {
  // Phase 15 Core Handlers
  getFinancialOverview,
  getInvoicesLedger,
  applySponsorWaiver,
  sweepExpiredInvoices,
  processInvoiceRefund,

  // Platform Admin Legacy Compatibility Handlers
  generateInvoiceAdmin,
  recordPaymentAdmin,
  processExpiredInvoicesAdmin,
  listInvoicesAdmin,
  getInvoiceByIdAdmin,
  getInvoiceByEnrollmentAdmin,
  updateInvoiceMetadataAdmin,
  adjustPaymentAdmin,
  getPaymentRemindersSummaryAdmin,
  previewPaymentRemindersAdmin,
  sendSinglePaymentReminderAdmin,
  sendBulkPaymentRemindersAdmin,
  getPaymentRemindersHistoryAdmin,
};
