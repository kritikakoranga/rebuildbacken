const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userStreakSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    unique: true
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastActivityDate: {
    type: Date,
    default: null
  },
  streakHistory: [{
    date: {
      type: Date,
      required: true
    },
    problemsSolved: {
      type: Number,
      default: 0
    },
    hasActivity: {
      type: Boolean,
      default: false
    }
  }],
  totalActiveDays: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

// Index for efficient queries
userStreakSchema.index({ userId: 1 });
userStreakSchema.index({ 'streakHistory.date': 1 });

// Method to update streak when user solves a problem
userStreakSchema.methods.updateStreak = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Check if user already has activity today
  const todayEntry = this.streakHistory.find(entry => {
    const entryDate = new Date(entry.date);
    entryDate.setHours(0, 0, 0, 0);
    return entryDate.getTime() === today.getTime();
  });
  
  if (todayEntry) {
    // Update today's entry
    todayEntry.problemsSolved += 1;
    todayEntry.hasActivity = true;
  } else {
    // Add new entry for today
    this.streakHistory.push({
      date: today,
      problemsSolved: 1,
      hasActivity: true
    });
    this.totalActiveDays += 1;
  }
  
  // Calculate current streak
  this.currentStreak = this.calculateCurrentStreak();
  
  // Update longest streak if current is higher
  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }
  
  this.lastActivityDate = new Date();
  
  // Keep only last 365 days of history
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  this.streakHistory = this.streakHistory.filter(entry => entry.date >= oneYearAgo);
  
  return this.save();
};

// Method to calculate current streak
userStreakSchema.methods.calculateCurrentStreak = function() {
  if (this.streakHistory.length === 0) return 0;
  
  // Sort history by date (newest first)
  const sortedHistory = this.streakHistory
    .filter(entry => entry.hasActivity)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (sortedHistory.length === 0) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  let streak = 0;
  let currentDate = new Date(today);
  
  // Check if user has activity today or yesterday (to maintain streak)
  const latestActivity = new Date(sortedHistory[0].date);
  latestActivity.setHours(0, 0, 0, 0);
  
  if (latestActivity.getTime() < yesterday.getTime()) {
    return 0; // Streak is broken
  }
  
  // Count consecutive days
  for (let i = 0; i < sortedHistory.length; i++) {
    const activityDate = new Date(sortedHistory[i].date);
    activityDate.setHours(0, 0, 0, 0);
    
    if (activityDate.getTime() === currentDate.getTime()) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (activityDate.getTime() < currentDate.getTime()) {
      break; // Gap found, streak ends
    }
  }
  
  return streak;
};

// Method to get streak data for calendar view
userStreakSchema.methods.getStreakCalendar = function(days = 365) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const calendar = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const entry = this.streakHistory.find(h => {
      const historyDate = new Date(h.date);
      return historyDate.toISOString().split('T')[0] === dateStr;
    });
    
    calendar.push({
      date: new Date(currentDate),
      problemsSolved: entry ? entry.problemsSolved : 0,
      hasActivity: entry ? entry.hasActivity : false
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return calendar;
};

module.exports = mongoose.model('UserStreak', userStreakSchema);