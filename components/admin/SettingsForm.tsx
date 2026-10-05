'use client';

import { useActionState, useState, type ChangeEvent, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { updateSettings, type AdminSettingsActionState } from '@/app/admin/settings/actions';
import {
  AI_MODEL_SUGGESTIONS,
  isTranscriptProvider,
  SETTINGS_BOUNDS,
  TRANSCRIPT_PROVIDER_LABELS,
  TRANSCRIPT_PROVIDERS,
  type AppSettings,
  type SettingsErrors,
} from '@/utils/settings-config';

const idleState: AdminSettingsActionState = { message: '' };

type FieldKey = keyof AppSettings;
type FormValues = Record<FieldKey, string>;

/** Numbers -> display strings; also the baseline used to detect changes. */
function toFormValues(s: AppSettings): FormValues {
  return {
    passScore: String(s.passScore),
    assessmentQuestionCount: String(s.assessmentQuestionCount),
    maxAttemptsPerWindow: String(s.maxAttemptsPerWindow),
    aiModel: s.aiModel,
    transcriptProvider: s.transcriptProvider,
    freeCredentialsPerMonth: String(s.freeCredentialsPerMonth),
  };
}

const FIELD_LABELS: Record<FieldKey, string> = {
  passScore: 'Passing score',
  assessmentQuestionCount: 'Assessment questions',
  maxAttemptsPerWindow: 'Maximum attempts',
  aiModel: 'AI model',
  transcriptProvider: 'Transcript provider',
  freeCredentialsPerMonth: 'Free credentials per month',
};

// Shown in the confirmation step so an operator understands the blast radius
// before saving. Every one of these fields applies platform-wide.
/** Human-readable value for the confirmation diff (provider slugs -> labels). */
function displayValue(key: FieldKey, raw: string): string {
  if (!raw) return '—';
  if (key === 'transcriptProvider' && isTranscriptProvider(raw)) {
    return TRANSCRIPT_PROVIDER_LABELS[raw];
  }
  return raw;
}

const FIELD_IMPACT: Record<FieldKey, string> = {
  passScore:
    'Learners must score at least this to pass. Existing attempts and credentials are not re-scored, but the pass mark shown on certificates and verification pages changes.',
  assessmentQuestionCount:
    'Only affects newly generated assessments (and admin regenerations). Existing assessments keep their questions.',
  maxAttemptsPerWindow: 'Applies to every learner’s rolling attempt window immediately.',
  aiModel: 'Affects generation quality, latency, and cost for every new assessment.',
  transcriptProvider:
    'Affects how transcripts are fetched for new assessments. Videos already cached keep their stored transcript.',
  freeCredentialsPerMonth:
    'How many credentials a free (non-subscriber) user can mint each month. 0 blocks free minting.',
};

const inputClass =
  'h-11 w-full rounded-lg border bg-cream px-3.5 text-sm text-ink placeholder:text-clay/60 focus:outline-none focus:ring-1 read-only:opacity-70';
const inputOk = 'border-sandline focus:border-ink focus:ring-ink';
const inputError = 'border-red-600 focus:border-red-600 focus:ring-red-600';
const secondaryButton =
  'inline-flex h-11 items-center justify-center rounded-lg border border-sandline bg-paper px-5 text-sm font-bold text-ink transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream';

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-clay">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-clay">{hint}</p>
      ) : null}
    </div>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

/**
 * Settings form. The confirmation step is server-driven: the first submit is
 * validated, diffed against the stored row, and withheld with
 * `needsConfirmation`; only a resubmit carrying `confirmImpact=yes` writes.
 * That means no effect has to synchronise local state with the action result -
 * the confirmation panel is derived from `formState`.
 */
