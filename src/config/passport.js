const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/user');

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/user/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with this Google ID
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      return done(null, user);
    }
    
    // Check if user exists with the same email
    user = await User.findOne({ emailId: profile.emails[0].value });
    
    if (user) {
      // Link Google account to existing user
      user.googleId = profile.id;
      await user.save();
      return done(null, user);
    }
    
    // Create new user
    user = new User({
      googleId: profile.id,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      emailId: profile.emails[0].value,
      profilePicture: profile.photos[0].value,
      isVerified: true, // Google accounts are pre-verified
      authProvider: 'google'
    });
    
    await user.save();
    return done(null, user);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, null);
  }
}));
} else {
  console.warn('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: "/user/auth/github/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with this GitHub ID
    let user = await User.findOne({ githubId: profile.id });
    
    if (user) {
      return done(null, user);
    }
    
    // Get primary email from GitHub profile
    const primaryEmail = profile.emails && profile.emails.find(email => email.primary) 
      ? profile.emails.find(email => email.primary).value 
      : profile.emails[0].value;
    
    // Check if user exists with the same email
    user = await User.findOne({ emailId: primaryEmail });
    
    if (user) {
      // Link GitHub account to existing user
      user.githubId = profile.id;
      await user.save();
      return done(null, user);
    }
    
    // Create new user
    user = new User({
      githubId: profile.id,
      firstName: profile.displayName || profile.username,
      lastName: '',
      emailId: primaryEmail,
      profilePicture: profile.photos[0].value,
      isVerified: true, // GitHub accounts are pre-verified
      authProvider: 'github'
    });
    
    await user.save();
    return done(null, user);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return done(error, null);
  }
}));
} else {
  console.warn('GitHub OAuth not configured - missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET');
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;