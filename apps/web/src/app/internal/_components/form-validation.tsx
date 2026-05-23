'use client';

import { AlertCircle } from 'lucide-react';
import { ReactNode, useCallback, useState } from 'react';

export type FormErrors = Record<string, string>;

export interface RequiredRule {
  name: string;
  label: string;
}

export interface FormErrorsHook {
  errors: FormErrors;
  hasErrors: boolean;
  setFieldError: (name: string, message: string | null) => void;
  clearAll: () => void;
  validateRequired: (
    values: Record<string, string | undefined>,
    rules: RequiredRule[],
  ) => FormErrors;
  focusField: (name: string) => void;
}

export function useFormErrors(): FormErrorsHook {
  const [errors, setErrors] = useState<FormErrors>({});

  const setFieldError = useCallback((name: string, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (message === null) delete next[name];
      else next[name] = message;
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  const validateRequired = useCallback(
    (values: Record<string, string | undefined>, rules: RequiredRule[]) => {
      const next: FormErrors = {};
      for (const rule of rules) {
        const raw = values[rule.name];
        if (raw === undefined || raw.trim() === '') {
          next[rule.name] = `${rule.label} is required.`;
        }
      }
      setErrors(next);
      return next;
    },
    [],
  );

  const focusField = useCallback((name: string) => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(name);
    if (el === null) return;
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const hasErrors = Object.keys(errors).length > 0;

  return { errors, hasErrors, setFieldError, clearAll, validateRequired, focusField };
}

export interface FormErrorSummaryProps {
  errors: FormErrors;
  fieldLabels: Record<string, string>;
  onFocusField: (name: string) => void;
}

export function FormErrorSummary({
  errors,
  fieldLabels,
  onFocusField,
}: FormErrorSummaryProps) {
  const entries = Object.entries(errors);
  const visible = entries.length > 0;

  return (
    <div
      aria-live="polite"
      className="form-error-summary"
      data-visible={visible ? 'true' : undefined}
      role={visible ? 'alert' : undefined}
    >
      {visible && (
        <>
          <div className="form-error-summary__head">
            <AlertCircle size={16} />
            <span>
              Please fill in {entries.length === 1
                ? '1 required field'
                : `${entries.length} required fields`}{' '}
              before continuing.
            </span>
          </div>
          <ul>
            {entries.map(([name]) => (
              <li key={name}>
                <button onClick={() => onFocusField(name)} type="button">
                  {fieldLabels[name] ?? name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export interface FormFieldProps {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ name, label, required, hint, error, children }: FormFieldProps) {
  const hasError = Boolean(error);
  return (
    <div className="form-field" data-error={hasError ? 'true' : undefined}>
      <label htmlFor={name}>
        {label}
        {required && (
          <span aria-hidden="true" className="form-field__required-mark">
            *
          </span>
        )}
      </label>
      {children}
      {hint !== undefined && hint.length > 0 && !hasError && (
        <span className="form-hint">{hint}</span>
      )}
      {hasError && (
        <span className="form-field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
