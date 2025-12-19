const express = require('express');
const router = express.Router();
const {
  getProblemDiscussions,
  createProblemDiscussion,
  createCommunityDiscussion,
  toggleDiscussionLike,
  addDiscussionReply,
  getCommunityDiscussions
} = require('../controllers/discussionController');
const userMiddleware = require('../middleware/userMiddleware');

// Apply user middleware to all routes
router.use(userMiddleware);

// Problem-specific discussions
router.get('/problem/:problemId', getProblemDiscussions);
router.post('/problem/:problemId', createProblemDiscussion);

// Discussion interactions
router.post('/:discussionId/like', toggleDiscussionLike);
router.post('/:discussionId/reply', addDiscussionReply);

// Community discussions
router.get('/community', getCommunityDiscussions);
router.post('/community', createCommunityDiscussion);

module.exports = router;