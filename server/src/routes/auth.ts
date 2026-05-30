import express from 'express';
import { pool } from '../index.js';
import { supabaseAdmin, supabaseAnon } from '../lib/supabase.js';

const router = express.Router();

const hasEduEmail = (email: string) => email.toLowerCase().includes('.edu');

const ensureUserProfile = async (userId: string, email: string) => {
  const existing = await pool.query(
    `SELECT id, email, name, major, year, avatar, reputation, onboarding_completed, created_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const created = await pool.query(
    `INSERT INTO users (id, email) VALUES ($1, $2)
     RETURNING id, email, name, major, year, avatar, reputation, onboarding_completed, created_at`,
    [userId, email]
  );

  return created.rows[0];
};

// Register route
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!hasEduEmail(email)) {
    return res.status(400).json({ error: 'Email must contain ".edu".' });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !createdUser.user) {
      return res.status(400).json({ error: createError?.message || 'Error creating user.' });
    }

    const user = await ensureUserProfile(createdUser.user.id, email);

    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      return res.status(401).json({ error: signInError?.message || 'Error signing in.' });
    }

    res.status(201).json({
      token: signInData.session.access_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        major: user.major,
        year: user.year,
        avatar: user.avatar,
        reputation: user.reputation,
        onboardingCompleted: user.onboarding_completed,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error registering user.' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!hasEduEmail(email)) {
    return res.status(400).json({ error: 'Email must contain ".edu".' });
  }

  try {
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session || !signInData.user) {
      return res.status(401).json({ error: signInError?.message || 'Invalid credentials.' });
    }

    const userEmail = signInData.user.email || email;
    const user = await ensureUserProfile(signInData.user.id, userEmail);

    res.status(200).json({
      token: signInData.session.access_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        major: user.major,
        year: user.year,
        avatar: user.avatar,
        reputation: user.reputation,
        onboardingCompleted: user.onboarding_completed,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in.' });
  }
});

// Verify token and get current user
router.get('/verify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const userEmail = data.user.email || '';
    const user = await ensureUserProfile(data.user.id, userEmail);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        major: user.major,
        year: user.year,
        avatar: user.avatar,
        reputation: user.reputation,
        onboardingCompleted: user.onboarding_completed,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error verifying token' });
  }
});

export default router;