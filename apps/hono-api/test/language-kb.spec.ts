import { describe, expect, it } from 'vitest';
import { expandSearchText } from '../src/services/knowledge';
import { toClientProfile } from '../src/services/mappers';

describe('language and KB retrieval helpers', () => {
  it('preserves the client default language from the database', () => {
    const client = toClientProfile({
      id: 'pilot-abc',
      businessName: 'ABC Telecom',
      pageId: 'pilot-abc-page',
      onboardingStatus: 'live',
      defaultLanguage: 'mixed',
      tone: 'friendly',
      escalationKeywords: ['refund'],
    });

    expect(client.defaultLanguage).toBe('mixed');
  });

  it('expands Banglish customer questions into KB-searchable English terms', () => {
    expect(expandSearchText('apnader plan er dam koto?')).toContain('price plan package');
    expect(expandSearchText('installation free kina?')).toContain('install installation setup free');
    expect(expandSearchText('Dhaka te coverage ache?')).toContain('coverage area available');
  });
});
