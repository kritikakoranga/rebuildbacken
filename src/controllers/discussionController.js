const Discussion = require('../models/discussion');
const User = require('../models/user');

// Get discussions for a specific problem
const getProblemDiscussions = async (req, res) => {
  try {
    const { problemId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const discussions = await Discussion.find({ problemId })
      .populate('userId', 'firstName lastName email')
      .populate('replies.userId', 'firstName lastName')
      .sort({ createdAt: 1 }) // Oldest first for chat-like experience
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Transform the data to include user info at the top level
    const transformedDiscussions = discussions.map(discussion => ({
      _id: discussion._id,
      problemId: discussion.problemId,
      message: discussion.message,
      likes: discussion.likes,
      replies: discussion.replies,
      isEdited: discussion.isEdited,
      editedAt: discussion.editedAt,
      createdAt: discussion.createdAt,
      updatedAt: discussion.updatedAt,
      user: discussion.userId
    }));

    res.json({
      success: true,
      discussions: transformedDiscussions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Discussion.countDocuments({ problemId })
      }
    });
  } catch (error) {
    console.error('Error fetching problem discussions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching discussions'
    });
  }
};

// Create a new discussion for a problem
const createProblemDiscussion = async (req, res) => {
  try {
    const { problemId } = req.params;
    const { message } = req.body;
    const userId = req.result._id;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const discussion = new Discussion({
      problemId,
      userId,
      message: message.trim()
    });

    await discussion.save();

    // Populate user info before sending response
    await discussion.populate('userId', 'firstName lastName email');

    // Transform the response
    const transformedDiscussion = {
      _id: discussion._id,
      problemId: discussion.problemId,
      message: discussion.message,
      likes: discussion.likes,
      replies: discussion.replies,
      isEdited: discussion.isEdited,
      editedAt: discussion.editedAt,
      createdAt: discussion.createdAt,
      updatedAt: discussion.updatedAt,
      user: discussion.userId
    };

    res.status(201).json({
      success: true,
      discussion: transformedDiscussion
    });
  } catch (error) {
    console.error('Error creating discussion:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating discussion'
    });
  }
};

// Create a general community discussion (not problem-specific)
const createCommunityDiscussion = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.result._id;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const discussion = new Discussion({
      problemId: null, // No specific problem
      userId,
      message: message.trim()
    });

    await discussion.save();

    // Populate user info before sending response
    await discussion.populate('userId', 'firstName lastName email');

    // Transform the response
    const transformedDiscussion = {
      _id: discussion._id,
      problemId: discussion.problemId,
      message: discussion.message,
      likes: discussion.likes,
      replies: discussion.replies,
      isEdited: discussion.isEdited,
      editedAt: discussion.editedAt,
      createdAt: discussion.createdAt,
      updatedAt: discussion.updatedAt,
      user: discussion.userId
    };

    res.status(201).json({
      success: true,
      discussion: transformedDiscussion
    });
  } catch (error) {
    console.error('Error creating community discussion:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating community discussion'
    });
  }
};

// Like/Unlike a discussion
const toggleDiscussionLike = async (req, res) => {
  try {
    const { discussionId } = req.params;
    const userId = req.result._id;

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    const likeIndex = discussion.likes.indexOf(userId);
    if (likeIndex > -1) {
      // Unlike
      discussion.likes.splice(likeIndex, 1);
    } else {
      // Like
      discussion.likes.push(userId);
    }

    await discussion.save();

    res.json({
      success: true,
      likes: discussion.likes.length,
      isLiked: likeIndex === -1
    });
  } catch (error) {
    console.error('Error toggling discussion like:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating like'
    });
  }
};

// Add reply to a discussion
const addDiscussionReply = async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { message } = req.body;
    const userId = req.result._id;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply message is required'
      });
    }

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    discussion.replies.push({
      userId,
      message: message.trim()
    });

    await discussion.save();
    await discussion.populate('replies.userId', 'firstName lastName');

    res.status(201).json({
      success: true,
      reply: discussion.replies[discussion.replies.length - 1]
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding reply'
    });
  }
};

// Get all discussions for community page
const getCommunityDiscussions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const discussions = await Discussion.find({})
      .populate('userId', 'firstName lastName email')
      .populate('problemId', 'title difficulty')
      .sort({ createdAt: -1 }) // Newest first for community
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const transformedDiscussions = discussions.map(discussion => ({
      _id: discussion._id,
      problemId: discussion.problemId,
      message: discussion.message,
      likes: discussion.likes,
      replies: discussion.replies,
      isEdited: discussion.isEdited,
      editedAt: discussion.editedAt,
      createdAt: discussion.createdAt,
      updatedAt: discussion.updatedAt,
      user: discussion.userId,
      problem: discussion.problemId
    }));

    res.json({
      success: true,
      discussions: transformedDiscussions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Discussion.countDocuments({})
      }
    });
  } catch (error) {
    console.error('Error fetching community discussions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching community discussions'
    });
  }
};

module.exports = {
  getProblemDiscussions,
  createProblemDiscussion,
  createCommunityDiscussion,
  toggleDiscussionLike,
  addDiscussionReply,
  getCommunityDiscussions
};