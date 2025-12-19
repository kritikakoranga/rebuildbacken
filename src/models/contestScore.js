const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const contestScoreSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('ContestScore', contestScoreSchema); 