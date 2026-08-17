"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, XCircle } from "lucide-react";
import {
  saveProviderConfigAction,
  testConnectionAction,
} from "@/app/admin/(dashboard)/settings/payments/actions";
import { useToast } from "@/components/providers/ToastProvider";
import type { AdminProviderConfigView } from "@/lib/payments/config";
import type { ConfigurationTestResult } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black disabled:bg-luxe-gray-light disabled:text-luxe-gray-dark";

/**
 * Renders itself entirely from the provider's own `configFields`.
 *
 * That's the property that makes §10 true in practice: adding Viva Wallet, PayPal
 * or another Greek bank means declaring its fields in its provider module — this
 * component never changes, and neither does the page that hosts it.
 *
 * Two rules it enforces on every provider's behalf, so no provider has to remember
 * them: a secret is shown only as a mask and is never sent back to the browser in
 * full, and a field sourced from an environment variable is read-only, because a
 * stored value that silently never takes effect is the worst kind of config bug.
 */
export function ProviderConfigForm({ view }: { view: AdminProviderConfigView }) {
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTest] = useTransition();
  const [testResult, setTestResult] = useState<ConfigurationTestResult | null>(null);
  const { toast } = useToast();

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveProviderConfigAction(view.providerId, formData);
      if (result.error) {
        toast({ title: "Couldn't save", description: result.error, tone: "error" });
        return;
      }
      toast({ title: result.success ?? "Saved" });
    });
  };

  const onTest = () => {
    startTest(async () => {
      const state = await testConnectionAction(view.providerId);
      if (state.error) {
        toast({ title: "Test failed", description: state.error, tone: "error" });
        return;
      }
      setTestResult(state.result ?? null);
    });
  };

  return (
    <form action={onSubmit} className="space-y-6">
      <div className="border border-border bg-luxe-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium tracking-[0.05em] uppercase">Status</h3>
            <p className="mt-1 text-sm text-luxe-gray-dark">
              Disabling a provider immediately hides every method it powers from checkout.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={view.enabled}
              className="size-4 border-border accent-luxe-black"
            />
            Enabled
          </label>
        </div>

        {view.supportsEnvironments ? (
          <div className="mt-5">
            <label htmlFor="environment" className="mb-1.5 block text-eyebrow">
              Environment
            </label>
            <select
              id="environment"
              name="environment"
              defaultValue={view.environment}
              className={cn(inputClass, "appearance-none")}
            >
              <option value="sandbox">Sandbox / test</option>
              <option value="production">Production / live</option>
            </select>
            <p className="mt-1.5 text-xs text-luxe-gray-dark">
              Each environment has its own credentials below. Switching modes changes which set is used — it never
              deletes the other.
            </p>
          </div>
        ) : null}
      </div>

      {view.secretStorageError ? (
        <div className="flex gap-2 border border-amber-600/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
          <p>{view.secretStorageError}</p>
        </div>
      ) : null}

      {view.fields.length > 0 ? (
        <div className="border border-border bg-luxe-white p-5">
          <h3 className="text-sm font-medium tracking-[0.05em] uppercase">Configuration</h3>
          <div className="mt-5 space-y-5">
            {view.fields.map((field) => (
              <div key={field.key}>
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
                  <label htmlFor={`field-${field.key}`} className="text-eyebrow">
                    {field.label}
                  </label>
                  {field.required ? <span className="text-[10px] text-luxe-gray-dark">Required</span> : null}
                  {field.fromEnvironment ? (
                    <span className="text-[10px] text-luxe-gray-dark">
                      Set by {field.environmentVariableName} — edit it in your environment
                    </span>
                  ) : null}
                </div>

                {field.type === "boolean" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      id={`field-${field.key}`}
                      type="checkbox"
                      name={`field:${field.key}`}
                      defaultChecked={field.displayValue === "true"}
                      disabled={field.fromEnvironment}
                      className="size-4 border-border accent-luxe-black"
                    />
                    {field.help ?? "Enabled"}
                  </label>
                ) : field.type === "select" ? (
                  <select
                    id={`field-${field.key}`}
                    name={`field:${field.key}`}
                    defaultValue={field.displayValue}
                    disabled={field.fromEnvironment}
                    className={cn(inputClass, "appearance-none")}
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    id={`field-${field.key}`}
                    name={`field:${field.key}`}
                    defaultValue={field.displayValue}
                    disabled={field.fromEnvironment}
                    rows={4}
                    placeholder={field.placeholder}
                    className={cn(inputClass, "h-auto py-2")}
                  />
                ) : (
                  <input
                    id={`field-${field.key}`}
                    name={`field:${field.key}`}
                    type="text"
                    // A secret's real value never reaches this component — the mask
                    // goes in the placeholder, and the input starts empty so an
                    // untouched form leaves the stored credential alone.
                    defaultValue={field.secret ? "" : field.displayValue}
                    placeholder={field.secret && field.hasStoredValue ? field.displayValue : field.placeholder}
                    disabled={field.fromEnvironment}
                    autoComplete="off"
                    spellCheck={false}
                    className={inputClass}
                  />
                )}

                {field.secret && field.hasStoredValue && !field.fromEnvironment ? (
                  <label className="mt-1.5 flex items-center gap-2 text-xs text-luxe-gray-dark">
                    <input type="checkbox" name={`clear:${field.key}`} className="size-3.5 accent-luxe-black" />
                    Remove the stored value
                  </label>
                ) : null}

                {field.help && field.type !== "boolean" ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-luxe-gray-dark">
                    <HelpCircle className="mt-0.5 size-3 shrink-0" strokeWidth={1.5} />
                    {field.help}
                  </p>
                ) : null}
                {field.secret && !field.fromEnvironment ? (
                  <p className="mt-1 text-xs text-luxe-gray-dark">
                    {field.hasStoredValue
                      ? "A value is stored. Leave blank to keep it — it is never shown again after saving."
                      : "Stored encrypted. It will never be displayed again after saving."}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-border bg-luxe-white p-5 text-sm text-luxe-gray-dark">
          This provider has no credentials to configure. Its fee, limits and availability are set per payment method
          below.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex h-10 items-center justify-center bg-luxe-black px-5 text-xs font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save settings"}
        </button>

        {view.supportsConnectionTest ? (
          <button
            type="button"
            onClick={onTest}
            disabled={isTesting}
            className="flex h-10 items-center gap-2 border border-border px-5 text-xs font-medium tracking-[0.08em] uppercase transition-colors hover:border-luxe-black disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} /> : null}
            Test connection
          </button>
        ) : null}
      </div>

      {testResult ? <TestResultPanel result={testResult} /> : null}
    </form>
  );
}

/**
 * Renders the test outcome verbatim, including whether a real request was made.
 *
 * §19's "do not claim success if no real API request was made" is the reason
 * `checkedLive` is surfaced rather than hidden: a provider with no external API to
 * call reports a green state, and this line is what stops that being mistaken for a
 * verified connection.
 */
function TestResultPanel({ result }: { result: ConfigurationTestResult }) {
  const tone =
    result.status === "connected"
      ? { icon: CheckCircle2, className: "border-green-700/30 bg-green-700/5" }
      : result.status === "not_configured" || result.status === "not_implemented"
        ? { icon: AlertTriangle, className: "border-amber-600/40 bg-amber-500/10" }
        : { icon: XCircle, className: "border-destructive/40 bg-destructive/5" };
  const Icon = tone.icon;

  return (
    <div className={cn("border p-4 text-sm", tone.className)}>
      <div className="flex gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
        <div className="min-w-0">
          <p>{result.message}</p>
          <p className="mt-1 text-xs text-luxe-gray-dark">
            {result.checkedLive
              ? "Verified with a live request to the provider."
              : "No request was made to the provider — this reflects the stored configuration only."}
          </p>
          {result.details ? (
            <dl className="mt-3 space-y-1">
              {Object.entries(result.details).map(([label, value]) => (
                <div key={label} className="flex flex-wrap gap-x-2 text-xs">
                  <dt className="text-luxe-gray-dark">{label}:</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </div>
  );
}
