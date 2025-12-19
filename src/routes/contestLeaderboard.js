const express = require('express');
const router = express.Router();
const ContestScore = require('../models/contestScore');
const User = require('../models/user');

// POST /api/contest-leaderboard - Save a user's contest score
router.post('/', async (req, res) => {
  try {
    const { userId, score } = req.body;
    console.log('Received contest score submission:', { userId, score }); // Debug log
    
    if (!userId || typeof score !== 'number') {
      console.log('Invalid data received:', { userId, score, scoreType: typeof score }); // Debug log
      return res.status(400).json({ message: 'Missing userId or score' });
    }
    
    // Save the score
    const entry = new ContestScore({ userId, score });
    await entry.save();
    console.log('Contest score saved successfully:', entry); // Debug log
    
    res.status(201).json({ message: 'Score saved', entry });
  } catch (err) {
    console.error('Error saving contest score:', err); // Debug log
    res.status(500).json({ message: 'Error saving score', error: err.message });
  }
});

// GET /api/contest-leaderboard - Get top scores (highest per user)
router.get('/', async (req, res) => {
  try {
    console.log('Fetching contest leaderboard...'); // Debug log
    
    // First, let's see all contest scores in the database
    const allScores = await ContestScore.find({}).sort({ createdAt: -1 });
    console.log('All contest scores in database:', allScores); // Debug log
    
    // Aggregate to get highest score per user
    const topScores = await ContestScore.aggregate([
      {
        $sort: { score: -1, createdAt: 1 }
      },
      {
        $group: {
          _id: '$userId',
          score: { $first: '$score' },
          date: { $first: '$date' },
        }
      },
      {
        $sort: { score: -1, date: 1 }
      },
      { $limit: 20 }
    ]);
    
    console.log('Aggregated top scores:', topScores); // Debug log
    
    // Populate user info
    const userIds = topScores.map(s => s._id);
    const users = await User.find({ _id: { $in: userIds } }, 'firstName lastName');
    console.log('Found users:', users); // Debug log
    
    const userMap = {};
    users.forEach(u => { userMap[u._id] = u; });
    
    const leaderboard = topScores.map(entry => ({
      userId: entry._id,
      name: userMap[entry._id]
        ? `${userMap[entry._id].firstName || ''} ${userMap[entry._id].lastName || ''}`.trim()
        : 'Unknown',
      score: entry.score,
      date: entry.date,
    }));
    
    console.log('Final leaderboard:', leaderboard); // Debug log
    res.json({ leaderboard });
  } catch (err) {
    console.error('Error fetching contest leaderboard:', err); // Debug log
    res.status(500).json({ message: 'Error fetching leaderboard', error: err.message });
  }
});

module.exports = router; 