const UUID_LENGTH = 36

function slugify(text: string): string {
  return text
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}


export function toNoteSlug(title: string, noteId: string): string {
  const slug = slugify(title)
  return slug ? `${slug}-${noteId}` : noteId
}

/** Extract the raw UUID from the slug (last 36 chars) */
export function fromNoteSlug(slug: string): string {
  if (slug.length <= UUID_LENGTH) return slug
  return slug.slice(-UUID_LENGTH)
}
