import { API_NoteType } from "../../../../../api/queries/notes/entityTypes";

// Seed data so the template renders a real page with no backend configured. Dates are literal
// ISO strings so the list is identical on every machine and in every timezone.
export const MANAGE_NOTES_DEMO_SEED_DEFINITION: API_NoteType[] = [
  {
    id: "Note_seed_1",
    title: "Read the standard before writing anything",
    body: "AGENTS.md first, then standards/ in full. The rules interlock.",
    createdAt: "2026-01-12T09:30:00.000Z"
  },
  {
    id: "Note_seed_2",
    title: "Validation drives the block and the reason",
    body: "One response object feeds both the disabled state and the tooltip, so they cannot drift.",
    createdAt: "2026-01-14T15:05:00.000Z"
  },
  {
    id: "Note_seed_3",
    title: "The guard is where any stops",
    body: "Guard depth has to match what the .then() reads, or both sides compile and neither is right.",
    createdAt: "2026-02-02T11:45:00.000Z"
  }
];
