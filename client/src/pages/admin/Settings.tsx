import { useCallback, useEffect, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Save, ShieldCheck, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import type { AiProviderStatus } from '../../types';
import { useToast } from '../../components/common/ToastProvider';
import { Badge, Card, ErrorState, LoadingBlock } from '../../components/common';

interface SettingRow {
  key: string;
  value: unknown;
  valueType: string;
  category: string;
  label: string;
  description: string;
  isSecretBacked: boolean;
  updatedAt?: string;
}

interface SettingsPayload {
  settings: SettingRow[];
  aiProvider: AiProviderStatus & { note: string };
  runtime: {
    nodeEnv: string;
    port: number;
    clientOrigins: string[];
    cookieSecure: boolean;
    mailEnabled: boolean;
  };
}

export default function SettingsPage() {
  const toast = useToast();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: response } = await api.get<SettingsPayload>('/settings');
      setData(response);
      setDraft(Object.fromEntries(response.settings.map((s) => [s.key, s.value])));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const { data: response } = await api.put<SettingsPayload>('/settings', draft);
      setData(response);
      toast.success('Settings saved and recorded in the audit log.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading settings" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">System settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Non-secret application configuration. Credentials are never stored in the database.
        </p>
      </header>

      <Card
        title="AI provider"
        description="Configured through server environment variables, never in the database"
        actions={
          <Badge tone={data.aiProvider.usable ? 'success' : 'warning'}>
            {data.aiProvider.usable ? 'AI enabled' : 'AI unavailable'}
          </Badge>
        }
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-lg bg-accent-50 p-2 text-accent-700">
            <Bot className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-slate-700">{data.aiProvider.reason}</p>
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{data.aiProvider.note}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.aiProvider.providers.map((provider) => (
            <div key={provider.name} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-navy-900">{provider.name}</span>
                {provider.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Configured" />
                ) : (
                  <XCircle className="h-4 w-4 text-slate-300" aria-label="Not configured" />
                )}
              </div>
              <p className="mt-1 font-mono text-xs text-slate-500">model: {provider.model}</p>
              {provider.reason && <p className="mt-1 text-xs text-slate-500">{provider.reason}</p>}
              <p className="mt-1 text-xs text-slate-500">
                API key present in environment: {data.aiProvider.keysInEnvironment[provider.name as 'gemini' | 'openai'] ? 'yes' : 'no'}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          To enable the AI narrative, set <code>AI_PROVIDER</code> and the matching API key in{' '}
          <code>server/.env</code>, then restart the API. Without a provider the system still produces full reports
          using deterministic, template-based explanations - it never claims an AI request succeeded when it did not.
        </p>
      </Card>

      <Card
        title="Application configuration"
        actions={
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" /> Save settings
              </>
            )}
          </button>
        }
      >
        <div className="space-y-4">
          {data.settings.map((setting) => (
            <div key={setting.key}>
              <label htmlFor={setting.key} className="label">
                {setting.label}
                <span className="ml-2 font-mono text-xs font-normal text-slate-400">{setting.key}</span>
              </label>
              {setting.valueType === 'boolean' ? (
                <label className="flex items-center gap-2 text-sm text-navy-800">
                  <input
                    id={setting.key}
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                    checked={Boolean(draft[setting.key])}
                    onChange={(e) => setDraft((d) => ({ ...d, [setting.key]: e.target.checked }))}
                  />
                  {draft[setting.key] ? 'Enabled' : 'Disabled'}
                </label>
              ) : setting.valueType === 'number' ? (
                <input
                  id={setting.key}
                  type="number"
                  step={setting.key.includes('Coverage') ? 0.05 : 1}
                  className="input max-w-xs"
                  value={Number(draft[setting.key] ?? 0)}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [setting.key]: Number(e.target.value) }))
                  }
                />
              ) : (
                <textarea
                  id={setting.key}
                  rows={setting.key === 'report.disclaimer' ? 4 : 2}
                  className="input"
                  value={String(draft[setting.key] ?? '')}
                  onChange={(e) => setDraft((d) => ({ ...d, [setting.key]: e.target.value }))}
                />
              )}
              <p className="help-text">{setting.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Runtime environment" description="Read-only, sourced from server environment variables">
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Environment', value: data.runtime.nodeEnv },
            { label: 'Port', value: data.runtime.port },
            { label: 'Allowed origins', value: data.runtime.clientOrigins.join(', ') },
            { label: 'Secure cookies', value: data.runtime.cookieSecure ? 'Enabled (HTTPS)' : 'Disabled (HTTP dev)' },
            { label: 'Mail service', value: data.runtime.mailEnabled ? 'Configured' : 'Not configured' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
              <dt className="text-sm text-slate-600">{item.label}</dt>
              <dd className="text-sm font-medium text-navy-900">{item.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Setting changes are written to the audit log with the acting administrator and the fields changed. Secrets
          such as database credentials, JWT secrets and AI keys are never editable through this interface.
        </p>
      </Card>
    </div>
  );
}
