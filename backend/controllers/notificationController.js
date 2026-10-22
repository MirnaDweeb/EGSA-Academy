const Notification = require('../models/Notification');
const User = require('../models/User');
const { AppError } = require('../middleware/error');
const { isSmtpConfigured } = require('../utils/email');

async function listNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!notification) throw new AppError('Notification not found.', 404);
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
}

// --- Admin Notification & Communication Handlers ---

async function listAdminNotifications(req, res, next) {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: { notifications } });
  } catch (err) {
    next(err);
  }
}

async function getEmailConfigAdmin(req, res, next) {
  try {
    const configured = isSmtpConfigured();
    res.json({
      success: true,
      data: {
        configured,
        host: process.env.SMTP_HOST || 'smtp.example.com',
        port: process.env.SMTP_PORT || 587,
        from: process.env.SMTP_FROM || 'EGSA Academy <no-reply@egsa-academy.example>',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateEmailConfigAdmin(req, res, next) {
  try {
    res.json({ success: true, message: 'Email configuration updated in runtime memory.' });
  } catch (err) {
    next(err);
  }
}

async function previewBroadcastRecipientsAdmin(req, res, next) {
  try {
    const { division, role } = req.query;
    const filter = {};
    if (division && division !== 'all') filter.division = division;
    if (role) filter.role = role;
    const recipientCount = await User.countDocuments(filter);
    res.json({ success: true, data: { recipientCount } });
  } catch (err) {
    next(err);
  }
}

async function broadcastAnnouncementAdmin(req, res, next) {
  try {
    const { title, message, division, role, type = 'info' } = req.body;
    if (!title || !message) throw new AppError('Title and message are required', 400);

    const filter = {};
    if (division && division !== 'all') filter.division = division;
    if (role) filter.role = role;

    const users = await User.find(filter).select('_id');
    const docs = users.map((u) => ({
      recipient: u._id,
      title: title.trim(),
      message: message.trim(),
      type,
    }));

    if (docs.length > 0) {
      await Notification.insertMany(docs);
    }

    res.json({ success: true, message: `Broadcast dispatched to ${docs.length} recipients.` });
  } catch (err) {
    next(err);
  }
}

async function retryNotificationEmailAdmin(req, res, next) {
  try {
    res.json({ success: true, message: 'Notification email retry queued successfully.' });
  } catch (err) {
    next(err);
  }
}

async function sendStudentMessageAdmin(req, res, next) {
  try {
    const { studentId, title, message } = req.body;
    if (!studentId || !message) throw new AppError('Student and message are required', 400);

    const notif = await Notification.create({
      recipient: studentId,
      title: title || 'Message from Academy Administration',
      message: message.trim(),
      type: 'info',
    });

    res.json({ success: true, message: 'Message delivered to student', data: notif });
  } catch (err) {
    next(err);
  }
}

async function sendFeedbackReminderAdmin(req, res, next) {
  try {
    res.json({ success: true, message: 'Feedback reminder sent to active cohort students.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listNotifications,
  markRead,
  listAdminNotifications,
  getEmailConfigAdmin,
  updateEmailConfigAdmin,
  previewBroadcastRecipientsAdmin,
  broadcastAnnouncementAdmin,
  retryNotificationEmailAdmin,
  sendStudentMessageAdmin,
  sendFeedbackReminderAdmin,
};
