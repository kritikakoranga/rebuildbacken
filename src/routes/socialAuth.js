const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user');

// Cookie configuration helper
const getCookieConfig = () => ({
  maxAge: 60 * 60 * 1000,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
});

// Test endpoint to verify OAuth routes are working
router.get('/test', (req, res) => {
  res.json({ 
    message: 'OAuth routes are working!',
    availableRoutes: ['/google', '/github', '/google/callback', '/github/callback']
  });
});

// GET /api/auth/google
router.get('/google', (req, res, next) => {
  console.log('Google OAuth route hit');
  console.log('Google Client ID configured:', !!process.env.GOOGLE_CLIENT_ID);
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// GET /api/auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  async (req, res) => {
    // User is attached to req.user by passport
    const user = req.user;
    const JWT_KEY = process.env.JWT_KEY || 'YOUR_JWT_SECRET';
    const frontendRedirect = process.env.FRONTEND_URL || 'http://localhost:5173/';
    const token = jwt.sign(
      { _id: user._id, emailId: user.emailId, role: user.role },
      JWT_KEY,
      { expiresIn: 60 * 60 }
    );
    res.cookie('token', token, getCookieConfig());
    // Optionally, you can pass user info as query params if needed
    res.redirect(frontendRedirect);
  }
);

// GET /api/auth/github
router.get(
  '/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

// GET /api/auth/github/callback
router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: '/login', session: false }),
  async (req, res) => {
    // User is attached to req.user by passport
    const user = req.user;
    const JWT_KEY = process.env.JWT_KEY || 'YOUR_JWT_SECRET';
    const frontendRedirect = process.env.FRONTEND_URL || 'http://localhost:5173/';
    const token = jwt.sign(
      { _id: user._id, emailId: user.emailId, role: user.role },
      JWT_KEY,
      { expiresIn: 60 * 60 }
    );
    res.cookie('token', token, getCookieConfig());
    // Optionally, you can pass user info as query params if needed
    res.redirect(frontendRedirect);
  }
);

module.exports = router;