import { GENERATED_USER_ACCOUNTS, type GeneratedUserAccount } from "./generated-users";

export type LogbookStatus = "Pending" | "Approved" | "Rejected";
export type UserRole = "analyst" | "supervisor" | "admin";

export type AppUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  passwordChangeRequired: boolean;
  avatarSeed: string;
};

export type LogbookRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: LogbookStatus;
  supervisorComment: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  submittedBy: string | null;
  laboratoryName: string;
  department: string;
  location: string;
  instrumentName: string;
  instrumentModel: string;
  serialNumber: string;
  manufacturer: string;
  installationDate: string;
  instrumentId: string;
  date: string;
  analyst: string;
  activityType: string;
  methodUsed: string;
  sampleId: string;
  measuredValue: string;
  startTime: string;
  endTime: string;
  metadata: Record<string, string>;
  remarks: string;
  analystSignature: string;
};

export type LogbookInput = Omit<
  LogbookRecord,
  "id" | "createdAt" | "updatedAt" | "status" | "supervisorComment" | "reviewedAt" | "reviewedBy" | "submittedBy"
>;

export type InstrumentCategory = {
  id: string;
  name: string;
  displayOrder: number;
};

export type InstrumentTemplate = {
  id: string;
  categoryId: string;
  categoryName: string;
  instrumentName: string;
  instrumentModel: string;
  serialNumber: string;
  manufacturer: string;
  installationDate: string;
  instrumentId: string;
  laboratoryName: string;
  department: string;
  location: string;
  methodUsed: string;
  displayOrder: number;
};

// ─── Pre-generated Accounts ───────────────────────────────────────────────────

export type GeneratedUser = GeneratedUserAccount & {
  initialPassword: string;
};

// Initial password for all accounts - set via LAB_INITIAL_PASSWORD env var.
// Users must change it on first login.
const _initPw = process.env.LAB_INITIAL_PASSWORD ?? "";

export const GENERATED_USERS: GeneratedUser[] = GENERATED_USER_ACCOUNTS.map((user) => ({
  ...user,
  initialPassword: _initPw,
}));

// ─── Supabase Row Types ───────────────────────────────────────────────────────

type AuthMetadata = Record<string, unknown>;

type SupabaseAuthUser = {
  id: string;
  email?: string;
  user_metadata?: AuthMetadata;
};

type SupabaseAuthResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: SupabaseAuthUser;
};

type SupabaseAdminUser = {
  id: string;
  email?: string;
  user_metadata?: AuthMetadata;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  role: UserRole;
  password_change_required: boolean;
};

type ProfileUsernameRow = {
  id: string;
  username: string | null;
};

type LogbookRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: LogbookStatus;
  supervisor_comment: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submitted_by: string | null;
  laboratory_name: string | null;
  department: string | null;
  location: string | null;
  instrument_name: string | null;
  instrument_model: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  installation_date: string | null;
  instrument_id: string | null;
  record_date: string | null;
  analyst: string | null;
  activity_type: string | null;
  method_used: string | null;
  sample_id: string | null;
  measured_value: string | null;
  start_time: string | null;
  end_time: string | null;
  metadata: Record<string, string> | null;
  remarks: string | null;
  analyst_signature: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  display_order: number;
};

