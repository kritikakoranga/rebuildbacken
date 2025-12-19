const express = require('express');
const router = express.Router();
const { getUserStreak, getStreakCalendar, getStreakLeaderboard, getUserProgress } = require('../controllers/streakController');
const userMiddleware = require('../middleware/userMiddleware');

// All routes require authentication
router.use(userMiddleware);

// GET /api/streak - Get user's streak data
router.get('/', getUserStreak);

// GET /api/streak/calendar - Get streak calendar
router.get('/calendar', getStreakCalendar);

// GET /api/streak/leaderboard - Get streak leaderboard
router.get('/leaderboard', getStreakLeaderboard);

// GET /api/streak/progress - Get comprehensive user progress data
router.get('/progress', getUserProgress);

module.exports = router;