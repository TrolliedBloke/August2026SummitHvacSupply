/**
 * Exchange a QuickBooks authorization code for a refresh token.
 *
 * An authorization code is a single-use voucher that Intuit expires in about
 * ten minutes. It is never stored anywhere in this project -- it is traded once
 * for a refresh token, and that token is what the scheduled sync keeps.
 *
 * Run:
 *   QBO_CLIENT_ID=... QBO_CLIENT_SECRET=... \
 *     npx tsx scripts/quickbooks-exchange-code.ts \
 *       --code='<authorization code>' \
 *       --redirect-uri='<the SAME redirect URI that produced the code>'
 *
 * The redirect URI must match byte for byte what was registered on the Intuit
 * app and used to obtain the code. A mismatch returns an opaque `invalid_grant`
 * that looks identical to an expired code.
 *
 * This writes nothing and touches no database. It prints a secret to your
 * terminal: do not commit it, and do not paste it into a chat window.
 */

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    console.error(`\nMissing ${name}.\n`);
    process.exit(1);
  }
  return trimmed;
}

async function main() {
  const clientId = required("QBO_CLIENT_ID", process.env.QBO_CLIENT_ID);
  const clientSecret = required("QBO_CLIENT_SECRET", process.env.QBO_CLIENT_SECRET);
  const code = required("--code", arg("code"));
  const redirectUri = required("--redirect-uri", arg("redirect-uri"));

  // Intuit hands the code back URL-encoded in the redirect. Decoding an already
  // decoded value is harmless; leaving one encoded is not.
  const decoded = decodeURIComponent(code);

  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: decoded,
      redirect_uri: redirectUri,
    }),
  });

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    x_refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.refresh_token) {
    console.error(`\nExchange failed (${response.status}): ${body.error ?? ""} ${body.error_description ?? ""}`.trimEnd());
    if (body.error === "invalid_grant") {
      console.error(
        "\ninvalid_grant means one of three things, in order of likelihood:\n" +
          "  1. the code expired (they last ~10 minutes) -- get a fresh one;\n" +
          "  2. the code was already exchanged once -- they are single use;\n" +
          "  3. --redirect-uri does not exactly match the one that issued it."
      );
    }
    process.exit(1);
  }

  const days = body.x_refresh_token_expires_in
    ? Math.round(body.x_refresh_token_expires_in / 86400)
    : null;

  console.log("\n  Refresh token (store this, do not commit it):\n");
  console.log(`  ${body.refresh_token}\n`);
  if (days) console.log(`  Valid for ~${days} days of inactivity. The sync refreshes it well inside that.\n`);
  console.log("  Next:");
  console.log("    1. Seed it once in Supabase (SQL editor):");
  console.log("       insert into private.quickbooks_token (refresh_token) values ('<token>');");
  console.log("    2. It rotates from then on -- the Edge Function persists each rotation itself.\n");
}

void main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
