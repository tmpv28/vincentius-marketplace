// The entity every notes endpoint reads or returns. It sits beside the verb folders, not inside
// one of them, because create/ reading a type out of read/ would be a cross-sibling import.
export interface API_NoteType {
  id: string;
  title: string;
  body?: string;
  createdAt: string;
}
