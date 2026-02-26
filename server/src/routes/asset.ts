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
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
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

    const maxSort = await prisma.account.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });

    const account = await prisma.account.create({
      data: {
        userId,
        bankName: bankName.trim(),
        alias: alias ? String(alias).trim() : null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        balance: balance !== undefined && balance !== null ? Number(balance) : 0,
        balanceSyncDate: new Date(),
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
router.patch('/accounts/:id(\\d+)', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
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
      data.balanceSyncDate = new Date();
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
router.delete('/accounts/:id(\\d+)', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
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

// PATCH /assets/accounts/reorder
// 계좌 정렬 순서를 일괄 업데이트.
router.patch('/accounts/reorder', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0 || !orderedIds.every((id) => Number.isInteger(id))) {
      res.status(400).json({ error: 'orderedIds must be a non-empty array of integers.' });
      return;
    }

    const uniqueIds = Array.from(new Set(orderedIds.map((id) => Number(id))));
    if (uniqueIds.length !== orderedIds.length) {
      res.status(400).json({ error: 'orderedIds must not contain duplicates.' });
      return;
    }

    const ownedAccounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    if (ownedAccounts.length !== uniqueIds.length) {
      res.status(400).json({ error: 'orderedIds must include all account IDs.' });
      return;
    }

    const ownedIdSet = new Set(ownedAccounts.map((item) => item.id));
    if (!uniqueIds.every((id) => ownedIdSet.has(id))) {
      res.status(400).json({ error: 'orderedIds contains invalid account ID.' });
      return;
    }

    await prisma.$transaction(
      uniqueIds.map((id, index) => prisma.account.update({
        where: { id },
        data: { sortOrder: index },
      })),
    );

    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    res.json({ accounts });
  } catch (error) {
    console.error('Reorder accounts error:', error);
    res.status(500).json({ error: 'Failed to reorder accounts.' });
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
      include: { linkedAccount: true },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
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
    const { cardCompany, alias, cardType, paymentDay, linkedAccountId } = req.body;

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

    // 카드 타입 검증
    if (cardType && !['credit', 'check'].includes(cardType)) {
      res.status(400).json({ error: 'cardType must be "credit" or "check".' });
      return;
    }

    // 체크카드일 때 연결 계좌 필수
    if (cardType === 'check' && !linkedAccountId) {
      res.status(400).json({ error: 'linkedAccountId is required for check cards.' });
      return;
    }

    // 연결 계좌 소유권 확인
    if (linkedAccountId) {
      const linkedAccount = await prisma.account.findUnique({ where: { id: Number(linkedAccountId) } });
      if (!linkedAccount || linkedAccount.userId !== userId) {
        res.status(400).json({ error: 'Invalid linkedAccountId.' });
        return;
      }
    }

    const maxSort = await prisma.card.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });

    const card = await prisma.card.create({
      data: {
        userId,
        cardCompany: cardCompany.trim(),
        alias: alias ? String(alias).trim() : null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        cardType: cardType || 'credit',
        paymentDay: paymentDay !== undefined && paymentDay !== null ? Number(paymentDay) : null,
        linkedAccountId: linkedAccountId ? Number(linkedAccountId) : null,
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
router.patch('/cards/:id(\\d+)', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
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

    const { cardCompany, alias, cardType, paymentDay, linkedAccountId } = req.body;

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

    if (cardType !== undefined) {
      if (!['credit', 'check'].includes(cardType)) {
        res.status(400).json({ error: 'cardType must be "credit" or "check".' });
        return;
      }
      data.cardType = cardType;
    }

    if (linkedAccountId !== undefined) {
      if (linkedAccountId === null) {
        data.linkedAccountId = null;
      } else {
        const linkedAccount = await prisma.account.findUnique({ where: { id: Number(linkedAccountId) } });
        if (!linkedAccount || linkedAccount.userId !== userId) {
          res.status(400).json({ error: 'Invalid linkedAccountId.' });
          return;
        }
        data.linkedAccountId = Number(linkedAccountId);
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
router.delete('/cards/:id(\\d+)', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
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

// PATCH /assets/cards/reorder
// 카드 정렬 순서를 일괄 업데이트.
router.patch('/cards/reorder', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0 || !orderedIds.every((id) => Number.isInteger(id))) {
      res.status(400).json({ error: 'orderedIds must be a non-empty array of integers.' });
      return;
    }

    const uniqueIds = Array.from(new Set(orderedIds.map((id) => Number(id))));
    if (uniqueIds.length !== orderedIds.length) {
      res.status(400).json({ error: 'orderedIds must not contain duplicates.' });
      return;
    }

    const ownedCards = await prisma.card.findMany({
      where: { userId },
      select: { id: true },
    });

    if (ownedCards.length !== uniqueIds.length) {
      res.status(400).json({ error: 'orderedIds must include all card IDs.' });
      return;
    }

    const ownedIdSet = new Set(ownedCards.map((item) => item.id));
    if (!uniqueIds.every((id) => ownedIdSet.has(id))) {
      res.status(400).json({ error: 'orderedIds contains invalid card ID.' });
      return;
    }

    await prisma.$transaction(
      uniqueIds.map((id, index) => prisma.card.update({
        where: { id },
        data: { sortOrder: index },
      })),
    );

    const cards = await prisma.card.findMany({
      where: { userId },
      include: { linkedAccount: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    res.json({ cards });
  } catch (error) {
    console.error('Reorder cards error:', error);
    res.status(500).json({ error: 'Failed to reorder cards.' });
  }
});

// ─── 현금 엔드포인트 ────────────────────────────────────────────

// GET /assets/cash
router.get('/cash', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cashBalance: true, cashSyncDate: true },
    });
    res.json({ cashBalance: user ? Number(user.cashBalance) : 0, cashSyncDate: user ? user.cashSyncDate : null });
  } catch (error) {
    console.error('Get cash balance error:', error);
    res.status(500).json({ error: 'Failed to get cash balance.' });
  }
});

// PATCH /assets/cash
router.patch('/cash', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { balance } = req.body;

    if (balance === undefined || balance === null || isNaN(Number(balance))) {
      res.status(400).json({ error: 'balance must be a valid number.' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { cashBalance: Number(balance), cashSyncDate: new Date() },
      select: { cashBalance: true, cashSyncDate: true },
    });

    res.json({ cashBalance: Number(user.cashBalance), cashSyncDate: user.cashSyncDate });
  } catch (error) {
    console.error('Update cash balance error:', error);
    res.status(500).json({ error: 'Failed to update cash balance.' });
  }
});

// POST /assets/accounts/:id/sync - 잔액 맞추기
router.post('/accounts/:id(\\d+)/sync', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);
    const { balance } = req.body;

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid account ID.' });
      return;
    }

    if (balance === undefined || balance === null || isNaN(Number(balance))) {
      res.status(400).json({ error: 'balance must be a valid number.' });
      return;
    }

    const existing = await prisma.account.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    if (existing.userId !== userId) {
      res.status(403).json({ error: 'You can only sync your own accounts.' });
      return;
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        balance: Number(balance),
        balanceSyncDate: new Date(),
      },
    });

    res.json({ account });
  } catch (error) {
    console.error('Sync account balance error:', error);
    res.status(500).json({ error: 'Failed to sync account balance.' });
  }
});