type TemplateRow = {
  id: string;
  category_id: string;
  instrument_categories: { name: string } | null;
  instrument_name: string;
  instrument_model: string;
  serial_number: string;
  manufacturer: string;
  installation_date: string | null;
  instrument_id: string;
  laboratory_name: string;
  department: string;
  location: string;
  method_used: string;
  display_order: number;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function loginWithUsername(username: string, password: string) {
  // PostgREST rejects `username` as a filter param (PGRST125), so fetch all and filter in JS
  const profiles = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  const profile = profiles.find((p) => p.username === username);

  if (!profile) {
    throw new Error("Username not found.");
  }

  const email = profile.email || `${username}@lab.local`;
  const result = await supabaseAuth<SupabaseAuthResponse>("/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });

  return {
    token: result.access_token,
    maxAge: result.expires_in,
    user: mapProfile(profile, result.user.user_metadata),
  };
}

export async function loginWithPassword(email: string, password: string) {
  const result = await supabaseAuth<SupabaseAuthResponse>("/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });

  const profile = await getProfile(result.user.id, result.user.user_metadata);
  if (!profile) throw new Error("This user does not have an application profile.");

  return { token: result.access_token, maxAge: result.expires_in, user: profile };
}

export async function getCurrentUser(accessToken: string): Promise<AppUser | null> {
  if (!accessToken) return null;
  try {
    const authUser = await supabaseAuth<SupabaseAuthUser>("/user", { token: accessToken });
    return await getProfile(authUser.id, authUser.user_metadata);
  } catch {
    return null;
  }
}

export async function changePassword(userId: string, newPassword: string) {
  await supabaseAdminPut<unknown>(`/admin/users/${encodeURIComponent(userId)}`, {
    password: newPassword,
  });

  await supabaseRest<unknown>(`/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: { password_change_required: false },
  });
}

export async function updateCurrentUserProfile(
  userId: string,
  opts: { username?: string; avatarSeed?: string }
): Promise<AppUser> {
  let metadata: AuthMetadata | undefined;

  if (opts.username) {
    const existing = await supabaseRest<ProfileUsernameRow[]>("/profiles?select=id,username");
    const taken = existing.some((p) =>
      p.id !== userId && p.username?.toLowerCase() === opts.username!.toLowerCase()
    );
    if (taken) throw new Error("Username is already in use.");

    await supabaseRest<unknown>(`/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: { username: opts.username },
    });
  }

  if (opts.avatarSeed) {
    metadata = await updateUserMetadata(userId, { avatar_seed: opts.avatarSeed });
  }

  if (!metadata) {
    const authUser = await supabaseAdminGet<SupabaseAdminUser>(
      `/admin/users/${encodeURIComponent(userId)}`
    );
    metadata = authUser.user_metadata;
  }

  const updated = await getProfile(userId, metadata);
  if (!updated) throw new Error("Profile not found.");
  return updated;
}

// ─── Logbook Records ──────────────────────────────────────────────────────────

export async function listRecords(_user: AppUser) {
  void _user;
  const rows = await supabaseRest<LogbookRow[]>("/logbook_records?select=*&order=created_at.desc");
  return rows.map(mapRecord);
}

export async function createRecord(input: LogbookInput, submittedBy: string) {
  const rows = await supabaseRest<LogbookRow[]>("/logbook_records?select=*", {
    method: "POST",
    prefer: "return=representation",
    body: {
      submitted_by: submittedBy,
      laboratory_name: input.laboratoryName,
      department: input.department,
      location: input.location,
      instrument_name: input.instrumentName,
      instrument_model: input.instrumentModel,
      serial_number: input.serialNumber,
      manufacturer: input.manufacturer,
      installation_date: emptyToNull(input.installationDate),
      instrument_id: input.instrumentId,
      record_date: emptyToNull(input.date),
      analyst: input.analyst,
      activity_type: input.activityType,
      method_used: input.methodUsed,
      sample_id: input.sampleId,
      measured_value: input.measuredValue,
      start_time: emptyToNull(input.startTime),
      end_time: emptyToNull(input.endTime),
      remarks: input.remarks,
      analyst_signature: input.analystSignature,
    },
  });
  return mapRecord(rows[0]);
}

export async function updateRecordReview({
  id, status, supervisorComment, reviewedBy,
}: {
  id: string;
  status: LogbookStatus;
  supervisorComment: string;
  reviewedBy: string;
}) {
  const rows = await supabaseRest<LogbookRow[]>(
    `/logbook_records?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        status,
        supervisor_comment: supervisorComment,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }
  );
  return rows[0] ? mapRecord(rows[0]) : null;
}

// ─── Instrument Templates ─────────────────────────────────────────────────────

export async function listCategories(): Promise<InstrumentCategory[]> {
  const rows = await supabaseRest<CategoryRow[]>(
    "/instrument_categories?select=*&order=display_order.asc"
  );
  return rows.map((r) => ({ id: r.id, name: r.name, displayOrder: r.display_order }));
}

export async function listTemplates(): Promise<InstrumentTemplate[]> {
  const rows = await supabaseRest<TemplateRow[]>(
    "/instrument_templates?select=*,instrument_categories(name)&order=display_order.asc"
  );
  return rows.map(mapTemplate);
}

export async function createTemplate(
  input: Omit<InstrumentTemplate, "id" | "categoryName">
): Promise<InstrumentTemplate> {
  const rows = await supabaseRest<TemplateRow[]>(
    "/instrument_templates?select=*,instrument_categories(name)",
    {
      method: "POST",
      prefer: "return=representation",
      body: templateToRow(input),
    }
  );
  return mapTemplate(rows[0]);
}

export async function updateTemplate(
  id: string,
  input: Partial<Omit<InstrumentTemplate, "id" | "categoryName">>
): Promise<InstrumentTemplate | null> {
  const rows = await supabaseRest<TemplateRow[]>(
    `/instrument_templates?id=eq.${encodeURIComponent(id)}&select=*,instrument_categories(name)`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: templateToRow(input),
    }
  );
  return rows[0] ? mapTemplate(rows[0]) : null;
}

export async function deleteTemplate(id: string) {
  await supabaseRest<unknown>(
    `/instrument_templates?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

// ─── User Management ──────────────────────────────────────────────────────────

export async function listProvisionedUsernames(): Promise<string[]> {
  const rows = await supabaseRest<{ username: string | null }[]>(
    "/profiles?select=username"
  );
  return rows.map((r) => r.username).filter((u): u is string => !!u);
}

export async function provisionUser(gen: GeneratedUser): Promise<void> {
  let userId: string;

  try {
    // Try to create in Supabase Auth
    const authUser = await supabaseAdminPost<SupabaseAdminUser>("/admin/users", {
      email: gen.email,
      password: gen.initialPassword,
      email_confirm: true,
      user_metadata: { full_name: gen.fullName },
    });
    userId = authUser.id;
  } catch {
    // User already exists in Auth — look up their ID by listing users
    const res = await supabaseAdminGet<{ users: SupabaseAdminUser[] }>(
      "/admin/users?per_page=1000&page=1"
    );
    const existing = res.users.find((u) => u.email === gen.email);
    if (!existing) throw new Error(`User ${gen.email} not found in Supabase Auth.`);
    userId = existing.id;
  }

  // Upsert profile — safe to run even if profile already exists
  await supabaseRest<unknown>("/profiles?on_conflict=id", {
    method: "POST",
    prefer: "return=minimal,resolution=merge-duplicates",
    body: {
      id: userId,
      email: gen.email,
      full_name: gen.fullName,
      username: gen.username,
      role: gen.role,
      password_change_required: true,
    },
  });
}

export async function resetUserPassword(username: string, newPassword: string): Promise<void> {
  const profiles = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  const profile = profiles.find((p) => p.username === username);
  if (!profile) throw new Error("User not found.");

  await supabaseAdminPut<unknown>(`/admin/users/${encodeURIComponent(profile.id)}`, {
    password: newPassword,
  });

  await supabaseRest<unknown>(
    `/profiles?id=eq.${encodeURIComponent(profile.id)}`,
    { method: "PATCH", body: { password_change_required: true } }
  );
}

// ─── User Management (extended) ──────────────────────────────────────────────

export type ProfilePublic = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
};

export async function listProfiles(): Promise<ProfilePublic[]> {
  const rows = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  return rows.map((r) => ({
    id: r.id,
    username: r.username || "",
    email: r.email || "",
    fullName: r.full_name || "",
    role: r.role,
  }));
}

export async function deleteUser(username: string): Promise<void> {
  const rows = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  const profile = rows.find((p) => p.username === username);
  if (!profile) throw new Error(`User "${username}" not found.`);
  await supabaseAdminDelete(`/admin/users/${encodeURIComponent(profile.id)}`);
}

export async function updateUserCredentials(
  username: string,
  opts: { newUsername?: string; newPassword?: string }
): Promise<void> {
  const rows = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  const profile = rows.find((p) => p.username === username);
  if (!profile) throw new Error(`User "${username}" not found.`);
  if (opts.newPassword) {
    await supabaseAdminPut<unknown>(`/admin/users/${encodeURIComponent(profile.id)}`, {
      password: opts.newPassword,
    });
  }
  if (opts.newUsername) {
    await supabaseRest<unknown>(`/profiles?id=eq.${encodeURIComponent(profile.id)}`, {
      method: "PATCH",
      body: { username: opts.newUsername },
    });
  }
}

// ─── App Config ───────────────────────────────────────────────────────────────

export type TelegramConfig = { botToken: string; chatId: string };

export async function getTelegramConfig(): Promise<TelegramConfig> {
  try {
    const rows = await supabaseRest<{ key: string; value: string }[]>(
      "/app_config?key=in.(telegram_bot_token,telegram_chat_id)&select=key,value"
    );
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      botToken: map.telegram_bot_token || "",
      chatId: map.telegram_chat_id || "",
    };
  } catch {
    return { botToken: "", chatId: "" };
  }
}

export async function setTelegramConfig(
  config: Partial<TelegramConfig>,
  updatedBy: string
): Promise<void> {
  const entries: [string, string][] = [];
  if (config.botToken !== undefined) entries.push(["telegram_bot_token", config.botToken]);
  if (config.chatId !== undefined) entries.push(["telegram_chat_id", config.chatId]);
  for (const [key, value] of entries) {
    await supabaseRest<unknown>("/app_config?on_conflict=key", {
      method: "POST",
      prefer: "return=minimal,resolution=merge-duplicates",
      body: { key, value, updated_by: updatedBy, updated_at: new Date().toISOString() },
    });
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function getProfile(userId: string, metadata?: AuthMetadata): Promise<AppUser | null> {
  const rows = await supabaseRest<ProfileRow[]>(
    `/profiles?id=eq.${encodeURIComponent(userId)}&select=*`
  );
  return rows[0] ? mapProfile(rows[0], metadata) : null;
}

function mapProfile(row: ProfileRow, metadata?: AuthMetadata): AppUser {
  return {
    id: row.id,
    email: row.email || "",
    username: row.username || row.email?.split("@")[0] || "user",
    fullName: row.full_name || row.email || "User",
    role: row.role,
    passwordChangeRequired: row.password_change_required ?? false,
    avatarSeed: metadataString(metadata, "avatar_seed") || metadataString(metadata, "avatarSeed") || row.id,
  };
}

function metadataString(metadata: AuthMetadata | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function mapRecord(row: LogbookRow): LogbookRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    supervisorComment: row.supervisor_comment || "",
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    submittedBy: row.submitted_by,
    laboratoryName: row.laboratory_name || "",
    department: row.department || "",
    location: row.location || "",
    instrumentName: row.instrument_name || "",
    instrumentModel: row.instrument_model || "",
    serialNumber: row.serial_number || "",
    manufacturer: row.manufacturer || "",
    installationDate: row.installation_date || "",
    instrumentId: row.instrument_id || "",
    date: row.record_date || "",
    analyst: row.analyst || "",
    activityType: row.activity_type || "SMP",
    methodUsed: row.method_used || "",
    sampleId: row.sample_id || "",
    measuredValue: row.measured_value || "",
    startTime: row.start_time || "",
    endTime: row.end_time || "",
    metadata: row.metadata || {},
    remarks: row.remarks || "",
    analystSignature: row.analyst_signature || "",
  };
}

function mapTemplate(row: TemplateRow): InstrumentTemplate {
  const cat = row.instrument_categories;
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: cat ? cat.name : "",
    instrumentName: row.instrument_name,
    instrumentModel: row.instrument_model,
    serialNumber: row.serial_number,
    manufacturer: row.manufacturer,
    installationDate: row.installation_date || "",
    instrumentId: row.instrument_id,
    laboratoryName: row.laboratory_name,
    department: row.department,
    location: row.location,
    methodUsed: row.method_used,
    displayOrder: row.display_order,
  };
}

function templateToRow(t: Partial<Omit<InstrumentTemplate, "id" | "categoryName">>) {
  const row: Record<string, unknown> = {};
  if (t.categoryId !== undefined)     row.category_id       = t.categoryId;
  if (t.instrumentName !== undefined) row.instrument_name   = t.instrumentName;
  if (t.instrumentModel !== undefined) row.instrument_model = t.instrumentModel;
  if (t.serialNumber !== undefined)   row.serial_number     = t.serialNumber;
  if (t.manufacturer !== undefined)   row.manufacturer      = t.manufacturer;
  if (t.installationDate !== undefined) row.installation_date = emptyToNull(t.installationDate);
  if (t.instrumentId !== undefined)   row.instrument_id     = t.instrumentId;
  if (t.laboratoryName !== undefined) row.laboratory_name   = t.laboratoryName;
  if (t.department !== undefined)     row.department        = t.department;
  if (t.location !== undefined)       row.location          = t.location;
  if (t.methodUsed !== undefined)     row.method_used       = t.methodUsed;
  if (t.displayOrder !== undefined)   row.display_order     = t.displayOrder;
  return row;
}

// ─── Supabase Client ──────────────────────────────────────────────────────────

async function supabaseAuth<T>(
  path: string,
  options: { method?: string; token?: string; body?: Record<string, unknown> } = {}
) {
  const headers: HeadersInit = {
    apikey: requireEnv("SUPABASE_ANON_KEY"),
    "Content-Type": "application/json",
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  return supabaseFetch<T>(`/auth/v1${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

async function supabaseAdminGet<T>(path: string) {
  return supabaseFetch<T>(`/auth/v1${path}`, {
    method: "GET",
    headers: {
      apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
  });
}

async function supabaseAdminPost<T>(path: string, body: Record<string, unknown>) {
  return supabaseFetch<T>(`/auth/v1${path}`, {
    method: "POST",
    headers: {
      apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function supabaseAdminDelete<T>(path: string) {
  return supabaseFetch<T>(`/auth/v1${path}`, {
    method: "DELETE",
    headers: {
      apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
  });
}

async function supabaseAdminPut<T>(path: string, body: Record<string, unknown>) {
  return supabaseFetch<T>(`/auth/v1${path}`, {
    method: "PUT",
    headers: {
      apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function updateUserMetadata(userId: string, patch: AuthMetadata) {
  const authUser = await supabaseAdminGet<SupabaseAdminUser>(
    `/admin/users/${encodeURIComponent(userId)}`
  );
  const userMetadata = { ...(authUser.user_metadata || {}), ...patch };
  await supabaseAdminPut<unknown>(`/admin/users/${encodeURIComponent(userId)}`, {
    user_metadata: userMetadata,
  });
  return userMetadata;
}

export async function supabaseRest<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown>; prefer?: string } = {}
) {
  const headers: HeadersInit = {
    apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
    "Content-Type": "application/json",
  };
  if (options.prefer) headers.Prefer = options.prefer;

  return supabaseFetch<T>(`/rest/v1${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

async function supabaseFetch<T>(path: string, init: RequestInit): Promise<T> {
  const baseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) throw new Error(await response.text());
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

function emptyToNull(value: string | undefined) {
  return value || null;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}
