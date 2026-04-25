-- AlterTable
ALTER TABLE "projects" ADD COLUMN "invoiceDueMode" "InvoiceDueMode" NOT NULL DEFAULT 'UPON_RECEIPT',
ADD COLUMN "invoiceNetDays" INTEGER,
ADD COLUMN "invoicePoNumber" VARCHAR(500),
ADD COLUMN "invoiceTaxPercent" DECIMAL(5,2),
ADD COLUMN "invoiceSecondTaxEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invoiceSecondTaxPercent" DECIMAL(5,2),
ADD COLUMN "invoiceDiscountPercent" DECIMAL(5,2);
