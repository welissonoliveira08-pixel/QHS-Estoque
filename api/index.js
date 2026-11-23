// @ts-nocheck

// src/lib/verifyFirebaseJwt.ts
import crypto from "node:crypto";
var GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
var FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "sylvan-throne-pbcxw";
var cachedCerts = null;
var cachedCertsExpiresAt = 0;
function parseMaxAgeSeconds(cacheControl) {
  if (!cacheControl) return 3600;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return 3600;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 60 ? seconds : 3600;
}
async function getGooglePublicCerts(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < cachedCertsExpiresAt) {
    return cachedCerts;
  }
  const response = await fetch(GOOGLE_CERTS_URL, {
    method: "GET",
    signal: AbortSignal.timeout(8e3)
  });
  if (!response.ok) {
    throw new Error(`Falha ao obter certificados p\xFAblicos do Firebase (${response.status}).`);
  }
  const certs = await response.json();
  const maxAge = parseMaxAgeSeconds(response.headers.get("cache-control"));
  cachedCerts = certs;
  cachedCertsExpiresAt = now + maxAge * 1e3;
  return certs;
}
function decodeBase64UrlJson(segment) {
  const json = Buffer.from(segment, "base64url").toString("utf8");
  return JSON.parse(json);
}
async function verifyFirebaseIdToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Token JWT inv\xE1lido.");
  }
  const [headerSeg, payloadSeg, sigSeg] = parts;
  const header = decodeBase64UrlJson(headerSeg);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Cabe\xE7alho do token Firebase inv\xE1lido.");
  }
  let certs = await getGooglePublicCerts(false);
  let certPem = certs[header.kid];
  if (!certPem) {
    certs = await getGooglePublicCerts(true);
    certPem = certs[header.kid];
  }
  if (!certPem) {
    throw new Error("Certificado de assinatura do token n\xE3o encontrado.");
  }
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${headerSeg}.${payloadSeg}`);
  verifier.end();
  const signatureValid = verifier.verify(certPem, Buffer.from(sigSeg, "base64url"));
  if (!signatureValid) {
    throw new Error("Assinatura do token Firebase inv\xE1lida.");
  }
  const payload = decodeBase64UrlJson(payloadSeg);
  const nowSec = Math.floor(Date.now() / 1e3);
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error("Token Firebase emitido para outro projeto.");
  }
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new Error("Emissor do token Firebase inv\xE1lido.");
  }
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) {
    throw new Error("Identificador de usu\xE1rio inv\xE1lido no token.");
  }
  if (typeof payload.exp !== "number" || payload.exp <= nowSec - 30) {
    throw new Error("Token Firebase expirado.");
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSec + 300) {
    throw new Error("Data de emiss\xE3o do token Firebase inv\xE1lida.");
  }
  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : void 0,
    email_verified: Boolean(payload.email_verified),
    name: typeof payload.name === "string" ? payload.name : void 0
  };
}

// src/db/shared.ts
var ORG_ID = "qhs-engenharia";
var BOOTSTRAPPED_ADMIN_EMAIL = "welisson.oliveira08@gmail.com";
var DomainError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
};
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
    destinos: perms?.destinos !== void 0 ? Boolean(perms.destinos) : true,
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
  destinos: true,
  relatorios: true,
  estatisticas: true,
  configuracoes: true
};

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
var ACCESS_REQUESTS_STORE_ID = "access_requests_store";
function isMissingTableDomainError(err) {
  if (err instanceof DomainError && err.statusCode === 503 && err.message.includes("Tabela n\xE3o encontrada")) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err || "");
  return msg.includes("PGRST205") || msg.includes("42P01") || msg.includes("Tabela n\xE3o encontrada");
}
async function readFallbackAccessRequestsSupabase() {
  const rows = await sbRequest(
    `managed_lists?id=eq.${ACCESS_REQUESTS_STORE_ID}&limit=1`
  );
  const store = rows[0];
  if (!store || !Array.isArray(store.groups)) return [];
  return store.groups;
}
async function writeFallbackAccessRequestsSupabase(rows) {
  await sbRequest("managed_lists?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      id: ACCESS_REQUESTS_STORE_ID,
      groups: rows,
      roles: [],
      destinations: [],
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
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
    sbRequest(`managed_lists?id=in.(global,${ACCESS_REQUESTS_STORE_ID})`),
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
  const listsRow = listsRows.find((r) => r.id === "global");
  const fallbackStoreRow = listsRows.find((r) => r.id === ACCESS_REQUESTS_STORE_ID);
  const fallbackAccessReqRows = currentUser.isAdmin && accessReqRows.length === 0 && fallbackStoreRow && Array.isArray(fallbackStoreRow.groups) ? fallbackStoreRow.groups : [];
  const effectiveAccessReqRows = accessReqRows.length > 0 ? accessReqRows : fallbackAccessReqRows;
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
    accessRequests: effectiveAccessReqRows.map(mapAccessRequest).sort((a, b) => b.date.localeCompare(a.date)),
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
async function updateDestinationsSupabase(destinations) {
  await ensureDefaultsSeededSupabase();
  await sbRequest("managed_lists?id=eq.global", {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      destinations: destinations.map((d) => String(d || "").trim().slice(0, 120)).filter(Boolean).slice(0, 150),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function createUserSupabase(newUser) {
  const emailLower = newUser.email.trim().toLowerCase();
  if (!emailLower || !newUser.name.trim()) {
    throw new DomainError("Nome e e-mail do usu\xE1rio s\xE3o obrigat\xF3rios.", 400);
  }
  const existing = await sbRequest(
    `users?email=eq.${encodeURIComponent(emailLower)}&select=id&limit=1`
  );
  if (existing[0]) {
    throw new DomainError("J\xE1 existe um usu\xE1rio cadastrado com este e-mail.", 409);
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
  const duplicate = await sbRequest(
    `users?email=eq.${encodeURIComponent(emailLower)}&select=id&limit=1`
  );
  if (duplicate[0] && String(duplicate[0].id) !== updatedUser.id) {
    throw new DomainError("J\xE1 existe outro usu\xE1rio cadastrado com este e-mail.", 409);
  }
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
      message: 'Este e-mail j\xE1 est\xE1 autorizado! Use a aba "1\xBA Acesso" para criar sua senha ou clique em "Continuar com conta Google".'
    };
  }
  const nowFormatted = formatDateTimeNow();
  try {
    const existingPending = await sbRequest(
      `access_requests?email=eq.${encodeURIComponent(emailLower)}&status=eq.PENDENTE&limit=1`
    );
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
  } catch (err) {
    if (!isMissingTableDomainError(err)) throw err;
    const storeRows = await readFallbackAccessRequestsSupabase();
    const existingIdx = storeRows.findIndex(
      (r) => String(r.email || "").trim().toLowerCase() === emailLower && String(r.status || "") === "PENDENTE"
    );
    if (existingIdx >= 0) {
      const updatedRow = {
        ...storeRows[existingIdx],
        name: cleanName.slice(0, 120),
        role: (params.role || "").trim().slice(0, 100),
        department: (params.department || "").trim().slice(0, 100),
        reason: (params.reason || "").trim().slice(0, 500),
        date: nowFormatted,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const nextStore = [...storeRows];
      nextStore[existingIdx] = updatedRow;
      await writeFallbackAccessRequestsSupabase(nextStore);
      return {
        request: mapAccessRequest(updatedRow),
        message: "Seu pedido de acesso foi atualizado e reenviado ao Administrador da QHS Engenharia! Assim que aprovado, voc\xEA poder\xE1 entrar no aplicativo."
      };
    }
    const newRow = {
      id: `acc-req-${Date.now()}`,
      org_id: ORG_ID,
      name: cleanName.slice(0, 120),
      email: emailLower.slice(0, 200),
      role: (params.role || "").trim().slice(0, 100),
      department: (params.department || "").trim().slice(0, 100),
      reason: (params.reason || "").trim().slice(0, 500),
      date: nowFormatted,
      status: "PENDENTE",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await writeFallbackAccessRequestsSupabase([newRow, ...storeRows]);
    return {
      request: mapAccessRequest(newRow),
      message: "Pedido enviado com sucesso ao Administrador! Aguarde a aprova\xE7\xE3o e tente entrar novamente."
    };
  }
}
async function approveAccessRequestSupabase(params) {
  let reqRow;
  let usingFallbackStore = false;
  let fallbackRows = [];
  try {
    const reqRows = await sbRequest(
      `access_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
    );
    reqRow = reqRows[0];
  } catch (err) {
    if (!isMissingTableDomainError(err)) throw err;
    usingFallbackStore = true;
    fallbackRows = await readFallbackAccessRequestsSupabase();
    reqRow = fallbackRows.find((r) => String(r.id) === params.requestId);
  }
  if (!reqRow && !usingFallbackStore) {
    fallbackRows = await readFallbackAccessRequestsSupabase();
    const fallbackMatch = fallbackRows.find((r) => String(r.id) === params.requestId);
    if (fallbackMatch) {
      usingFallbackStore = true;
      reqRow = fallbackMatch;
    }
  }
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
      destinos: true,
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
  const reviewedAt = formatDateTimeNow();
  if (usingFallbackStore) {
    const updatedReqRow = {
      ...reqRow,
      status: "APROVADO",
      reviewed_by: params.admin.name.slice(0, 120),
      reviewed_at: reviewedAt,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await writeFallbackAccessRequestsSupabase(
      fallbackRows.map((r) => String(r.id) === params.requestId ? updatedReqRow : r)
    );
    return {
      user: mapUser(savedUserRow),
      request: mapAccessRequest(updatedReqRow)
    };
  }
  const updatedReqs = await sbRequest(
    `access_requests?id=eq.${encodeURIComponent(params.requestId)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        status: "APROVADO",
        reviewed_by: params.admin.name.slice(0, 120),
        reviewed_at: reviewedAt,
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
  let reqRow;
  let usingFallbackStore = false;
  let fallbackRows = [];
  try {
    const reqRows = await sbRequest(
      `access_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
    );
    reqRow = reqRows[0];
  } catch (err) {
    if (!isMissingTableDomainError(err)) throw err;
    usingFallbackStore = true;
    fallbackRows = await readFallbackAccessRequestsSupabase();
    reqRow = fallbackRows.find((r) => String(r.id) === params.requestId);
  }
  if (!reqRow && !usingFallbackStore) {
    fallbackRows = await readFallbackAccessRequestsSupabase();
    const fallbackMatch = fallbackRows.find((r) => String(r.id) === params.requestId);
    if (fallbackMatch) {
      usingFallbackStore = true;
      reqRow = fallbackMatch;
    }
  }
  if (!reqRow) throw new DomainError("Pedido de acesso n\xE3o encontrado.", 404);
  if (reqRow.status !== "PENDENTE") {
    throw new DomainError("Este pedido de acesso j\xE1 foi analisado.", 400);
  }
  const reviewedAt = formatDateTimeNow();
  if (usingFallbackStore) {
    const updatedRow = {
      ...reqRow,
      status: "RECUSADO",
      reviewed_by: params.admin.name.slice(0, 120),
      reviewed_at: reviewedAt,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await writeFallbackAccessRequestsSupabase(
      fallbackRows.map((r) => String(r.id) === params.requestId ? updatedRow : r)
    );
    return mapAccessRequest(updatedRow);
  }
  const updated = await sbRequest(
    `access_requests?id=eq.${encodeURIComponent(params.requestId)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        status: "RECUSADO",
        reviewed_by: params.admin.name.slice(0, 120),
        reviewed_at: reviewedAt,
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
  await sbRequest(`managed_lists?id=eq.${ACCESS_REQUESTS_STORE_ID}`, {
    method: "DELETE",
    prefer: "return=minimal"
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
function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
async function readJsonBody(req) {
  const existingBody = req.body;
  if (existingBody && typeof existingBody === "object" && !Buffer.isBuffer(existingBody)) {
    return existingBody;
  }
  if (typeof existingBody === "string") {
    return existingBody.trim() ? JSON.parse(existingBody) : {};
  }
  const chunks = [];
  let totalBytes = 0;
  const maxBytes = 5 * 1024 * 1024;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      throw new DomainError("Tamanho m\xE1ximo da requisi\xE7\xE3o excedido (5 MB).", 413);
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}
function resolveApiPath(rawUrl) {
  const parsed = new URL(rawUrl || "/", "http://localhost");
  if (parsed.pathname === "/api/index" && parsed.searchParams.has("__path")) {
    const p = parsed.searchParams.get("__path") || "";
    return `/api/${p.replace(/^\/+/, "")}`;
  }
  return parsed.pathname;
}
async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new DomainError("N\xE3o autenticado: token ausente.", 401);
  }
  const tokenStr = authHeader.slice("Bearer ".length).trim();
  if (!tokenStr) {
    throw new DomainError("N\xE3o autenticado: token inv\xE1lido.", 401);
  }
  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(tokenStr);
  } catch (err) {
    console.error("Firebase token verification error:", err);
    throw new DomainError("Sess\xE3o inv\xE1lida ou expirada. Fa\xE7a login novamente.", 401);
  }
  if (!decoded.email || decoded.email_verified !== true) {
    throw new DomainError(
      "Acesso negado: confirme o link de verifica\xE7\xE3o enviado para o seu e-mail antes de acessar o sistema.",
      403
    );
  }
  const authResult = await resolveAuthenticatedUserSupabase({
    uid: decoded.uid,
    email: decoded.email,
    displayName: decoded.name
  });
  if (!authResult.authorized || !authResult.user) {
    throw new DomainError(authResult.errorMessage || "Acesso n\xE3o autorizado.", 403);
  }
  return {
    token: decoded,
    dbUser: authResult.user,
    isRealAdmin: authResult.isRealAdmin
  };
}
function assertAdmin(session) {
  if (!session.isRealAdmin || !session.dbUser.isAdmin) {
    throw new DomainError("Acesso restrito ao Administrador principal.", 403);
  }
}
function assertDirectDelete(session) {
  if (!session.dbUser.isAdmin && !session.dbUser.canDelete) {
    throw new DomainError(
      'Voc\xEA n\xE3o possui permiss\xE3o para excluir registros diretamente. Utilize a op\xE7\xE3o "Solicitar exclus\xE3o".',
      403
    );
  }
}
function matchPath(pathname, pattern) {
  const pathParts = pathname.replace(/\/+$/, "").split("/");
  const patternParts = pattern.replace(/\/+$/, "").split("/");
  if (pathParts.length !== patternParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const pat = patternParts[i];
    const actual = pathParts[i];
    if (pat.startsWith(":")) {
      params[pat.slice(1)] = decodeURIComponent(actual);
    } else if (pat !== actual) {
      return null;
    }
  }
  return params;
}
async function handler(req, res) {
  try {
    const method = (req.method || "GET").toUpperCase();
    const pathname = resolveApiPath(req.url || "/");
    if (method === "GET" && pathname === "/api/health") {
      const hasSupabaseUrl = Boolean(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
      );
      const hasSupabaseKey = Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
      );
      sendJson(res, 200, {
        ok: true,
        mode: "supabase",
        supabaseConfigured: hasSupabaseUrl && hasSupabaseKey
      });
      return;
    }
    if (method === "POST" && pathname === "/api/auth/verify-invite") {
      const body = await readJsonBody(req);
      const email = String(body.email ?? "").trim();
      const status = await checkEmailInvitationStatusSupabase(email);
      if (!status.authorized) {
        sendJson(res, 403, { error: status.message || "E-mail n\xE3o autorizado." });
        return;
      }
      sendJson(res, 200, status);
      return;
    }
    if (method === "POST" && pathname === "/api/auth/request-access") {
      const body = await readJsonBody(req);
      const result = await createAccessRequestSupabase({
        name: String(body.name ?? ""),
        email: String(body.email ?? ""),
        role: body.role ? String(body.role) : "",
        department: body.department ? String(body.department) : "",
        reason: body.reason ? String(body.reason) : ""
      });
      sendJson(res, result.alreadyAuthorized ? 200 : 201, result);
      return;
    }
    const session = await authenticateRequest(req);
    if (method === "GET" && pathname === "/api/bootstrap") {
      const data = await getBootstrapDataSupabase(session.dbUser, session.token.uid);
      sendJson(res, 200, data);
      return;
    }
    if (method === "PATCH" && pathname === "/api/settings/photos") {
      const body = await readJsonBody(req);
      const showProductPhotos = Boolean(body.showProductPhotos);
      await updateSystemSettingsSupabase({ showProductPhotos });
      sendJson(res, 200, { ok: true, showProductPhotos });
      return;
    }
    if (method === "PUT" && pathname === "/api/settings") {
      assertAdmin(session);
      const body = await readJsonBody(req);
      await updateSystemSettingsSupabase(body);
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "PUT" && pathname === "/api/lists") {
      assertAdmin(session);
      const body = await readJsonBody(req);
      const lists = body.lists;
      if (!lists || !Array.isArray(lists.groups) || !Array.isArray(lists.roles) || !Array.isArray(lists.destinations)) {
        throw new DomainError("Dados de listas inv\xE1lidos.", 400);
      }
      await updateManagedListsSupabase({
        lists,
        renameGroup: body.renameGroup,
        renameRole: body.renameRole
      });
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "PUT" && pathname === "/api/destinations") {
      if (!session.dbUser.isAdmin && session.dbUser.permissions?.destinos === false) {
        throw new DomainError(
          "Voc\xEA n\xE3o possui permiss\xE3o para alterar clientes e locais de destino.",
          403
        );
      }
      const body = await readJsonBody(req);
      if (!Array.isArray(body.destinations)) {
        throw new DomainError("Lista de clientes e locais de destino inv\xE1lida.", 400);
      }
      await updateDestinationsSupabase(body.destinations.map((d) => String(d ?? "")));
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && pathname === "/api/users") {
      assertAdmin(session);
      const body = await readJsonBody(req);
      const created = await createUserSupabase(body);
      sendJson(res, 201, created);
      return;
    }
    let params = matchPath(pathname, "/api/users/:id");
    if (params && method === "PUT") {
      assertAdmin(session);
      const body = await readJsonBody(req);
      const updated = await updateUserSupabase({ ...body, id: params.id });
      sendJson(res, 200, updated);
      return;
    }
    if (params && method === "DELETE") {
      assertAdmin(session);
      await deleteUserSupabase(params.id);
      sendJson(res, 200, { ok: true });
      return;
    }
    params = matchPath(pathname, "/api/users/:id/permissions");
    if (params && method === "PATCH") {
      assertAdmin(session);
      const body = await readJsonBody(req);
      await updateUserPermissionsSupabase(
        params.id,
        body.permissions ?? {}
      );
      sendJson(res, 200, { ok: true });
      return;
    }
    params = matchPath(pathname, "/api/users/:id/delete-permission");
    if (params && method === "PATCH") {
      assertAdmin(session);
      const body = await readJsonBody(req);
      await updateUserDeletePermissionSupabase(params.id, Boolean(body.canDelete));
      sendJson(res, 200, { ok: true });
      return;
    }
    params = matchPath(pathname, "/api/access-requests/:id/approve");
    if (params && method === "POST") {
      assertAdmin(session);
      const body = await readJsonBody(req);
      const result = await approveAccessRequestSupabase({
        requestId: params.id,
        admin: session.dbUser,
        role: body.role ? String(body.role) : void 0,
        department: body.department ? String(body.department) : void 0,
        canDelete: body.canDelete !== void 0 ? Boolean(body.canDelete) : void 0,
        permissions: body.permissions
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }
    params = matchPath(pathname, "/api/access-requests/:id/reject");
    if (params && method === "POST") {
      assertAdmin(session);
      const updated = await rejectAccessRequestSupabase({
        requestId: params.id,
        admin: session.dbUser
      });
      sendJson(res, 200, { ok: true, request: updated });
      return;
    }
    if (method === "POST" && pathname === "/api/collaborators") {
      const body = await readJsonBody(req);
      const created = await createCollaboratorSupabase({
        ownerUid: session.token.uid,
        fullName: String(body.fullName ?? ""),
        role: body.role ? String(body.role) : "",
        active: body.active !== void 0 ? Boolean(body.active) : true
      });
      sendJson(res, 201, created);
      return;
    }
    params = matchPath(pathname, "/api/collaborators/:id");
    if (params && method === "PUT") {
      const body = await readJsonBody(req);
      const updated = await updateCollaboratorSupabase({
        id: params.id,
        fullName: String(body.fullName ?? ""),
        role: body.role ? String(body.role) : "",
        active: Boolean(body.active)
      });
      sendJson(res, 200, updated);
      return;
    }
    if (params && method === "DELETE") {
      assertDirectDelete(session);
      const deletedName = await deleteCollaboratorSupabase({
        collaboratorId: params.id,
        actor: session.dbUser,
        actorEmail: session.token.email || session.dbUser.email,
        actorUid: session.token.uid
      });
      sendJson(res, 200, { ok: true, deletedName });
      return;
    }
    params = matchPath(pathname, "/api/collaborators/:id/toggle");
    if (params && method === "PATCH") {
      const updated = await toggleCollaboratorActiveSupabase(params.id);
      sendJson(res, 200, updated);
      return;
    }
    if (method === "POST" && pathname === "/api/products") {
      const body = await readJsonBody(req);
      const created = await createProductSupabase(
        session.token.uid,
        body
      );
      sendJson(res, 201, created);
      return;
    }
    params = matchPath(pathname, "/api/products/:id");
    if (params && method === "PUT") {
      const body = await readJsonBody(req);
      const updated = await updateProductSupabase({
        ...body,
        id: params.id
      });
      sendJson(res, 200, updated);
      return;
    }
    if (params && method === "DELETE") {
      assertDirectDelete(session);
      const deletedName = await deleteProductSupabase({
        productId: params.id,
        actor: session.dbUser,
        actorEmail: session.token.email || session.dbUser.email,
        actorUid: session.token.uid
      });
      sendJson(res, 200, { ok: true, deletedName });
      return;
    }
    if (method === "POST" && pathname === "/api/movements") {
      const body = await readJsonBody(req);
      const result = await recordMovementSupabase({
        id: body.id ? String(body.id) : void 0,
        productId: String(body.productId ?? ""),
        type: body.type === "ENTRADA" ? "ENTRADA" : "SAIDA",
        quantity: Number(body.quantity ?? 0),
        date: body.date ? String(body.date) : void 0,
        withdrawnBy: body.withdrawnBy ? String(body.withdrawnBy) : void 0,
        collaboratorId: body.collaboratorId ? String(body.collaboratorId) : void 0,
        destination: body.destination ? String(body.destination) : void 0,
        notes: body.notes ? String(body.notes) : void 0,
        isNegativeStockAuthorized: body.isNegativeStockAuthorized !== void 0 ? Boolean(body.isNegativeStockAuthorized) : void 0,
        authorizedBy: body.authorizedBy ? String(body.authorizedBy) : void 0,
        actor: session.dbUser,
        actorUid: session.token.uid
      });
      sendJson(res, 201, result);
      return;
    }
    params = matchPath(pathname, "/api/movements/:id");
    if (params && method === "DELETE") {
      assertDirectDelete(session);
      const result = await deleteMovementSupabase({
        movementId: params.id,
        actor: session.dbUser,
        actorEmail: session.token.email || session.dbUser.email,
        actorUid: session.token.uid
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }
    if (method === "POST" && pathname === "/api/negative-requests") {
      const body = await readJsonBody(req);
      const result = await createNegativeRequestSupabase({
        id: body.id ? String(body.id) : void 0,
        productId: String(body.productId ?? ""),
        requestedQuantity: Number(body.requestedQuantity ?? 0),
        withdrawnBy: String(body.withdrawnBy ?? ""),
        collaboratorId: body.collaboratorId ? String(body.collaboratorId) : void 0,
        destination: String(body.destination ?? ""),
        reason: String(body.reason ?? ""),
        actor: session.dbUser,
        actorUid: session.token.uid
      });
      sendJson(res, 201, result);
      return;
    }
    params = matchPath(pathname, "/api/negative-requests/:id/approve");
    if (params && method === "POST") {
      assertAdmin(session);
      const result = await approveNegativeRequestSupabase({
        requestId: params.id,
        admin: session.dbUser,
        adminUid: session.token.uid
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }
    params = matchPath(pathname, "/api/negative-requests/:id/reject");
    if (params && method === "POST") {
      assertAdmin(session);
      await rejectNegativeRequestSupabase(params.id, session.dbUser.name);
      sendJson(res, 200, { ok: true });
      return;
    }
    params = matchPath(pathname, "/api/negative-requests/:id");
    if (params && method === "DELETE") {
      assertDirectDelete(session);
      await deleteNegativeRequestSupabase({
        requestId: params.id,
        actor: session.dbUser,
        actorEmail: session.token.email || session.dbUser.email,
        actorUid: session.token.uid
      });
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && pathname === "/api/deletion-requests") {
      const body = await readJsonBody(req);
      const result = await createDeletionRequestSupabase({
        recordType: body.recordType,
        targetId: String(body.targetId ?? ""),
        targetCode: String(body.targetCode ?? ""),
        targetName: String(body.targetName ?? ""),
        targetDetails: String(body.targetDetails ?? ""),
        quantity: Number(body.quantity ?? 0),
        reason: String(body.reason ?? ""),
        actor: session.dbUser,
        actorEmail: session.token.email || session.dbUser.email,
        actorUid: session.token.uid
      });
      sendJson(res, 201, result);
      return;
    }
    params = matchPath(pathname, "/api/deletion-requests/:id/approve");
    if (params && method === "POST") {
      assertAdmin(session);
      const result = await approveDeletionRequestSupabase({
        requestId: params.id,
        admin: session.dbUser,
        adminEmail: session.token.email || session.dbUser.email,
        adminUid: session.token.uid
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }
    params = matchPath(pathname, "/api/deletion-requests/:id/reject");
    if (params && method === "POST") {
      assertAdmin(session);
      const result = await rejectDeletionRequestSupabase({
        requestId: params.id,
        admin: session.dbUser,
        adminEmail: session.token.email || session.dbUser.email
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }
    if (method === "POST" && pathname === "/api/admin/supabase-sync") {
      assertAdmin(session);
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && pathname === "/api/admin/reset") {
      assertAdmin(session);
      await resetAllDataSupabase(
        session.token.uid,
        session.token.email || session.dbUser.email,
        session.dbUser.name
      );
      sendJson(res, 200, { ok: true });
      return;
    }
    sendJson(res, 404, { error: "Rota de API n\xE3o encontrada." });
  } catch (err) {
    if (err instanceof DomainError) {
      sendJson(res, err.statusCode, { error: err.message });
      return;
    }
    console.error("Vercel API unhandled error:", err);
    sendJson(res, 500, {
      error: err instanceof Error && err.message ? err.message : "Erro interno ao processar opera\xE7\xE3o no servidor."
    });
  }
}
export {
  handler as default
};
