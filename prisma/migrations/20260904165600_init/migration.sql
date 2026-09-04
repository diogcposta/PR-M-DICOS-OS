-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('APPOINTMENTS', 'PRODUCTION_BILLING', 'BUDGETS', 'PATIENT_STATUS', 'OUTSTANDING_BALANCES');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'PARSED', 'MAPPED', 'VALIDATED', 'COMMITTED', 'REJECTED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ImportErrorSeverity" AS ENUM ('WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FinancialFactType" AS ENUM ('PRODUCTION', 'INVOICE', 'DEBT');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('PRESENTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PatientActivityStatus" AS ENUM ('ACTIVE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Lisbon',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioners" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT,
    "displayName" TEXT NOT NULL,
    "specialty" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practitioners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "importProfileId" TEXT,
    "importProfileVersion" INTEGER,
    "rowsTotal" INTEGER NOT NULL DEFAULT 0,
    "rowsValid" INTEGER NOT NULL DEFAULT 0,
    "rowsInvalid" INTEGER NOT NULL DEFAULT 0,
    "rowsCommitted" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_row_errors" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "columnName" TEXT,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "ImportErrorSeverity" NOT NULL DEFAULT 'ERROR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_row_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_facts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "practitionerId" TEXT,
    "patientExternalRef" TEXT,
    "sourceRecordId" TEXT,
    "stableRowKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL,
    "sourceStatusLabel" TEXT,
    "durationMinutes" INTEGER,
    "importBatchId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_facts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "practitionerId" TEXT,
    "patientExternalRef" TEXT,
    "sourceRecordId" TEXT,
    "stableRowKey" TEXT NOT NULL,
    "type" "FinancialFactType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_facts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "practitionerId" TEXT,
    "patientExternalRef" TEXT,
    "sourceRecordId" TEXT,
    "stableRowKey" TEXT NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'UNKNOWN',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "presentedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "importBatchId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_status_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientExternalRef" TEXT,
    "sourceRecordId" TEXT,
    "stableRowKey" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "status" "PatientActivityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "sourceStatusLabel" TEXT,
    "outstandingCents" INTEGER,
    "lastAppointmentAt" TIMESTAMP(3),
    "nextAppointmentAt" TIMESTAMP(3),
    "importBatchId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_status_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "clinics_organizationId_idx" ON "clinics"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "clinics_organizationId_externalId_key" ON "clinics"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "practitioners_organizationId_idx" ON "practitioners"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "practitioners_organizationId_externalId_key" ON "practitioners"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "import_profiles_organizationId_sourceType_idx" ON "import_profiles"("organizationId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "import_profiles_organizationId_key_version_key" ON "import_profiles"("organizationId", "key", "version");

-- CreateIndex
CREATE INDEX "import_batches_organizationId_fileHash_idx" ON "import_batches"("organizationId", "fileHash");

-- CreateIndex
CREATE INDEX "import_batches_organizationId_status_idx" ON "import_batches"("organizationId", "status");

-- CreateIndex
CREATE INDEX "import_batches_organizationId_uploadedAt_idx" ON "import_batches"("organizationId", "uploadedAt");

-- CreateIndex
CREATE INDEX "import_row_errors_importBatchId_sourceRowNumber_idx" ON "import_row_errors"("importBatchId", "sourceRowNumber");

-- CreateIndex
CREATE INDEX "import_row_errors_importBatchId_severity_idx" ON "import_row_errors"("importBatchId", "severity");

-- CreateIndex
CREATE INDEX "appointment_facts_organizationId_occurredAt_idx" ON "appointment_facts"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "appointment_facts_organizationId_clinicId_occurredAt_idx" ON "appointment_facts"("organizationId", "clinicId", "occurredAt");

-- CreateIndex
CREATE INDEX "appointment_facts_organizationId_practitionerId_occurredAt_idx" ON "appointment_facts"("organizationId", "practitionerId", "occurredAt");

-- CreateIndex
CREATE INDEX "appointment_facts_organizationId_status_occurredAt_idx" ON "appointment_facts"("organizationId", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "appointment_facts_importBatchId_idx" ON "appointment_facts"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_facts_organizationId_stableRowKey_key" ON "appointment_facts"("organizationId", "stableRowKey");

-- CreateIndex
CREATE INDEX "financial_facts_organizationId_type_occurredAt_idx" ON "financial_facts"("organizationId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "financial_facts_organizationId_clinicId_type_occurredAt_idx" ON "financial_facts"("organizationId", "clinicId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "financial_facts_organizationId_practitionerId_type_occurred_idx" ON "financial_facts"("organizationId", "practitionerId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "financial_facts_importBatchId_idx" ON "financial_facts"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_facts_organizationId_stableRowKey_key" ON "financial_facts"("organizationId", "stableRowKey");

-- CreateIndex
CREATE INDEX "budget_facts_organizationId_presentedAt_idx" ON "budget_facts"("organizationId", "presentedAt");

-- CreateIndex
CREATE INDEX "budget_facts_organizationId_clinicId_status_presentedAt_idx" ON "budget_facts"("organizationId", "clinicId", "status", "presentedAt");

-- CreateIndex
CREATE INDEX "budget_facts_importBatchId_idx" ON "budget_facts"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_facts_organizationId_stableRowKey_key" ON "budget_facts"("organizationId", "stableRowKey");

-- CreateIndex
CREATE INDEX "patient_status_snapshots_organizationId_snapshotDate_idx" ON "patient_status_snapshots"("organizationId", "snapshotDate");

-- CreateIndex
CREATE INDEX "patient_status_snapshots_organizationId_clinicId_snapshotDa_idx" ON "patient_status_snapshots"("organizationId", "clinicId", "snapshotDate");

-- CreateIndex
CREATE INDEX "patient_status_snapshots_importBatchId_idx" ON "patient_status_snapshots"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_status_snapshots_organizationId_stableRowKey_key" ON "patient_status_snapshots"("organizationId", "stableRowKey");

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_profiles" ADD CONSTRAINT "import_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_importProfileId_fkey" FOREIGN KEY ("importProfileId") REFERENCES "import_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row_errors" ADD CONSTRAINT "import_row_errors_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_facts" ADD CONSTRAINT "appointment_facts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_facts" ADD CONSTRAINT "appointment_facts_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_facts" ADD CONSTRAINT "appointment_facts_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_facts" ADD CONSTRAINT "appointment_facts_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_facts" ADD CONSTRAINT "financial_facts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_facts" ADD CONSTRAINT "financial_facts_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_facts" ADD CONSTRAINT "financial_facts_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_facts" ADD CONSTRAINT "financial_facts_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_facts" ADD CONSTRAINT "budget_facts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_facts" ADD CONSTRAINT "budget_facts_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_facts" ADD CONSTRAINT "budget_facts_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_facts" ADD CONSTRAINT "budget_facts_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_status_snapshots" ADD CONSTRAINT "patient_status_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_status_snapshots" ADD CONSTRAINT "patient_status_snapshots_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_status_snapshots" ADD CONSTRAINT "patient_status_snapshots_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
