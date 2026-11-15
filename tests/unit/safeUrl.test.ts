import test from 'node:test';
import assert from 'node:assert/strict';
import { safeHref } from '../../src/lib/safeUrl.ts';

test('safeHref keeps http(s) and harmless data URLs, drops anything that could run script', () => {
  for (const ok of ['https://www.example.com/a?b=1', 'http://example.com', 'data:application/pdf;base64,AAAA', 'data:image/png;base64,AAAA']) {
    assert.equal(safeHref(ok), ok);
  }
  for (const bad of [
    'javascript:alert(1)', ' JavaScript:alert(1)', 'vbscript:x', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,AAAA',
    'data:application/xhtml+xml;base64,AAAA', '//evil.example', '/relative', 'https://exa mple.com', '', null, undefined, 42,
  ]) {
    assert.equal(safeHref(bad), undefined, String(bad));
  }
});
