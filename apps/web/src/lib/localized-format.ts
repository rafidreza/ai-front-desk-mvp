import { ClientProfile } from '@/types/domain';

type ClientLanguage = ClientProfile['defaultLanguage'];

function localeForLanguage(language?: ClientLanguage) {
  return language === 'bangla' ? 'bn-BD' : 'en';
}

export function formatLocalizedNumber(value: number, language?: ClientLanguage, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeForLanguage(language), {
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}

export function formatLocalizedPercent(value: number, language?: ClientLanguage) {
  return `${formatLocalizedNumber(value, language)}%`;
}

export function formatBdt(value: number, language?: ClientLanguage) {
  return `৳${formatLocalizedNumber(value, language)}`;
}

export function formatLocalizedDateTime(value: string, language?: ClientLanguage) {
  return new Intl.DateTimeFormat(localeForLanguage(language), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