// POST /assets/cash/sync - 현금 잔액 맞추기
router.post('/cash/sync', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { balance } = req.body;

    if (balance === undefined || balance === null || isNaN(Number(balance))) {
      res.status(400).json({ error: 'balance must be a valid number.' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        cashBalance: Number(balance),
        cashSyncDate: new Date(),
      },
      select: { cashBalance: true, cashSyncDate: true },
    });

    res.json({ cashBalance: Number(user.cashBalance), cashSyncDate: user.cashSyncDate });
  } catch (error) {
    console.error('Sync cash balance error:', error);
    res.status(500).json({ error: 'Failed to sync cash balance.' });
  }
});

// ─── 요약 엔드포인트 ─────────────────────────────────────────────

// GET /assets/summary
// 총 잔액(계좌 잔액 합산 + 현금), 계좌 수, 카드 수를 반환.
router.get('/summary', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;

    const [accounts, cardCount, user] = await Promise.all([
      prisma.account.findMany({
        where: { userId },
        select: { balance: true },
      }),
      prisma.card.count({
        where: { userId },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { cashBalance: true },
      }),
    ]);

    const cashBalance = user ? Number(user.cashBalance) : 0;
    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0) + cashBalance;

    res.json({
      summary: {
        totalBalance,
        accountCount: accounts.length,
        cardCount,
        cashBalance,
      },
    });
  } catch (error) {
    console.error('Get asset summary error:', error);
    res.status(500).json({ error: 'Failed to get asset summary.' });
  }
});

export default router;
