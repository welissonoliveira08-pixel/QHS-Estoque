// @ts-nocheck

// src/server/app.ts
import express from "express";

// src/lib/firebase-admin.ts
import fs from "node:fs";
import path from "node:path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
function resolveFirebaseProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (typeof parsed.projectId === "string" && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch {
  }
  return "sylvan-throne-pbcxw";
}
if (!getApps().length) {
  initializeApp({
    projectId: resolveFirebaseProjectId()
  });
}
var adminAuth = getAuth();

// src/middleware/auth.ts
function createRequireAuth(resolveUser) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "N\xE3o autenticado: token ausente." });
      return;
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      res.status(401).json({ error: "N\xE3o autenticado: token inv\xE1lido." });
      return;
    }
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error("Error verifying Firebase ID token:", error);
      res.status(401).json({ error: "Sess\xE3o inv\xE1lida ou expirada. Fa\xE7a login novamente." });
      return;
    }
    if (!decodedToken.email || decodedToken.email_verified !== true) {
      res.status(403).json({
        error: "Acesso negado: confirme o link de verifica\xE7\xE3o enviado para o seu e-mail antes de acessar o sistema."
      });
      return;
    }
    try {
      const authResult = await resolveUser({
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name
      });
      if (!authResult.authorized || !authResult.user) {
        res.status(403).json({
          error: authResult.errorMessage || "Acesso n\xE3o autorizado."
        });
        return;
      }
      req.user = decodedToken;
      req.dbUser = authResult.user;
      req.isRealAdmin = authResult.isRealAdmin;
      next();
    } catch (error) {
      console.error("Auth database verification error:", error);
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
      const message = error instanceof Error && error.message ? error.message : "Erro interno ao validar acesso no banco de dados.";
      res.status(statusCode).json({ error: message });
    }
  };
}
var requireAdmin = (req, res, next) => {
  if (!req.isRealAdmin || !req.dbUser?.isAdmin) {
    res.status(403).json({
      error: "Acesso restrito ao Administrador principal."
    });
    return;
  }
  next();
};
var requireDirectDelete = (req, res, next) => {
  if (!req.dbUser || !req.dbUser.isAdmin && !req.dbUser.canDelete) {
    res.status(403).json({
      error: 'Voc\xEA n\xE3o possui permiss\xE3o para excluir registros diretamente. Utilize a op\xE7\xE3o "Solicitar exclus\xE3o".'
    });
    return;
  }
  next();
};

// src/db/shared.ts
var ORG_ID = "qhs-engenharia";
var BOOTSTRAPPED_ADMIN_EMAIL = "welisson.oliveira08@gmail.com";
var DomainError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
};
function isSqlDatabaseConfigured() {
  return Boolean(
    process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME
  );
}
function formatDateToday() {
  const now = /* @__PURE__ */ new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function formatDateTimeNow() {
  const now = /* @__PURE__ */ new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
function normalizePermissions(perms) {
  return {
    dashboard: Boolean(perms?.dashboard),
    produtos: Boolean(perms?.produtos),
    entradas: Boolean(perms?.entradas),
    saidas: Boolean(perms?.saidas),
    colaboradores: perms?.colaboradores !== void 0 ? Boolean(perms.colaboradores) : Boolean(perms?.saidas),
    relatorios: Boolean(perms?.relatorios),
    estatisticas: Boolean(perms?.estatisticas),
    configuracoes: Boolean(perms?.configuracoes)
  };
}
var FULL_ADMIN_PERMISSIONS = {
  dashboard: true,
  produtos: true,
  entradas: true,
  saidas: true,
  colaboradores: true,
  relatorios: true,
  estatisticas: true,
  configuracoes: true
};

// src/server/app.ts
var asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
function createApiApp(repo) {
  const app = express();
  const requireAuth = createRequireAuth(repo.resolveAuthenticatedUser);
  app.use(express.json({ limit: "5mb" }));
  app.get("/api/health", (_req, res) => {
    const hasSupabaseUrl = Boolean(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
    );
    const hasSupabaseKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
    );
    res.json({
      ok: true,
      mode: isSqlDatabaseConfigured() ? "cloudsql" : "supabase",
      supabaseConfigured: hasSupabaseUrl && hasSupabaseKey
    });
  });
  app.post(
    "/api/auth/verify-invite",
    asyncHandler(async (req, res) => {
      const email = String(req.body?.email ?? "").trim();
      const status = await repo.checkEmailInvitationStatus(email);
      if (!status.authorized) {
        res.status(403).json({ error: status.message || "E-mail n\xE3o autorizado." });
        return;
      }
      res.json(status);
    })
  );
  app.post(
    "/api/auth/request-access",
    asyncHandler(async (req, res) => {
      const result = await repo.createAccessRequestInDb({
        name: String(req.body?.name ?? ""),
        email: String(req.body?.email ?? ""),
        role: req.body?.role ? String(req.body.role) : "",
        department: req.body?.department ? String(req.body.department) : "",
        reason: req.body?.reason ? String(req.body.reason) : ""
      });
      res.status(result.alreadyAuthorized ? 200 : 201).json(result);
    })
  );
  app.get(
    "/api/bootstrap",
    requireAuth,
    asyncHandler(async (req, res) => {
      const data = await repo.getBootstrapData(req.dbUser, req.user.uid);
      res.json(data);
    })
  );
  app.patch(
    "/api/settings/photos",
    requireAuth,
    asyncHandler(async (req, res) => {
      const showProductPhotos = Boolean(req.body?.showProductPhotos);
      await repo.updateSystemSettingsInDb({ showProductPhotos });
      res.json({ ok: true, showProductPhotos });
    })
  );
  app.put(
    "/api/settings",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      await repo.updateSystemSettingsInDb(req.body ?? {});
      res.json({ ok: true });
    })
  );
  app.put(
    "/api/lists",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { lists, renameGroup, renameRole } = req.body ?? {};
      if (!lists || !Array.isArray(lists.groups) || !Array.isArray(lists.roles) || !Array.isArray(lists.destinations)) {
        throw new DomainError("Dados de listas inv\xE1lidos.", 400);
      }
      await repo.updateManagedListsInDb({ lists, renameGroup, renameRole });
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/users",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const created = await repo.createUserInDb(req.body ?? {});
      res.status(201).json(created);
    })
  );
  app.put(
    "/api/users/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const updated = await repo.updateUserInDb({ ...req.body ?? {}, id });
      res.json(updated);
    })
  );
  app.patch(
    "/api/users/:id/permissions",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      await repo.updateUserPermissionsInDb(id, req.body?.permissions ?? {});
      res.json({ ok: true });
    })
  );
  app.patch(
    "/api/users/:id/delete-permission",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      await repo.updateUserDeletePermissionInDb(id, Boolean(req.body?.canDelete));
      res.json({ ok: true });
    })
  );
  app.delete(
    "/api/users/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      await repo.deleteUserInDb(id);
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/access-requests/:id/approve",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const result = await repo.approveAccessRequestInDb({
        requestId: id,
        admin: req.dbUser,
        role: req.body?.role ? String(req.body.role) : void 0,
        department: req.body?.department ? String(req.body.department) : void 0,
        canDelete: req.body?.canDelete !== void 0 ? Boolean(req.body.canDelete) : void 0,
        permissions: req.body?.permissions
      });
      res.json({ ok: true, ...result });
    })
  );
  app.post(
    "/api/access-requests/:id/reject",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const updated = await repo.rejectAccessRequestInDb({
        requestId: id,
        admin: req.dbUser
      });
      res.json({ ok: true, request: updated });
    })
  );
  app.post(
    "/api/collaborators",
    requireAuth,
    asyncHandler(async (req, res) => {
      const created = await repo.createCollaboratorInDb({
        ownerUid: req.user.uid,
        fullName: String(req.body?.fullName ?? ""),
        role: req.body?.role ? String(req.body.role) : "",
        active: req.body?.active !== void 0 ? Boolean(req.body.active) : true
      });
      res.status(201).json(created);
    })
  );
  app.put(
    "/api/collaborators/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const updated = await repo.updateCollaboratorInDb({
        id,
        fullName: String(req.body?.fullName ?? ""),
        role: req.body?.role ? String(req.body.role) : "",
        active: Boolean(req.body?.active)
      });
      res.json(updated);
    })
  );
  app.patch(
    "/api/collaborators/:id/toggle",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const updated = await repo.toggleCollaboratorActiveInDb(id);
      res.json(updated);
    })
  );
  app.delete(
    "/api/collaborators/:id",
    requireAuth,
    requireDirectDelete,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const deletedName = await repo.deleteCollaboratorInDb({
        collaboratorId: id,
        actor: req.dbUser,
        actorEmail: req.user.email || req.dbUser.email,
        actorUid: req.user.uid
      });
      res.json({ ok: true, deletedName });
    })
  );
  app.post(
    "/api/products",
    requireAuth,
    asyncHandler(async (req, res) => {
      const created = await repo.createProductInDb(req.user.uid, req.body ?? {});
      res.status(201).json(created);
    })
  );
  app.put(
    "/api/products/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const updated = await repo.updateProductInDb({ ...req.body ?? {}, id });
      res.json(updated);
    })
  );
  app.delete(
    "/api/products/:id",
    requireAuth,
    requireDirectDelete,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const deletedName = await repo.deleteProductInDb({
        productId: id,
        actor: req.dbUser,
        actorEmail: req.user.email || req.dbUser.email,
        actorUid: req.user.uid
      });
      res.json({ ok: true, deletedName });
    })
  );
  app.post(
    "/api/movements",
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await repo.recordMovementInDb({
        id: req.body?.id,
        productId: String(req.body?.productId ?? ""),
        type: req.body?.type === "ENTRADA" ? "ENTRADA" : "SAIDA",
        quantity: Number(req.body?.quantity ?? 0),
        date: req.body?.date ? String(req.body.date) : void 0,
        withdrawnBy: req.body?.withdrawnBy ? String(req.body.withdrawnBy) : void 0,
        collaboratorId: req.body?.collaboratorId ? String(req.body.collaboratorId) : void 0,
        destination: req.body?.destination ? String(req.body.destination) : void 0,
        notes: req.body?.notes ? String(req.body.notes) : void 0,
        isNegativeStockAuthorized: req.body?.isNegativeStockAuthorized !== void 0 ? Boolean(req.body.isNegativeStockAuthorized) : void 0,
        authorizedBy: req.body?.authorizedBy ? String(req.body.authorizedBy) : void 0,
        actor: req.dbUser,
        actorUid: req.user.uid
      });
      res.status(201).json(result);
    })
  );
  app.delete(
    "/api/movements/:id",
    requireAuth,
    requireDirectDelete,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const result = await repo.deleteMovementInDb({
        movementId: id,
        actor: req.dbUser,
        actorEmail: req.user.email || req.dbUser.email,
        actorUid: req.user.uid
      });
      res.json({ ok: true, ...result });
    })
  );
  app.post(
    "/api/negative-requests",
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await repo.createNegativeRequestInDb({
        id: req.body?.id,
        productId: String(req.body?.productId ?? ""),
        requestedQuantity: Number(req.body?.requestedQuantity ?? 0),
        withdrawnBy: String(req.body?.withdrawnBy ?? ""),
        collaboratorId: req.body?.collaboratorId ? String(req.body.collaboratorId) : void 0,
        destination: String(req.body?.destination ?? ""),
        reason: String(req.body?.reason ?? ""),
        actor: req.dbUser,
        actorUid: req.user.uid
      });
      res.status(201).json(result);
    })
  );
  app.post(
    "/api/negative-requests/:id/approve",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const result = await repo.approveNegativeRequestInDb({
        requestId: id,
        admin: req.dbUser,
        adminUid: req.user.uid
      });
      res.json({ ok: true, ...result });
    })
  );
  app.post(
    "/api/negative-requests/:id/reject",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      await repo.rejectNegativeRequestInDb(id, req.dbUser.name);
      res.json({ ok: true });
    })
  );
  app.delete(
    "/api/negative-requests/:id",
    requireAuth,
    requireDirectDelete,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      await repo.deleteNegativeRequestInDb({
        requestId: id,
        actor: req.dbUser,
        actorEmail: req.user.email || req.dbUser.email,
        actorUid: req.user.uid
      });
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/deletion-requests",
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await repo.createDeletionRequestInDb({
        recordType: req.body?.recordType,
        targetId: String(req.body?.targetId ?? ""),
        targetCode: String(req.body?.targetCode ?? ""),
        targetName: String(req.body?.targetName ?? ""),
        targetDetails: String(req.body?.targetDetails ?? ""),
        quantity: Number(req.body?.quantity ?? 0),
        reason: String(req.body?.reason ?? ""),
        actor: req.dbUser,
        actorEmail: req.user.email || req.dbUser.email,
        actorUid: req.user.uid
      });
      res.status(201).json(result);
    })
  );
  app.post(
    "/api/deletion-requests/:id/approve",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const result = await repo.approveDeletionRequestInDb({
        requestId: id,
        admin: req.dbUser,
        adminEmail: req.user.email || req.dbUser.email,
        adminUid: req.user.uid
      });
      res.json({ ok: true, ...result });
    })
  );
  app.post(
    "/api/deletion-requests/:id/reject",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const result = await repo.rejectDeletionRequestInDb({
        requestId: id,
        admin: req.dbUser,
        adminEmail: req.user.email || req.dbUser.email
      });
      res.json({ ok: true, ...result });
    })
  );
  app.post(
    "/api/admin/supabase-sync",
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      if (repo.forceSupabaseSync) {
        await repo.forceSupabaseSync();
      }
      res.json({ ok: true });
    })
  );
  app.post(
    "/api/admin/reset",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      await repo.resetAllDataInDb(
        req.user.uid,
        req.user.email || req.dbUser.email,
        req.dbUser.name
      );
      res.json({ ok: true });
    })
  );
  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "Rota de API n\xE3o encontrada." });
  });
  app.use("/api", (err, _req, res, _next) => {
    if (err instanceof DomainError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error("Unhandled API error:", err);
    const message = err instanceof Error && err.message ? err.message : "Erro interno ao processar opera\xE7\xE3o no servidor.";
    res.status(500).json({ error: message });
  });
  return app;
}

