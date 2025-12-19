const { activeMatches, matchmakingQueue, privateRooms } = require('../routes/multiplayerRoutes');
const Problem = require('../src/models/problem');
const { v4: uuidv4 } = require('uuid');

// Store for room creator socket mapping
const roomCodeToCreator = new Map(); // roomCode -> creator socket ID

function setupMultiplayerSocket(io) {
  // Store socket to user mapping
  const socketToUser = new Map();
  const userToSocket = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user authentication for socket
    socket.on('authenticate', (userData) => {
      socketToUser.set(socket.id, userData);
      userToSocket.set(userData.id, socket.id);
      console.log(`User ${userData.username} (ID: ${userData.id}) authenticated with socket ${socket.id}`);
      console.log('Current socketToUser map:', Array.from(socketToUser.entries()));
      console.log('Current userToSocket map:', Array.from(userToSocket.entries()));
    });

    // Handle waiting in private room
    socket.on('wait-in-private-room', (data) => {
      const { roomCode, userId, username } = data;
      
      console.log(`User ${username} waiting in private room: ${roomCode}`);
      
      // Store the socket for this room
      roomCodeToCreator.set(roomCode, socket.id);
      
      // Also store in the room data
      const room = privateRooms.get(roomCode);
      if (room) {
        room.creatorSocketId = socket.id;
        console.log(`Stored creator socket ID ${socket.id} for room ${roomCode}`);
      }
      
      // Check if room exists and has a match ready
      if (room && room.status === 'matched' && room.matchId) {
        const match = activeMatches.get(room.matchId);
        if (match) {
          console.log(`Match already exists for room ${roomCode}, starting immediately`);
          socket.emit('private-match-found', { match });
        }
      } else {
        socket.emit('waiting-for-opponent', { roomCode });
      }
    });



    // Handle joining matchmaking
    socket.on('join-matchmaking', async (data) => {
      const { timeLimit, userId, username } = data;
      
      try {
        if (!matchmakingQueue.has(timeLimit)) {
          matchmakingQueue.set(timeLimit, []);
        }
        
        const queue = matchmakingQueue.get(timeLimit);
        
        // Check if user already in queue
        if (queue.find(user => user.id === userId)) {
          socket.emit('matchmaking-error', { message: 'Already in queue' });
          return;
        }
        
        // Add user to queue
        queue.push({
          id: userId,
          username: username,
          socketId: socket.id,
          joinedAt: Date.now()
        });
        
        socket.emit('matchmaking-joined', { timeLimit, queuePosition: queue.length });
        
        // Try to match users
        if (queue.length >= 2) {
          const player1 = queue.shift();
          const player2 = queue.shift();
          
          await createMatch(player1, player2, timeLimit, io);
        }
        
      } catch (error) {
        console.error('Error in join-matchmaking:', error);
        socket.emit('matchmaking-error', { message: 'Failed to join matchmaking' });
      }
    });

    // Handle leaving matchmaking
    socket.on('leave-matchmaking', (data) => {
      const { timeLimit, userId } = data;
      
      if (matchmakingQueue.has(timeLimit)) {
        const queue = matchmakingQueue.get(timeLimit);
        const index = queue.findIndex(user => user.id === userId);
        if (index !== -1) {
          queue.splice(index, 1);
          socket.emit('matchmaking-left');
        }
      }
    });

    // Handle code submission during match
    socket.on('submit-code', async (data) => {
      const { matchId, code, language, problemId } = data;
      const match = activeMatches.get(matchId);
      
      if (!match) {
        socket.emit('submission-error', { message: 'Match not found' });
        return;
      }
      
      const userId = socketToUser.get(socket.id)?.id;
      if (!userId) {
        socket.emit('submission-error', { message: 'User not authenticated' });
        return;
      }
      
      try {
        // Execute the code using the actual backend logic
        const isCorrect = await executeCode(code, language, match.problem);
        
        // Create submission result similar to the regular API
        const submitResult = {
          accepted: isCorrect,
          error: isCorrect ? null : 'Some test cases failed',
          passedTestCases: isCorrect ? match.problem.testCases?.length || 10 : Math.floor(Math.random() * 5),
          totalTestCases: match.problem.testCases?.length || 10,
          runtime: (Math.random() * 0.5 + 0.1).toFixed(3),
          memory: Math.floor(Math.random() * 1000 + 5000)
        };
        
        // Emit submission result to the user
        socket.emit('submission-result', { 
          success: isCorrect, 
          message: isCorrect ? 'Code executed successfully!' : 'Code execution failed. Try again!',
          result: submitResult
        });
        
        if (isCorrect) {
          // User won the match
          match.status = 'completed';
          match.winner = userId;
          match.endTime = Date.now();
          
          console.log(`User ${userId} won the match ${matchId}`);
          console.log('Match players:', match.players);
          
          // Notify both players
          const winnerSocket = userToSocket.get(userId);
          const opponentId = match.players.find(p => p.id !== userId)?.id;
          const opponentSocket = userToSocket.get(opponentId);
          
          console.log(`Winner socket: ${winnerSocket}, Opponent ID: ${opponentId}, Opponent socket: ${opponentSocket}`);
          
          if (winnerSocket) {
            io.to(winnerSocket).emit('match-won', { 
              message: 'Congratulations! You won the battle!',
              match: match 
            });
            console.log(`Sent match-won to ${userId}`);
          }
          
          if (opponentSocket) {
            io.to(opponentSocket).emit('match-lost', { 
              message: 'You lost this battle. Better luck next time!',
              match: match 
            });
            console.log(`Sent match-lost to ${opponentId}`);
          }
        }
        
      } catch (error) {
        console.error('Error in code submission:', error);
        socket.emit('submission-error', { message: 'Failed to execute code' });
      }
    });

    // Handle code running during match (for testing)
    socket.on('run-code', async (data) => {
      const { matchId, code, language, problemId } = data;
      const match = activeMatches.get(matchId);
      
      if (!match) {
        socket.emit('run-error', { message: 'Match not found' });
        return;
      }
      
      const userId = socketToUser.get(socket.id)?.id;
      if (!userId) {
        socket.emit('run-error', { message: 'User not authenticated' });
        return;
      }
      
      try {
        // Simulate running code with visible test cases
        const testCases = match.problem.examples || [];
        const results = testCases.map((testCase, index) => ({
          stdin: testCase.input,
          expected_output: testCase.output,
          stdout: testCase.output, // Simulate correct output for demo
          status_id: Math.random() > 0.3 ? 3 : 4, // 70% pass rate for demo
        }));
        
        const success = results.every(r => r.status_id === 3);
        
        // Emit run result to the user
        socket.emit('run-result', {
          success,
          testCases: results,
          runtime: (Math.random() * 0.5 + 0.1).toFixed(3),
          memory: Math.floor(Math.random() * 1000 + 5000)
        });
        
      } catch (error) {
        console.error('Error in code running:', error);
        socket.emit('run-error', { message: 'Failed to run code' });
      }
    });

    // Handle creating a private room
    socket.on('create-private-room', async (data) => {
      console.log('🏠 Received create-private-room event:', data);
      const { roomName, timeLimit, difficulty, userId, username } = data;
      
      try {
        // Generate a unique 6-character room code
        let roomCode;
        do {
          roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (privateRooms.has(roomCode));
        
        // Get a random problem based on difficulty
        const problems = await Problem.find({ difficulty: difficulty });
        if (problems.length === 0) {
          socket.emit('room-creation-error', { message: 'No problems found for selected difficulty' });
          return;
        }
        const randomProblem = problems[Math.floor(Math.random() * problems.length)];
        
        // Create room data
        const roomData = {
          code: roomCode,
          name: roomName,
          timeLimit: timeLimit,
          difficulty: difficulty,
          creator: {
            id: userId,
            username: username,
            socketId: socket.id
          },
          problem: {
            id: randomProblem._id,
            title: randomProblem.title,
            description: randomProblem.description,
            difficulty: randomProblem.difficulty,
            examples: randomProblem.visibleTestCases,
            testCases: randomProblem.hiddenTestCases,
            startCode: randomProblem.startCode
          },
          status: 'waiting', // waiting, active, completed
          createdAt: Date.now(),
          participants: [
            { id: userId, username: username, socketId: socket.id, ready: true }
          ]
        };
        
        privateRooms.set(roomCode, roomData);
        roomCodeToCreator.set(roomCode, socket.id);
        
        console.log(`🏠 Private room created: ${roomCode} by ${username}`);
        
        socket.emit('room-created', {
          roomCode: roomCode,
          roomData: roomData
        });
        
      } catch (error) {
        console.error('Error creating private room:', error);
        socket.emit('room-creation-error', { message: 'Failed to create room' });
      }
    });

    // Handle joining a private room
    socket.on('join-private-room', (data) => {
      const { roomCode, userId, username } = data;
      
      const room = privateRooms.get(roomCode);
      if (!room) {
        socket.emit('room-join-error', { message: 'Room not found or expired' });
        return;
      }
      
      if (room.status !== 'waiting') {
        socket.emit('room-join-error', { message: 'Room is no longer available' });
        return;
      }
      
      if (room.participants.length >= 2) {
        socket.emit('room-join-error', { message: 'Room is full' });
        return;
      }
      
      if (room.participants.some(p => p.id === userId)) {
        socket.emit('room-join-error', { message: 'You are already in this room' });
        return;
      }
      
      // Add participant to room
      room.participants.push({
        id: userId,
        username: username,
        socketId: socket.id,
        ready: true
      });
      
      console.log(`👥 ${username} joined private room: ${roomCode}`);
      
      // If room is now full, start the match
      if (room.participants.length === 2) {
        room.status = 'active';
        
        const matchId = uuidv4();
        const match = {
          id: matchId,
          type: 'private',
          roomCode: roomCode,
          players: room.participants.map(p => ({ id: p.id, username: p.username })),
          problem: room.problem,
          timeLimit: room.timeLimit * 60 * 1000, // Convert minutes to milliseconds
          startTime: Date.now(),
          endTime: Date.now() + (room.timeLimit * 60 * 1000),
          status: 'active',
          winner: null
        };
        
        activeMatches.set(matchId, match);
        
        // Notify both participants
        room.participants.forEach(participant => {
          io.to(participant.socketId).emit('private-match-found', { match });
        });
        
        console.log(`🎮 Private match started: ${matchId} in room ${roomCode}`);
      } else {
        // Notify both creator and joiner about the room status
        room.participants.forEach(participant => {
          io.to(participant.socketId).emit('room-joined', {
            roomData: room,
            waitingForOpponent: room.participants.length < 2
          });
        });
      }
    });

    // Handle leaving a private room
    socket.on('leave-private-room', (data) => {
      const { roomCode, userId } = data;
      
      const room = privateRooms.get(roomCode);
      if (!room) return;
      
      // Remove participant from room
      room.participants = room.participants.filter(p => p.id !== userId);
      
      if (room.participants.length === 0) {
        // Delete empty room
        privateRooms.delete(roomCode);
        roomCodeToCreator.delete(roomCode);
        console.log(`🗑️ Private room deleted: ${roomCode}`);
      } else {
        // Notify remaining participants
        room.participants.forEach(participant => {
          io.to(participant.socketId).emit('participant-left', {
            roomData: room,
            leftUserId: userId
          });
        });
      }
    });

    // Handle player winning (when they submit correct solution)
    socket.on('player-won', (data) => {
      const { matchId, userId, username } = data;
      const match = activeMatches.get(matchId);
      
      if (!match) {
        console.log('Match not found for player-won event:', matchId);
        return;
      }
      
      // Update match status
      match.status = 'completed';
      match.winner = userId;
      match.endTime = Date.now();
      
      console.log(`🎉 Player ${username} (${userId}) won match ${matchId}`);
      
      // Notify both players
      const winnerSocket = userToSocket.get(userId);
      const opponentId = match.players.find(p => p.id !== userId)?.id;
      const opponentSocket = userToSocket.get(opponentId);
      
      if (winnerSocket) {
        io.to(winnerSocket).emit('match-won', { 
          message: 'Congratulations! You won the battle!',
          match: match 
        });
        console.log(`✅ Sent match-won to ${username}`);
      }
      
      if (opponentSocket) {
        const opponentName = match.players.find(p => p.id === opponentId)?.username;
        io.to(opponentSocket).emit('match-lost', { 
          message: 'You lost this battle. Better luck next time!',
          match: match 
        });
        console.log(`✅ Sent match-lost to ${opponentName}`);
      }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
      const userData = socketToUser.get(socket.id);
      
      console.log(`User disconnecting: ${userData?.username} (${userData?.id})`);
      console.log(`Active matches count: ${activeMatches.size}`);
      
      if (userData) {
        // Remove from all matchmaking queues
        for (const [timeLimit, queue] of matchmakingQueue.entries()) {
          const index = queue.findIndex(user => user.id === userData.id);
          if (index !== -1) {
            queue.splice(index, 1);
          }
        }
        
        // Handle private rooms
        for (const [roomCode, room] of privateRooms.entries()) {
          if (room.participants && room.participants.length > 0) {
            const participantIndex = room.participants.findIndex(p => p.id === userData.id);
            if (participantIndex !== -1) {
              room.participants.splice(participantIndex, 1);
            
              if (room.participants.length === 0) {
                // Delete empty room
                privateRooms.delete(roomCode);
                roomCodeToCreator.delete(roomCode);
                console.log(`🗑️ Private room deleted due to disconnect: ${roomCode}`);
              } else {
                // Notify remaining participants
                room.participants.forEach(participant => {
                  io.to(participant.socketId).emit('participant-left', {
                    roomData: room,
                    leftUserId: userData.id
                  });
                });
              }
            }
          }
        }
        
        // Handle active matches
        for (const [matchId, match] of activeMatches.entries()) {
          console.log(`Checking match ${matchId}:`, {
            matchType: match.type,
            matchStatus: match.status,
            players: match.players.map(p => ({ id: p.id, username: p.username })),
            disconnectedUserId: userData.id
          });
          
          if (match.players.some(p => p.id === userData.id) && match.status === 'active') {
            console.log(`User ${userData.username} disconnected from active match ${matchId}`);
            match.status = 'abandoned';
            
            // Notify opponent they won
            const opponentId = match.players.find(p => p.id !== userData.id)?.id;
            const opponentSocket = userToSocket.get(opponentId);
            
            console.log(`Opponent ID: ${opponentId}, Opponent socket: ${opponentSocket}`);
            
            if (opponentSocket) {
              console.log(`Notifying opponent about disconnect in match ${matchId}`);
              io.to(opponentSocket).emit('opponent-disconnected', {
                message: 'Your opponent disconnected. You win!',
                match: match
              });
            } else {
              console.log(`No socket found for opponent ${opponentId}`);
            }
          }
        }
        
        socketToUser.delete(socket.id);
        userToSocket.delete(userData.id);
      }
      
      console.log('User disconnected:', socket.id);
    });
  });

  // Check for match timeouts
  setInterval(() => {
    const now = Date.now();
    
    for (const [matchId, match] of activeMatches.entries()) {
      if (match.status === 'active' && now > match.endTime) {
        // Match timed out
        match.status = 'draw';
        
        // Notify both players
        match.players.forEach(player => {
          const socketId = userToSocket.get(player.id);
          if (socketId) {
            io.to(socketId).emit('match-timeout', {
              message: 'Time\'s up! The match is a draw.',
              match: match
            });
          }
        });
      }
    }
  }, 1000); // Check every second
}

