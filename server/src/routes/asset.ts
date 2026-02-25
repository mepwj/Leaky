import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, JwtPayload } from '../middleware/auth';

const router = Router();

// ─── 계좌 엔드포인트 ────────────────────────────────────────────

// GET /assets/accounts
// 인증된 사용자의 모든 계좌를 반환.
router.get('/accounts', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;

    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ accounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to get accounts.' });
  }
});

// POST /assets/accounts
// 새로운 계좌를 생성.
router.post('/accounts', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { bankName, alias, balance } = req.body;

    if (!bankName || typeof bankName !== 'string' || !bankName.trim()) {
      res.status(400).json({ error: 'bankName is required.' });
      return;
    }

    const account = await prisma.account.create({
      data: {
        userId,
        bankName: bankName.trim(),
        alias: alias ? String(alias).trim() : null,
        balance: balance !== undefined && balance !== null ? Number(balance) : 0,
      },
    });

    res.status(201).json({ account });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

// PATCH /assets/accounts/:id
// 현재 사용자가 소유한 계좌를 수정.
router.patch('/accounts/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid account ID.' });
      return;
    }

    // 소유권 확인
    const existing = await prisma.account.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    if (existing.userId !== userId) {
      res.status(403).json({ error: 'You can only update your own accounts.' });
      return;
    }

    const { bankName, alias, balance } = req.body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (bankName !== undefined) {
      if (typeof bankName !== 'string' || !bankName.trim()) {
        res.status(400).json({ error: 'bankName must be a non-empty string.' });
        return;
      }
      data.bankName = bankName.trim();
    }

    if (alias !== undefined) {
      data.alias = alias ? String(alias).trim() : null;
    }

    if (balance !== undefined) {
      if (isNaN(Number(balance))) {
        res.status(400).json({ error: 'balance must be a valid number.' });
        return;
      }
      data.balance = Number(balance);
    }

    const account = await prisma.account.update({
      where: { id },
      data,
    });

    res.json({ account });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account.' });
  }
});

// DELETE /assets/accounts/:id
// 현재 사용자가 소유한 계좌를 삭제.
router.delete('/accounts/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid account ID.' });
      return;
    }

    // 소유권 확인
    const existing = await prisma.account.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    if (existing.userId !== userId) {
      res.status(403).json({ error: 'You can only delete your own accounts.' });
      return;
    }

    await prisma.account.delete({ where: { id } });

    res.json({ message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// ─── 카드 엔드포인트 ───────────────────────────────────────────

// GET /assets/cards
// 인증된 사용자의 모든 카드를 반환.
router.get('/cards', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;

    const cards = await prisma.card.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ cards });
  } catch (error) {
    console.error('Get cards error:', error);
    res.status(500).json({ error: 'Failed to get cards.' });
  }
});

// POST /assets/cards
// 새로운 카드를 생성.
router.post('/cards', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { cardCompany, alias, paymentDay } = req.body;

    if (!cardCompany || typeof cardCompany !== 'string' || !cardCompany.trim()) {
      res.status(400).json({ error: 'cardCompany is required.' });
      return;
    }

    if (paymentDay !== undefined && paymentDay !== null) {
      const day = Number(paymentDay);
      if (isNaN(day) || day < 1 || day > 31) {
        res.status(400).json({ error: 'paymentDay must be between 1 and 31.' });
        return;
      }
    }

    const card = await prisma.card.create({
      data: {
        userId,
        cardCompany: cardCompany.trim(),
        alias: alias ? String(alias).trim() : null,
        paymentDay: paymentDay !== undefined && paymentDay !== null ? Number(paymentDay) : null,
      },
    });

    res.status(201).json({ card });
  } catch (error) {
    console.error('Create card error:', error);
    res.status(500).json({ error: 'Failed to create card.' });
  }
});

// PATCH /assets/cards/:id
// 현재 사용자가 소유한 카드를 수정.
router.patch('/cards/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid card ID.' });
      return;
    }

    // 소유권 확인
    const existing = await prisma.card.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ error: 'Card not found.' });
      return;
    }

    if (existing.userId !== userId) {
      res.status(403).json({ error: 'You can only update your own cards.' });
      return;
    }

    const { cardCompany, alias, paymentDay } = req.body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (cardCompany !== undefined) {
      if (typeof cardCompany !== 'string' || !cardCompany.trim()) {
        res.status(400).json({ error: 'cardCompany must be a non-empty string.' });
        return;
      }
      data.cardCompany = cardCompany.trim();
    }

    if (alias !== undefined) {
      data.alias = alias ? String(alias).trim() : null;
    }

    if (paymentDay !== undefined) {
      if (paymentDay === null) {
        data.paymentDay = null;
      } else {
        const day = Number(paymentDay);
        if (isNaN(day) || day < 1 || day > 31) {
          res.status(400).json({ error: 'paymentDay must be between 1 and 31.' });
          return;
        }
        data.paymentDay = day;
      }
    }

    const card = await prisma.card.update({
      where: { id },
      data,
    });

    res.json({ card });
  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({ error: 'Failed to update card.' });
  }
});

// DELETE /assets/cards/:id
// 현재 사용자가 소유한 카드를 삭제.
router.delete('/cards/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid card ID.' });
      return;
    }

    // 소유권 확인
    const existing = await prisma.card.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ error: 'Card not found.' });
      return;
    }

    if (existing.userId !== userId) {
      res.status(403).json({ error: 'You can only delete your own cards.' });
      return;
    }

    await prisma.card.delete({ where: { id } });

    res.json({ message: 'Card deleted successfully.' });
  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).json({ error: 'Failed to delete card.' });
  }
});

// ─── 요약 엔드포인트 ─────────────────────────────────────────────

// GET /assets/summary
// 총 잔액(계좌 잔액 합산), 계좌 수, 카드 수를 반환.
router.get('/summary', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;

    const [accounts, cardCount] = await Promise.all([
      prisma.account.findMany({
        where: { userId },
        select: { balance: true },
      }),
      prisma.card.count({
        where: { userId },
      }),
    ]);

    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    res.json({
      summary: {
        totalBalance,
        accountCount: accounts.length,
        cardCount,
      },
    });
  } catch (error) {
    console.error('Get asset summary error:', error);
    res.status(500).json({ error: 'Failed to get asset summary.' });
  }
});

export default router;
