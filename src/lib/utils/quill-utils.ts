export function isEmptyQuillDelta(body: string | null | undefined): boolean {
  if (!body) return true;
  
  // Fast exact matches for common empty delta representations
  if (body === '{"ops":[{"insert":"\\n"}]}') return true;
  if (body === '{"ops":[{"insert":"\\n\\n"}]}') return true;

  try {
    const parsed = JSON.parse(body);
    if (parsed && Array.isArray(parsed.ops) && parsed.ops.length === 1) {
      const op = parsed.ops[0];
      // Check if it's an insert operation with only whitespace/newlines
      if (typeof op.insert === 'string' && op.insert.trim() === '') {
        return true;
      }
    }
  } catch (e) {
    // If it's not valid JSON, it's not an empty Quill Delta
  }
  
  return false;
}
