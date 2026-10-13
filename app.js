(() => {
  const cfg = window.MOUNT_TOP_CONFIG || {};
  const configured = cfg.supabaseUrl && cfg.supabasePublishableKey &&
    !cfg.supabaseUrl.includes("YOUR_") && !cfg.supabasePublishableKey.includes("YOUR_");
  const sb = configured && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey) : null;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  let authMode = "login", pendingEmail = "", pendingName = "";
  const money = (n) => new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN"}).format(Number(n||0));
  function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.remove("hidden");setTimeout(()=>t.classList.add("hidden"),4500)}
  function msg(el,text,isError=false){el.textContent=text;el.style.color=isError?"#c33232":"#075bd8"}
  function openAuth(mode="login"){authMode=mode;$("#authModal").classList.remove("hidden");setAuthMode(mode);$("#authMessage").textContent=""}
  function setAuthMode(mode){authMode=mode;$("#authForm").classList.remove("hidden");$("#otpForm").classList.add("hidden");$("#authNameWrap").classList.toggle("hidden",mode!=="signup");$("#authConfirmWrap").classList.toggle("hidden",mode!=="signup");$("#authPasswordWrap").classList.toggle("hidden",mode==="otp");$("#authTitle").textContent=mode==="signup"?"Create your account":"Welcome back";$("#authSubtitle").textContent=mode==="signup"?"Register to request and track services.":"Log in to your Mount Top account.";$("#authSubmit").textContent=mode==="signup"?"Create account":"Login";$$("[data-auth-mode]").forEach(b=>b.classList.toggle("active",b.dataset.authMode===mode))}
  $$("[data-open-auth]").forEach(b=>b.addEventListener("click",()=>openAuth(b.dataset.openAuth)));
  $("#closeAuth").addEventListener("click",()=>$("#authModal").classList.add("hidden"));
  $("#authModal").addEventListener("click",e=>{if(e.target.id==="authModal")$("#authModal").classList.add("hidden")});
  $$("[data-auth-mode]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.authMode)));
  $("#menuToggle").addEventListener("click",()=>$("#mainNav").classList.toggle("open"));
  $("#year").textContent=new Date().getFullYear();
  $$("[data-service]").forEach(b=>b.addEventListener("click",()=>{$("#serviceType").value=b.dataset.service;$("#request").scrollIntoView({behavior:"smooth"});$("#requestDetails").focus()}));
  $$("[data-tab]").forEach(b=>b.addEventListener("click",()=>{const track=b.dataset.tab==="track";$$("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));$("#sendPanel").classList.toggle("hidden",track);$("#trackPanel").classList.toggle("hidden",!track);if(track)loadRequests()}));
  function showSignedIn(user){$("#logoutBtn").classList.remove("hidden");$("#requestAuthNotice").classList.add("hidden");$("#requestName").value=user.user_metadata?.full_name||"";$("#requestEmail").value=user.email||"";$("#walletStatus").textContent="Signed in. Your balance is retrieved securely.";loadBalance();loadRequests()}
  function showSignedOut(){$("#logoutBtn").classList.add("hidden");$("#requestAuthNotice").classList.remove("hidden");$("#walletBalance").textContent="₦—";$("#walletStatus").textContent="Sign in to access your wallet."}
  async function currentUser(){if(!sb)return null;const {data}=await sb.auth.getUser();return data.user||null}
  $("#authForm").addEventListener("submit",async e=>{
    e.preventDefault();const out=$("#authMessage");
    if(!sb){msg(out,"Add your Supabase URL and publishable key in assets/js/config.js first.",true);return}
    const email=$("#authEmail").value.trim(),password=$("#authPassword").value,name=$("#authName").value.trim();
    if(authMode==="signup"&&password!==$("#authConfirm").value){msg(out,"Passwords do not match.",true);return}
    $("#authSubmit").disabled=true;
    try{
      if(authMode==="signup"){
        pendingEmail=email;pendingName=name;
        const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:name}}});
        if(error)throw error;
        if(data.session){$("#authModal").classList.add("hidden");showSignedIn(data.user);toast("Account created.")}
        else {$("#authForm").classList.add("hidden");$("#otpForm").classList.remove("hidden");msg(out,"Account created. Check your email for the 6-digit verification code.");}
      }else{
        const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;
        $("#authModal").classList.add("hidden");showSignedIn(data.user);toast("Welcome back.");
      }
    }catch(err){msg(out,err.message||"Authentication failed.",true)}finally{$("#authSubmit").disabled=false}
  });
  $("#otpForm").addEventListener("submit",async e=>{
    e.preventDefault();const out=$("#authMessage");if(!sb)return;
    const token=$("#otpCode").value.trim();
    try{
      const {data,error}=await sb.auth.verifyOtp({email:pendingEmail,token,type:"signup"});if(error)throw error;
      $("#authModal").classList.add("hidden");showSignedIn(data.user);toast("Email verified successfully.");
    }catch(err){msg(out,err.message||"Code verification failed. Check your email and try again.",true)}
  });
  $("#logoutBtn").addEventListener("click",async()=>{if(sb)await sb.auth.signOut();showSignedOut();toast("You have logged out.")});
  async function loadBalance(){
    if(!sb)return;const user=await currentUser();if(!user)return;
    // This view/function must be created by the SQL setup; RLS limits rows to the signed-in user.
    const {data,error}=await sb.from("wallet_balances").select("balance_kobo").eq("user_id",user.id).maybeSingle();
    if(error){$("#walletStatus").textContent="Wallet setup pending. Apply supabase/schema.sql and policies.";return}
    $("#walletBalance").textContent=money(Number(data?.balance_kobo||0)/100);
  }
  async function loadRequests(){
    const list=$("#requestList");if(!sb){list.innerHTML='<p class="muted">Connect Supabase to view requests.</p>';return}
    const user=await currentUser();if(!user){list.innerHTML='<p class="muted">Please log in to track your requests.</p>';return}
    const {data,error}=await sb.from("service_requests").select("id,service_type,status,created_at,details").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
    if(error){list.textContent="Request tracking will be available after applying the database schema.";return}
    list.replaceChildren();
    if(!data?.length){list.textContent="No requests submitted yet.";return}
    data.forEach(r=>{const card=document.createElement("article");card.className="request-list-card";const title=document.createElement("b");title.textContent=r.service_type;const status=document.createElement("span");status.textContent=r.status;const date=document.createElement("small");date.textContent=new Date(r.created_at).toLocaleString();const detail=document.createElement("p");detail.textContent=r.details;card.append(title,status,date,detail);list.append(card)});
  }
  $("#refreshRequests").addEventListener("click",loadRequests);
  $("#requestForm").addEventListener("submit",async e=>{
    e.preventDefault();const out=$("#requestMessage");
    if(!sb){msg(out,"Connect Supabase first in assets/js/config.js.",true);return}
    const user=await currentUser();if(!user){msg(out,"Please log in before sending your request.",true);openAuth("login");return}
    const file=$("#requestFile").files[0];if(file&&file.size>10*1024*1024){msg(out,"File is too large. Maximum size is 10 MB.",true);return}
    const btn=e.submitter; if(btn)btn.disabled=true;
    try{
      let filePath=null;
      if(file){
        const allowed=["image/jpeg","image/png","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        if(!allowed.includes(file.type))throw new Error("Unsupported file type.");
        const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
        filePath=`${user.id}/${crypto.randomUUID()}-${safeName}`;
        const {error:uploadError}=await sb.storage.from("service-attachments").upload(filePath,file,{upsert:false,contentType:file.type});
        if(uploadError)throw uploadError;
      }
      const payload={user_id:user.id,service_type:$("#serviceType").value,full_name:$("#requestName").value.trim(),email:$("#requestEmail").value.trim(),phone:$("#requestPhone").value.trim(),details:$("#requestDetails").value.trim(),attachment_path:filePath};
      const {error}=await sb.from("service_requests").insert(payload);if(error)throw error;
      e.target.reset();$("#requestName").value=user.user_metadata?.full_name||"";$("#requestEmail").value=user.email||"";msg(out,"Request submitted. Open Track Requests to see your request.");toast("Your request was submitted.");loadRequests();
    }catch(err){msg(out,err.message||"Could not submit request.",true)}finally{if(btn)btn.disabled=false}
  });
  $("#depositForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!sb){toast("Connect Supabase first.");return}
    const user=await currentUser();if(!user){openAuth("login");return}
    const amount=Number($("#depositAmount").value);
    if(!Number.isInteger(amount)||amount<100||amount>1000000){toast("Enter an amount from ₦100 to ₦1,000,000.");return}
    if(!cfg.paystackInitializeFunctionUrl){toast("Paystack is not configured yet. Deploy the secure Supabase Edge Function and add its URL to config.js.");return}
    const button=e.submitter;if(button)button.disabled=true;
    try{
      const {data:{session}}=await sb.auth.getSession();
      const res=await fetch(cfg.paystackInitializeFunctionUrl,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`,"apikey":cfg.supabasePublishableKey},body:JSON.stringify({amount_naira:amount})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not initialize payment.");
      if(!data.authorization_url)throw new Error("Payment provider did not return a checkout URL.");
      location.href=data.authorization_url;
    }catch(err){toast(err.message||"Payment initialization failed.")}finally{if(button)button.disabled=false}
  });
  if(sb){sb.auth.onAuthStateChange((_event,session)=>{if(session?.user)showSignedIn(session.user);else showSignedOut()});sb.auth.getSession().then(({data})=>data.session?.user?showSignedIn(data.session.user):showSignedOut())}
  else {showSignedOut();$("#walletStatus").textContent="Supabase setup required. See README.md."}
})();