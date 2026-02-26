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

// POST /categories
// 사용자 커스텀 카테고리를 생성. sortOrder는 기존 최대값 + 1로 자동 할당.
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const { type, name, icon } = req.body;

    // 타입 검증
    if (!type || !['income', 'expense'].includes(type)) {
      res.status(400).json({ error: 'type must be "income" or "expense".' });
      return;
    }

    // 이름 검증
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required.' });
      return;
    }

    // 기존 카테고리의 최대 sortOrder 조회하여 +1 자동 할당
    const maxSortOrder = await prisma.category.aggregate({
      _max: { sortOrder: true },
      where: {
        OR: [
          { userId: null },
          { userId },
        ],
        type: type as string,
      },
    });

    const nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1;

    const category = await prisma.category.create({
      data: {
        type,
        name: name.trim(),
        icon: icon ? String(icon) : null,
        userId,
        isDefault: false,
        sortOrder: nextSortOrder,
      },
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

    res.status(201).json({ category });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// PATCH /categories/:id
// 사용자 소유 카테고리만 수정 가능. 기본 카테고리(userId=null)는 수정 불가.
router.patch('/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }

    // 소유권 확인: 사용자 소유 카테고리만 수정 가능
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    if (category.userId === null || category.userId !== userId) {
      res.status(403).json({ error: 'You can only update your own custom categories.' });
      return;
    }

    const { name, icon, sortOrder } = req.body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'name must be a non-empty string.' });
        return;
      }
      data.name = name.trim();
    }

    if (icon !== undefined) {
      data.icon = icon ? String(icon) : null;
    }

    if (sortOrder !== undefined) {
      if (isNaN(Number(sortOrder))) {
        res.status(400).json({ error: 'sortOrder must be a number.' });
        return;
      }
      data.sortOrder = Number(sortOrder);
    }

    const updated = await prisma.category.update({
      where: { id },
      data,
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

    res.json({ category: updated });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

// DELETE /categories/:id
// 사용자 소유 카테고리만 삭제 가능. 기본 카테고리(userId=null)는 삭제 불가.
router.delete('/:id', authMiddleware, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.user as JwtPayload;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }

    // 소유권 확인: 사용자 소유 카테고리만 삭제 가능
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    if (category.userId === null || category.userId !== userId) {
      res.status(403).json({ error: 'You can only delete your own custom categories.' });
      return;
    }

    await prisma.category.delete({
      where: { id },
    });

    res.json({ message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

export default router;
