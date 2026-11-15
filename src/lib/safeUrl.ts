/**
 * A link target that is safe to put in <a href>: http(s) URLs and data: URLs of non-executable types only.
 * Anything else (javascript:, vbscript:, data:text/html, data:image/svg+xml, relative junk) gives undefined, so the
 * link renders without a target instead of running script. The server validates too; this is defence in depth for
 * values stored before that validation existed.
 */
const EXECUTABLE_DATA = /^data:(text\/html|image\/svg\+xml|application\/(xhtml\+xml|javascript|x-javascript|xml)|text\/javascript|text\/xml)/i;

export function safeHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(v)) return v;
  if (/^data:[\w.+-]+\/[\w.+-]+;base64,/i.test(v) && !EXECUTABLE_DATA.test(v)) return v;
  return undefined;
}
