/**
 * E90: builds `Content-Disposition: inline` for a stored upload filename.
 * The plain `filename` keeps only safe ASCII (others become `_`); the real
 * name goes in `filename*` percent-encoded (RFC 6266), so no quote, `;`,
 * \r or \n from the client can reach the header.
 */
export function inlineContentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 200) || "document";
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
