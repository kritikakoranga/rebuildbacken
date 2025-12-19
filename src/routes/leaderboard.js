const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Submission = require('../models/submission');
const Problem = require('../models/problem');

// GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    // Get all users with their problemSolved count
    const users = await User.find({}, 'firstName lastName problemSolved').lean();
    
    // For each user, get their stats
    const leaderboard = await Promise.all(users.map(async (user) => {
      // Get all accepted submissions for this user
      const submissions = await Submission.find({ 
        userId: user._id, 
        status: 'accepted' 
      }).lean();

      // Calculate problems solved count
      const problemsSolved = user.problemSolved ? user.problemSolved.length : 0;

      // Best memory/runtime per problem
      const bestStats = {};
      submissions.forEach((sub) => {
        const pid = sub.problemId.toString();
        if (!bestStats[pid] || sub.memory < bestStats[pid].memory) {
          bestStats[pid] = { memory: sub.memory, runtime: sub.runtime };
        }
      });

      const bestMemory = Object.values(bestStats).reduce((min, s) => Math.min(min, s.memory), Infinity);
      const bestRuntime = Object.values(bestStats).reduce((min, s) => Math.min(min, s.runtime), Infinity);

      return {
        userId: user._id,
        name: `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`,
        problemsSolved,
        bestMemory: bestMemory === Infinity ? null : bestMemory,
        bestRuntime: bestRuntime === Infinity ? null : bestRuntime
      };
    }));

    // Sort leaderboard
    leaderboard.sort((a, b) => {
      if (b.problemsSolved !== a.problemsSolved) return b.problemsSolved - a.problemsSolved;
      if (a.bestMemory !== b.bestMemory) return a.bestMemory - b.bestMemory;
      return 0;
    });

    res.json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: 'Error generating leaderboard' });
  }
});

// GET /:userId - Get a single user's profile and stats (with problem names)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId, 'firstName lastName emailId role problemSolved').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    const submissions = await Submission.find({ userId: user._id, status: 'accepted' })
      .sort({ createdAt: -1 })
      .lean();
    // Get all unique problemIds from submissions
    const problemIds = [...new Set(submissions.map(sub => sub.problemId.toString()))];
    // Fetch all problem names in one go
    const problems = await Problem.find({ _id: { $in: problemIds } }, 'title').lean();
    const problemMap = {};
    problems.forEach(p => { problemMap[p._id.toString()] = p.title; });
    // Recent problems (up to 5)
    const recentProblems = submissions.slice(0, 5).map(sub => ({
      problemId: sub.problemId,
      problemName: problemMap[sub.problemId.toString()] || 'Unknown',
      solvedAt: sub.createdAt
    }));
    // All submissions with problem names
    const allSubmissions = submissions.map(sub => ({
      problemId: sub.problemId,
      problemName: problemMap[sub.problemId.toString()] || 'Unknown',
      createdAt: sub.createdAt
    }));
    // Stats
    const problemsSolved = user.problemSolved ? user.problemSolved.length : 0;
    const bestStats = {};
    submissions.forEach((sub) => {
      const pid = sub.problemId.toString();
      if (!bestStats[pid] || sub.memory < bestStats[pid].memory) {
        bestStats[pid] = { memory: sub.memory, runtime: sub.runtime };
      }
    });
    const bestMemory = Object.values(bestStats).reduce((min, s) => Math.min(min, s.memory), Infinity);
    const bestRuntime = Object.values(bestStats).reduce((min, s) => Math.min(min, s.runtime), Infinity);
    res.json({
      userId: user._id,
      name: user.firstName + (user.lastName ? ' ' + user.lastName : ''),
      email: user.emailId,
      role: user.role,
      problemsSolved,
      recentProblems,
      bestMemory: bestMemory === Infinity ? null : bestMemory,
      bestRuntime: bestRuntime === Infinity ? null : bestRuntime,
      submissions: allSubmissions
    });
  } catch (err) {
    console.error('User profile error:', err);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

module.exports = router;