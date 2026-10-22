const S = {
  session: require('../services/session.service'),
};
const { asyncHandler: h, ok } = require('../utils/helpers');
const me = (req) => req.user?.id || req.user?._id;

exports.listSessions = h(async (req, res) => {
  const r = await S.session.list(me(req), req.query);
  ok(res, r.items, r.meta);
});

exports.getSession = h(async (req, res) => {
  ok(res, await S.session.get(me(req), req.params.id));
});

exports.createSession = h(async (req, res) => {
  ok(res, await S.session.create(me(req), req.body), null, 201);
});

exports.updateSession = h(async (req, res) => {
  ok(res, await S.session.update(me(req), req.params.id, req.body));
});

exports.startSession = h(async (req, res) => {
  ok(res, await S.session.start(me(req), req.params.id));
});

exports.endSession = h(async (req, res) => {
  ok(res, await S.session.end(me(req), req.params.id));
});

exports.regenerateQR = h(async (req, res) => {
  ok(res, await S.session.regenerateQR(me(req), req.params.id));
});
