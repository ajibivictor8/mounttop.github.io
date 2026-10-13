// Supabase Edge Function: initialize Paystack checkout securely.
// Deploy with: supabase functions deploy paystack-initialize
// Set secrets: supabase secrets set PAYSTACK_SECRET_KEY=sk_test_... SITE_URL=https://YOURNAME.github.io/YOURREPO/
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in required" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) return json({ error: "Invalid session" }, 401);

    const body = await req.json();
    const amountNaira = Number(body.amount_naira);
    if (!Number.isInteger(amountNaira) || amountNaira < 100 || amountNaira > 1000000) {
      return json({ error: "Amount must be between ₦100 and ₦1,000,000" }, 400);
    }
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) return json({ error: "Payment provider is not configured" }, 503);
    const reference = `MT_${crypto.randomUUID().replaceAll("-", "")}`;
    const amountKobo = amountNaira * 100;

    // Create a pending transaction with the service role only on the server.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: insertError } = await admin.from("wallet_transactions").insert({
      user_id: user.id, reference, amount_kobo: amountKobo, transaction_type: "deposit",
      status: "pending", description: "Mount Top wallet funding"
    });
    if (insertError) return json({ error: "Could not create payment record" }, 500);

    const siteUrl = Deno.env.get("SITE_URL");
    if (!siteUrl) return json({ error: "SITE_URL is not configured" }, 503);
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email, amount: amountKobo, reference,
        callback_url: `${siteUrl.replace(/\/$/, "")}/?payment=return&reference=${encodeURIComponent(reference)}`
      })
    });
    const result = await paystackRes.json();
    if (!paystackRes.ok || !result.status) {
      await admin.from("wallet_transactions").update({ status: "failed" }).eq("reference", reference);
      return json({ error: "Paystack could not initialize this payment" }, 502);
    }
    return json({ authorization_url: result.data.authorization_url, reference });
  } catch (_e) {
    return json({ error: "Unexpected payment initialization error" }, 500);
  }
});