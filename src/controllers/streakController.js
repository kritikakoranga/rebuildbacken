const UserStreak = require('../models/userStreak');
const User = require('../models/user');

// Get user's streak data
const getUserStreak = async (req, res) => {
  try {
    const userId = req.result._id;
    
    let userStreak = await UserStreak.findOne({ userId });
    
    if (!userStreak) {
      // Create new streak record for user
      userStreak = new UserStreak({ userId });
      await userStreak.save();
    }
    
    // Update current streak calculation
    userStreak.currentStreak = userStreak.calculateCurrentStreak();
    await userStreak.save();
    
    res.json({
      currentStreak: userStreak.currentStreak,
      longestStreak: userStreak.longestStreak,
      totalActiveDays: userStreak.totalActiveDays,
      lastActivityDate: userStreak.lastActivityDate,
      calendar: userStreak.getStreakCalendar(365)
    });
  } catch (error) {
    console.error('Error fetching user streak:', error);
    res.status(500).json({ message: 'Error fetching streak data' });
  }
};

// Update streak when user solves a problem
const updateStreak = async (userId) => {
  try {
    let userStreak = await UserStreak.findOne({ userId });
    
    if (!userStreak) {
      userStreak = new UserStreak({ userId });
    }
    
    await userStreak.updateStreak();
    return userStreak;
  } catch (error) {
    console.error('Error updating streak:', error);
    throw error;
  }
};

// Get streak calendar for specific date range
const getStreakCalendar = async (req, res) => {
  try {
    const userId = req.result._id;
    const { days = 365 } = req.query;
    
    let userStreak = await UserStreak.findOne({ userId });
    
    if (!userStreak) {
      userStreak = new UserStreak({ userId });
      await userStreak.save();
    }
    
    const calendar = userStreak.getStreakCalendar(parseInt(days));
    
    res.json({ calendar });
  } catch (error) {
    console.error('Error fetching streak calendar:', error);
    res.status(500).json({ message: 'Error fetching calendar data' });
  }
};

// Get leaderboard of users with highest streaks
const getStreakLeaderboard = async (req, res) => {
  try {
    const topStreaks = await UserStreak.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userId: 1,
          currentStreak: 1,
          longestStreak: 1,
          totalActiveDays: 1,
          name: {
            $concat: ['$user.firstName', ' ', { $ifNull: ['$user.lastName', ''] }]
          }
        }
      },
      {
        $sort: { currentStreak: -1, longestStreak: -1 }
      },
      {
        $limit: 20
      }
    ]);
    
    res.json({ leaderboard: topStreaks });
  } catch (error) {
    console.error('Error fetching streak leaderboard:', error);
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
};

// Get comprehensive user progress data
const getUserProgress = async (req, res) => {
  try {
    console.log('getUserProgress called for user:', req.result._id);
    const userId = req.result._id;
    
    // Get streak data
    let userStreak = await UserStreak.findOne({ userId });
    if (!userStreak) {
      userStreak = new UserStreak({ userId });
      await userStreak.save();
    }
    
    // Update current streak calculation
    userStreak.currentStreak = userStreak.calculateCurrentStreak();
    await userStreak.save();
    
    // Get user's solved problems
    const user = await User.findById(userId).populate('problemSolved');
    const solvedProblems = user.problemSolved || [];
    
    // Get user's submissions for recent activity
    const Submission = require('../models/submission');
    const recentSubmissions = await Submission.find({ userId })
      .populate('problemId', 'title difficulty')
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Calculate monthly progress (last 6 months)
    const monthlyProgress = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthSubmissions = await Submission.find({
        userId,
        status: 'accepted',
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }).distinct('problemId');
      
      const monthName = monthStart.toLocaleString('default', { month: 'long' });
      
      monthlyProgress.push({
        month: monthName,
        solved: monthSubmissions.length,
        total: Math.max(monthSubmissions.length + Math.floor(Math.random() * 5), 10) // Approximate total available
      });
    }
    
    // Calculate success rate
    const totalSubmissions = await Submission.countDocuments({ userId });
    const acceptedSubmissions = await Submission.countDocuments({ userId, status: 'accepted' });
    const successRate = totalSubmissions > 0 ? Math.round((acceptedSubmissions / totalSubmissions) * 100) : 0;
    
    // Calculate average problems per week
    const firstSubmission = await Submission.findOne({ userId }).sort({ createdAt: 1 });
    let avgProblemsPerWeek = 0;
    if (firstSubmission) {
      const daysSinceFirst = Math.max(1, Math.ceil((now - firstSubmission.createdAt) / (1000 * 60 * 60 * 24)));
      const weeksSinceFirst = Math.max(1, daysSinceFirst / 7);
      avgProblemsPerWeek = Math.round((solvedProblems.length / weeksSinceFirst) * 10) / 10;
    }
    
    // Format recent activity
    const recentActivity = recentSubmissions.map(submission => ({
      problem: submission.problemId?.title || 'Unknown Problem',
      difficulty: submission.problemId?.difficulty || 'Unknown',
      time: getTimeAgo(submission.createdAt),
      status: submission.status === 'accepted' ? 'solved' : 'attempted'
    }));
    
    res.json({
      streak: {
        current: userStreak.currentStreak,
        longest: userStreak.longestStreak,
        totalActiveDays: userStreak.totalActiveDays
      },
      problems: {
        solved: solvedProblems.length,
        successRate: successRate,
        avgPerWeek: avgProblemsPerWeek
      },
      monthlyProgress: monthlyProgress,
      calendar: userStreak.getStreakCalendar(91), // Last 3 months
      recentActivity: recentActivity
    });
    console.log('Progress data sent successfully');
  } catch (error) {
    console.error('Error fetching user progress:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Error fetching progress data' });
  }
};

// Helper function to format time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
};

module.exports = {
  getUserStreak,
  updateStreak,
  getStreakCalendar,
  getStreakLeaderboard,
  getUserProgress
};