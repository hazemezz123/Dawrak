-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "student_id" TEXT;

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_devices" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_phone_key" ON "students"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "student_devices_device_id_key" ON "student_devices"("device_id");

-- CreateIndex
CREATE INDEX "student_devices_student_id_idx" ON "student_devices"("student_id");

-- CreateIndex
CREATE INDEX "tickets_student_id_idx" ON "tickets"("student_id");

-- AddForeignKey
ALTER TABLE "student_devices" ADD CONSTRAINT "student_devices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX tickets_active_student_per_window
  ON tickets (student_id, window_id)
  WHERE status IN ('waiting', 'called');
