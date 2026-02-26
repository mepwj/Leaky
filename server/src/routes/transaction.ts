import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, JwtPayload } from '../middleware/auth';

const router = Router();

// GET /transactions?month=YYYY-MM
// 지정된 월의 모든 거래내역을 카테고리 포함하여 반환.
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { month } = req.query;

    if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'month query parameter is required (YYYY-MM format).' });
      return;
    }

    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        category: true,
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ transactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions.' });
  }
});

// GET /transactions/summary?month=YYYY-MM
// 지정된 월의 일별 수입/지출 요약을 반환.
// 응답: { [date: string]: { income: number, expense: number } }
router.get('/summary', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { month } = req.query;

    if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'month query parameter is required (YYYY-MM format).' });
      return;
    }

    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: {
        type: true,
        amount: true,
        date: true,
      },
    });

    const summary: Record<string, { income: number; expense: number }> = {};

    for (const tx of transactions) {
      // 날짜를 YYYY-MM-DD 형식으로 변환
      const dateKey = tx.date.toISOString().split('T')[0];
      if (!summary[dateKey]) {
        summary[dateKey] = { income: 0, expense: 0 };
      }
      const amount = Number(tx.amount);
      if (tx.type === 'income') {
        summary[dateKey].income += amount;
      } else {
        summary[dateKey].expense += amount;
      }
    }

    res.json({ summary });
  } catch (error) {
    console.error('Get transaction summary error:', error);
    res.status(500).json({ error: 'Failed to get transaction summary.' });
  }
});

// POST /transactions
// 새로운 거래내역을 생성.
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { type, title, amount, categoryId, paymentMethod, paymentSourceId, memo, date } = req.body;

    // 타입 검증
    if (!type || !['income', 'expense'].includes(type)) {
      res.status(400).json({ error: 'type must be "income" or "expense".' });
      return;
    }

    // 금액 검증
    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ error: 'amount must be a positive number.' });
      return;
    }

    // 결제수단 검증
    if (!paymentMethod || !['cash', 'account', 'card'].includes(paymentMethod)) {
      res.status(400).json({ error: 'paymentMethod must be "cash", "account", or "card".' });
      return;
    }

    // 날짜 검증
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date is required (YYYY-MM-DD format).' });
      return;
    }

    // 거래내역 데이터 구성
    const data: {
      userId: number;
      type: string;
      title?: string;
      amount: number;
      paymentMethod: string;
      date: Date;
      categoryId?: number;
      accountId?: number;
      cardId?: number;
      memo?: string;
    } = {
      userId,
      type,
      amount: Number(amount),
      paymentMethod,
      date: new Date(date + 'T00:00:00.000Z'),
    };

    if (categoryId) {
      data.categoryId = Number(categoryId);
    }

    if (typeof title === 'string') {
      const trimmedTitle = title.trim();
      if (trimmedTitle) {
        data.title = trimmedTitle;
      }
    }

    if (memo) {
      data.memo = String(memo);
    }

    // 결제수단에 따라 accountId 또는 cardId 설정
    if (paymentMethod === 'account' && paymentSourceId) {
      data.accountId = Number(paymentSourceId);
    } else if (paymentMethod === 'card' && paymentSourceId) {
      data.cardId = Number(paymentSourceId);
    }

    const result = await prisma.transaction.create({
      data,
      include: { category: true },
    });

    res.status(201).json({ transaction: result });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction.' });
  }
});

// PATCH /transactions/:id
// 거래내역을 수정. 소유권 확인 필수. POST와 동일한 검증 적용.
router.patch('/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid transaction ID.' });
      return;
    }

    // 소유권 확인
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    if (transaction.userId !== userId) {
      res.status(403).json({ error: 'You can only update your own transactions.' });
      return;
    }

    const { type, title, amount, categoryId, paymentMethod, paymentSourceId, memo, date } = req.body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    // 타입 검증
    if (type !== undefined) {
      if (!['income', 'expense'].includes(type)) {
        res.status(400).json({ error: 'type must be "income" or "expense".' });
        return;
      }
      data.type = type;
    }

    // 금액 검증
    if (amount !== undefined) {
      if (amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
        res.status(400).json({ error: 'amount must be a positive number.' });
        return;
      }
      data.amount = Number(amount);
    }

    // 제목 설정
    if (title !== undefined) {
      if (title === null) {
        data.title = null;
      } else {
        const trimmedTitle = String(title).trim();
        data.title = trimmedTitle || null;
      }
    }

    // 카테고리 설정
    if (categoryId !== undefined) {
      data.categoryId = categoryId ? Number(categoryId) : null;
    }

    // 결제수단 검증
    if (paymentMethod !== undefined) {
      if (!['cash', 'account', 'card'].includes(paymentMethod)) {
        res.status(400).json({ error: 'paymentMethod must be "cash", "account", or "card".' });
        return;
      }
      data.paymentMethod = paymentMethod;
    }

    // 결제수단에 따라 accountId 또는 cardId 설정
    const effectivePaymentMethod = paymentMethod ?? transaction.paymentMethod;
    if (paymentSourceId !== undefined) {
      // 기존 연결 초기화
      data.accountId = null;
      data.cardId = null;
      if (effectivePaymentMethod === 'account' && paymentSourceId) {
        data.accountId = Number(paymentSourceId);
      } else if (effectivePaymentMethod === 'card' && paymentSourceId) {
        data.cardId = Number(paymentSourceId);
      }
    }

    // 메모 설정
    if (memo !== undefined) {
      data.memo = memo ? String(memo) : null;
    }

    // 날짜 검증
    if (date !== undefined) {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });
        return;
      }
      data.date = new Date(date + 'T00:00:00.000Z');
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data,
      include: { category: true },
    });

    res.json({ transaction: updated });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
});

// DELETE /transactions/:id
// 현재 사용자가 소유한 거래내역을 삭제.
router.delete('/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid transaction ID.' });
      return;
    }

    // 소유권 확인
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    if (transaction.userId !== userId) {
      res.status(403).json({ error: 'You can only delete your own transactions.' });
      return;
    }

    await prisma.transaction.delete({
      where: { id },
    });

    res.json({ message: 'Transaction deleted successfully.' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction.' });
  }
});

export default router;
