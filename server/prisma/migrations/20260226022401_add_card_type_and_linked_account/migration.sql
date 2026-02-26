-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "cardType" TEXT NOT NULL DEFAULT 'credit',
ADD COLUMN     "linkedAccountId" INTEGER;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