// src/data/initialData.ts
var INITIAL_SETTINGS = {
  showProductPhotos: true,
  companyName: "QHS ENGENHARIA",
  companySubtitle: "Sistema de Controle de Almoxarifado e Estoque de Materiais",
  cnpj: "18.492.831/0001-50",
  contactEmail: "almoxarifado@qhsengenharia.com.br",
  lowStockAlertNotification: true
};
var INITIAL_LISTS = {
  groups: ["Materiais", "Extintores", "Placas"],
  roles: [],
  destinations: []
};

// src/db/supabaseRepository.ts
function stripQuotes(value) {
  return value.trim().replace(/^["']+|["']+$/g, "").trim();
}
function normalizeUrl(raw) {
  const cleaned = stripQuotes(raw).replace(/\/+$/, "");
  if (!cleaned.startsWith("http")) return "";
  try {
    return new URL(cleaned).origin;
  } catch {
    return cleaned.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  }
}
function isPublicKey(key) {
  if (key.startsWith("sb_publishable_")) return true;
  if (key.startsWith("eyJ")) {
    const parts = key.split(".");
    if (parts.length === 3) {
      try {
        const decoded = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        if (decoded?.role === "anon") return true;
      } catch {
        return false;
      }
    }
  }
  return false;
}
function getRequiredConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  let rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  rawKey = stripQuotes(rawKey);
  if (/^Bearer\s+/i.test(rawKey)) {
    rawKey = rawKey.replace(/^Bearer\s+/i, "").trim();
  }
  const url = normalizeUrl(rawUrl);
  if (!url || !rawKey) {
    throw new DomainError(
      "Backend conectado, mas falta configurar SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas Environment Variables da hospedagem (Vercel / servidor) e refazer o deploy.",
      503
    );
  }
  if (isPublicKey(rawKey)) {
    throw new DomainError(
      "A vari\xE1vel SUPABASE_SERVICE_ROLE_KEY est\xE1 usando uma chave p\xFAblica (anon/publishable). Substitua pela chave secreta service_role ou sb_secret_ do Supabase.",
      503
    );
  }
  return { url, key: rawKey };
}
function makeHeaders(key, extra) {
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
    ...extra
  };
  if (!key.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}
async function sbRequest(pathWithQuery, options = {}) {
  const config = getRequiredConfig();
  const headers = makeHeaders(
    config.key,
    options.prefer ? { Prefer: options.prefer } : void 0
  );
  const response = await fetch(`${config.url}/rest/v1/${pathWithQuery}`, {
    method: options.method || "GET",
    headers,
    body: options.body !== void 0 ? JSON.stringify(options.body) : void 0,
    signal: AbortSignal.timeout(12e3)
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const isMissingTable = response.status === 404 || errorText.includes("PGRST205") || errorText.includes("42P01");
    if (options.ignoreMissingTable && isMissingTable) {
      return [];
    }
    if (isMissingTable) {
      throw new DomainError(
        `Tabela n\xE3o encontrada no Supabase (${pathWithQuery.split("?")[0]}). Execute o script SQL em supabase/supabase_migration_completa.sql no SQL Editor do Supabase.`,
        503
      );
    }
    throw new Error(`Supabase REST ${response.status} on ${pathWithQuery}: ${errorText}`);
  }
  if (response.status === 204) {
    return [];
  }
  const text = await response.text().catch(() => "");
  if (!text) return [];
  return JSON.parse(text);
}
function mapUser(r) {
  const perms = r.permissions || {};
  return {
    id: String(r.id),
    name: String(r.name || ""),
    email: String(r.email || ""),
    role: String(r.role || ""),
    department: String(r.department || ""),
    isAdmin: Boolean(r.is_admin),
    canDelete: Boolean(r.is_admin || r.can_delete),
    permissions: normalizePermissions(perms),
    active: r.active !== false,
    createdAt: String(r.registration_date || "")
  };
}
function mapCollaborator(r) {
  return {
    id: String(r.id),
    fullName: String(r.full_name || ""),
    role: String(r.role || ""),
    active: r.active !== false,
    createdAt: String(r.registration_date || ""),
    updatedAt: String(r.display_updated_at || "")
  };
}
function mapProduct(r) {
  return {
    id: String(r.id),
    code: String(r.code || ""),
    name: String(r.name || ""),
    group: String(r.group_name || ""),
    currentStock: Number(r.current_stock ?? 0),
    minStock: Number(r.min_stock ?? 0),
    photoUrl: String(r.photo_url || ""),
    description: String(r.description || ""),
    createdAt: String(r.registration_date || ""),
    updatedAt: String(r.display_updated_at || "")
  };
}
function mapMovement(r) {
  return {
    id: String(r.id),
    productId: String(r.product_id || ""),
    productCode: String(r.product_code || ""),
    productName: String(r.product_name || ""),
    group: String(r.group_name || ""),
    type: r.type === "ENTRADA" ? "ENTRADA" : "SAIDA",
    quantity: Number(r.quantity ?? 0),
    stockAfterMovement: Number(r.stock_after_movement ?? 0),
    date: String(r.date || ""),
    withdrawnBy: typeof r.withdrawn_by === "string" ? r.withdrawn_by : void 0,
    collaboratorId: typeof r.collaborator_id === "string" ? r.collaborator_id : void 0,
    responsibleUser: String(r.responsible_user || ""),
    destination: typeof r.destination === "string" ? r.destination : void 0,
    notes: typeof r.notes === "string" ? r.notes : void 0,
    isNegativeStockAuthorized: r.is_negative_stock_authorized !== null && r.is_negative_stock_authorized !== void 0 ? Boolean(r.is_negative_stock_authorized) : void 0,
    authorizedBy: typeof r.authorized_by === "string" ? r.authorized_by : void 0
  };
}
function mapNegativeRequest(r) {
  return {
    id: String(r.id),
    productId: String(r.product_id || ""),
    productCode: String(r.product_code || ""),
    productName: String(r.product_name || ""),
    group: String(r.group_name || ""),
    requestedQuantity: Number(r.requested_quantity ?? 0),
    availableStock: Number(r.available_stock ?? 0),
    deficitQuantity: Number(r.deficit_quantity ?? 0),
    withdrawnBy: String(r.withdrawn_by || ""),
    collaboratorId: typeof r.collaborator_id === "string" ? r.collaborator_id : void 0,
    destination: String(r.destination || ""),
    requestedBy: String(r.requested_by || ""),
    reason: String(r.reason || ""),
    date: String(r.date || ""),
    status: r.status === "APROVADO" ? "APROVADO" : r.status === "RECUSADO" ? "RECUSADO" : "PENDENTE",
    reviewedBy: typeof r.reviewed_by === "string" ? r.reviewed_by : void 0,
    reviewedAt: typeof r.reviewed_at === "string" ? r.reviewed_at : void 0
  };
}
function toRecordType(rt) {
  return rt === "PRODUTO" || rt === "ENTRADA" || rt === "SAIDA" || rt === "SOLICITACAO_NEGATIVA" || rt === "COLABORADOR" ? rt : "PRODUTO";
}
function mapDeletionRequest(r) {
  return {
    id: String(r.id),
    recordType: toRecordType(r.record_type),
    targetId: String(r.target_id || ""),
    targetCode: String(r.target_code || ""),
    targetName: String(r.target_name || ""),
    targetDetails: String(r.target_details || ""),
    quantity: Number(r.quantity ?? 0),
    reason: String(r.reason || ""),
    requestedBy: String(r.requested_by || ""),
    requestedByEmail: String(r.requested_by_email || ""),
    requestedByUid: String(r.requested_by_uid || ""),
    date: String(r.date || ""),
    status: r.status === "APROVADO" ? "APROVADO" : r.status === "RECUSADO" ? "RECUSADO" : "PENDENTE",
    reviewedBy: typeof r.reviewed_by === "string" ? r.reviewed_by : void 0,
    reviewedByEmail: typeof r.reviewed_by_email === "string" ? r.reviewed_by_email : void 0,
    reviewedAt: typeof r.reviewed_at === "string" ? r.reviewed_at : void 0,
    executedBy: typeof r.executed_by === "string" ? r.executed_by : void 0,
    executedAt: typeof r.executed_at === "string" ? r.executed_at : void 0
  };
}
function mapDeletionLog(r) {
  return {
    id: String(r.id),
    origin: r.origin === "APROVADA" ? "APROVADA" : "DIRETA",
    requestId: typeof r.request_id === "string" ? r.request_id : void 0,
    recordType: toRecordType(r.record_type),
    targetId: String(r.target_id || ""),
    targetCode: String(r.target_code || ""),
    targetName: String(r.target_name || ""),
    targetDetails: String(r.target_details || ""),
    quantity: Number(r.quantity ?? 0),
    reason: String(r.reason || ""),
    requestedBy: String(r.requested_by || ""),
    requestedByDate: String(r.requested_by_date || ""),
    approvedBy: typeof r.approved_by === "string" ? r.approved_by : void 0,
    approvedAt: typeof r.approved_at === "string" ? r.approved_at : void 0,
    deletedBy: String(r.deleted_by || ""),
    deletedByEmail: String(r.deleted_by_email || ""),
    deletedByUid: String(r.deleted_by_uid || ""),
    deletedAt: String(r.deleted_at || "")
  };
}
function mapAccessRequest(r) {
  const status = r.status === "APROVADO" ? "APROVADO" : r.status === "RECUSADO" ? "RECUSADO" : "PENDENTE";
  return {
    id: String(r.id),
    name: String(r.name || ""),
    email: String(r.email || ""),
    role: String(r.role || ""),
    department: String(r.department || ""),
    reason: String(r.reason || ""),
    date: String(r.date || ""),
    status,
    reviewedBy: typeof r.reviewed_by === "string" ? r.reviewed_by : void 0,
    reviewedAt: typeof r.reviewed_at === "string" ? r.reviewed_at : void 0
  };
}
async function ensureDefaultsSeededSupabase() {
  const existingSettings = await sbRequest("system_settings?id=eq.global&limit=1");
  if (existingSettings.length === 0) {
    await sbRequest("system_settings?on_conflict=id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: {
        id: "global",
        show_product_photos: INITIAL_SETTINGS.showProductPhotos,
        company_name: INITIAL_SETTINGS.companyName,
        company_subtitle: INITIAL_SETTINGS.companySubtitle,
        cnpj: INITIAL_SETTINGS.cnpj,
        contact_email: INITIAL_SETTINGS.contactEmail,
        low_stock_alert_notification: INITIAL_SETTINGS.lowStockAlertNotification
      }
    });
  }
  const existingLists = await sbRequest("managed_lists?id=eq.global&limit=1");
  if (existingLists.length === 0) {
    await sbRequest("managed_lists?on_conflict=id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: {
        id: "global",
        groups: INITIAL_LISTS.groups,
        roles: INITIAL_LISTS.roles,
        destinations: INITIAL_LISTS.destinations
      }
    });
  }
}
async function checkEmailInvitationStatusSupabase(email) {
  const emailLower = email.trim().toLowerCase();
  if (!emailLower || !emailLower.includes("@")) {
    return {
      authorized: false,
      alreadyActivated: false,
      message: "Informe um endere\xE7o de e-mail v\xE1lido."
    };
  }
  await ensureDefaultsSeededSupabase();
  const rows = await sbRequest(
    `users?email=eq.${encodeURIComponent(emailLower)}&select=id,active,uid&limit=1`
  );
  if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return {
      authorized: true,
      alreadyActivated: Boolean(rows[0]?.uid)
    };
  }
  if (!rows[0]) {
    return {
      authorized: false,
      alreadyActivated: false,
      message: `O e-mail ${email.trim()} ainda n\xE3o foi autorizado pelo Administrador da QHS Engenharia.`
    };
  }
  if (rows[0].active === false) {
    return {
      authorized: false,
      alreadyActivated: Boolean(rows[0].uid),
      message: "Este e-mail est\xE1 inativo no sistema. Contate o Administrador da QHS Engenharia."
    };
  }
  return {
    authorized: true,
    alreadyActivated: Boolean(rows[0].uid)
  };
}
async function resolveAuthenticatedUserSupabase(params) {
  const emailLower = params.email.trim().toLowerCase();
  const isBootstrapped = emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
  await ensureDefaultsSeededSupabase();
  if (isBootstrapped) {
    const existingByEmail = await sbRequest(
      `users?email=eq.${encodeURIComponent(emailLower)}&limit=1`
    );
    if (existingByEmail[0]) {
      const updated = await sbRequest(
        `users?id=eq.${encodeURIComponent(String(existingByEmail[0].id))}`,
        {
          method: "PATCH",
          prefer: "return=representation",
          body: {
            uid: params.uid,
            is_admin: true,
            can_delete: true,
            active: true,
            permissions: FULL_ADMIN_PERMISSIONS,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      );
      return {
        authorized: true,
        isRealAdmin: true,
        user: mapUser(updated[0] || existingByEmail[0])
      };
    }
    const inserted = await sbRequest("users?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: {
        id: "user-owner",
        uid: params.uid,
        name: (params.displayName || "Welisson Oliveira").slice(0, 120),
        email: emailLower,
        role: "Diretor de Engenharia & Admin",
        department: "Diretoria T\xE9cnica",
        is_admin: true,
        can_delete: true,
        active: true,
        permissions: FULL_ADMIN_PERMISSIONS,
        registration_date: formatDateToday(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    return {
      authorized: true,
      isRealAdmin: true,
      user: mapUser(inserted[0])
    };
  }
  const found = await sbRequest(
    `users?email=eq.${encodeURIComponent(emailLower)}&limit=1`
  );
  const userRow = found[0];
  if (!userRow) {
    return {
      authorized: false,
      isRealAdmin: false,
      errorMessage: `O e-mail ${params.email} ainda n\xE3o foi autorizado no sistema da QHS Engenharia.`
    };
  }
  if (userRow.active === false) {
    return {
      authorized: false,
      isRealAdmin: false,
      errorMessage: "Seu cadastro est\xE1 inativo no momento. Contate o Administrador da QHS Engenharia."
    };
  }
  if (userRow.uid !== params.uid) {
    const updated = await sbRequest(
      `users?id=eq.${encodeURIComponent(String(userRow.id))}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: { uid: params.uid, updated_at: (/* @__PURE__ */ new Date()).toISOString() }
      }
    );
    const row = updated[0] || userRow;
    return {
      authorized: true,
      isRealAdmin: Boolean(row.is_admin),
      user: mapUser(row)
    };
  }
  return {
    authorized: true,
    isRealAdmin: Boolean(userRow.is_admin),
    user: mapUser(userRow)
  };
}
async function getBootstrapDataSupabase(currentUser, uid) {
  await ensureDefaultsSeededSupabase();
  const [
    allUsersRows,
    collabRows,
    prodRows,
    movRows,
    negRows,
    delReqRows,
    delLogRows,
    accessReqRows,
    listsRows,
    settingsRows
  ] = await Promise.all([
    sbRequest("users?select=*"),
    sbRequest("collaborators?select=*"),
    sbRequest("products?select=*"),
    sbRequest("movements?select=*"),
    sbRequest("negative_requests?select=*"),
    currentUser.isAdmin ? sbRequest("deletion_requests?select=*") : sbRequest(
      `deletion_requests?requested_by_uid=eq.${encodeURIComponent(uid)}&select=*`
    ),
    currentUser.isAdmin ? sbRequest("deletion_logs?select=*") : Promise.resolve([]),
    currentUser.isAdmin ? sbRequest("access_requests?select=*", { ignoreMissingTable: true }) : Promise.resolve([]),
    sbRequest("managed_lists?id=eq.global&limit=1"),
    sbRequest("system_settings?id=eq.global&limit=1")
  ]);
  const mappedUsers = allUsersRows.map(mapUser);
  const visibleUsers = currentUser.isAdmin ? mappedUsers : [
    currentUser,
    ...mappedUsers.filter((u) => u.id !== currentUser.id).map((u) => ({
      ...u,
      email: "",
      permissions: normalizePermissions(),
      canDelete: false
    }))
  ];
  const listsRow = listsRows[0];
  const lists = listsRow ? {
    groups: Array.isArray(listsRow.groups) ? listsRow.groups : INITIAL_LISTS.groups,
    roles: Array.isArray(listsRow.roles) ? listsRow.roles : INITIAL_LISTS.roles,
    destinations: Array.isArray(listsRow.destinations) ? listsRow.destinations : INITIAL_LISTS.destinations
  } : INITIAL_LISTS;
  const sRow = settingsRows[0];
  const settings = sRow ? {
    showProductPhotos: Boolean(sRow.show_product_photos),
    companyName: String(sRow.company_name || INITIAL_SETTINGS.companyName),
    companySubtitle: String(sRow.company_subtitle || INITIAL_SETTINGS.companySubtitle),
    cnpj: String(sRow.cnpj || INITIAL_SETTINGS.cnpj),
    contactEmail: String(sRow.contact_email || INITIAL_SETTINGS.contactEmail),
    lowStockAlertNotification: Boolean(sRow.low_stock_alert_notification)
  } : INITIAL_SETTINGS;
  return {
    currentUser,
    users: visibleUsers,
    collaborators: collabRows.map(mapCollaborator).sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR")),
    products: prodRows.map(mapProduct).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    movements: movRows.map(mapMovement).sort((a, b) => b.date.localeCompare(a.date)),
    negativeRequests: negRows.map(mapNegativeRequest).sort((a, b) => b.date.localeCompare(a.date)),
    deletionRequests: delReqRows.map(mapDeletionRequest).sort((a, b) => b.date.localeCompare(a.date)),
    deletionLogs: delLogRows.map(mapDeletionLog).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    accessRequests: accessReqRows.map(mapAccessRequest).sort((a, b) => b.date.localeCompare(a.date)),
    managedLists: lists,
    settings
  };
}
async function updateSystemSettingsSupabase(newSettings) {
  await ensureDefaultsSeededSupabase();
  const payload = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (newSettings.showProductPhotos !== void 0) {
    payload.show_product_photos = Boolean(newSettings.showProductPhotos);
  }
  if (newSettings.companyName !== void 0) {
    payload.company_name = newSettings.companyName.trim().slice(0, 120);
  }
  if (newSettings.companySubtitle !== void 0) {
    payload.company_subtitle = newSettings.companySubtitle.trim().slice(0, 200);
  }
  if (newSettings.cnpj !== void 0) {
    payload.cnpj = newSettings.cnpj.trim().slice(0, 30);
  }
  if (newSettings.contactEmail !== void 0) {
    payload.contact_email = newSettings.contactEmail.trim().slice(0, 150);
  }
  if (newSettings.lowStockAlertNotification !== void 0) {
    payload.low_stock_alert_notification = Boolean(newSettings.lowStockAlertNotification);
  }
  await sbRequest("system_settings?id=eq.global", {
    method: "PATCH",
    prefer: "return=minimal",
    body: payload
  });
}
async function updateManagedListsSupabase(params) {
  await sbRequest("managed_lists?id=eq.global", {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      groups: params.lists.groups.slice(0, 100),
      roles: params.lists.roles.slice(0, 100),
      destinations: params.lists.destinations.slice(0, 150),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  if (params.renameGroup) {
    const { oldName, newName } = params.renameGroup;
    await Promise.all([
      sbRequest(`products?group_name=eq.${encodeURIComponent(oldName)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { group_name: newName, updated_at: (/* @__PURE__ */ new Date()).toISOString() }
      }),
      sbRequest(`movements?group_name=eq.${encodeURIComponent(oldName)}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { group_name: newName }
      })
    ]);
  }
  if (params.renameRole) {
    const { oldName, newName } = params.renameRole;
    await sbRequest(`users?role=eq.${encodeURIComponent(oldName)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { role: newName, updated_at: (/* @__PURE__ */ new Date()).toISOString() }
    });
  }
}
async function createUserSupabase(newUser) {
  const emailLower = newUser.email.trim().toLowerCase();
  if (!emailLower || !newUser.name.trim()) {
    throw new DomainError("Nome e e-mail do usu\xE1rio s\xE3o obrigat\xF3rios.", 400);
  }
  const inserted = await sbRequest("users", {
    method: "POST",
    prefer: "return=representation",
    body: {
      id: `user-${Date.now()}`,
      name: newUser.name.trim().slice(0, 120),
      email: emailLower.slice(0, 200),
      role: newUser.role.trim().slice(0, 100),
      department: (newUser.department || "").trim().slice(0, 100),
      is_admin: Boolean(newUser.isAdmin),
      can_delete: Boolean(newUser.isAdmin || newUser.canDelete),
      active: Boolean(newUser.active),
      permissions: normalizePermissions(newUser.permissions),
      registration_date: formatDateToday(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return mapUser(inserted[0]);
}
async function updateUserSupabase(updatedUser) {
  const emailLower = updatedUser.email.trim().toLowerCase();
  const updated = await sbRequest(
    `users?id=eq.${encodeURIComponent(updatedUser.id)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        name: updatedUser.name.trim().slice(0, 120),
        email: emailLower.slice(0, 200),
        role: updatedUser.role.trim().slice(0, 100),
        department: (updatedUser.department || "").trim().slice(0, 100),
        is_admin: Boolean(updatedUser.isAdmin),
        can_delete: Boolean(updatedUser.isAdmin || updatedUser.canDelete),
        active: Boolean(updatedUser.active),
        permissions: normalizePermissions(updatedUser.permissions),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  );
  if (!updated[0]) throw new DomainError("Usu\xE1rio n\xE3o encontrado.", 404);
  return mapUser(updated[0]);
}
async function updateUserPermissionsSupabase(userId, permissions) {
  await sbRequest(`users?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      permissions: normalizePermissions(permissions),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function updateUserDeletePermissionSupabase(userId, canDelete) {
  const existing = await sbRequest(
    `users?id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  if (!existing[0]) throw new DomainError("Usu\xE1rio n\xE3o encontrado.", 404);
  if (existing[0].is_admin) {
    throw new DomainError("O Administrador principal sempre possui permiss\xE3o total.", 400);
  }
  await sbRequest(`users?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { can_delete: Boolean(canDelete), updated_at: (/* @__PURE__ */ new Date()).toISOString() }
  });
}
async function deleteUserSupabase(userId) {
  if (userId === "user-owner") {
    throw new DomainError("N\xE3o \xE9 permitido excluir o Administrador principal.", 400);
  }
  await sbRequest(`users?id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
}
async function createAccessRequestSupabase(params) {
  const emailLower = params.email.trim().toLowerCase();
  const cleanName = params.name.trim();
  if (!emailLower || !emailLower.includes("@")) {
    throw new DomainError("Informe um endere\xE7o de e-mail v\xE1lido.", 400);
  }
  if (cleanName.length < 2) {
    throw new DomainError("Informe seu nome completo (m\xEDnimo 2 caracteres).", 400);
  }
  await ensureDefaultsSeededSupabase();
  if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return {
      alreadyAuthorized: true,
      message: 'Este e-mail j\xE1 \xE9 o Administrador Principal do sistema. Clique em "J\xE1 tenho senha" ou "Continuar com conta Google" para entrar.'
    };
  }
  const existingUsers = await sbRequest(
    `users?email=eq.${encodeURIComponent(emailLower)}&limit=1`
  );
  if (existingUsers[0] && existingUsers[0].active !== false) {
    return {
      alreadyAuthorized: true,
      message: 'Este e-mail j\xE1 est\xE1 autorizado! Use a aba "Primeiro Acesso" para criar sua senha ou clique em "Continuar com conta Google".'
    };
  }
  const existingPending = await sbRequest(
    `access_requests?email=eq.${encodeURIComponent(emailLower)}&status=eq.PENDENTE&limit=1`
  );
  const nowFormatted = formatDateTimeNow();
  if (existingPending[0]) {
    const updated = await sbRequest(
      `access_requests?id=eq.${encodeURIComponent(String(existingPending[0].id))}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: {
          name: cleanName.slice(0, 120),
          role: (params.role || "").trim().slice(0, 100),
          department: (params.department || "").trim().slice(0, 100),
          reason: (params.reason || "").trim().slice(0, 500),
          date: nowFormatted,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      }
    );
    return {
      request: mapAccessRequest(updated[0]),
      message: "Seu pedido de acesso foi atualizado e reenviado ao Administrador da QHS Engenharia! Assim que aprovado, voc\xEA poder\xE1 entrar no aplicativo."
    };
  }
  const inserted = await sbRequest("access_requests", {
    method: "POST",
    prefer: "return=representation",
    body: {
      id: `acc-req-${Date.now()}`,
      org_id: ORG_ID,
      name: cleanName.slice(0, 120),
      email: emailLower.slice(0, 200),
      role: (params.role || "").trim().slice(0, 100),
      department: (params.department || "").trim().slice(0, 100),
      reason: (params.reason || "").trim().slice(0, 500),
      date: nowFormatted,
      status: "PENDENTE",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return {
    request: mapAccessRequest(inserted[0]),
    message: "Pedido enviado com sucesso ao Administrador! Aguarde a aprova\xE7\xE3o e tente entrar novamente."
  };
}
async function approveAccessRequestSupabase(params) {
  const reqRows = await sbRequest(
    `access_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new DomainError("Pedido de acesso n\xE3o encontrado.", 404);
  if (reqRow.status !== "PENDENTE") {
    throw new DomainError("Este pedido de acesso j\xE1 foi analisado.", 400);
  }
  const emailLower = String(reqRow.email || "").trim().toLowerCase();
  const defaultPerms = normalizePermissions(
    params.permissions ?? {
      dashboard: true,
      produtos: true,
      entradas: false,
      saidas: true,
      colaboradores: true,
      relatorios: false,
      estatisticas: false,
      configuracoes: false
    }
  );
  const resolvedRole = (params.role ?? String(reqRow.role || "")) || "Operador de Estoque";
  const resolvedDepartment = params.department ?? String(reqRow.department || "");
  const existingUsers = await sbRequest(
    `users?email=eq.${encodeURIComponent(emailLower)}&limit=1`
  );
  let savedUserRow;
  if (existingUsers[0]) {
    const updatedUsers = await sbRequest(
      `users?id=eq.${encodeURIComponent(String(existingUsers[0].id))}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: {
          name: String(reqRow.name || "").trim().slice(0, 120),
          role: resolvedRole.trim().slice(0, 100),
          department: resolvedDepartment.trim().slice(0, 100),
          can_delete: Boolean(existingUsers[0].is_admin || params.canDelete),
          active: true,
          permissions: existingUsers[0].is_admin ? FULL_ADMIN_PERMISSIONS : defaultPerms,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      }
    );
    savedUserRow = updatedUsers[0];
  } else {
    const insertedUsers = await sbRequest("users", {
      method: "POST",
      prefer: "return=representation",
      body: {
        id: `user-${Date.now()}`,
        name: String(reqRow.name || "").trim().slice(0, 120),
        email: emailLower.slice(0, 200),
        role: resolvedRole.trim().slice(0, 100),
        department: resolvedDepartment.trim().slice(0, 100),
        is_admin: false,
        can_delete: Boolean(params.canDelete),
        active: true,
        permissions: defaultPerms,
        registration_date: formatDateToday(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    savedUserRow = insertedUsers[0];
  }
  const updatedReqs = await sbRequest(
    `access_requests?id=eq.${encodeURIComponent(params.requestId)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        status: "APROVADO",
        reviewed_by: params.admin.name.slice(0, 120),
        reviewed_at: formatDateTimeNow(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  );
  return {
    user: mapUser(savedUserRow),
    request: mapAccessRequest(updatedReqs[0])
  };
}
async function rejectAccessRequestSupabase(params) {
  const reqRows = await sbRequest(
    `access_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new DomainError("Pedido de acesso n\xE3o encontrado.", 404);
  if (reqRow.status !== "PENDENTE") {
    throw new DomainError("Este pedido de acesso j\xE1 foi analisado.", 400);
  }
  const updated = await sbRequest(
    `access_requests?id=eq.${encodeURIComponent(params.requestId)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        status: "RECUSADO",
        reviewed_by: params.admin.name.slice(0, 120),
        reviewed_at: formatDateTimeNow(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  );
  return mapAccessRequest(updated[0]);
}
async function createCollaboratorSupabase(params) {
  const trimmedName = params.fullName.trim();
  if (trimmedName.length < 2) {
    throw new DomainError("Informe o nome completo do colaborador (m\xEDnimo 2 caracteres).", 400);
  }
  const allColabs = await sbRequest("collaborators?select=id,full_name");
  if (allColabs.some(
    (c) => String(c.full_name || "").trim().toLowerCase() === trimmedName.toLowerCase()
  )) {
    throw new DomainError(
      `J\xE1 existe um colaborador cadastrado com o nome "${trimmedName}".`,
      409
    );
  }
  const inserted = await sbRequest("collaborators", {
    method: "POST",
    prefer: "return=representation",
    body: {
      id: `colab-${Date.now()}`,
      org_id: ORG_ID,
      full_name: trimmedName.slice(0, 120),
      role: (params.role || "").trim().slice(0, 100),
      active: params.active ?? true,
      registration_date: formatDateToday(),
      display_updated_at: formatDateTimeNow(),
      owner_uid: params.ownerUid,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return mapCollaborator(inserted[0]);
}
async function updateCollaboratorSupabase(params) {
  const trimmedName = params.fullName.trim();
  if (trimmedName.length < 2) {
    throw new DomainError("Informe o nome completo do colaborador (m\xEDnimo 2 caracteres).", 400);
  }
  const allColabs = await sbRequest("collaborators?select=id,full_name");
  if (allColabs.some(
    (c) => String(c.id) !== params.id && String(c.full_name || "").trim().toLowerCase() === trimmedName.toLowerCase()
  )) {
    throw new DomainError(
      `J\xE1 existe outro colaborador cadastrado com o nome "${trimmedName}".`,
      409
    );
  }
  const updated = await sbRequest(
    `collaborators?id=eq.${encodeURIComponent(params.id)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        full_name: trimmedName.slice(0, 120),
        role: (params.role || "").trim().slice(0, 100),
        active: Boolean(params.active),
        display_updated_at: formatDateTimeNow(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  );
  if (!updated[0]) throw new DomainError("Colaborador n\xE3o encontrado.", 404);
  return mapCollaborator(updated[0]);
}
async function toggleCollaboratorActiveSupabase(collaboratorId) {
  const existing = await sbRequest(
    `collaborators?id=eq.${encodeURIComponent(collaboratorId)}&limit=1`
  );
  if (!existing[0]) throw new DomainError("Colaborador n\xE3o encontrado.", 404);
  const updated = await sbRequest(
    `collaborators?id=eq.${encodeURIComponent(collaboratorId)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        active: existing[0].active === false,
        display_updated_at: formatDateTimeNow(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  );
  return mapCollaborator(updated[0]);
}
async function deleteCollaboratorSupabase(params) {
  const targets = await sbRequest(
    `collaborators?id=eq.${encodeURIComponent(params.collaboratorId)}&limit=1`
  );
  const target = targets[0];
  if (!target) throw new DomainError("Colaborador n\xE3o encontrado.", 404);
  const movRows = await sbRequest("movements?type=eq.SAIDA&select=collaborator_id,withdrawn_by");
  const fullNameLower = String(target.full_name || "").trim().toLowerCase();
  const relatedExitsCount = movRows.filter(
    (m) => m.collaborator_id ? String(m.collaborator_id) === String(target.id) : String(m.withdrawn_by || "").trim().toLowerCase() === fullNameLower
  ).length;
  await sbRequest(`collaborators?id=eq.${encodeURIComponent(params.collaboratorId)}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
  const now = formatDateTimeNow();
  await sbRequest("deletion_logs", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: `del-log-${Date.now()}`,
      org_id: ORG_ID,
      origin: "DIRETA",
      record_type: "COLABORADOR",
      target_id: String(target.id),
      target_code: "",
      target_name: String(target.full_name),
      target_details: target.role ? `Fun\xE7\xE3o: ${target.role} \xB7 Status: ${target.active !== false ? "Ativo" : "Inativo"}` : `Colaborador de obra \xB7 Status: ${target.active !== false ? "Ativo" : "Inativo"}`,
      quantity: relatedExitsCount,
      reason: "Exclus\xE3o direta por usu\xE1rio autorizado",
      requested_by: params.actor.name,
      requested_by_date: now,
      deleted_by: params.actor.name,
      deleted_by_email: params.actorEmail.toLowerCase(),
      deleted_by_uid: params.actorUid,
      deleted_at: now
    }
  });
  return String(target.full_name);
}
async function createProductSupabase(ownerUid, prodData) {
  const inserted = await sbRequest("products", {
    method: "POST",
    prefer: "return=representation",
    body: {
      id: `prod-${Date.now()}`,
      org_id: ORG_ID,
      code: prodData.code.trim().slice(0, 60),
      name: prodData.name.trim().slice(0, 200),
      group_name: prodData.group.trim().slice(0, 80),
      current_stock: Math.max(0, Number(prodData.currentStock)),
      min_stock: Math.max(0, Number(prodData.minStock)),
      photo_url: (prodData.photoUrl || "").slice(0, 3e5),
      description: (prodData.description || "").slice(0, 1e3),
      registration_date: formatDateToday(),
      display_updated_at: formatDateTimeNow(),
      owner_uid: ownerUid,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return mapProduct(inserted[0]);
}
async function updateProductSupabase(updatedProduct) {
  const updated = await sbRequest(
    `products?id=eq.${encodeURIComponent(updatedProduct.id)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        code: updatedProduct.code.trim().slice(0, 60),
        name: updatedProduct.name.trim().slice(0, 200),
        group_name: updatedProduct.group.trim().slice(0, 80),
        current_stock: Number(updatedProduct.currentStock),
        min_stock: Math.max(0, Number(updatedProduct.minStock)),
        photo_url: (updatedProduct.photoUrl || "").slice(0, 3e5),
        description: (updatedProduct.description || "").slice(0, 1e3),
        display_updated_at: formatDateTimeNow(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  );
  if (!updated[0]) throw new DomainError("Produto n\xE3o encontrado.", 404);
  return mapProduct(updated[0]);
}
async function deleteProductSupabase(params) {
  const targets = await sbRequest(
    `products?id=eq.${encodeURIComponent(params.productId)}&limit=1`
  );
  const target = targets[0];
  if (!target) throw new DomainError("Produto n\xE3o encontrado.", 404);
  await sbRequest(`products?id=eq.${encodeURIComponent(params.productId)}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
  const now = formatDateTimeNow();
  await sbRequest("deletion_logs", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: `del-log-${Date.now()}`,
      org_id: ORG_ID,
      origin: "DIRETA",
      record_type: "PRODUTO",
      target_id: String(target.id),
      target_code: String(target.code || ""),
      target_name: String(target.name || ""),
      target_details: `Grupo: ${target.group_name} \xB7 Estoque no momento da exclus\xE3o: ${target.current_stock} un`,
      quantity: Number(target.current_stock ?? 0),
      reason: "Exclus\xE3o direta por usu\xE1rio autorizado",
      requested_by: params.actor.name,
      requested_by_date: now,
      deleted_by: params.actor.name,
      deleted_by_email: params.actorEmail.toLowerCase(),
      deleted_by_uid: params.actorUid,
      deleted_at: now
    }
  });
  return String(target.name);
}
async function recordMovementSupabase(params) {
  const qty = Number(params.quantity);
  if (Number.isNaN(qty) || qty <= 0) {
    throw new DomainError("Quantidade deve ser maior que zero.", 400);
  }
  const prodRows = await sbRequest(
    `products?id=eq.${encodeURIComponent(params.productId)}&limit=1`
  );
  const prod = prodRows[0];
  if (!prod) throw new DomainError("Produto n\xE3o encontrado.", 404);
  const currentStock = Number(prod.current_stock ?? 0);
  if (params.type === "SAIDA" && !params.isNegativeStockAuthorized && currentStock < qty) {
    throw new DomainError(
      `Saldo insuficiente! Estoque dispon\xEDvel: ${currentStock} un. Necess\xE1rio solicitar autoriza\xE7\xE3o ao Administrador.`,
      400
    );
  }
  if (params.type === "SAIDA" && params.isNegativeStockAuthorized && !params.actor.isAdmin) {
    throw new DomainError("Somente o Administrador pode autorizar sa\xEDda com saldo negativo.", 403);
  }
  let resolvedWithdrawnBy = params.withdrawnBy?.trim() || "";
  let resolvedCollaboratorId = params.collaboratorId || void 0;
  if (resolvedCollaboratorId) {
    const colabRows = await sbRequest(
      `collaborators?id=eq.${encodeURIComponent(resolvedCollaboratorId)}&limit=1`
    );
    if (colabRows[0]) {
      resolvedWithdrawnBy = String(colabRows[0].full_name || resolvedWithdrawnBy);
    } else {
      resolvedCollaboratorId = void 0;
    }
  }
  const newStock = params.type === "ENTRADA" ? currentStock + qty : currentStock - qty;
  const formattedDate = params.date?.trim() || formatDateTimeNow();
  const movId = params.id || `mov-${Date.now()}`;
  await sbRequest("movements", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: movId,
      org_id: ORG_ID,
      product_id: String(prod.id),
      product_code: String(prod.code),
      product_name: String(prod.name),
      group_name: String(prod.group_name),
      type: params.type,
      quantity: qty,
      stock_after_movement: newStock,
      date: formattedDate.slice(0, 30),
      withdrawn_by: resolvedWithdrawnBy ? resolvedWithdrawnBy.slice(0, 120) : null,
      collaborator_id: resolvedCollaboratorId ?? null,
      responsible_user: params.actor.name.slice(0, 120),
      destination: params.destination ? params.destination.slice(0, 150) : null,
      notes: params.notes ? params.notes.slice(0, 1e3) : null,
      is_negative_stock_authorized: params.isNegativeStockAuthorized ?? null,
      authorized_by: params.authorizedBy ? params.authorizedBy.slice(0, 120) : null,
      owner_uid: params.actorUid
    }
  });
  await sbRequest(`products?id=eq.${encodeURIComponent(String(prod.id))}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      current_stock: newStock,
      display_updated_at: formattedDate.slice(0, 30),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return { stockAfter: newStock, movId };
}
async function deleteMovementSupabase(params) {
  const movRows = await sbRequest(
    `movements?id=eq.${encodeURIComponent(params.movementId)}&limit=1`
  );
  const mov = movRows[0];
  if (!mov) throw new DomainError("Movimenta\xE7\xE3o n\xE3o encontrada.", 404);
  const movType = mov.type === "ENTRADA" ? "ENTRADA" : "SAIDA";
  const qty = Number(mov.quantity ?? 0);
  let productUpdated = false;
  let newStock;
  const prodRows = await sbRequest(
    `products?id=eq.${encodeURIComponent(String(mov.product_id))}&limit=1`
  );
  if (prodRows[0]) {
    const currentStock = Number(prodRows[0].current_stock ?? 0);
    newStock = movType === "ENTRADA" ? currentStock - qty : currentStock + qty;
    await sbRequest(`products?id=eq.${encodeURIComponent(String(mov.product_id))}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        current_stock: newStock,
        display_updated_at: formatDateTimeNow(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    productUpdated = true;
  }
  await sbRequest(`movements?id=eq.${encodeURIComponent(params.movementId)}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
  const now = formatDateTimeNow();
  await sbRequest("deletion_logs", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: `del-log-${Date.now()}`,
      org_id: ORG_ID,
      origin: "DIRETA",
      record_type: movType,
      target_id: String(mov.id),
      target_code: String(mov.product_code || ""),
      target_name: String(mov.product_name || ""),
      target_details: `${movType === "ENTRADA" ? "Entrada" : "Sa\xEDda"} registrada em ${mov.date}${mov.destination ? ` \xB7 Obra: ${mov.destination}` : ""}${mov.withdrawn_by ? ` \xB7 Retirada: ${mov.withdrawn_by}` : ""}`,
      quantity: qty,
      reason: "Exclus\xE3o direta por usu\xE1rio autorizado",
      requested_by: params.actor.name,
      requested_by_date: now,
      deleted_by: params.actor.name,
      deleted_by_email: params.actorEmail.toLowerCase(),
      deleted_by_uid: params.actorUid,
      deleted_at: now
    }
  });
  return { productUpdated, newStock };
}
async function createNegativeRequestSupabase(params) {
  const prodRows = await sbRequest(
    `products?id=eq.${encodeURIComponent(params.productId)}&limit=1`
  );
  const prod = prodRows[0];
  if (!prod) throw new DomainError("Produto n\xE3o encontrado.", 404);
  let resolvedWithdrawnBy = params.withdrawnBy.trim();
  let resolvedCollaboratorId = params.collaboratorId || void 0;
  if (resolvedCollaboratorId) {
    const colabRows = await sbRequest(
      `collaborators?id=eq.${encodeURIComponent(resolvedCollaboratorId)}&limit=1`
    );
    if (colabRows[0]) {
      resolvedWithdrawnBy = String(colabRows[0].full_name || resolvedWithdrawnBy);
    } else {
      resolvedCollaboratorId = void 0;
    }
  }
  const reqId = params.id || `req-neg-${Date.now()}`;
  const availableStock = Number(prod.current_stock ?? 0);
  const deficit = Math.max(0, Number(params.requestedQuantity) - availableStock);
  await sbRequest("negative_requests", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: reqId,
      org_id: ORG_ID,
      product_id: String(prod.id),
      product_code: String(prod.code),
      product_name: String(prod.name),
      group_name: String(prod.group_name),
      requested_quantity: Number(params.requestedQuantity),
      available_stock: availableStock,
      deficit_quantity: deficit,
      withdrawn_by: resolvedWithdrawnBy.slice(0, 120),
      collaborator_id: resolvedCollaboratorId ?? null,
      destination: params.destination.slice(0, 150),
      requested_by: params.actor.name.slice(0, 120),
      requested_by_uid: params.actorUid,
      reason: (params.reason || "Necessidade operacional urgente.").slice(0, 1e3),
      date: formatDateTimeNow(),
      status: "PENDENTE",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return { reqId };
}
async function approveNegativeRequestSupabase(params) {
  const reqRows = await sbRequest(
    `negative_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new DomainError("Solicita\xE7\xE3o n\xE3o encontrada.", 404);
  if (reqRow.status !== "PENDENTE") {
    throw new DomainError("Solicita\xE7\xE3o j\xE1 analisada anteriormente.", 400);
  }
  const prodRows = await sbRequest(
    `products?id=eq.${encodeURIComponent(String(reqRow.product_id))}&limit=1`
  );
  const prod = prodRows[0];
  if (!prod) throw new DomainError("Produto n\xE3o encontrado.", 404);
  const newStock = Number(prod.current_stock ?? 0) - Number(reqRow.requested_quantity ?? 0);
  const formattedDate = formatDateTimeNow();
  await sbRequest(`negative_requests?id=eq.${encodeURIComponent(params.requestId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      status: "APROVADO",
      reviewed_by: params.admin.name.slice(0, 120),
      reviewed_at: formattedDate,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  await sbRequest("movements", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: `mov-${Date.now()}`,
      org_id: ORG_ID,
      product_id: String(prod.id),
      product_code: String(prod.code),
      product_name: String(prod.name),
      group_name: String(prod.group_name),
      type: "SAIDA",
      quantity: Number(reqRow.requested_quantity),
      stock_after_movement: newStock,
      date: formattedDate,
      withdrawn_by: String(reqRow.withdrawn_by || ""),
      collaborator_id: reqRow.collaborator_id ?? null,
      responsible_user: params.admin.name.slice(0, 120),
      destination: String(reqRow.destination || ""),
      notes: `[AUTORIZA\xC7\xC3O EXCEPCIONAL ADMINISTRADOR: ${params.admin.name}] Motivo: ${reqRow.reason}`.slice(
        0,
        1e3
      ),
      is_negative_stock_authorized: true,
      authorized_by: params.admin.name.slice(0, 120),
      owner_uid: params.adminUid
    }
  });
  await sbRequest(`products?id=eq.${encodeURIComponent(String(prod.id))}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      current_stock: newStock,
      display_updated_at: formattedDate,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return { newStock, productName: String(prod.name) };
}
async function rejectNegativeRequestSupabase(requestId, adminName) {
  const existing = await sbRequest(
    `negative_requests?id=eq.${encodeURIComponent(requestId)}&limit=1`
  );
  if (!existing[0]) throw new DomainError("Solicita\xE7\xE3o n\xE3o encontrada.", 404);
  await sbRequest(`negative_requests?id=eq.${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      status: "RECUSADO",
      reviewed_by: adminName.slice(0, 120),
      reviewed_at: formatDateTimeNow(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function deleteNegativeRequestSupabase(params) {
  const reqRows = await sbRequest(
    `negative_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const target = reqRows[0];
  if (!target) throw new DomainError("Solicita\xE7\xE3o n\xE3o encontrada.", 404);
  await sbRequest(`negative_requests?id=eq.${encodeURIComponent(params.requestId)}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
  const now = formatDateTimeNow();
  await sbRequest("deletion_logs", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: `del-log-${Date.now()}`,
      org_id: ORG_ID,
      origin: "DIRETA",
      record_type: "SOLICITACAO_NEGATIVA",
      target_id: String(target.id),
      target_code: String(target.product_code || ""),
      target_name: String(target.product_name || ""),
      target_details: `Retirada: ${target.withdrawn_by} \xB7 Obra: ${target.destination}`,
      quantity: Number(target.requested_quantity ?? 0),
      reason: "Exclus\xE3o direta por usu\xE1rio autorizado",
      requested_by: params.actor.name,
      requested_by_date: now,
      deleted_by: params.actor.name,
      deleted_by_email: params.actorEmail.toLowerCase(),
      deleted_by_uid: params.actorUid,
      deleted_at: now
    }
  });
}
async function createDeletionRequestSupabase(params) {
  const trimmedReason = params.reason.trim();
  if (trimmedReason.length < 3) {
    throw new DomainError(
      "Informe uma justificativa com pelo menos 3 caracteres explicando o motivo da exclus\xE3o.",
      400
    );
  }
  const existingPending = await sbRequest(
    `deletion_requests?target_id=eq.${encodeURIComponent(params.targetId)}&requested_by_uid=eq.${encodeURIComponent(params.actorUid)}&status=eq.PENDENTE&limit=1`
  );
  if (existingPending[0]) {
    throw new DomainError(
      "J\xE1 existe uma solicita\xE7\xE3o de exclus\xE3o pendente aguardando aprova\xE7\xE3o para este registro.",
      409
    );
  }
  const reqId = `del-req-${Date.now()}`;
  await sbRequest("deletion_requests", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: reqId,
      org_id: ORG_ID,
      record_type: params.recordType,
      target_id: params.targetId,
      target_code: params.targetCode.slice(0, 60),
      target_name: params.targetName.slice(0, 200),
      target_details: params.targetDetails.slice(0, 400),
      quantity: Number(params.quantity),
      reason: trimmedReason.slice(0, 1e3),
      requested_by: params.actor.name.slice(0, 120),
      requested_by_email: params.actorEmail.toLowerCase().slice(0, 200),
      requested_by_uid: params.actorUid,
      date: formatDateTimeNow(),
      status: "PENDENTE",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return { reqId };
}
async function approveDeletionRequestSupabase(params) {
  const reqRows = await sbRequest(
    `deletion_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new DomainError("Solicita\xE7\xE3o de exclus\xE3o n\xE3o encontrada.", 404);
  if (reqRow.status !== "PENDENTE") {
    throw new DomainError("Esta solicita\xE7\xE3o j\xE1 foi analisada anteriormente.", 400);
  }
  const targetId = String(reqRow.target_id);
  const recordType = toRecordType(reqRow.record_type);
  let stockNote = "";
  if (recordType === "PRODUTO") {
    await sbRequest(`products?id=eq.${encodeURIComponent(targetId)}`, {
      method: "DELETE",
      prefer: "return=minimal"
    });
  } else if (recordType === "ENTRADA" || recordType === "SAIDA") {
    const movRows = await sbRequest(`movements?id=eq.${encodeURIComponent(targetId)}&limit=1`);
    const mov = movRows[0];
    if (mov) {
      const prodRows = await sbRequest(
        `products?id=eq.${encodeURIComponent(String(mov.product_id))}&limit=1`
      );
      if (prodRows[0]) {
        const currentStock = Number(prodRows[0].current_stock ?? 0);
        const qty = Number(mov.quantity ?? 0);
        const newStock = mov.type === "ENTRADA" ? currentStock - qty : currentStock + qty;
        await sbRequest(`products?id=eq.${encodeURIComponent(String(mov.product_id))}`, {
          method: "PATCH",
          prefer: "return=minimal",
          body: {
            current_stock: newStock,
            display_updated_at: formatDateTimeNow(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
        stockNote = ` Estoque atualizado de "${reqRow.target_name}": ${newStock} un.`;
      }
      await sbRequest(`movements?id=eq.${encodeURIComponent(String(mov.id))}`, {
        method: "DELETE",
        prefer: "return=minimal"
      });
    }
  } else if (recordType === "SOLICITACAO_NEGATIVA") {
    await sbRequest(`negative_requests?id=eq.${encodeURIComponent(targetId)}`, {
      method: "DELETE",
      prefer: "return=minimal"
    });
  } else if (recordType === "COLABORADOR") {
    await sbRequest(`collaborators?id=eq.${encodeURIComponent(targetId)}`, {
      method: "DELETE",
      prefer: "return=minimal"
    });
  }
  const now = formatDateTimeNow();
  await sbRequest(`deletion_requests?id=eq.${encodeURIComponent(String(reqRow.id))}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      status: "APROVADO",
      reviewed_by: params.admin.name.slice(0, 120),
      reviewed_by_email: params.adminEmail.toLowerCase().slice(0, 200),
      reviewed_at: now,
      executed_by: params.admin.name.slice(0, 120),
      executed_at: now,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  await sbRequest("deletion_logs", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: `del-log-${Date.now()}`,
      org_id: ORG_ID,
      origin: "APROVADA",
      request_id: String(reqRow.id),
      record_type: recordType,
      target_id: targetId,
      target_code: String(reqRow.target_code || ""),
      target_name: String(reqRow.target_name || ""),
      target_details: String(reqRow.target_details || ""),
      quantity: Number(reqRow.quantity ?? 0),
      reason: String(reqRow.reason || ""),
      requested_by: String(reqRow.requested_by || ""),
      requested_by_date: String(reqRow.date || ""),
      approved_by: params.admin.name.slice(0, 120),
      approved_at: now,
      deleted_by: params.admin.name.slice(0, 120),
      deleted_by_email: params.adminEmail.toLowerCase().slice(0, 200),
      deleted_by_uid: params.adminUid,
      deleted_at: now
    }
  });
  return { targetName: String(reqRow.target_name || ""), stockNote };
}
async function rejectDeletionRequestSupabase(params) {
  const reqRows = await sbRequest(
    `deletion_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new DomainError("Solicita\xE7\xE3o de exclus\xE3o n\xE3o encontrada.", 404);
  if (reqRow.status !== "PENDENTE") {
    throw new DomainError("Esta solicita\xE7\xE3o j\xE1 foi analisada anteriormente.", 400);
  }
  await sbRequest(`deletion_requests?id=eq.${encodeURIComponent(params.requestId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      status: "RECUSADO",
      reviewed_by: params.admin.name.slice(0, 120),
      reviewed_by_email: params.adminEmail.toLowerCase().slice(0, 200),
      reviewed_at: formatDateTimeNow(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return { targetName: String(reqRow.target_name || "") };
}
async function resetAllDataSupabase(adminUid, adminEmail, adminName) {
  await sbRequest("movements?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
  await sbRequest("negative_requests?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
  await sbRequest("deletion_requests?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
  await sbRequest("deletion_logs?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
  await sbRequest("access_requests?id=not.is.null", {
    method: "DELETE",
    prefer: "return=minimal",
    ignoreMissingTable: true
  });
  await sbRequest("collaborators?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
  await sbRequest("products?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
  await sbRequest("users?id=neq.user-owner", { method: "DELETE", prefer: "return=minimal" });
  await sbRequest("managed_lists?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      id: "global",
      groups: INITIAL_LISTS.groups,
      roles: INITIAL_LISTS.roles,
      destinations: INITIAL_LISTS.destinations,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  await sbRequest("system_settings?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      id: "global",
      show_product_photos: INITIAL_SETTINGS.showProductPhotos,
      company_name: INITIAL_SETTINGS.companyName,
      company_subtitle: INITIAL_SETTINGS.companySubtitle,
      cnpj: INITIAL_SETTINGS.cnpj,
      contact_email: INITIAL_SETTINGS.contactEmail,
      low_stock_alert_notification: INITIAL_SETTINGS.lowStockAlertNotification,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  await sbRequest("users?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      id: "user-owner",
      uid: adminUid,
      name: adminName.slice(0, 120),
      email: adminEmail.toLowerCase(),
      role: "Diretor de Engenharia & Admin",
      department: "Diretoria T\xE9cnica",
      is_admin: true,
      can_delete: true,
      active: true,
      permissions: FULL_ADMIN_PERMISSIONS,
      registration_date: formatDateToday(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}

// src/server/vercelEntry.ts
var cachedApp = null;
function getApp() {
  if (!cachedApp) {
    cachedApp = createApiApp({
      checkEmailInvitationStatus: checkEmailInvitationStatusSupabase,
      resolveAuthenticatedUser: resolveAuthenticatedUserSupabase,
      getBootstrapData: getBootstrapDataSupabase,
      updateSystemSettingsInDb: updateSystemSettingsSupabase,
      updateManagedListsInDb: updateManagedListsSupabase,
      createUserInDb: createUserSupabase,
      updateUserInDb: updateUserSupabase,
      updateUserPermissionsInDb: updateUserPermissionsSupabase,
      updateUserDeletePermissionInDb: updateUserDeletePermissionSupabase,
      deleteUserInDb: deleteUserSupabase,
      createAccessRequestInDb: createAccessRequestSupabase,
      approveAccessRequestInDb: approveAccessRequestSupabase,
      rejectAccessRequestInDb: rejectAccessRequestSupabase,
      createCollaboratorInDb: createCollaboratorSupabase,
      updateCollaboratorInDb: updateCollaboratorSupabase,
      toggleCollaboratorActiveInDb: toggleCollaboratorActiveSupabase,
      deleteCollaboratorInDb: deleteCollaboratorSupabase,
      createProductInDb: createProductSupabase,
      updateProductInDb: updateProductSupabase,
      deleteProductInDb: deleteProductSupabase,
      recordMovementInDb: recordMovementSupabase,
      deleteMovementInDb: deleteMovementSupabase,
      createNegativeRequestInDb: createNegativeRequestSupabase,
      approveNegativeRequestInDb: approveNegativeRequestSupabase,
      rejectNegativeRequestInDb: rejectNegativeRequestSupabase,
      deleteNegativeRequestInDb: deleteNegativeRequestSupabase,
      createDeletionRequestInDb: createDeletionRequestSupabase,
      approveDeletionRequestInDb: approveDeletionRequestSupabase,
      rejectDeletionRequestInDb: rejectDeletionRequestSupabase,
      resetAllDataInDb: resetAllDataSupabase
    });
  }
  return cachedApp;
}
function handler(req, res) {
  try {
    const rawUrl = req.url || "/";
    if (rawUrl.startsWith("/api/index")) {
      const parsed = new URL(rawUrl, "http://localhost");
      const pathParam = parsed.searchParams.get("__path") || "";
      parsed.searchParams.delete("__path");
      const remainingQuery = parsed.searchParams.toString();
      req.url = `/api/${pathParam.replace(/^\/+/, "")}${remainingQuery ? `?${remainingQuery}` : ""}`;
    }
    const app = getApp();
    return app(
      req,
      res
    );
  } catch (err) {
    console.error("Vercel API handler error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro interno ao inicializar servidor da API."
      })
    );
  }
}
export {
  handler as default
};
