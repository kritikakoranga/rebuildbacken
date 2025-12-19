const express = require('express');
const router = express.Router();
const { navigationAssistant } = require('../controllers/navigationAI');
const userMiddleware = require('../middleware/userMiddleware');

// POST /api/navigation-ai - Get navigation assistance
router.post('/', userMiddleware, navigationAssistant);

module.exports = router;