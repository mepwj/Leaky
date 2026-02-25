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
// Google ID 토큰을 받아 검증 후 사용자를 생성하거나 찾아 JWT를 반환
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ error: 'idToken is required.' });
      return;
    }

    // Google ID 토큰 검증
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

    // 사용자 찾기 또는 생성
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
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed.' });
  }
});

// POST /auth/signup
// 이메일 + 비밀번호 회원가입. 인증 토큰과 함께 사용자를 생성.
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format.' });
      return;
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    // 이미 존재하는 사용자인지 확인
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email is already registered.' });
      return;
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 인증 토큰 생성
    const verificationToken = uuidv4();

    // 사용자 생성
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

    // TODO: 프로덕션에서는 토큰 반환 대신 인증 이메일 발송
    res.status(201).json({
      token,
      verificationToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        provider: user.provider,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed.' });
  }
});

// POST /auth/login
// 이메일 + 비밀번호 로그인. 이메일 인증 여부를 확인.
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // 로그인 제공자 확인 - Google 사용자는 Google 로그인을 사용해야 함
    if (user.provider === 'google') {
      res.status(400).json({ error: 'This account uses Google login. Please sign in with Google.' });
      return;
    }

    // 비밀번호 검증
    if (!user.password) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // 이메일 인증 여부 확인
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
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// POST /auth/verify-email
// 인증 토큰을 사용하여 이메일을 인증.
router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { verificationToken } = req.body;

    if (!verificationToken) {
      res.status(400).json({ error: 'Verification token is required.' });
      return;
    }

    // 해당 토큰을 가진 사용자 조회
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

    // 이메일 인증 완료 처리 및 토큰 삭제
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
// 인증이 필요한 라우트. 현재 사용자 정보를 반환.
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
        onboardingCompleted: true,
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

// PATCH /auth/profile
// 인증이 필요한 라우트. 사용자 닉네임을 업데이트하고 온보딩 완료를 표시.
router.patch('/profile', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { nickname } = req.body;

    if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
      res.status(400).json({ error: 'Nickname is required.' });
      return;
    }

    const trimmedNickname = nickname.trim();

    if (trimmedNickname.length > 20) {
      res.status(400).json({ error: 'Nickname must be 20 characters or less.' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        nickname: trimmedNickname,
        onboardingCompleted: true,
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        provider: true,
        emailVerified: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
