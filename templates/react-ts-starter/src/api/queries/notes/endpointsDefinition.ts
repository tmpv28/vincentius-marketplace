// Every URL this entity owns, in one object, with {id} left literal so interpolation happens in
// one known place instead of being spelled out at a call site.
export const NOTES_API_URL = {
  create: "/notes",
  list: "/notes",
  read: "/notes/{id}",
  update: "/notes",
  delete: "/notes/{id}"
} as const;
