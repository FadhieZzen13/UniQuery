import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../index.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || 'default_secret';

// Register route
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // Validate email contains edu
  if (!email.includes('edu')) {
    return res.status(400).json({ error: 'Email must contain "edu".' });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, onboarding_completed',
      [email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: '7d',
    });

    res.status(201).json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        onboardingCompleted: user.onboarding_completed
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error registering user.' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, name, major, year, avatar, reputation, onboarding_completed, created_at FROM users WHERE email = $1', 
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    const token = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: '7d',
    });

    res.status(200).json({ 
      token,
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
    const decoded = jwt.verify(token, jwtSecret) as { userId: number };
    
    const result = await pool.query(
      'SELECT id, email, name, major, year, avatar, reputation, onboarding_completed, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
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
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
});

export default router;