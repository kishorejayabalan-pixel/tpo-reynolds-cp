-- AlterTable
ALTER TABLE "PromoEvent" ADD COLUMN "displaySupport" BOOLEAN DEFAULT false;
ALTER TABLE "PromoEvent" ADD COLUMN "featureAd" BOOLEAN DEFAULT false;
ALTER TABLE "PromoEvent" ADD COLUMN "promoType" TEXT;
