const mongoose = require('mongoose');

const ReadinessQuestionSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: false, default: null },
    isDefault: { type: Boolean, default: false },
    questionText: { type: String },
    question: { type: String }, // compatibility alias
    options: [{ type: String, required: true }],
    correctOptionIndex: { type: Number },
    correctAnswerIndex: { type: Number }, // compatibility alias
    topic: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    weight: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ReadinessQuestionSchema.pre('validate', function (next) {
  if (!this.questionText && this.question) {
    this.questionText = this.question;
  }
  if (!this.question && this.questionText) {
    this.question = this.questionText;
  }
  if (this.correctOptionIndex === undefined && this.correctAnswerIndex !== undefined) {
    this.correctOptionIndex = this.correctAnswerIndex;
  }
  if (this.correctAnswerIndex === undefined && this.correctOptionIndex !== undefined) {
    this.correctAnswerIndex = this.correctOptionIndex;
  }
  next();
});

module.exports = mongoose.model('ReadinessQuestion', ReadinessQuestionSchema);

