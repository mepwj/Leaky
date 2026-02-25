import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { generateToken, authMiddleware, JwtPayload } from '../middleware/auth';

const router = Router();

const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);

const SALT_ROUNDS = 12;

// POST /auth/google
// Receives Google ID token, verifies it, creates/finds user, returns JWT
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ error: 'idToken is required.' });
      return;
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_WEB_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ error: 'Invalid Google token.' });
      return;
    }

    const { email, name } = payload;

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          nickname: name || null,
          provider: 'google',
          emailVerified: true,
        },
      });
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        provider: user.provider,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed.' });
  }
});

// POST /auth/signup
// Email + password signup. Creates user with verification token.
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format.' });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email is already registered.' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate verification token
    const verificationToken = uuidv4();

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        provider: 'email',
        emailVerified: false,
        verificationToken,
      },
    });

    const token = generateToken({ userId: user.id, email: user.email });

    // TODO: In production, send verification email instead of returning the token
    res.status(201).json({
      token,
      verificationToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        provider: user.provider,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed.' });
  }
});

// POST /auth/login
// Email + password login. Checks emailVerified status.
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Check provider - Google users should use Google login
    if (user.provider === 'google') {
      res.status(400).json({ error: 'This account uses Google login. Please sign in with Google.' });
      return;
    }

    // Verify password
    if (!user.password) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Check email verification
    if (!user.emailVerified) {
      res.status(403).json({ error: 'Email not verified. Please verify your email first.' });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        provider: user.provider,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// POST /auth/verify-email
// Verifies email using the verification token.
router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { verificationToken } = req.body;

    if (!verificationToken) {
      res.status(400).json({ error: 'Verification token is required.' });
      return;
    }

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: { verificationToken },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid verification token.' });
      return;
    }

    if (user.emailVerified) {
      res.json({ message: 'Email is already verified.' });
      return;
    }

    // Mark email as verified and clear the token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    res.json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed.' });
  }
});

// GET /auth/me
// Protected route. Returns current user info.
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        provider: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info.' });
  }
});

export default router;
