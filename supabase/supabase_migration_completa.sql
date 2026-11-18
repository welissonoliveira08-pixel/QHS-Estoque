-- ============================================================================
-- QHS ENGENHARIA - Almoxarifado & Gestão de Estoque
-- Script completo de Migration + Dados Iniciais para Supabase (PostgreSQL)
-- Instruções: Cole todo este conteúdo no SQL Editor do Supabase e clique em RUN
-- ============================================================================

BEGIN;

-- 1. TABELAS PRINCIPAIS

CREATE TABLE IF NOT EXISTS "public"."users" (
  "id" text PRIMARY KEY NOT NULL,
  "uid" text UNIQUE,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "role" text NOT NULL,
  "department" text NOT NULL DEFAULT '',
  "is_admin" boolean NOT NULL DEFAULT false,
  "can_delete" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "permissions" jsonb NOT NULL,
  "registration_date" text NOT NULL DEFAULT '',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "public"."collaborators" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL DEFAULT 'qhs-engenharia',
  "full_name" text NOT NULL,
  "role" text NOT NULL DEFAULT '',
  "active" boolean NOT NULL DEFAULT true,
  "registration_date" text NOT NULL DEFAULT '',
  "display_updated_at" text NOT NULL DEFAULT '',
  "owner_uid" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "public"."products" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL DEFAULT 'qhs-engenharia',
  "code" text NOT NULL,
  "name" text NOT NULL,
  "group_name" text NOT NULL,
  "current_stock" double precision NOT NULL DEFAULT 0,
  "min_stock" double precision NOT NULL DEFAULT 0,
  "photo_url" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "registration_date" text NOT NULL DEFAULT '',
  "display_updated_at" text NOT NULL DEFAULT '',
  "owner_uid" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "public"."movements" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL DEFAULT 'qhs-engenharia',
  "product_id" text NOT NULL,
  "product_code" text NOT NULL,
  "product_name" text NOT NULL,
  "group_name" text NOT NULL,
  "type" text NOT NULL,
  "quantity" double precision NOT NULL,
  "stock_after_movement" double precision NOT NULL,
  "date" text NOT NULL,
  "withdrawn_by" text,
  "collaborator_id" text,
  "responsible_user" text NOT NULL,
  "destination" text,
  "notes" text,
  "is_negative_stock_authorized" boolean,
  "authorized_by" text,
  "owner_uid" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "public"."negative_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL DEFAULT 'qhs-engenharia',
  "product_id" text NOT NULL,
  "product_code" text NOT NULL,
  "product_name" text NOT NULL,
  "group_name" text NOT NULL,
  "requested_quantity" double precision NOT NULL,
  "available_stock" double precision NOT NULL,
  "deficit_quantity" double precision NOT NULL,
  "withdrawn_by" text NOT NULL,
  "collaborator_id" text,
  "destination" text NOT NULL,
  "requested_by" text NOT NULL,
  "requested_by_uid" text NOT NULL,
  "reason" text NOT NULL,
  "date" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDENTE',
  "reviewed_by" text,
  "reviewed_at" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "public"."deletion_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL DEFAULT 'qhs-engenharia',
  "record_type" text NOT NULL,
  "target_id" text NOT NULL,
  "target_code" text NOT NULL DEFAULT '',
  "target_name" text NOT NULL,
  "target_details" text NOT NULL DEFAULT '',
  "quantity" double precision NOT NULL DEFAULT 0,
  "reason" text NOT NULL,
  "requested_by" text NOT NULL,
  "requested_by_email" text NOT NULL,
  "requested_by_uid" text NOT NULL,
  "date" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDENTE',
  "reviewed_by" text,
  "reviewed_by_email" text,
  "reviewed_at" text,
  "executed_by" text,
  "executed_at" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "public"."deletion_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL DEFAULT 'qhs-engenharia',
  "origin" text NOT NULL,
  "request_id" text,
  "record_type" text NOT NULL,
  "target_id" text NOT NULL,
  "target_code" text NOT NULL DEFAULT '',
  "target_name" text NOT NULL,
  "target_details" text NOT NULL DEFAULT '',
  "quantity" double precision NOT NULL DEFAULT 0,
  "reason" text NOT NULL,
  "requested_by" text NOT NULL,
  "requested_by_date" text NOT NULL,
  "approved_by" text,
  "approved_at" text,
  "deleted_by" text NOT NULL,
  "deleted_by_email" text NOT NULL,
  "deleted_by_uid" text NOT NULL,
  "deleted_at" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "public"."managed_lists" (
  "id" text PRIMARY KEY NOT NULL,
  "groups" jsonb NOT NULL,
  "roles" jsonb NOT NULL,
  "destinations" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "public"."system_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "show_product_photos" boolean NOT NULL DEFAULT true,
  "company_name" text NOT NULL,
  "company_subtitle" text NOT NULL,
  "cnpj" text NOT NULL,
  "contact_email" text NOT NULL,
  "low_stock_alert_notification" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- 2. CHAVES ESTRANGEIRAS (RELACIONAMENTOS)

ALTER TABLE "public"."movements"
  DROP CONSTRAINT IF EXISTS "movements_product_id_products_id_fk";
ALTER TABLE "public"."movements"
  ADD CONSTRAINT "movements_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."movements"
  DROP CONSTRAINT IF EXISTS "movements_collaborator_id_collaborators_id_fk";
ALTER TABLE "public"."movements"
  ADD CONSTRAINT "movements_collaborator_id_collaborators_id_fk"
  FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "public"."negative_requests"
  DROP CONSTRAINT IF EXISTS "negative_requests_product_id_products_id_fk";
ALTER TABLE "public"."negative_requests"
  ADD CONSTRAINT "negative_requests_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."negative_requests"
  DROP CONSTRAINT IF EXISTS "negative_requests_collaborator_id_collaborators_id_fk";
ALTER TABLE "public"."negative_requests"
  ADD CONSTRAINT "negative_requests_collaborator_id_collaborators_id_fk"
  FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- 3. ÍNDICES DE PERFORMANCE

CREATE INDEX IF NOT EXISTS "idx_movements_product_id" ON "public"."movements" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_movements_collaborator_id" ON "public"."movements" ("collaborator_id");
CREATE INDEX IF NOT EXISTS "idx_negative_requests_product_id" ON "public"."negative_requests" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_deletion_requests_status" ON "public"."deletion_requests" ("status");

-- 4. PERMISSÕES PARA SINCRONIZAÇÃO BACKEND (SERVICE_ROLE)

GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public" TO "service_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "public" TO "service_role";

-- 5. DADOS ATUAIS DO APLICATIVO (SEED COMPLETO)

INSERT INTO "public"."system_settings" (
  "id",
  "show_product_photos",
  "company_name",
  "company_subtitle",
  "cnpj",
  "contact_email",
  "low_stock_alert_notification"
) VALUES (
  'global',
  true,
  'QHS ENGENHARIA',
  'Sistema de Controle de Almoxarifado e Estoque de Materiais',
  '18.492.831/0001-50',
  'almoxarifado@qhsengenharia.com.br',
  true
)
ON CONFLICT ("id") DO UPDATE SET
  "show_product_photos" = EXCLUDED."show_product_photos",
  "company_name" = EXCLUDED."company_name",
  "company_subtitle" = EXCLUDED."company_subtitle",
  "cnpj" = EXCLUDED."cnpj",
  "contact_email" = EXCLUDED."contact_email",
  "low_stock_alert_notification" = EXCLUDED."low_stock_alert_notification";

INSERT INTO "public"."managed_lists" (
  "id",
  "groups",
  "roles",
  "destinations"
) VALUES (
  'global',
  '["Materiais", "Extintores", "Placas"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "groups" = EXCLUDED."groups",
  "roles" = EXCLUDED."roles",
  "destinations" = EXCLUDED."destinations";

INSERT INTO "public"."users" (
  "id",
  "uid",
  "name",
  "email",
  "role",
  "department",
  "is_admin",
  "can_delete",
  "active",
  "permissions",
  "registration_date"
) VALUES (
  'user-owner',
  'mR4BFFHTsKYPzBKFcb0yd99JhHk2',
  'Welisson de Oliveira Martins',
  'welisson.oliveira08@gmail.com',
  'Diretor de Engenharia & Admin',
  'Diretoria Técnica',
  true,
  true,
  true,
  '{"saidas": true, "entradas": true, "produtos": true, "dashboard": true, "relatorios": true, "estatisticas": true, "colaboradores": true, "configuracoes": true}'::jsonb,
  '2026-11-16'
)
ON CONFLICT ("id") DO UPDATE SET
  "uid" = EXCLUDED."uid",
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "role" = EXCLUDED."role",
  "department" = EXCLUDED."department",
  "is_admin" = EXCLUDED."is_admin",
  "can_delete" = EXCLUDED."can_delete",
  "active" = EXCLUDED."active",
  "permissions" = EXCLUDED."permissions";

INSERT INTO "public"."collaborators" (
  "id",
  "org_id",
  "full_name",
  "role",
  "active",
  "registration_date",
  "display_updated_at",
  "owner_uid"
) VALUES (
  'colab-1794838999417',
  'qhs-engenharia',
  'LUCIANA',
  'ADM',
  true,
  '2026-11-16',
  '2026-11-16 14:23',
  'mR4BFFHTsKYPzBKFcb0yd99JhHk2'
)
ON CONFLICT ("id") DO UPDATE SET
  "org_id" = EXCLUDED."org_id",
  "full_name" = EXCLUDED."full_name",
  "role" = EXCLUDED."role",
  "active" = EXCLUDED."active",
  "display_updated_at" = EXCLUDED."display_updated_at";

INSERT INTO "public"."products" (
  "id",
  "org_id",
  "code",
  "name",
  "group_name",
  "current_stock",
  "min_stock",
  "photo_url",
  "description",
  "registration_date",
  "display_updated_at",
  "owner_uid"
) VALUES
(
  'prod-1794847386988',
  'qhs-engenharia',
  '01',
  'PLACA 1',
  'Placas',
  60,
  20,
  '',
  '',
  '2026-11-16',
  '2026-11-18 13:30',
  'mR4BFFHTsKYPzBKFcb0yd99JhHk2'
),
(
  'prod-1795022203407',
  'qhs-engenharia',
  '02',
  'EXTINTOR ABC NOVO',
  'Extintores',
  10,
  15,
  '',
  '',
  '2026-11-18',
  '2026-11-18 17:16',
  'mR4BFFHTsKYPzBKFcb0yd99JhHk2'
)
ON CONFLICT ("id") DO UPDATE SET
  "code" = EXCLUDED."code",
  "name" = EXCLUDED."name",
  "group_name" = EXCLUDED."group_name",
  "current_stock" = EXCLUDED."current_stock",
  "min_stock" = EXCLUDED."min_stock",
  "photo_url" = EXCLUDED."photo_url",
  "description" = EXCLUDED."description",
  "display_updated_at" = EXCLUDED."display_updated_at";

INSERT INTO "public"."movements" (
  "id",
  "org_id",
  "product_id",
  "product_code",
  "product_name",
  "group_name",
  "type",
  "quantity",
  "stock_after_movement",
  "date",
  "withdrawn_by",
  "collaborator_id",
  "responsible_user",
  "destination",
  "notes",
  "is_negative_stock_authorized",
  "authorized_by",
  "owner_uid"
) VALUES (
  'mov-1795019467144',
  'qhs-engenharia',
  'prod-1794847386988',
  '01',
  'PLACA 1',
  'Placas',
  'ENTRADA',
  50,
  60,
  '2026-11-18 13:30',
  NULL,
  NULL,
  'Welisson de Oliveira Martins',
  NULL,
  NULL,
  NULL,
  NULL,
  'mR4BFFHTsKYPzBKFcb0yd99JhHk2'
)
ON CONFLICT ("id") DO UPDATE SET
  "quantity" = EXCLUDED."quantity",
  "stock_after_movement" = EXCLUDED."stock_after_movement",
  "date" = EXCLUDED."date",
  "responsible_user" = EXCLUDED."responsible_user";

INSERT INTO "public"."deletion_logs" (
  "id",
  "org_id",
  "origin",
  "request_id",
  "record_type",
  "target_id",
  "target_code",
  "target_name",
  "target_details",
  "quantity",
  "reason",
  "requested_by",
  "requested_by_date",
  "approved_by",
  "approved_at",
  "deleted_by",
  "deleted_by_email",
  "deleted_by_uid",
  "deleted_at"
) VALUES
(
  'del-log-1794838892631',
  'qhs-engenharia',
  'DIRETA',
  NULL,
  'COLABORADOR',
  'colab-1794838858434',
  '',
  'luciana',
  'Função: adm · Status: Ativo',
  0,
  'Exclusão direta por usuário autorizado',
  'Welisson de Oliveira Martins',
  '2026-11-16 14:21',
  NULL,
  NULL,
  'Welisson de Oliveira Martins',
  'welisson.oliveira08@gmail.com',
  'mR4BFFHTsKYPzBKFcb0yd99JhHk2',
  '2026-11-16 14:21'
),
(
  'del-log-1794838962409',
  'qhs-engenharia',
  'DIRETA',
  NULL,
  'COLABORADOR',
  'colab-1794838914388',
  '',
  'luciana',
  'Função: adm · Status: Ativo',
  0,
  'Exclusão direta por usuário autorizado',
  'Welisson de Oliveira Martins',
  '2026-11-16 14:22',
  NULL,
  NULL,
  'Welisson de Oliveira Martins',
  'welisson.oliveira08@gmail.com',
  'mR4BFFHTsKYPzBKFcb0yd99JhHk2',
  '2026-11-16 14:22'
)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
