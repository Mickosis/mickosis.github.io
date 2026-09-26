import { test, expect } from '@playwright/test';
import { findLeaks, termsFromEnv } from '../scripts/leak-check';

test.describe('leak check', () => {

  const terms = termsFromEnv({ PRIVATE_REPOS: 'alias=Secret_Repo+other-thing;x=Solo', PRIVATE_BLOCKLIST: 'codename' });

  test('builds terms and their separator variants', () => {
    expect(terms).toEqual(expect.arrayContaining(['secret_repo', 'secret repo', 'secretrepo', 'other-thing', 'solo', 'codename']));
  });

  test('catches an injected private name', () => {
    expect(findLeaks('<p>Built on Secret_Repo last week</p>', terms)).toContain('secret_repo');
    expect(findLeaks('{"name":"CODENAME"}', terms)).toContain('codename');
  });

  test('ignores substrings of other words', () => {
    expect(findLeaks('console solos and isolation', terms)).toEqual([]);
  });
});
