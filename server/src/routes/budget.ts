import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, JwtPayload } from '../middleware/auth';

const router = Router();

// GET /budgets?month=YYYY-MM
// 지정된 월의 모든 예산을 카테고리 포함하여 반환. 예산이 없으면 빈 배열 반환.
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { month } = req.query;

    if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'month query parameter is required (YYYY-MM format).' });
      return;
    }

    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        month: month as string,
      },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ budgets });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Failed to get budgets.' });
  }
});

// POST /budgets
// 새로운 예산을 생성. categoryId가 null이면 전체 월 예산을 의미.
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { categoryId, amount, month } = req.body;

    // 금액 검증
    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ error: 'amount must be a positive number.' });
      return;
    }

    // 월 형식 검증
    if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'month is required (YYYY-MM format).' });
      return;
    }

    const budget = await prisma.budget.create({
      data: {
        userId,
        categoryId: categoryId != null ? Number(categoryId) : null,
        amount: Number(amount),
        month,
      },
      include: {
        category: true,
      },
    });

    res.status(201).json({ budget });
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({ error: 'Failed to create budget.' });
  }
});

// PATCH /budgets/:id
// 예산 금액을 수정. 소유권 확인 필수.
router.patch('/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid budget ID.' });
      return;
    }

    const { amount } = req.body;

    // 금액 검증
    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ error: 'amount must be a positive number.' });
      return;
    }

    // 소유권 확인
    const budget = await prisma.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      res.status(404).json({ error: 'Budget not found.' });
      return;
    }

    if (budget.userId !== userId) {
      res.status(403).json({ error: 'You can only update your own budgets.' });
      return;
    }

    const updated = await prisma.budget.update({
      where: { id },
      data: { amount: Number(amount) },
      include: {
        category: true,
      },
    });

    res.json({ budget: updated });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({ error: 'Failed to update budget.' });
  }
});

// DELETE /budgets/:id
// 예산을 삭제. 소유권 확인 필수.
router.delete('/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid budget ID.' });
      return;
    }

    // 소유권 확인
    const budget = await prisma.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      res.status(404).json({ error: 'Budget not found.' });
      return;
    }

    if (budget.userId !== userId) {
      res.status(403).json({ error: 'You can only delete your own budgets.' });
      return;
    }

    await prisma.budget.delete({
      where: { id },
    });

    res.json({ message: 'Budget deleted successfully.' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ error: 'Failed to delete budget.' });
  }
});

export default router;
