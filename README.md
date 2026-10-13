# MOUNT TOP — Website starter

A responsive static frontend starter for Mount Top digital services, styled in navy blue, bright blue, white and gold. Includes service cards, request form with optional file upload, Supabase email/password authentication, email verification flow, request tracking, wallet display and a secure-backend Paystack deposit integration template.

## Important before real customers use it

This is a starter, not a fully audited production payment platform. Configure the Supabase project, storage policies, Edge Functions, and Paystack test/live keys before enabling real deposits. Do not promise official government services or claim affiliation unless authorized. Never request customers' account passwords, card PINs, OTPs for third-party accounts, or unnecessary sensitive identity data.

## Project files

- `index.html` — website page
- `assets/css/style.css` — responsive design
- `assets/js/config.js` — public Supabase settings
- `assets/js/app.js` — auth, requests, tracking, wallet UI, deposit checkout
- `assets/logo.svg` — Mount Top logo
- `supabase/schema.sql` — tables, RLS policies, wallet creation trigger
- `supabase/wallet-credit-rpc.sql` — atomic wallet credit RPC
- `supabase/functions/paystack-initialize/index.ts` — secure Paystack checkout initialization
- `supabase/functions/paystack-verify/index.ts` — payment verification template

## 1. Publish on GitHub Pages

1. Download and extract this ZIP.
2. Upload the contents of the `mount-top-website` folder to the root of your intended GitHub repository. `index.html` must be at the repository root.
3. In GitHub, open **Settings → Pages**. Choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. Wait for the published URL. If using a project site, it will usually be `https://YOURNAME.github.io/REPOSITORY/`.

## 2. Create and configure Supabase

1. Create a Supabase project at https://supabase.com/.
2. In Project Settings / API Keys, copy the Project URL and publishable key (or legacy anon key).
3. Edit `assets/js/config.js` and replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_PUBLISHABLE_KEY`.
4. In Supabase **SQL Editor**, run `supabase/schema.sql`.
5. Run `supabase/wallet-credit-rpc.sql`.
6. In **Storage**, create a **private** bucket named `service-attachments`.
7. Add Storage policies so authenticated users can upload/read only objects whose first folder is their own `auth.uid()`. Do not make this bucket public.
8. In **Authentication → URL Configuration**, set the Site URL to your actual GitHub Pages URL and add it to Redirect URLs. Configure email templates/provider so sign-up confirmation delivers a 6-digit OTP if you want code verification. Supabase's default confirmation link and OTP email templates differ; check the template's token variable and ensure it actually sends a 6-digit code.
9. Test signup, verification, login, service submission, and tracking with a test account.

### Note on authentication UX

This starter uses password + email confirmation on signup, then password login. The signup verification form expects a six-digit `type: "signup"` OTP. It does not add a second OTP challenge on every login. If you require OTP on every login, configure Supabase MFA or implement a deliberate email OTP login flow and test its security and recovery behavior.

## 3. Configure Paystack safely

Never place a Paystack secret key in `assets/js/config.js` or any browser file.

1. Create a Paystack account and start in test mode.
2. Install the Supabase CLI and sign in. Link your project.
3. Set secrets for Edge Functions. Example (replace values locally; do not commit them):
   ```bash
   supabase secrets set PAYSTACK_SECRET_KEY=sk_test_REPLACE_ME
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_SERVER_SECRET
   supabase secrets set SITE_URL=https://YOURNAME.github.io/REPOSITORY
   ```
   Supabase normally provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Edge Functions. Never expose the service-role key.
4. Deploy functions:
   ```bash
   supabase functions deploy paystack-initialize
   supabase functions deploy paystack-verify
   ```
5. Put the public URL of `paystack-initialize` in `paystackInitializeFunctionUrl` in `assets/js/config.js`, e.g. `https://PROJECT_REF.supabase.co/functions/v1/paystack-initialize`.
6. Review CORS `SITE_URL` to exactly match your deployed website origin. If your GitHub Pages URL includes a repository path, `SITE_URL` should include the path for callback construction, while the browser origin is only `https://YOURNAME.github.io`; adjust CORS allow-origin to the origin only if needed.
7. Complete the return flow: after redirect, call `paystack-verify` from an authenticated session with the `reference` query parameter, show the verified result, then refresh balance. This starter includes the secure verify function template but the browser callback trigger is intentionally not wired until you review and test it.
8. Test successful, failed, cancelled, duplicate, wrong-amount and replayed payment cases in Paystack test mode before going live.

## 4. Security checklist

- RLS is enabled on the included tables. Do not add browser insert/update policies for wallet balances or wallet transactions.
- The wallet balance is stored in kobo as an integer to avoid decimal rounding.
- Payment verification must use Paystack's server API and match reference, status, currency, and exact amount.
- The `credit_wallet_from_verified_deposit` RPC locks the transaction and is idempotent for successful transactions.
- Add monitoring, rate limits, abuse controls, support contact details, privacy policy and terms before launch.
- Consider a signed Paystack webhook for reliable asynchronous confirmation; secure it by verifying the `x-paystack-signature` HMAC on the server. Do not trust a browser redirect alone.
- A full commercial wallet should have an independent security review, reconciliation tools, refund process and auditable admin workflows.

## 5. Local preview

Static preview can be done with a local server (for example, VS Code Live Server). Authentication and payments require the correct Supabase and Edge Function configuration.
