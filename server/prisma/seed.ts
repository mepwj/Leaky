import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultExpenseCategories = [
  { name: '식비', icon: '🍚', sortOrder: 1 },
  { name: '카페/간식', icon: '☕', sortOrder: 2 },
  { name: '교통', icon: '🚌', sortOrder: 3 },
  { name: '쇼핑', icon: '🛍️', sortOrder: 4 },
  { name: '생활', icon: '🏠', sortOrder: 5 },
  { name: '주거/통신', icon: '📱', sortOrder: 6 },
  { name: '의료/건강', icon: '🏥', sortOrder: 7 },
  { name: '문화/여가', icon: '🎬', sortOrder: 8 },
  { name: '교육', icon: '📚', sortOrder: 9 },
  { name: '경조사', icon: '💐', sortOrder: 10 },
  { name: '보험/세금', icon: '📋', sortOrder: 11 },
  { name: '이체/저축', icon: '💰', sortOrder: 12 },
  { name: '기타', icon: '➕', sortOrder: 13 },
];

const defaultIncomeCategories = [
  { name: '급여', icon: '💵', sortOrder: 1 },
  { name: '부수입', icon: '💼', sortOrder: 2 },
  { name: '용돈', icon: '🎁', sortOrder: 3 },
  { name: '금융수입', icon: '📈', sortOrder: 4 },
  { name: '환불', icon: '🔄', sortOrder: 5 },
  { name: '기타', icon: '➕', sortOrder: 6 },
];

async function main() {
  console.log('Seeding default categories...');

  // Check if default categories already exist
  const existingDefaults = await prisma.category.count({
    where: { isDefault: true, userId: null },
  });

  if (existingDefaults > 0) {
    console.log(`Found ${existingDefaults} existing default categories. Skipping seed.`);
    return;
  }

  // Insert expense categories
  for (const category of defaultExpenseCategories) {
    await prisma.category.create({
      data: {
        type: 'expense',
        name: category.name,
        icon: category.icon,
        sortOrder: category.sortOrder,
        isDefault: true,
        userId: null,
      },
    });
  }

  console.log(`Inserted ${defaultExpenseCategories.length} default expense categories.`);

  // Insert income categories
  for (const category of defaultIncomeCategories) {
    await prisma.category.create({
      data: {
        type: 'income',
        name: category.name,
        icon: category.icon,
        sortOrder: category.sortOrder,
        isDefault: true,
        userId: null,
      },
    });
  }

  console.log(`Inserted ${defaultIncomeCategories.length} default income categories.`);
  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
