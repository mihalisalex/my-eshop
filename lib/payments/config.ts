import "server-only";
import { prisma } from "@/lib/prisma";
import { toJsonInput } from "@/lib/commerce/postgres/mappers";
import { decryptSecret, encryptSecret, isSecretStorageConfigured, maskSecret } from "@/lib/payments/crypto";
import { paymentProviderRegistry } from "@/lib/payments/registry";
import type {
  PaymentConfigField,
  PaymentEnvironment,
  PaymentMethodDefinition,
  PaymentMethodId,
  PaymentMethodSettings,
  PaymentProvider,
  PaymentProviderId,
  PublicConfigValues,
  ResolvedProviderConfig,
} from "@/lib/payments/types";

/**
 * Configuration resolution and storage.
 *
 * Two sources, with a deliberate precedence: an environment variable ALWAYS wins
 * over the database. The reasoning is operational — a production deployment
 * should be able to hold its live credentials in Vercel's env scope and nowhere
 * else, and that guarantee is worthless if an admin UI write can quietly override
 * it. The admin screen shows env-sourced fields as read-only and says where the
 * value came from, so the precedence is visible rather than surprising.
 */

/** `stripe` + `secretKey` → `STRIPE_SECRET_KEY`. Documented in .env.example and PAYMENTS.md. */
export function envVarNameFor(providerId: PaymentProviderId, fieldKey: string): string {
  const provider = providerId.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
  const field = fieldKey
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toUpperCase();
  return `${provider}_${field}`;
}

function envValue(providerId: PaymentProviderId, fieldKey: string): string | undefined {
  const raw = process.env[envVarNameFor(providerId, fieldKey)];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/** Fields that apply in the given environment — a sandbox key isn't required in production, and vice versa. */
export function fieldsForEnvironment(
  provider: PaymentProvider,
  environment: PaymentEnvironment
): PaymentConfigField[] {
  return provider.configFields.filter((field) => !field.environment || field.environment === environment);
}

interface ProviderConfigRow {
  environment: string;
  enabled: boolean;
  config: unknown;
  encryptedSecrets: unknown;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string") result[key] = item;
  }
  return result;
}

/**
 * The server-side view of a provider's configuration: public values plus DECRYPTED
 * secrets. Never return this from a Route Handler and never pass it to a Client
 * Component — use `toAdminConfigView` for anything that leaves the server.
 */
export async function resolveProviderConfig(providerId: PaymentProviderId): Promise<ResolvedProviderConfig> {
  const provider = paymentProviderRegistry.require(providerId);
  const row = (await prisma.paymentProviderConfig.findUnique({ where: { provider: providerId } })) as ProviderConfigRow | null;

  // An explicit env override for the environment itself lets a deployment pin
  // "production" regardless of what's stored, which matters when the same
  // database backs both a staging and a production deployment.
  //
  // A provider with no sandbox/live split is always "production": cash genuinely
  // changed hands and a bank transfer genuinely arrived, so labelling those
  // payments as test data (which is what the admin's "Test" badge means) would be
  // actively wrong — caught during live verification, where a real COD order came
  // out tagged as a test payment.
  const envEnvironment = process.env[envVarNameFor(providerId, "environment")]?.trim();
  const environment: PaymentEnvironment = !provider.supportsEnvironments
    ? "production"
    : envEnvironment === "production" || envEnvironment === "sandbox"
      ? envEnvironment
      : row?.environment === "production"
        ? "production"
        : "sandbox";

  const storedValues = asRecord(row?.config);
  const storedSecrets = asRecord(row?.encryptedSecrets);

  const values: PublicConfigValues = {};
  const secrets: Record<string, string> = {};
  const sourcedFromEnv = new Set<string>();

  for (const field of fieldsForEnvironment(provider, environment)) {
    const fromEnv = envValue(providerId, field.key);
    if (fromEnv !== undefined) {
      sourcedFromEnv.add(field.key);
      if (field.secret) secrets[field.key] = fromEnv;
      else values[field.key] = fromEnv;
      continue;
    }
    if (field.secret) {
      const stored = storedSecrets[field.key];
      if (!stored) continue;
      try {
        secrets[field.key] = decryptSecret(stored);
      } catch (error) {
        // A single unreadable secret must not take down the whole payments
        // section — the provider will simply report itself unconfigured, and the
        // admin screen surfaces the decryption problem separately.
        console.error(`[payments] Could not decrypt ${providerId}.${field.key}`, error);
      }
      continue;
    }
    const stored = storedValues[field.key];
    if (stored !== undefined) values[field.key] = stored;
  }

  return { providerId, environment, values, secrets, sourcedFromEnv };
}

/**
 * Whether the provider is switched on at all, independent of whether it's configured.
 *
 * With no row and no env var, this falls back to the provider's own `defaultEnabled`
 * — which is what makes a fresh install have a working checkout. The alternative
 * (defaulting everything to off) produced a genuinely broken state: the two internal
 * METHODS default to enabled, so their providers defaulting to disabled meant
 * checkout offered nothing at all until someone found and flipped a second switch.
 */
