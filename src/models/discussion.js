const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const discussionSchema = new Schema({
  problemId: {
    type: Schema.Types.ObjectId,
    ref: 'Problem',
    required: false // Made optional for general community discussions
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'user'
  }],
  replies: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
discussionSchema.index({ problemId: 1, createdAt: -1 });
discussionSchema.index({ userId: 1 });

module.exports = mongoose.model('Discussion', discussionSchema);