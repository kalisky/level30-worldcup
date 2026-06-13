// App-wide admins (distinct from per-room creators). Only these accounts may
// view the global usage dashboard at /admin.
const APP_ADMIN_EMAILS = new Set([
  "kalisky@gmail.com",
  "elon.gecht@gmail.com",
]);

export function isAppAdmin(email: string | null | undefined): boolean {
  return !!email && APP_ADMIN_EMAILS.has(email.trim().toLowerCase());
}
