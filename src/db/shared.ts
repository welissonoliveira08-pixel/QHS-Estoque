import type { UserPermissions } from '../types/index.ts';

export const ORG_ID = 'qhs-engenharia';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'welisson.oliveira08@gmail.com';

export class DomainError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function isSqlDatabaseConfigured(): boolean {
  return Boolean(
    process.env.SQL_HOST &&
      process.env.SQL_USER &&
      process.env.SQL_DB_NAME
  );
}

export function formatDateToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatDateTimeNow(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function normalizePermissions(perms?: Partial<UserPermissions> | null): UserPermissions {
  return {
    dashboard: Boolean(perms?.dashboard),
    produtos: Boolean(perms?.produtos),
    entradas: Boolean(perms?.entradas),
    saidas: Boolean(perms?.saidas),
    colaboradores:
      perms?.colaboradores !== undefined ? Boolean(perms.colaboradores) : Boolean(perms?.saidas),
    destinos: perms?.destinos !== undefined ? Boolean(perms.destinos) : true,
    relatorios: Boolean(perms?.relatorios),
    estatisticas: Boolean(perms?.estatisticas),
    configuracoes: Boolean(perms?.configuracoes),
  };
}

export const FULL_ADMIN_PERMISSIONS: UserPermissions = {
  dashboard: true,
  produtos: true,
  entradas: true,
  saidas: true,
  colaboradores: true,
  destinos: true,
  relatorios: true,
  estatisticas: true,
  configuracoes: true,
};
