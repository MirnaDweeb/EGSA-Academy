const mongoose = require('mongoose');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const Invoice = require('../models/Invoice');
const Certificate = require('../models/Certificate');
const Evaluation = require('../models/Evaluation');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const { recordAudit } = require('../services/auditService');
const { AppError } = require('../middleware/error');

/**
 * Middleware: Strictly enforce SUPER_ADMIN role authorization
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const role = String(req.user.role || '').toUpperCase();
  if (role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted: Executive Super-Administrator privileges required.',
    });
  }
  next();
}

/**
 * GET /api/admin/super/strategic-overview
 * Multi-division cross-comparative metrics and institutional operational funnel
 */
async function getStrategicOverview(req, res, next) {
  try {
    const divisions = ['UNIVERSITY', 'PRE_UNIVERSITY'];
    const divisionMetrics = {};

    let totalGlobalRevenue = 0;
    let totalGlobalReceivables = 0;
    let totalGlobalWaived = 0;
    let totalGlobalRefunded = 0;
    let totalGlobalCapacity = 0;
    let totalGlobalConfirmedSeats = 0;
    let totalGlobalApplications = 0;
    let totalGlobalEnrollments = 0;
    let totalGlobalCertificates = 0;

    const globalFunnel = {
      applied: 0,
      eligible: 0,
      assessed: 0,
      provisional: 0,
      enrolled: 0,
      certified: 0,
    };

    for (const dKey of divisions) {
      // 1. Resolve Courses
      const courses = await Course.find({ division: dKey }).select('_id title price currency');
      const courseIds = courses.map((c) => c._id);

      // 2. Cohorts & Seat Capacity
      const cohorts = await Cohort.find({ course: { $in: courseIds } });
      let capacity = 0;
      let seatsTaken = 0;
      for (const c of cohorts) {
        capacity += Number(c.capacity) || 0;
        seatsTaken += Number(c.seatsTaken) || 0;
      }

      // 3. Applications & Funnel
      const applications = await Application.find({ course: { $in: courseIds } });
      const totalApps = applications.length;

      let eligibleCount = 0;
      let assessedCount = 0;
      let provisionalCount = 0;
      let confirmedAppsCount = 0;

      for (const app of applications) {
        const s = app.status;
        if (!['Draft', 'Rejected', 'Cancelled'].includes(s)) {
          eligibleCount++;
        }
        if (
          [
            'Eligible',
            'Foundation Required',
            'Manual Review',
            'Accepted',
            'Provisional_Seat_Hold',
            'Waitlisted',
            'Confirmed',
            'Enrolled',
          ].includes(s)
        ) {
          assessedCount++;
        }
        if (['Provisional_Seat_Hold', 'Accepted'].includes(s)) {
          provisionalCount++;
        }
        if (['Confirmed', 'Enrolled'].includes(s)) {
          confirmedAppsCount++;
        }
      }

      // 4. Enrollments
      const enrollments = await Enrollment.find({
        course: { $in: courseIds },
        status: { $in: ['Confirmed', 'Active', 'Completed'] },
      });
      const totalEnrollments = Math.max(enrollments.length, confirmedAppsCount);

      // 5. Certificates Issued
      const certCount = await Certificate.countDocuments({
        course: { $in: courseIds },
        status: { $in: ['ISSUED', 'Issued', 'Valid'] },
      });

      // 6. Invoices & Financials
      const invoices = await Invoice.find({ course: { $in: courseIds } });
      let collectedRevenue = 0;
      let pendingReceivables = 0;
      let waivedAmount = 0;
      let refundedAmount = 0;

      for (const inv of invoices) {
        const amt = Number(inv.amount) || 0;
        const bal = inv.balanceDue != null ? Number(inv.balanceDue) : amt;
        const waived = Number(inv.waivedAmount) || (inv.sponsorWaiver?.waivedAmount || 0);

        if (['Paid', 'PAID'].includes(inv.status)) {
          collectedRevenue += amt;
        } else if (inv.status === 'Waived') {
          waivedAmount += waived > 0 ? waived : amt;
        } else if (inv.status === 'Refunded' || inv.refundStatus === 'Refunded') {
          refundedAmount += Number(inv.refundAmount) || amt;
        } else if (['Pending', 'Invoice Issued', 'Payment Initiated', 'Partially_Waived'].includes(inv.status)) {
          pendingReceivables += bal;
          if (waived > 0) waivedAmount += waived;
        }
      }

      // 7. Course & Instructor Evaluation Average (out of 5.0)
      const evals = await Evaluation.find({ course: { $in: courseIds } });
      let avgScore = 4.8; // Baseline default if no student evaluations submitted yet
      if (evals.length > 0) {
        const sum = evals.reduce((acc, curr) => acc + (Number(curr.overallRating) || 4.8), 0);
        avgScore = Math.round((sum / evals.length) * 10) / 10;
      }

      const confirmedSeats = Math.max(seatsTaken, totalEnrollments);
      const seatUtilizationRate = capacity > 0 ? Math.round((confirmedSeats / capacity) * 100) : 0;

      divisionMetrics[dKey] = {
        division: dKey,
        displayName: dKey === 'UNIVERSITY' ? 'University Academic Programs' : 'Pre-University STEM Programs',
        totalCourses: courses.length,
        totalCohorts: cohorts.length,
        totalCapacity: capacity,
        confirmedSeats,
        seatUtilizationRate,
        totalApplications: totalApps,
        totalEnrollments,
        totalCertificatesIssued: certCount,
        financials: {
          collectedRevenue,
          pendingReceivables,
          waivedAmount,
          refundedAmount,
          currency: 'EGP',
        },
        evaluationAverage: avgScore,
        funnel: {
          applied: totalApps,
          eligible: eligibleCount,
          assessed: assessedCount,
          provisional: provisionalCount,
          enrolled: totalEnrollments,
          certified: certCount,
        },
      };

      // Accumulate Globals
      totalGlobalRevenue += collectedRevenue;
      totalGlobalReceivables += pendingReceivables;
      totalGlobalWaived += waivedAmount;
      totalGlobalRefunded += refundedAmount;
      totalGlobalCapacity += capacity;
      totalGlobalConfirmedSeats += confirmedSeats;
      totalGlobalApplications += totalApps;
      totalGlobalEnrollments += totalEnrollments;
      totalGlobalCertificates += certCount;

      globalFunnel.applied += totalApps;
      globalFunnel.eligible += eligibleCount;
      globalFunnel.assessed += assessedCount;
      globalFunnel.provisional += provisionalCount;
      globalFunnel.enrolled += totalEnrollments;
      globalFunnel.certified += certCount;
    }

    const overallUtilizationRate =
      totalGlobalCapacity > 0 ? Math.round((totalGlobalConfirmedSeats / totalGlobalCapacity) * 100) : 0;

    const conversionRate =
      globalFunnel.applied > 0 ? Math.round((globalFunnel.enrolled / globalFunnel.applied) * 100) : 0;

    res.json({
      success: true,
      timestamp: new Date(),
      data: {
        divisions: divisionMetrics,
        funnel: {
          ...globalFunnel,
          conversionRate,
        },
        totals: {
          totalRevenue: totalGlobalRevenue,
          pendingReceivables: totalGlobalReceivables,
          waivedAmount: totalGlobalWaived,
          refundedAmount: totalGlobalRefunded,
          totalCapacity: totalGlobalCapacity,
          confirmedSeats: totalGlobalConfirmedSeats,
          overallUtilizationRate,
          totalApplications: totalGlobalApplications,
          totalEnrollments: totalGlobalEnrollments,
          totalCertificatesIssued: totalGlobalCertificates,
          currency: 'EGP',
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/super/audit-logs
 * Academy-wide immutable audit trail with multi-tier role and division filters
 */
async function getAcademyAuditLogs(req, res, next) {
  try {
    const { role, action, division, search, limit = 100, page = 1 } = req.query;
    const filter = {};

    if (action) {
      filter.action = action;
    }

    if (division && division !== 'ALL') {
      filter.division = division.toUpperCase();
    }

    if (role) {
      // Find matching users with requested role
      const matchingUsers = await User.find({
        role: new RegExp(`^${role}$`, 'i'),
      }).select('_id');
      const userIds = matchingUsers.map((u) => u._id);
      filter.$or = [{ actor: { $in: userIds } }, { user: { $in: userIds } }];
    }

    if (search) {
      const s = search.trim();
      const matchingActors = await User.find({
        $or: [
          { email: new RegExp(s, 'i') },
          { fullName: new RegExp(s, 'i') },
        ],
      }).select('_id');
      const actorIds = matchingActors.map((u) => u._id);

      const searchConditions = [
        { action: new RegExp(s, 'i') },
        { resource: new RegExp(s, 'i') },
        { entity: new RegExp(s, 'i') },
        { 'details.reason': new RegExp(s, 'i') },
        { 'details.sponsorName': new RegExp(s, 'i') },
        { 'details.studentName': new RegExp(s, 'i') },
      ];

      if (actorIds.length > 0) {
        searchConditions.push({ actor: { $in: actorIds } });
        searchConditions.push({ user: { $in: actorIds } });
      }

      if (mongoose.Types.ObjectId.isValid(s)) {
        searchConditions.push({ entityId: s }, { resourceId: s });
      }

      filter.$or = filter.$or ? [{ $and: [{ $or: filter.$or }, { $or: searchConditions }] }] : searchConditions;
    }

    const pageSize = Math.min(200, Math.max(1, Number(limit) || 100));
    const skip = (Math.max(1, Number(page) || 1) - 1) * pageSize;

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .populate('actor', 'fullName email role division')
        .populate('user', 'fullName email role division')
        .sort({ timestamp: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: Number(page) || 1,
      totalPages: Math.ceil(total / pageSize),
      data: logs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/super/config
 * View institutional system configuration constants
 */
async function getSystemConfig(req, res, next) {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    res.json({
      success: true,
      data: config,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/super/config
 * Tune institutional constants and log governance audit event
 */
async function updateSystemConfig(req, res, next) {
  try {
    const {
      seatReservationHours,
      minimumAttendanceGate,
      passingAssessmentThreshold,
      academicYear,
      institutionName,
    } = req.body;

    const config = await SystemConfig.getEffectiveConfig();
    const before = config.toObject();

    if (seatReservationHours != null) {
      const hours = Number(seatReservationHours);
      if (isNaN(hours) || hours < 1 || hours > 720) {
        throw new AppError('Seat reservation hours must be between 1 and 720 hours.', 400);
      }
      config.seatReservationHours = hours;
    }

    if (minimumAttendanceGate != null) {
      const att = Number(minimumAttendanceGate);
      if (isNaN(att) || att < 50 || att > 100) {
        throw new AppError('Minimum attendance gate must be between 50% and 100%.', 400);
      }
      config.minimumAttendanceGate = att;
    }

    if (passingAssessmentThreshold != null) {
      const pass = Number(passingAssessmentThreshold);
      if (isNaN(pass) || pass < 50 || pass > 100) {
        throw new AppError('Passing assessment threshold must be between 50% and 100%.', 400);
      }
      config.passingAssessmentThreshold = pass;
    }

    if (academicYear) config.academicYear = String(academicYear).trim();
    if (institutionName) config.institutionName = String(institutionName).trim();

    config.updatedBy = req.user._id;
    config.updatedAt = new Date();
    await config.save();

    const after = config.toObject();

    // Log immutable governance event
    await recordAudit({
      actor: req.user._id,
      user: req.user._id,
      action: 'SYSTEM_CONFIG_UPDATED',
      entity: 'SystemConfig',
      resource: 'SystemConfig',
      entityId: config._id,
      resourceId: config._id,
      division: 'all',
      before: {
        seatReservationHours: before.seatReservationHours,
        minimumAttendanceGate: before.minimumAttendanceGate,
        passingAssessmentThreshold: before.passingAssessmentThreshold,
      },
      after: {
        seatReservationHours: after.seatReservationHours,
        minimumAttendanceGate: after.minimumAttendanceGate,
        passingAssessmentThreshold: after.passingAssessmentThreshold,
      },
      details: {
        updatedBy: req.user.fullName || req.user.email,
        changes: {
          seatReservationHours: { from: before.seatReservationHours, to: after.seatReservationHours },
          minimumAttendanceGate: { from: before.minimumAttendanceGate, to: after.minimumAttendanceGate },
          passingAssessmentThreshold: { from: before.passingAssessmentThreshold, to: after.passingAssessmentThreshold },
        },
      },
      reason: 'Super Admin institutional constants update',
    });

    res.json({
      success: true,
      message: 'Institutional system constants successfully updated and audit-logged.',
      data: config,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireSuperAdmin,
  getStrategicOverview,
  getAcademyAuditLogs,
  getSystemConfig,
  updateSystemConfig,
};
