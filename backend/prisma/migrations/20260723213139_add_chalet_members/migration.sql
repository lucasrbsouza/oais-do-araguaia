-- CreateTable
CREATE TABLE "chalet_members" (
    "id" TEXT NOT NULL,
    "chalet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chalet_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chalet_members_user_id_idx" ON "chalet_members"("user_id");

-- CreateIndex
CREATE INDEX "chalet_members_chalet_id_idx" ON "chalet_members"("chalet_id");

-- CreateIndex
CREATE UNIQUE INDEX "chalet_members_chalet_id_user_id_key" ON "chalet_members"("chalet_id", "user_id");

-- AddForeignKey
ALTER TABLE "chalet_members" ADD CONSTRAINT "chalet_members_chalet_id_fkey" FOREIGN KEY ("chalet_id") REFERENCES "chalets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_members" ADD CONSTRAINT "chalet_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
