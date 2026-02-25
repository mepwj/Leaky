import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, JwtPayload } from '../middleware/auth';

const router = Router();

// GET /categories
// 기본 카테고리(userId가 null) + 사용자 커스텀 카테고리를 반환.
// 선택적 쿼리 파라미터 지원: ?type=income 또는 ?type=expense
// 결과는 sortOrder 기준으로 정렬.
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { type } = req.query;

    // 타입이 제공된 경우 검증
    if (type && type !== 'income' && type !== 'expense') {
      res.status(400).json({ error: 'Invalid type. Must be "income" or "expense".' });
      return;
    }

    // where 조건 구성: 기본 카테고리(userId null) + 사용자 커스텀 카테고리
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      OR: [
        { userId: null },
        { userId },
      ],
    };

    if (type) {
      where.type = type as string;
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        type: true,
        name: true,
        icon: true,
        sortOrder: true,
        isDefault: true,
        userId: true,
      },
    });

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories.' });
  }
});

export default router;