export async function isProviderEnabled(providerId: PaymentProviderId): Promise<boolean> {
  const provider = paymentProviderRegistry.require(providerId);
  const envEnabled = process.env[envVarNameFor(providerId, "enabled")]?.trim().toLowerCase();
  if (envEnabled === "true") return true;
  if (envEnabled === "false") return false;
  const row = await prisma.paymentProviderConfig.findUnique({
    where: { provider: providerId },
    select: { enabled: true },
  });
  return row?.enabled ?? provider.defaultEnabled;
}

// ---------------------------------------------------------------------------
// Admin-facing (masked) projection
// ---------------------------------------------------------------------------

export interface AdminConfigFieldView extends PaymentConfigField {
  /** For non-secret fields, the real value. For secret fields, a mask like "••••••1234". */
  displayValue: string;
  /** True when a secret is stored — lets the UI say "leave blank to keep" rather than showing an empty box that looks unset. */
  hasStoredValue: boolean;
  /** True when the value comes from an env var, which the UI renders read-only. */
  fromEnvironment: boolean;
  environmentVariableName: string;
}

export interface AdminProviderConfigView {
  providerId: PaymentProviderId;
  name: string;
  description: string;
  environment: PaymentEnvironment;
  enabled: boolean;
  supportsEnvironments: boolean;
  supportsConnectionTest: boolean;
  webhookSupported: boolean;
  configured: boolean;
  fields: AdminConfigFieldView[];
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  /** Set when PAYMENTS_CONFIG_SECRET is missing, so the UI can explain why saving a secret will fail. */
  secretStorageError: string | null;
}

/**
 * The ONLY shape allowed to cross into the browser. §18's "never display the full
 * secret after saving" is enforced here rather than in each page, so a new
 * provider settings screen cannot leak a credential by forgetting to mask it.
 */