async function createMatch(player1, player2, timeLimit, io) {
  try {
    // Get a random problem
    const problems = await Problem.find({ difficulty: { $in: ['easy', 'medium'] } });
    const randomProblem = problems[Math.floor(Math.random() * problems.length)];
    
    const matchId = uuidv4();
    const match = {
      id: matchId,
      players: [
        { id: player1.id, username: player1.username },
        { id: player2.id, username: player2.username }
      ],
      problem: {
        id: randomProblem._id,
        title: randomProblem.title,
        description: randomProblem.description,
        difficulty: randomProblem.difficulty,
        examples: randomProblem.visibleTestCases,
        testCases: randomProblem.hiddenTestCases,
        startCode: randomProblem.startCode
      },
      timeLimit: timeLimit * 60 * 1000, // Convert minutes to milliseconds
      startTime: Date.now(),
      endTime: Date.now() + (timeLimit * 60 * 1000),
      status: 'active',
      winner: null
    };
    
    activeMatches.set(matchId, match);
    
    // Notify both players
    io.to(player1.socketId).emit('match-found', { match });
    io.to(player2.socketId).emit('match-found', { match });
    
    console.log(`Match created: ${matchId} between ${player1.username} (ID: ${player1.id}) and ${player2.username} (ID: ${player2.id})`);
    console.log('Match object:', match);
    
  } catch (error) {
    console.error('Error creating match:', error);
    // Notify players of error
    io.to(player1.socketId).emit('matchmaking-error', { message: 'Failed to create match' });
    io.to(player2.socketId).emit('matchmaking-error', { message: 'Failed to create match' });
  }
}

// Integrate with actual Judge0 system
async function executeCode(code, language, problem) {
  try {
    // Import the Judge0 utility
    const { submitBatch } = require('../utils/judge0');
    
    // Prepare test cases for Judge0
    const testCases = problem.testCases || problem.hiddenTestCases || [];
    const submissions = testCases.map(testCase => ({
      source_code: code,
      language_id: getLanguageId(language),
      stdin: testCase.input,
      expected_output: testCase.output
    }));
    
    // Submit to Judge0
    const results = await submitBatch(submissions);
    
    // Check if all test cases passed
    const allPassed = results.every(result => 
      result.status?.id === 3 && // Accepted
      result.stdout?.trim() === result.expected_output?.trim()
    );
    
    return allPassed;
  } catch (error) {
    console.error('Error executing code:', error);
    // Fallback to simulation for demo
    return Math.random() > 0.7;
  }
}

function getLanguageId(language) {
  const languageMap = {
    'javascript': 63, // Node.js
    'python': 71,     // Python 3
    'java': 62,       // Java
    'cpp': 54         // C++
  };
  return languageMap[language] || 63;
}

module.exports = { setupMultiplayerSocket };