export default function SettingsForm({ initialSettings }: { initialSettings: AppSettings }) {
  const [formState, formAction] = useActionState(updateSettings, idleState);
  const [values, setValues] = useState<FormValues>(() => toFormValues(initialSettings));
  // Lets the operator leave the confirmation step without resubmitting.
  const [hideConfirmation, setHideConfirmation] = useState(false);

  const baseline = formState.values ?? initialSettings;
  const baselineForm = toFormValues(baseline);
  const errors: SettingsErrors = formState.errors ?? {};

  const inConfirmation = Boolean(formState.needsConfirmation) && !hideConfirmation;
  const pendingFields = inConfirmation ? (formState.changedFields ?? []) : [];

  const changed = (Object.keys(values) as FieldKey[]).filter(
    (key) => values[key].trim() !== baselineForm[key]
  );

  const set = (key: FieldKey) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <form
      action={formAction}
      onSubmit={() => setHideConfirmation(false)}
      className="flex flex-col gap-6"
    >
      {inConfirmation && (
        <section
          aria-labelledby="confirm-heading"
          className="rounded-2xl border border-sandline bg-linen p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-paper text-clay">
              <AlertTriangle aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="confirm-heading" className="font-fraunces text-xl font-bold text-ink">
                Confirm these changes
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-clay">
                These values apply to everyone on the platform as soon as you save.
              </p>
              {formState.message && (
                <p role="status" className="mt-2 text-sm font-medium text-red-600">
                  {formState.message}
                </p>
              )}
            </div>
          </div>

          <ul className="mt-5 flex flex-col gap-4">
            {pendingFields.map((key) => (
              <li key={key} className="rounded-xl border border-sandline bg-paper p-4">
                <p className="text-sm font-bold text-ink">{FIELD_LABELS[key]}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <del className="text-clay">{displayValue(key, baselineForm[key])}</del>
                  <span className="font-semibold text-ink">{displayValue(key, values[key])}</span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-clay">{FIELD_IMPACT[key]}</p>
              </li>
            ))}
          </ul>

          <label className="mt-5 flex items-start gap-2.5 text-sm text-ink">
            {/* Uncontrolled on purpose: it only gates submission via native
                validation, so it never needs React state. */}
            <input
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-sandline text-ink focus:ring-ink"
            />
            <span>
              I understand these changes apply to every user immediately and cannot be scoped per
              account.
            </span>
          </label>

          {/* The server only writes when this is present. */}
          <input type="hidden" name="confirmImpact" value="yes" />
        </section>
      )}

      <section
        aria-labelledby="assessment-settings-heading"
        className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
      >
        <h2 id="assessment-settings-heading" className="font-fraunces text-xl font-bold text-ink">
          Assessment
        </h2>
        <p className="mt-1 text-sm text-clay">
          How assessments are generated and scored for every course.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            id="passScore"
            label={FIELD_LABELS.passScore}
            hint={`Minimum score to pass. ${SETTINGS_BOUNDS.passScore.min}–${SETTINGS_BOUNDS.passScore.max}.`}
            error={errors.passScore}
          >
            <input
              id="passScore"
              name="passScore"
              type="number"
              inputMode="numeric"
              min={SETTINGS_BOUNDS.passScore.min}
              max={SETTINGS_BOUNDS.passScore.max}
              step={1}
              required
              readOnly={inConfirmation}
              value={values.passScore}
              onChange={set('passScore')}
              aria-invalid={errors.passScore ? true : undefined}
              className={`${inputClass} ${errors.passScore ? inputError : inputOk}`}
            />
          </Field>

          <Field
            id="assessmentQuestionCount"
            label={FIELD_LABELS.assessmentQuestionCount}
            hint={`Questions generated per assessment. ${SETTINGS_BOUNDS.assessmentQuestionCount.min}–${SETTINGS_BOUNDS.assessmentQuestionCount.max}.`}
            error={errors.assessmentQuestionCount}
          >
            <input
              id="assessmentQuestionCount"
              name="assessmentQuestionCount"
              type="number"
              inputMode="numeric"
              min={SETTINGS_BOUNDS.assessmentQuestionCount.min}
              max={SETTINGS_BOUNDS.assessmentQuestionCount.max}
              step={1}
              required
              readOnly={inConfirmation}
              value={values.assessmentQuestionCount}
              onChange={set('assessmentQuestionCount')}
              aria-invalid={errors.assessmentQuestionCount ? true : undefined}
              className={`${inputClass} ${errors.assessmentQuestionCount ? inputError : inputOk}`}
            />
          </Field>

          <Field
            id="maxAttemptsPerWindow"
            label={FIELD_LABELS.maxAttemptsPerWindow}
            hint={`Attempts per learner per rolling 7-day window. ${SETTINGS_BOUNDS.maxAttemptsPerWindow.min}–${SETTINGS_BOUNDS.maxAttemptsPerWindow.max}.`}
            error={errors.maxAttemptsPerWindow}
          >
            <input
              id="maxAttemptsPerWindow"
              name="maxAttemptsPerWindow"
              type="number"
              inputMode="numeric"
              min={SETTINGS_BOUNDS.maxAttemptsPerWindow.min}
              max={SETTINGS_BOUNDS.maxAttemptsPerWindow.max}
              step={1}
              required
              readOnly={inConfirmation}
              value={values.maxAttemptsPerWindow}
              onChange={set('maxAttemptsPerWindow')}
              aria-invalid={errors.maxAttemptsPerWindow ? true : undefined}
              className={`${inputClass} ${errors.maxAttemptsPerWindow ? inputError : inputOk}`}
            />
          </Field>

          <Field
            id="aiModel"
            label={FIELD_LABELS.aiModel}
            hint="Model id for the OpenAI-compatible endpoint (OPENAI_BASE_URL)."
            error={errors.aiModel}
          >
            <input
              id="aiModel"
              name="aiModel"
              type="text"
              list="ai-model-options"
              required
              maxLength={100}
              readOnly={inConfirmation}
              value={values.aiModel}
              onChange={set('aiModel')}
              aria-invalid={errors.aiModel ? true : undefined}
              className={`${inputClass} ${errors.aiModel ? inputError : inputOk}`}
            />
            <datalist id="ai-model-options">
              {AI_MODEL_SUGGESTIONS.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </Field>

          <Field
            id="transcriptProvider"
            label={FIELD_LABELS.transcriptProvider}
            hint="Where transcripts come from before question generation."
            error={errors.transcriptProvider}
          >
            <select
              id="transcriptProvider"
              name="transcriptProvider"
              disabled={inConfirmation}
              value={values.transcriptProvider}
              onChange={set('transcriptProvider')}
              aria-invalid={errors.transcriptProvider ? true : undefined}
              className={`${inputClass} ${errors.transcriptProvider ? inputError : inputOk}`}
            >
              {TRANSCRIPT_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {TRANSCRIPT_PROVIDER_LABELS[provider]}
                </option>
              ))}
            </select>
            {/* A disabled select is not submitted - mirror it while confirming. */}
            {inConfirmation && (
              <input type="hidden" name="transcriptProvider" value={values.transcriptProvider} />
            )}
          </Field>
        </div>
      </section>

      <section
        aria-labelledby="plan-settings-heading"
        className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
      >
        <h2 id="plan-settings-heading" className="font-fraunces text-xl font-bold text-ink">
          Plans
        </h2>
        <p className="mt-1 text-sm text-clay">Limits applied to free accounts.</p>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            id="freeCredentialsPerMonth"
            label={FIELD_LABELS.freeCredentialsPerMonth}
            hint={`Credentials a free user can mint each calendar month. ${SETTINGS_BOUNDS.freeCredentialsPerMonth.min}–${SETTINGS_BOUNDS.freeCredentialsPerMonth.max}.`}
            error={errors.freeCredentialsPerMonth}
          >
            <input
              id="freeCredentialsPerMonth"
              name="freeCredentialsPerMonth"
              type="number"
              inputMode="numeric"
              min={SETTINGS_BOUNDS.freeCredentialsPerMonth.min}
              max={SETTINGS_BOUNDS.freeCredentialsPerMonth.max}
              step={1}
              required
              readOnly={inConfirmation}
              value={values.freeCredentialsPerMonth}
              onChange={set('freeCredentialsPerMonth')}
              aria-invalid={errors.freeCredentialsPerMonth ? true : undefined}
              className={`${inputClass} ${errors.freeCredentialsPerMonth ? inputError : inputOk}`}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          label={inConfirmation ? 'Save settings' : 'Review changes'}
          disabled={!inConfirmation && changed.length === 0}
        />
        {!inConfirmation && changed.length > 0 && (
          <button type="button" onClick={() => setValues(baselineForm)} className={secondaryButton}>
            Reset
          </button>
        )}
        {inConfirmation && (
          <button
            type="button"
            onClick={() => setHideConfirmation(true)}
            className={secondaryButton}
          >
            Keep editing
          </button>
        )}

        {/* The confirmation prompt is rendered inside the panel, so suppress
            it here to avoid a stale red line after "Keep editing". */}
        {formState.message && !formState.needsConfirmation && (
          <p
            role="status"
            className={
              formState.success
                ? 'text-sm font-medium text-green-700'
                : 'text-sm font-medium text-red-600'
            }
          >
            {formState.message}
          </p>
        )}
      </div>
    </form>
  );
}
