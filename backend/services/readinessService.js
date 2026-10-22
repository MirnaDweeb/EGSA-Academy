const Course = require('../models/Course');

/**
 * Computes score, per-topic breakdown, knowledge gaps, outcome,
 * foundation course recommendations, and diagnostic rationale.
 */
async function scoreAttempt(attempt, course) {
  const total = attempt.answers.length || 1;
  const correct = attempt.answers.filter((a) => a.isCorrect).length;
  const score = Math.round((correct / total) * 100);

  // Topic breakdown
  const topicStats = {};
  attempt.answers.forEach((a) => {
    const q = attempt.questions.find((q2) => q2._id.toString() === a.question.toString());
    if (!q) return;
    const topic = q.topic || 'General Aerospace Fundamentals';
    if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
    topicStats[topic].total += 1;
    if (a.isCorrect) topicStats[topic].correct += 1;
  });

  const topicBreakdown = Object.entries(topicStats).map(([topic, stat]) => {
    const topicPct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
    return {
      topic,
      totalQuestions: stat.total,
      correctQuestions: stat.correct,
      score: topicPct,
      passed: topicPct >= 70,
    };
  });

  const knowledgeGaps = topicBreakdown
    .filter((t) => !t.passed)
    .map((t) => t.topic);

  const threshold = course.readinessThreshold || course.minReadinessScore || 70;

  let outcome = 'Ready';
  if (score >= threshold) {
    outcome = 'Ready';
  } else {
    outcome = 'Foundation Required';
  }

  // Map deficient topics to Foundation courses (e.g. EPS / Telemetry / Orbital Mechanics -> Satellite Systems Fundamentals)
  let recommendedCourses = [];
  let recommendedCourse = null;

  if (outcome === 'Foundation Required' || knowledgeGaps.length > 0) {
    // 1. Try course.recommendedPreviousCourses first
    if (Array.isArray(course?.recommendedPreviousCourses) && course.recommendedPreviousCourses.length > 0) {
      const candidates = await Course.find({
        _id: { $in: course.recommendedPreviousCourses },
      });
      if (candidates && candidates.length > 0) {
        recommendedCourses = candidates;
        recommendedCourse = candidates[0];
      }
    }

    // 2. If no candidate found yet, search for matching foundation course in DB
    if (!recommendedCourse) {
      const foundationCandidate = await Course.findOne({
        $or: [
          { slug: 'satellite-systems-fundamentals' },
          { title: /satellite systems fundamentals/i },
          { title: /space systems fundamentals/i },
          { title: /fundamentals/i },
          { level: 'Foundation' },
          { level: 'Introductory' },
        ],
        _id: { $ne: course._id },
      });

      if (foundationCandidate) {
        recommendedCourses = [foundationCandidate];
        recommendedCourse = foundationCandidate;
      }
    }
  }

  let rationale = '';
  if (outcome === 'Ready') {
    rationale = `Demonstrated satisfactory technical readiness (score: ${score}%, threshold: ${threshold}%) across evaluated space engineering topics.`;
  } else {
    const gapList = knowledgeGaps.length > 0 ? knowledgeGaps.join(', ') : 'overall technical score';
    rationale = `Identified technical competency gaps in: ${gapList}. Foundational preparatory coursework recommended prior to cohort advancement.`;
  }

  return {
    score,
    scorePercentage: score,
    topicBreakdown,
    knowledgeGaps,
    outcome,
    recommendedCourse,
    recommendedCourses,
    rationale,
    topicStats,
  };
}

module.exports = { scoreAttempt };

