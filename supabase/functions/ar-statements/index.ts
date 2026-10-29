// Emails each account with an outstanding balance a monthly AR statement.
// Scheduled on the 1st via pg_cron (004).
//   supabase functions deploy ar-statements
import { Resend } from "npm:resend";
import { createClient } from "npm:@supabase/supabase-js";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const FROM = Deno.env.get("EMAIL_FROM") ?? "Summit HVAC Supply <ar@summithvacsupply.com>";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

Deno.serve(async () => {
  // Accounts with a positive balance.
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, balance")
    .gt("balance", 0);

  if (!accounts || accounts.length === 0) {
    return new Response(JSON.stringify({ statements: 0 }));
  }

  let sent = 0;
  for (const account of accounts) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("email")
      .eq("account_id", account.id)
      .limit(1)
      .single();
    if (!contact?.email) continue;

    const { data: open } = await supabase
      .from("invoices")
      .select("invoice_number, total, balance, due_date")
      .eq("account_id", account.id)
      .in("status", ["open", "partial", "overdue"]);

    const rows = (open ?? [])
      .map(
        (i) =>
          `<tr><td>${i.invoice_number}</td><td>${money(Number(i.total))}</td><td>${money(
            Number(i.balance)
          )}</td><td>${i.due_date}</td></tr>`
      )
      .join("");

    const subject = `Your monthly statement - balance ${money(Number(account.balance))}`;
    const { data: sentEmail, error: sendError } = await resend.emails.send({
      from: FROM,
      to: contact.email,
      subject,
      html: `<h2>Statement for ${account.name}</h2>
        <p>Total balance: <strong>${money(Number(account.balance))}</strong></p>
        <table border="1" cellpadding="6" cellspacing="0">
          <thead><tr><th>Invoice</th><th>Total</th><th>Balance</th><th>Due</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`,
    });
    // One row per send for the staff customer view (migration 036). Best effort.
    await supabase.from("email_messages").insert({
      to_email: contact.email,
      subject,
      kind: "statement",
      status: sendError ? "failed" : "sent",
      provider_id: sentEmail?.id ?? null,
      error: sendError?.name ?? null,
      related_type: "account",
      related_id: account.id,
    });
    sent++;
  }

  return new Response(JSON.stringify({ statements: sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
