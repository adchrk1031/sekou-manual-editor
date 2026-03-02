-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "construction_types" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "zones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "construction_type_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    CONSTRAINT "zones_construction_type_id_fkey" FOREIGN KEY ("construction_type_id") REFERENCES "construction_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "csv_mapping_presets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "mapping_json" JSONB NOT NULL,
    "created_by" INTEGER,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "csv_mapping_presets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "file_name" TEXT NOT NULL,
    "mapping_preset_id" INTEGER,
    "mapping_json" JSONB NOT NULL,
    "status" TEXT NOT NULL CHECK ("status" IN ('UPLOADED', 'VALIDATED', 'IMPORTED', 'FAILED')),
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "success_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" INTEGER,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TEXT,
    CONSTRAINT "import_jobs_mapping_preset_id_fkey" FOREIGN KEY ("mapping_preset_id") REFERENCES "csv_mapping_presets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "import_jobs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "import_job_id" INTEGER NOT NULL,
    "row_no" INTEGER NOT NULL,
    "raw_json" JSONB NOT NULL,
    "validation_errors" JSONB,
    "project_id" INTEGER,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_rows_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "construction_type_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TEXT,
    "valid_to" TEXT,
    "created_by" INTEGER,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_templates_construction_type_id_fkey" FOREIGN KEY ("construction_type_id") REFERENCES "construction_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflow_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_template_steps" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "template_id" INTEGER NOT NULL,
    "step_order" INTEGER NOT NULL,
    "step_code" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "standard_days" INTEGER,
    "is_required" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "workflow_template_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workflow_templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflow_template_steps_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "salesforce_record_id" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "construction_type_id" INTEGER NOT NULL,
    "customer_name" TEXT,
    "owner_user_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NEW' CHECK ("status" IN ('NEW', 'ACTIVE', 'HOLD', 'DONE', 'CANCELLED')),
    "start_date" TEXT,
    "due_date" TEXT,
    "source_import_job_id" INTEGER,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_construction_type_id_fkey" FOREIGN KEY ("construction_type_id") REFERENCES "construction_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "projects_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "projects_source_import_job_id_fkey" FOREIGN KEY ("source_import_job_id") REFERENCES "import_jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_steps" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "template_step_id" INTEGER,
    "step_order" INTEGER NOT NULL,
    "step_code" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "assignee_user_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'TODO' CHECK ("status" IN ('TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED')),
    "planned_date" TEXT,
    "due_date" TEXT,
    "completed_at" TEXT,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_steps_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_steps_template_step_id_fkey" FOREIGN KEY ("template_step_id") REFERENCES "workflow_template_steps" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "project_steps_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "project_steps_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_step_histories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_step_id" INTEGER NOT NULL,
    "old_status" TEXT CHECK ("old_status" IS NULL OR "old_status" IN ('TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED')),
    "new_status" TEXT NOT NULL CHECK ("new_status" IN ('TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED')),
    "changed_by" INTEGER,
    "comment" TEXT,
    "changed_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_step_histories_project_step_id_fkey" FOREIGN KEY ("project_step_id") REFERENCES "project_steps" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_step_histories_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "month_end_closings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year_month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN', 'CLOSED')),
    "closed_by" INTEGER,
    "closed_at" TEXT,
    "summary_json" JSONB,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "month_end_closings_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "construction_types_code_key" ON "construction_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "construction_types_name_key" ON "construction_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "zones_construction_type_id_code_key" ON "zones"("construction_type_id", "code");

-- CreateIndex
CREATE INDEX "zones_construction_type_id_sort_order_idx" ON "zones"("construction_type_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "csv_mapping_presets_name_key" ON "csv_mapping_presets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_import_job_id_row_no_key" ON "import_rows"("import_job_id", "row_no");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_templates_construction_type_id_version_key" ON "workflow_templates"("construction_type_id", "version");

-- CreateIndex
CREATE INDEX "workflow_templates_construction_type_id_is_active_idx" ON "workflow_templates"("construction_type_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_template_steps_template_id_step_order_key" ON "workflow_template_steps"("template_id", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_template_steps_template_id_step_code_key" ON "workflow_template_steps"("template_id", "step_code");

-- CreateIndex
CREATE UNIQUE INDEX "projects_salesforce_record_id_key" ON "projects"("salesforce_record_id");

-- CreateIndex
CREATE INDEX "projects_construction_type_id_status_idx" ON "projects"("construction_type_id", "status");

-- CreateIndex
CREATE INDEX "projects_owner_user_id_status_idx" ON "projects"("owner_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_steps_project_id_step_order_key" ON "project_steps"("project_id", "step_order");

-- CreateIndex
CREATE INDEX "project_steps_project_id_step_order_idx" ON "project_steps"("project_id", "step_order");

-- CreateIndex
CREATE INDEX "project_steps_assignee_user_id_status_due_date_idx" ON "project_steps"("assignee_user_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "project_step_histories_project_step_id_changed_at_idx" ON "project_step_histories"("project_step_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "month_end_closings_year_month_key" ON "month_end_closings"("year_month");

-- Requirement-specific partial unique index (only one active template per construction type)
CREATE UNIQUE INDEX "uq_active_template_per_type"
ON "workflow_templates"("construction_type_id")
WHERE "is_active" = 1;

-- Requirement-specific current-position view (first unfinished step per project)
CREATE VIEW "v_project_current_position" AS
SELECT
  p.id AS project_id,
  ps.id AS current_step_id,
  ps.step_name AS current_step_name,
  z.name AS current_zone_name
FROM projects p
LEFT JOIN project_steps ps ON ps.id = (
  SELECT ps2.id
  FROM project_steps ps2
  WHERE ps2.project_id = p.id
    AND ps2.status IN ('TODO', 'IN_PROGRESS')
  ORDER BY ps2.step_order
  LIMIT 1
)
LEFT JOIN zones z ON z.id = ps.zone_id;

-- Seed initial construction types
INSERT OR IGNORE INTO "construction_types" ("code", "name") VALUES
  ('SMAME', 'スマメ工事'),
  ('EQUIP_RECOVERY', '設備回収工事'),
  ('DIGIME_KENMAN', 'デジメ・県満工事');
