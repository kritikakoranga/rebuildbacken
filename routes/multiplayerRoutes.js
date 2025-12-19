const express = require('express');
const router = express.Router();
const Problem = require('../src/models/problem');
const User = require('../src/models/user');
const userMiddleware = require('../src/middleware/userMiddleware');

// Store active matches in memory (in production, use Redis)
const activeMatches = new Map();
const matchmakingQueue = new Map(); // timeLimit -> [users]
const privateRooms = new Map(); // roomCode -> room data

// Get random problem for multiplayer
router.get('/random-problem', userMiddleware, async (req, res) => {
  try {
    const problems = await Problem.find({ difficulty: { $in: ['easy', 'medium'] } });
    const randomProblem = problems[Math.floor(Math.random() * problems.length)];
    
    res.json({
      success: true,
      problem: {
        id: randomProblem._id,
        title: randomProblem.title,
        description: randomProblem.description,
        difficulty: randomProblem.difficulty,
        examples: randomProblem.visibleTestCases,
        testCases: randomProblem.hiddenTestCases,
        startCode: randomProblem.startCode
      }
    });
  } catch (error) {
    console.error('Error fetching random problem:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch problem' });
  }
});

// Join matchmaking queue
router.post('/join-queue', userMiddleware, async (req, res) => {
  try {
    const { timeLimit } = req.body; // 5, 10, or 15 minutes
    const userId = req.result._id;
    
    if (!matchmakingQueue.has(timeLimit)) {
      matchmakingQueue.set(timeLimit, []);
    }
    
    const queue = matchmakingQueue.get(timeLimit);
    
    // Check if user is already in queue
    if (queue.find(user => user.id === userId)) {
      return res.json({ success: false, message: 'Already in queue' });
    }
    
    queue.push({
      id: userId,
      username: req.result.firstName + ' ' + req.result.lastName,
      joinedAt: Date.now()
    });
    
    res.json({ success: true, message: 'Joined matchmaking queue' });
  } catch (error) {
    console.error('Error joining queue:', error);
    res.status(500).json({ success: false, message: 'Failed to join queue' });
  }
});

// Leave matchmaking queue
router.post('/leave-queue', userMiddleware, async (req, res) => {
  try {
    const { timeLimit } = req.body;
    const userId = req.result._id;
    
    if (matchmakingQueue.has(timeLimit)) {
      const queue = matchmakingQueue.get(timeLimit);
      const index = queue.findIndex(user => user.id === userId);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    }
    
    res.json({ success: true, message: 'Left matchmaking queue' });
  } catch (error) {
    console.error('Error leaving queue:', error);
    res.status(500).json({ success: false, message: 'Failed to leave queue' });
  }
});

// Get match status
router.get('/match/:matchId', userMiddleware, async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    
    res.json({ success: true, match });
  } catch (error) {
    console.error('Error getting match:', error);
    res.status(500).json({ success: false, message: 'Failed to get match' });
  }
});

// Test route
router.get('/test', (req, res) => {
  console.log('Test route hit');
  res.json({ success: true, message: 'Multiplayer routes working' });
});

// Generate random room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Create private room
router.post('/create-room', async (req, res) => {
  try {
    console.log('Create room request received:', req.body);
    const { timeLimit, creatorId, creatorUsername } = req.body;
    
    if (!timeLimit || !creatorId || !creatorUsername) {
      console.log('Missing required fields:', { timeLimit, creatorId, creatorUsername });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Generate unique room code
    let roomCode;
    do {
      roomCode = generateRoomCode();
    } while (privateRooms.has(roomCode));

    // Create room
    const room = {
      roomCode,
      timeLimit,
      creator: {
        id: creatorId,
        username: creatorUsername
      },
      players: [{
        id: creatorId,
        username: creatorUsername
      }],
      status: 'waiting', // waiting, matched, in-progress, finished
      createdAt: Date.now(),
      expiresAt: Date.now() + (30 * 60 * 1000), // 30 minutes expiry
      creatorSocketId: null // Will be set when creator joins the waiting room
    };

    privateRooms.set(roomCode, room);
    console.log('Room created successfully:', roomCode);

    // Clean up expired rooms
    setTimeout(() => {
      if (privateRooms.has(roomCode) && privateRooms.get(roomCode).status === 'waiting') {
        privateRooms.delete(roomCode);
      }
    }, 30 * 60 * 1000);

    res.json({ 
      success: true, 
      roomCode,
      message: 'Room created successfully'
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ success: false, message: 'Failed to create room', error: error.message });
  }
});

// Join private room
router.post('/join-room', async (req, res) => {
  try {
    const { roomCode, playerId, playerUsername } = req.body;
    
    if (!roomCode || !playerId || !playerUsername) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const room = privateRooms.get(roomCode);
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found or expired' });
    }

    if (room.status !== 'waiting') {
      return res.status(400).json({ success: false, message: 'Room is no longer available' });
    }

    if (room.players.length >= 2) {
      return res.status(400).json({ success: false, message: 'Room is full' });
    }

    if (room.players.find(p => p.id === playerId)) {
      return res.status(400).json({ success: false, message: 'You are already in this room' });
    }

    // Add player to room
    room.players.push({
      id: playerId,
      username: playerUsername
    });

    // If room is now full, create match
    if (room.players.length === 2) {
      // Get random problem
      const problems = await Problem.find({ difficulty: { $in: ['easy', 'medium'] } });
      const randomProblem = problems[Math.floor(Math.random() * problems.length)];
      
      const matchId = `private_${roomCode}_${Date.now()}`;
      const match = {
        id: matchId,
        type: 'private',
        roomCode,
        timeLimit: room.timeLimit,
        players: room.players,
        problem: {
          id: randomProblem._id,
          title: randomProblem.title,
          description: randomProblem.description,
          difficulty: randomProblem.difficulty,
          examples: randomProblem.visibleTestCases,
          testCases: randomProblem.hiddenTestCases,
          startCode: randomProblem.startCode
        },
        startTime: Date.now(),
        endTime: Date.now() + (room.timeLimit * 60 * 1000),
        status: 'active',
        submissions: []
      };

      activeMatches.set(matchId, match);
      room.status = 'matched';
      room.matchId = matchId;

      // Notify room creator via socket if they're waiting
      const io = req.app.get('io');
      if (io) {
        if (room.creatorSocketId) {
          console.log(`Sending private-match-found to creator socket: ${room.creatorSocketId}`);
          io.to(room.creatorSocketId).emit('private-match-found', { match });
        } else {
          console.log('No creator socket ID, broadcasting to all sockets');
          io.emit('private-match-created', { roomCode, match });
        }
      } else {
        console.log('No io instance available');
      }

      res.json({ 
        success: true, 
        match,
        message: 'Successfully joined room and match created!'
      });
    } else {
      res.json({ 
        success: true, 
        message: 'Joined room, waiting for opponent...'
      });
    }
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ success: false, message: 'Failed to join room' });
  }
});

// Get room status
router.get('/room/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = privateRooms.get(roomCode);
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    
    res.json({ success: true, room });
  } catch (error) {
    console.error('Error getting room:', error);
    res.status(500).json({ success: false, message: 'Failed to get room' });
  }
});

module.exports = { 
  router, 
  activeMatches, 
  matchmakingQueue,
  privateRooms
};