export async function toAdminConfigView(providerId: PaymentProviderId): Promise<AdminProviderConfigView> {
  const provider = paymentProviderRegistry.require(providerId);
  const [resolved, row, enabled] = await Promise.all([
    resolveProviderConfig(providerId),
    prisma.paymentProviderConfig.findUnique({ where: { provider: providerId } }),
    isProviderEnabled(providerId),
  ]);

  const fields: AdminConfigFieldView[] = fieldsForEnvironment(provider, resolved.environment).map((field) => {
    const fromEnvironment = resolved.sourcedFromEnv.has(field.key);
    const secretValue = resolved.secrets[field.key];
    const plainValue = resolved.values[field.key] ?? "";
    return {
      ...field,
      displayValue: field.secret ? (secretValue ? maskSecret(secretValue) : "") : plainValue,
      hasStoredValue: field.secret ? Boolean(secretValue) : plainValue.length > 0,
      fromEnvironment,
      environmentVariableName: envVarNameFor(providerId, field.key),
    };
  });

  return {
    providerId,
    name: provider.name,
    description: provider.description,
    environment: resolved.environment,
    enabled,
    supportsEnvironments: provider.supportsEnvironments,
    supportsConnectionTest: provider.supportsConnectionTest,
    webhookSupported: provider.webhookSupported,
    configured: provider.isConfigured(resolved),
    fields,
    lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: row?.lastTestStatus ?? null,
    lastTestMessage: row?.lastTestMessage ?? null,
    secretStorageError: isSecretStorageConfigured()
      ? null
      : "PAYMENTS_CONFIG_SECRET is not set, so credentials cannot be stored securely. Set it in your environment (openssl rand -base64 32) and restart.",
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface SaveProviderConfigInput {
  providerId: PaymentProviderId;
  environment?: PaymentEnvironment;
  enabled?: boolean;
  /**
   * Field values keyed by `PaymentConfigField.key`. A secret whose value is an
   * empty string is LEFT UNCHANGED rather than cleared — the admin form shows a
   * mask, not the real secret, so submitting the form unedited must not wipe a
   * working credential. Clearing is a separate, explicit action.
   */
  values: Record<string, string>;
  /** Secret keys the admin explicitly asked to clear. */
  clearedSecretKeys?: string[];
}

export async function saveProviderConfig(input: SaveProviderConfigInput): Promise<void> {
  const provider = paymentProviderRegistry.require(input.providerId);
  const existing = await prisma.paymentProviderConfig.findUnique({ where: { provider: input.providerId } });

  const environment: PaymentEnvironment =
    input.environment ?? ((existing?.environment === "production" ? "production" : "sandbox") as PaymentEnvironment);

  const nextValues = asRecord(existing?.config);
  const nextSecrets = asRecord(existing?.encryptedSecrets);

  for (const field of provider.configFields) {
    const submitted = input.values[field.key];
    if (submitted === undefined) continue;

    // An env-sourced field is read-only by contract; accepting a write would
    // create a stored value that silently never takes effect — the worst kind of
    // configuration bug, because the UI would show it as saved.
    if (envValue(input.providerId, field.key) !== undefined) continue;

    const trimmed = submitted.trim();
    if (field.secret) {
      if (!trimmed) continue; // Blank means "keep what's stored" — see the doc comment above.
      nextSecrets[field.key] = encryptSecret(trimmed);
    } else if (trimmed) {
      nextValues[field.key] = trimmed;
    } else {
      delete nextValues[field.key];
    }
  }

  for (const key of input.clearedSecretKeys ?? []) {
    delete nextSecrets[key];
  }

  await prisma.paymentProviderConfig.upsert({
    where: { provider: input.providerId },
    create: {
      provider: input.providerId,
      environment,
      enabled: input.enabled ?? false,
      config: toJsonInput(nextValues),
      encryptedSecrets: toJsonInput(nextSecrets),
    },
    update: {
      environment,
      ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
      config: toJsonInput(nextValues),
      encryptedSecrets: toJsonInput(nextSecrets),
    },
  });
}

export async function setProviderEnabled(providerId: PaymentProviderId, enabled: boolean): Promise<void> {
  paymentProviderRegistry.require(providerId);
  await prisma.paymentProviderConfig.upsert({
    where: { provider: providerId },
    create: { provider: providerId, enabled },
    update: { enabled },
  });
}

export async function recordConnectionTest(
  providerId: PaymentProviderId,
  status: string,
  message: string
): Promise<void> {
  await prisma.paymentProviderConfig.upsert({
    where: { provider: providerId },
    create: { provider: providerId, lastTestedAt: new Date(), lastTestStatus: status, lastTestMessage: message },
    update: { lastTestedAt: new Date(), lastTestStatus: status, lastTestMessage: message },
  });
}

// ---------------------------------------------------------------------------
// Method settings
// ---------------------------------------------------------------------------

function defaultSettings(definition: PaymentMethodDefinition, index: number): PaymentMethodSettings {
  return {
    methodId: definition.id,
    enabled: definition.defaultEnabled,
    sortOrder: index,
    displayName: null,
    description: null,
    feeType: "none",
    feeValue: 0,
    minimumAmount: null,
    maximumAmount: null,
    countries: [],
    shippingRateIds: [],
  };
}

/**
 * Settings for every registered method, filling in defaults for methods that have
 * no row yet. Returning a default rather than nothing is what lets a newly-added
 * provider appear in the admin immediately, with no seeding step and no migration.
 */
export async function getAllMethodSettings(): Promise<PaymentMethodSettings[]> {
  const definitions = paymentProviderRegistry.listMethods();
  const rows = await prisma.paymentMethodSetting.findMany();
  const byId = new Map(rows.map((row) => [row.methodId, row]));

  return definitions.map((definition, index) => {
    const row = byId.get(definition.id);
    if (!row) return defaultSettings(definition, index);
    return {
      methodId: definition.id,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
      displayName: row.displayName,
      description: row.description,
      feeType: row.feeType === "fixed" || row.feeType === "percentage" ? row.feeType : "none",
      feeValue: Number(row.feeValue),
      minimumAmount: row.minimumAmount === null ? null : Number(row.minimumAmount),
      maximumAmount: row.maximumAmount === null ? null : Number(row.maximumAmount),
      countries: row.countries,
      shippingRateIds: row.shippingRateIds,
    };
  });
}

export async function getMethodSettings(methodId: PaymentMethodId): Promise<PaymentMethodSettings> {
  const all = await getAllMethodSettings();
  const found = all.find((settings) => settings.methodId === methodId);
  if (!found) {
    throw new Error(`No payment method registered with id "${methodId}".`);
  }
  return found;
}

export async function saveMethodSettings(settings: PaymentMethodSettings): Promise<void> {
  const definition = paymentProviderRegistry.requireMethod(settings.methodId);
  const data = {
    provider: definition.providerId,
    enabled: settings.enabled,
    sortOrder: settings.sortOrder,
    displayName: settings.displayName?.trim() || null,
    description: settings.description?.trim() || null,
    feeType: settings.feeType,
    feeValue: settings.feeType === "none" ? 0 : Math.max(settings.feeValue, 0),
    minimumAmount: settings.minimumAmount,
    maximumAmount: settings.maximumAmount,
    countries: settings.countries.map((code) => code.trim().toUpperCase()).filter(Boolean),
    shippingRateIds: settings.shippingRateIds.filter(Boolean),
  };
  await prisma.paymentMethodSetting.upsert({
    where: { methodId: settings.methodId },
    create: { methodId: settings.methodId, ...data },
    update: data,
  });
}

export async function setMethodEnabled(methodId: PaymentMethodId, enabled: boolean): Promise<void> {
  const definition = paymentProviderRegistry.requireMethod(methodId);
  await prisma.paymentMethodSetting.upsert({
    where: { methodId },
    create: { methodId, provider: definition.providerId, enabled },
    update: { enabled },
  });
}
