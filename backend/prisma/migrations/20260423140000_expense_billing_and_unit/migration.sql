ALTER TABLE "expenses" ADD COLUMN "isBillable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "expenses" ADD COLUMN "isReimbursable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "expenses" ADD COLUMN "unitQuantity" DECIMAL(18,4);
