/*
  MOUNT TOP CONFIGURATION
  1. Replace these placeholders with your Supabase Project URL and publishable key.
  2. A publishable/anon key is expected to be public. NEVER add service_role, secret
     API keys, database passwords, or Paystack secret keys to this file.
*/
window.MOUNT_TOP_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_PROJECT_URL",
  supabasePublishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  // Optional: public URL for a deployed initialize-payment Edge Function.
  paystackInitializeFunctionUrl: "",
  currency: "NGN"
};