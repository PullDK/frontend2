// Minimal shim for Next.js internal: shared/lib/server-reference-info
// Provides just enough functionality for client-and-server-references.ts.

export interface ServerReferenceInfo {
  type: 'use-cache' | string
}

/**
 * Extracts lightweight info from a React Server Reference id.
 * This shim only detects the special "use-cache" case used in metadata.
 */
export function extractInfoFromServerReferenceId(id: string): ServerReferenceInfo {
  try {
    if (typeof id === 'string' && id.includes('use-cache')) {
      return { type: 'use-cache' }
    }
  } catch {
    // ignore and fall through
  }
  return { type: 'unknown' }
}