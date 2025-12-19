const express = require('express');
const aiRouter =  express.Router();
const userMiddleware = require("../middleware/userMiddleware");
const solveDoubt = require('../controllers/solveDoubt');
const practicebehavioral = require('../controllers/practicebehavioral');
const practisedsa = require('../controllers/practisedsa');
const practicesystemdesign = require('../controllers/practicesystemdesign');
const mockhr = require('../controllers/mockhr');

aiRouter.post('/chat', userMiddleware, solveDoubt);
aiRouter.post('/practicebehavioral', userMiddleware, practicebehavioral);
aiRouter.post('/practisedsa', userMiddleware, practisedsa);
aiRouter.post('/practicesystemdesign', userMiddleware, practicesystemdesign);
aiRouter.post('/mockhr', userMiddleware, mockhr);

module.exports = aiRouter;