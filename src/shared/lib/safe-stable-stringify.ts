export default function safeStringify(value: unknown): string {
  try {
    const seen = new WeakSet<object>()
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        const obj = val as object
        if (seen.has(obj)) return '[Circular]'
        seen.add(obj)
      }
      return val as unknown
    }) ?? ''
  } catch {
    return ''
  }
}