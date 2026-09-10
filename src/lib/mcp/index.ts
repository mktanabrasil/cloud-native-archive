import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEventsTool from "./tools/list-events";
import getEventTool from "./tools/get-event";
import meTool from "./tools/me";

// Build the OAuth issuer from the Supabase URL (inlined at build time by
// Vite). Works for hosted and self-hosted Supabase alike. Keep this
// import-safe — no runtime env reads or throws at module top level, because
// this file is evaluated during manifest extraction and at Edge Function cold
// start where secrets are not yet present.
const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ?? "https://supabase-url-unset.invalid"
).replace(/\/+$/, "");

export default defineMcp({
  name: "ana-brasil-mcp",
  title: "ANA Brasil MCP",
  version: "0.1.0",
  instructions:
    "Tools for the ANA Brasil events platform. Use `me` to inspect the signed-in user, `list_events` to browse the calendar (with optional date/unit/status filters), and `get_event` to fetch a specific event by id. All calls run as the connected user and respect row-level security.",
  auth: auth.oauth.issuer({
    issuer: `${supabaseUrl}/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [meTool, listEventsTool, getEventTool],
});
