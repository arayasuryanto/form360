// Formure runtime config.
// The backend is our own PocketBase at formureapi.dockbay.xyz (see notes in CLAUDE.md).
// Public access is gated by PocketBase API rules (supabase-schema.sql is legacy reference).
window.FORMURE_CONFIG = window.FORMURE_CONFIG || {
    API_URL: 'https://formureapi.dockbay.xyz'
};
