import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { UserPermissions } from '../types/index.ts';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(),
  department: text('department').notNull().default(''),
  isAdmin: boolean('is_admin').notNull().default(false),
  canDelete: boolean('can_delete').notNull().default(false),
  active: boolean('active').notNull().default(true),
  permissions: jsonb('permissions').$type<UserPermissions>().notNull(),
  registrationDate: text('registration_date').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const collaborators = pgTable('collaborators', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('qhs-engenharia'),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default(''),
  active: boolean('active').notNull().default(true),
  registrationDate: text('registration_date').notNull().default(''),
  displayUpdatedAt: text('display_updated_at').notNull().default(''),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('qhs-engenharia'),
  code: text('code').notNull(),
  name: text('name').notNull(),
  groupName: text('group_name').notNull(),
  currentStock: doublePrecision('current_stock').notNull().default(0),
  minStock: doublePrecision('min_stock').notNull().default(0),
  photoUrl: text('photo_url').notNull().default(''),
  description: text('description').notNull().default(''),
  registrationDate: text('registration_date').notNull().default(''),
  displayUpdatedAt: text('display_updated_at').notNull().default(''),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const movements = pgTable('movements', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('qhs-engenharia'),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  productCode: text('product_code').notNull(),
  productName: text('product_name').notNull(),
  groupName: text('group_name').notNull(),
  type: text('type').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  stockAfterMovement: doublePrecision('stock_after_movement').notNull(),
  date: text('date').notNull(),
  withdrawnBy: text('withdrawn_by'),
  collaboratorId: text('collaborator_id').references(() => collaborators.id, {
    onDelete: 'set null',
  }),
  responsibleUser: text('responsible_user').notNull(),
  destination: text('destination'),
  notes: text('notes'),
  isNegativeStockAuthorized: boolean('is_negative_stock_authorized'),
  authorizedBy: text('authorized_by'),
  ownerUid: text('owner_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const negativeRequests = pgTable('negative_requests', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('qhs-engenharia'),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  productCode: text('product_code').notNull(),
  productName: text('product_name').notNull(),
  groupName: text('group_name').notNull(),
  requestedQuantity: doublePrecision('requested_quantity').notNull(),
  availableStock: doublePrecision('available_stock').notNull(),
  deficitQuantity: doublePrecision('deficit_quantity').notNull(),
  withdrawnBy: text('withdrawn_by').notNull(),
  collaboratorId: text('collaborator_id').references(() => collaborators.id, {
    onDelete: 'set null',
  }),
  destination: text('destination').notNull(),
  requestedBy: text('requested_by').notNull(),
  requestedByUid: text('requested_by_uid').notNull(),
  reason: text('reason').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull().default('PENDENTE'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: text('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const deletionRequests = pgTable('deletion_requests', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('qhs-engenharia'),
  recordType: text('record_type').notNull(),
  targetId: text('target_id').notNull(),
  targetCode: text('target_code').notNull().default(''),
  targetName: text('target_name').notNull(),
  targetDetails: text('target_details').notNull().default(''),
  quantity: doublePrecision('quantity').notNull().default(0),
  reason: text('reason').notNull(),
  requestedBy: text('requested_by').notNull(),
  requestedByEmail: text('requested_by_email').notNull(),
  requestedByUid: text('requested_by_uid').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull().default('PENDENTE'),
  reviewedBy: text('reviewed_by'),
  reviewedByEmail: text('reviewed_by_email'),
  reviewedAt: text('reviewed_at'),
  executedBy: text('executed_by'),
  executedAt: text('executed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const deletionLogs = pgTable('deletion_logs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('qhs-engenharia'),
  origin: text('origin').notNull(),
  requestId: text('request_id'),
  recordType: text('record_type').notNull(),
  targetId: text('target_id').notNull(),
  targetCode: text('target_code').notNull().default(''),
  targetName: text('target_name').notNull(),
  targetDetails: text('target_details').notNull().default(''),
  quantity: doublePrecision('quantity').notNull().default(0),
  reason: text('reason').notNull(),
  requestedBy: text('requested_by').notNull(),
  requestedByDate: text('requested_by_date').notNull(),
  approvedBy: text('approved_by'),
  approvedAt: text('approved_at'),
  deletedBy: text('deleted_by').notNull(),
  deletedByEmail: text('deleted_by_email').notNull(),
  deletedByUid: text('deleted_by_uid').notNull(),
  deletedAt: text('deleted_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const managedLists = pgTable('managed_lists', {
  id: text('id').primaryKey(),
  groups: jsonb('groups').$type<string[]>().notNull(),
  roles: jsonb('roles').$type<string[]>().notNull(),
  destinations: jsonb('destinations').$type<string[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  id: text('id').primaryKey(),
  showProductPhotos: boolean('show_product_photos').notNull().default(true),
  companyName: text('company_name').notNull(),
  companySubtitle: text('company_subtitle').notNull(),
  cnpj: text('cnpj').notNull(),
  contactEmail: text('contact_email').notNull(),
  lowStockAlertNotification: boolean('low_stock_alert_notification').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const productsRelations = relations(products, ({ many }) => ({
  movements: many(movements),
  negativeRequests: many(negativeRequests),
}));

export const collaboratorsRelations = relations(collaborators, ({ many }) => ({
  movements: many(movements),
  negativeRequests: many(negativeRequests),
}));

export const movementsRelations = relations(movements, ({ one }) => ({
  product: one(products, {
    fields: [movements.productId],
    references: [products.id],
  }),
  collaborator: one(collaborators, {
    fields: [movements.collaboratorId],
    references: [collaborators.id],
  }),
}));

export const negativeRequestsRelations = relations(negativeRequests, ({ one }) => ({
  product: one(products, {
    fields: [negativeRequests.productId],
    references: [products.id],
  }),
  collaborator: one(collaborators, {
    fields: [negativeRequests.collaboratorId],
    references: [collaborators.id],
  }),
}));
