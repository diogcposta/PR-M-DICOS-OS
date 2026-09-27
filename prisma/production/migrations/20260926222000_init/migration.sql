-- CreateTable
CREATE TABLE "doctor_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "feeBps" INTEGER NOT NULL DEFAULT 5000,
    "feeBase" TEXT NOT NULL DEFAULT 'BILLED',
    "standardSlotMinutes" INTEGER NOT NULL DEFAULT 45,
    "saturdayMinutes" INTEGER NOT NULL DEFAULT 210,
    "primaryGoalCentsPerHour" INTEGER NOT NULL DEFAULT 10000,
    "targetNoShowBps" INTEGER NOT NULL DEFAULT 500,
    "followUpMinCents" INTEGER NOT NULL DEFAULT 50000,
    "followUpPriorityCents" INTEGER NOT NULL DEFAULT 150000,
    "followUpFirstAlertDays" INTEGER NOT NULL DEFAULT 7,
    "followUpSecondAlertDays" INTEGER NOT NULL DEFAULT 30,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Lisbon',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "schedule_blocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "schedule_blocks_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_goals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "centsPerHour" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "production_goals_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centsPerHour" INTEGER,
    "hoursPerMonth" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "scenarios_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clinical_days" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'WORKED',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "clinical_days_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clinical_cases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinical_cases_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "procedures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "caseId" TEXT,
    "date" TEXT NOT NULL,
    "procedureType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "listPriceCents" INTEGER NOT NULL,
    "billedCents" INTEGER NOT NULL,
    "payerType" TEXT NOT NULL DEFAULT 'PRIVATE',
    "payerName" TEXT,
    "plannedVisits" INTEGER NOT NULL DEFAULT 1,
    "labCostCents" INTEGER NOT NULL DEFAULT 0,
    "otherCostCents" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "procedures_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "procedures_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "clinical_cases" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "procedure_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "procedure_sessions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "procedure_sessions_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "procedure_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "plannedVisits" INTEGER NOT NULL DEFAULT 1,
    "labCostCents" INTEGER NOT NULL DEFAULT 0,
    "payerType" TEXT NOT NULL DEFAULT 'PRIVATE',
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "procedure_templates_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "absence_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "plannedProcedure" TEXT,
    "estimatedValueCents" INTEGER NOT NULL DEFAULT 0,
    "payerType" TEXT NOT NULL DEFAULT 'PRIVATE',
    "kind" TEXT NOT NULL,
    "slotRecovered" BOOLEAN NOT NULL DEFAULT false,
    "recoveredValueCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "absence_events_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "treatment_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "presentedDate" TEXT NOT NULL,
    "diagnosedCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "phases" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PRESENTED',
    "acceptedCents" INTEGER NOT NULL DEFAULT 0,
    "performedCents" INTEGER NOT NULL DEFAULT 0,
    "lastContactDate" TEXT,
    "nextAppointmentBooked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "treatment_plans_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "treatment_plans_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "clinical_cases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "production_imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "rowsTotal" INTEGER NOT NULL,
    "rowsImported" INTEGER NOT NULL,
    "rowsSkipped" INTEGER NOT NULL,
    "rowsInvalid" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_imports_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "schedule_blocks_doctorId_weekday_idx" ON "schedule_blocks"("doctorId", "weekday");

-- CreateIndex
CREATE INDEX "production_goals_doctorId_sortOrder_idx" ON "production_goals"("doctorId", "sortOrder");

-- CreateIndex
CREATE INDEX "scenarios_doctorId_sortOrder_idx" ON "scenarios"("doctorId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_days_doctorId_date_key" ON "clinical_days"("doctorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_cases_doctorId_code_key" ON "clinical_cases"("doctorId", "code");

-- CreateIndex
CREATE INDEX "procedures_doctorId_date_idx" ON "procedures"("doctorId", "date");

-- CreateIndex
CREATE INDEX "procedures_doctorId_procedureType_idx" ON "procedures"("doctorId", "procedureType");

-- CreateIndex
CREATE INDEX "procedures_caseId_idx" ON "procedures"("caseId");

-- CreateIndex
CREATE INDEX "procedure_sessions_doctorId_date_idx" ON "procedure_sessions"("doctorId", "date");

-- CreateIndex
CREATE INDEX "procedure_sessions_procedureId_idx" ON "procedure_sessions"("procedureId");

-- CreateIndex
CREATE UNIQUE INDEX "procedure_templates_doctorId_name_key" ON "procedure_templates"("doctorId", "name");

-- CreateIndex
CREATE INDEX "absence_events_doctorId_date_idx" ON "absence_events"("doctorId", "date");

-- CreateIndex
CREATE INDEX "treatment_plans_doctorId_presentedDate_idx" ON "treatment_plans"("doctorId", "presentedDate");

-- CreateIndex
CREATE INDEX "treatment_plans_doctorId_status_idx" ON "treatment_plans"("doctorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "production_imports_doctorId_fileHash_key" ON "production_imports"("doctorId", "fileHash");
