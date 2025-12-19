const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const submissionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  problemId: {
    type: Schema.Types.ObjectId,
    ref: 'problem',
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    required: true,
    enum: [
      'javascript', 'js', 'java', 'c++', 'cpp', 'python', 'py', 'rust', 'rs', 
      'go', 'golang', 'c#', 'csharp', 'php', 'ruby', 'rb', 'swift', 'sw', 
      'kotlin', 'kt', 'typescript', 'ts', 'scala', 'r', 'dart', 'elixir', 
      'erlang', 'haskell', 'lua', 'perl', 'bash', 'c'
    ],
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'wrong', 'error'],
    default: 'pending'
  },
  runtime: {
    type: Number,  // milliseconds
    default: 0
  },
  memory: {
    type: Number,  // kB
    default: 0
  },
  errorMessage: {
    type: String,
    default: ''
  },
  testCasesPassed: {
    type: Number,
    default: 0
  },
  testCasesTotal: {  
    type: Number,
    default: 0
  },
  isMultiplayer: {
    type: Boolean,
    default: false
  },
  matchId: {
    type: String,
    default: null
  }
}, { 
  timestamps: true
});


submissionSchema.index({userId:1 , problemId:1});


const Submission = mongoose.model('submission',submissionSchema);

module.exports = Submission;