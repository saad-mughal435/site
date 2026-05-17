/* data.js - Sanad seed data
   24 customers, 8 agents, 6 categories, 80 conversations (~600 messages),
   80 KB articles, AI logs, settings, integrations. All fabricated. */
(function () {
  'use strict';

  function pp(id) { return 'https://images.unsplash.com/photo-' + id + '?w=120&q=80&auto=format&fit=crop&crop=faces'; }
  function isoAgo(minutes) { return new Date(Date.now() - minutes * 60000).toISOString(); }
  function pick(arr, i) { return arr[i % arr.length]; }
  function rid(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 8); }

  // ===================== CATEGORIES =====================
  var CATEGORIES = [
    { id: 'cat-billing',  name: 'Billing',         name_ar: 'الفوترة',       color: '#fbbf24', icon: '💳', auto_tag: true },
    { id: 'cat-tech',     name: 'Technical',       name_ar: 'تقني',          color: '#60a5fa', icon: '⚙', auto_tag: true },
    { id: 'cat-account',  name: 'Account & Security', name_ar: 'الحساب والأمان', color: '#8b5cf6', icon: '🔒', auto_tag: true },
    { id: 'cat-feature',  name: 'Feature Request', name_ar: 'طلب ميزة',      color: '#34d399', icon: '💡', auto_tag: true },
    { id: 'cat-bug',      name: 'Bug Report',      name_ar: 'تقرير خلل',     color: '#fb7185', icon: '🐛', auto_tag: true },
    { id: 'cat-general',  name: 'General',         name_ar: 'عام',           color: '#94a3b8', icon: '💬', auto_tag: false }
  ];

  // ===================== AGENTS =====================
  var AGENTS = [
    { id: 'ag-layla',  name: 'Layla Hassan',     role: 'lead',    photo: pp('1573497019940-1c28c88b4f3e'), online: true,  csat: 4.8 },
    { id: 'ag-omar',   name: 'Omar Al-Suwaidi',  role: 'agent',   photo: pp('1500648767791-00dcc994a43e'), online: true,  csat: 4.6 },
    { id: 'ag-amani',  name: 'Amani Khaled',     role: 'agent',   photo: pp('1494790108377-be9c29b29330'), online: true,  csat: 4.7 },
    { id: 'ag-zayed',  name: 'Zayed Ahmed',      role: 'agent',   photo: pp('1507003211169-0a1dd7228f2d'), online: false, csat: 4.5 },
    { id: 'ag-noura',  name: 'Noura Al-Falasi',  role: 'agent',   photo: pp('1438761681033-6461ffad8d80'), online: true,  csat: 4.6 },
    { id: 'ag-rashid', name: 'Rashid Bin Hamad', role: 'agent',   photo: pp('1472099645785-5658abf4ff4e'), online: false, csat: 4.4 },
    { id: 'ag-fatima', name: 'Fatima Al-Mazrui', role: 'admin',   photo: pp('1517841905240-472988babdf9'), online: true,  csat: 4.9 },
    { id: 'ag-saif',   name: 'Saif Al-Nahyan',   role: 'agent',   photo: pp('1539571696357-5a69c17a67c6'), online: true,  csat: 4.5 }
  ];

  // ===================== CUSTOMERS =====================
  var firstEN = ['Sarah','Marcus','Priya','James','Aisha','David','Lily','Ahmed','Rachel','Carlos','Emma','Hassan','Sophia','Tariq','Olivia','Yusuf'];
  var lastEN  = ['Chen','Weber','Sharma','OConnor','Patel','Garcia','Wong','Johnson','Cohen','Singh','Müller','Khan','Ricci','Nakamura','Brown','Diaz'];
  var firstAR = ['خالد','نور','سلمان','هند','محمد','ميرة','عبدالله','أمل'];
  var lastAR  = ['المنصوري','الزعابي','بن سعيد','الكتبي','الشحي','بن راشد','العامري','بن لحج'];
  var tiers = ['free','free','free','pro','pro','pro','business','business'];

  var CUSTOMERS = [];
  for (var i = 0; i < 16; i++) {
    CUSTOMERS.push({
      id: 'cu-' + (i + 1),
      name: pick(firstEN, i) + ' ' + pick(lastEN, i),
      email: (pick(firstEN, i) + '.' + pick(lastEN, i)).toLowerCase().replace(/[^a-z.]/g, '') + '@example.com',
      avatar: pp(['1494790108377-be9c29b29330','1438761681033-6461ffad8d80','1500648767791-00dcc994a43e','1517841905240-472988babdf9','1507003211169-0a1dd7228f2d','1539571696357-5a69c17a67c6','1521119989659-a83eee488004','1531427186611-ecfd6d936c79'][i % 8]),
      locale: 'en',
      tier: pick(tiers, i),
      joined_at: isoAgo(60 * 24 * (30 + i * 17)),
      ltv: 50 + (i * 87) % 1400
    });
  }
  for (var j = 0; j < 8; j++) {
    CUSTOMERS.push({
      id: 'cu-' + (17 + j),
      name: pick(firstAR, j) + ' ' + pick(lastAR, j),
      email: 'customer' + (17 + j) + '@example.ae',
      avatar: pp(['1517841905240-472988babdf9','1539571696357-5a69c17a67c6','1500648767791-00dcc994a43e','1494790108377-be9c29b29330'][j % 4]),
      locale: 'ar',
      tier: pick(tiers, j + 4),
      joined_at: isoAgo(60 * 24 * (10 + j * 23)),
      ltv: 100 + (j * 113) % 1800
    });
  }

  // ===================== CONVERSATION TEMPLATES =====================
  // Each template defines a subject + scripted message exchange. The seed
  // generator picks a template per conversation, swaps customer/agent, and
  // produces realistic threads of 2-12 messages.
  var TEMPLATES = [
    { cat: 'cat-tech', subject: 'Cannot reset my password',
      msgs: [
        ['cu', "Hi, I've tried resetting my password three times this morning and the email never arrives. I've checked spam too."],
        ['ag', "Sorry for the trouble. Can you confirm the email address on your account? Also, are you on the free or pro plan? Some corporate domains block our reset emails."],
        ['cu', "It's the one you have here. I'm on pro. Tried again just now, nothing."],
        ['ag', "Got it. I've manually triggered a reset and sent it via our backup provider. You should see it within 60 seconds. Let me know."],
        ['cu', "Just got it — thanks! That worked."]
      ]
    },
    { cat: 'cat-billing', subject: 'Charged twice for July invoice',
      msgs: [
        ['cu', "I see two charges of $49 on my card both dated July 4. Can you check what happened?"],
        ['ag', "I see both transactions in our records. The second one was an idempotency retry on our payment processor's side — it should have failed but it didn't. Refunding the duplicate now, you'll see it in 3-5 business days."],
        ['cu', "Thanks, really appreciate the quick response."]
      ]
    },
    { cat: 'cat-tech', subject: 'Webhook signature verification failing',
      msgs: [
        ['cu', "My webhook handler is rejecting all events since yesterday. Signature mismatch on every payload."],
        ['cu', "I'm using the v2 signing key from the dashboard."],
        ['ag', "Are you computing the HMAC over the raw request body, or the parsed JSON? If you're using a framework that re-serializes the body before your handler runs, the signature won't match."],
        ['cu', "Ah — Express was parsing it before my middleware. Let me bypass that for the webhook route."],
        ['cu', "That fixed it. Thanks!"]
      ]
    },
    { cat: 'cat-billing', subject: 'Want to downgrade from Business to Pro',
      msgs: [
        ['cu', "We're scaling back next month. How do I downgrade from Business to Pro without losing my existing data?"],
        ['ag', "Hi! Downgrade is one click from Settings → Billing → Change plan. Your data stays in place. The only thing you'll lose access to is SSO and the audit log export. Want me to flag your account so the change takes effect at the end of your billing cycle?"],
        ['cu', "Yes please, that would be perfect."]
      ]
    },
    { cat: 'cat-feature', subject: 'Bulk import via CSV?',
      msgs: [
        ['cu', "Is there a way to bulk-import contacts via CSV? I have 8,000 to migrate from our old tool."],
        ['ag', "Yes — Admin → Import → CSV. Up to 50,000 rows per file. The matcher needs an email column. Want me to send you our template?"],
        ['cu', "Please do."],
        ['ag', "Sent to your inbox. Let me know if anything looks off after the import — I can clean up duplicates from our side."]
      ]
    },
    { cat: 'cat-bug', subject: 'Mobile app crashes when opening notifications',
      msgs: [
        ['cu', "Every time I tap the bell icon on iOS the app crashes. Started this morning."],
        ['cu', "iPhone 15, iOS 18.3."],
        ['ag', "Confirmed — there's a fix going out in 14.7.2 (build 8821) within the next hour. As a workaround, swipe down from the home screen to see the notifications instead. Sorry about that."],
        ['cu', "Update just installed, all good now."]
      ]
    },
    { cat: 'cat-account', subject: 'SSO with Azure AD',
      msgs: [
        ['cu', "We want to enable SSO with Azure AD for our team of 40. Is this Business-tier only?"],
        ['ag', "Yes — SSO is part of Business. Once you upgrade I'll send you the SAML setup doc and walk through the IdP claims with you on a call if you want. Group-based provisioning works automatically once Azure pushes the groups."],
        ['cu', "Great, we'll upgrade today."]
      ]
    },
    { cat: 'cat-tech', subject: 'API rate limit too low for our use case',
      msgs: [
        ['cu', "We're hitting the 100 req/min limit constantly. Backfilling 6 months of data."],
        ['ag', "I can temporarily lift you to 1000 req/min for 7 days while you backfill. Just promise not to thrash :)"],
        ['cu', "Promise. Thanks!"]
      ]
    },
    { cat: 'cat-general', subject: 'Quick question on data residency',
      msgs: [
        ['cu', "Where is customer data physically stored? We have UAE compliance requirements."],
        ['ag', "We have regions in EU (Frankfurt), US (Virginia), and Asia (Mumbai). For UAE compliance you'd want Mumbai — it's the closest with the right data-residency posture. I can move your workspace if you want, it's a one-time migration that takes ~30 min."],
        ['cu', "Yes, please proceed with Mumbai."]
      ]
    },
    { cat: 'cat-feature', subject: 'Dark mode for the admin panel',
      msgs: [
        ['cu', "Pretty please — my eyes hurt by EOD. Any plans for dark mode on the admin?"],
        ['ag', "It's on the roadmap for Q3. I'll add your vote — it bumps the priority. In the meantime, do you know about the system-theme follow? If you set your OS to dark, the customer chat already follows; the admin is the only piece still light-only."],
        ['cu', "Didn't know about the follow! Still want admin dark though :)"]
      ]
    },
    { cat: 'cat-tech', subject: 'Slack integration not posting messages',
      msgs: [
        ['cu', "Our Slack integration stopped posting to #support since Friday. Channel still exists, bot is still in it."],
        ['ag', "I see the issue — Slack's API marked the legacy token as deprecated and we silently dropped writes. Reconnecting via Settings → Integrations → Slack will re-auth with the new OAuth scopes."],
        ['cu', "Reconnected, all good."]
      ]
    },
    { cat: 'cat-billing', subject: 'Annual vs monthly — what is the discount?',
      msgs: [
        ['cu', "Considering switching to annual. What's the discount?"],
        ['ag', "Annual saves you 20% off the monthly rate. So Pro is $390/year instead of $588 if billed monthly. Want me to send a quote PDF?"],
        ['cu', "Yes please."]
      ]
    },
    { cat: 'cat-account', subject: 'Two-factor recovery code lost',
      msgs: [
        ['cu', "I lost my 2FA recovery codes and changed phones. I can't log in."],
        ['ag', "I'll send a verification email to confirm your identity. Once you confirm I can reset 2FA on your account. Standard process takes ~10 min."],
        ['cu', "Got the email, confirmed."],
        ['ag', "Done. You can log in now and set up 2FA fresh."]
      ]
    },
    { cat: 'cat-bug', subject: 'CSV export missing the last column',
      msgs: [
        ['cu', "Every CSV export from the analytics page truncates the 'source' column. Tested in Excel and Numbers, same result."],
        ['ag', "Confirmed bug. Our writer was not escaping commas in source values that contained commas. Fix going out today. As a workaround you can use the JSON export which is unaffected."],
        ['cu', "Got it, thanks!"]
      ]
    },
    { cat: 'cat-general', subject: 'Pricing for non-profits',
      msgs: [
        ['cu', "We're a UAE-registered non-profit. Do you offer any discount?"],
        ['ag', "Yes — we give 50% off Pro for verified non-profits. Send me a copy of your DED / Federal Tax Authority registration and I'll apply it."],
        ['cu', "Sending now."]
      ]
    },
    { cat: 'cat-tech', subject: 'هل يمكنني تغيير اللغة إلى العربية؟', locale: 'ar',
      msgs: [
        ['cu', "مرحبا، هل يمكنني تغيير لغة لوحة التحكم إلى العربية؟"],
        ['ag', "نعم بالتأكيد. من الإعدادات → اللغة، اختر العربية. سيتم التطبيق فوراً."],
        ['cu', "شكراً جزيلاً، تم!"]
      ]
    }
  ];

  // ===================== CONVERSATIONS + MESSAGES =====================
  var CONVERSATIONS = [];
  var MESSAGES = [];
  var STATUSES = [];  // we control distribution

  // 22 open + waiting agent
  for (var s1 = 0; s1 < 22; s1++) STATUSES.push({ status: 'open', priority: s1 < 4 ? 'urgent' : s1 < 9 ? 'high' : s1 < 16 ? 'med' : 'low', age_min: 5 + s1 * 17 });
  // 18 pending (waiting for customer reply)
  for (var s2 = 0; s2 < 18; s2++) STATUSES.push({ status: 'pending', priority: s2 < 3 ? 'high' : s2 < 10 ? 'med' : 'low', age_min: 60 + s2 * 90 });
  // 6 snoozed
  for (var s3 = 0; s3 < 6; s3++) STATUSES.push({ status: 'snoozed', priority: 'low', age_min: 240 + s3 * 240 });
  // 30 closed in last 7 days
  for (var s4 = 0; s4 < 30; s4++) STATUSES.push({ status: 'closed', priority: 'low', age_min: 60 + s4 * 200 });
  // 4 escalated
  for (var s5 = 0; s5 < 4; s5++) STATUSES.push({ status: 'escalated', priority: 'urgent', age_min: 30 + s5 * 90 });

  STATUSES.forEach(function (spec, idx) {
    var tplIdx = idx % TEMPLATES.length;
    var tpl = TEMPLATES[tplIdx];
    var customer = CUSTOMERS[idx % CUSTOMERS.length];
    var agent = pick(AGENTS, idx + 1);
    var locale = tpl.locale || customer.locale;
    var convId = 'cv-' + String(idx + 1).padStart(4, '0');
    var createdAt = isoAgo(spec.age_min);
    var lastTime = createdAt;

    // Filter messages: 'open' means last message is from customer (waiting agent),
    // 'pending' means last message from agent. For 'closed', show full thread.
    var msgsToInclude;
    if (spec.status === 'open') {
      // 1-3 msgs ending with customer
      var n = 1 + (idx % 3);
      msgsToInclude = tpl.msgs.slice(0, n);
      // Force last to be customer
      if (msgsToInclude[msgsToInclude.length - 1][0] !== 'cu')
        msgsToInclude = msgsToInclude.slice(0, -1);
      if (!msgsToInclude.length) msgsToInclude = [tpl.msgs[0]];
    } else if (spec.status === 'pending') {
      // ensure last is agent
      var n2 = 2 + (idx % 3);
      msgsToInclude = tpl.msgs.slice(0, n2);
      if (msgsToInclude[msgsToInclude.length - 1][0] !== 'ag')
        msgsToInclude.push(tpl.msgs[Math.min(n2, tpl.msgs.length - 1)]);
    } else {
      msgsToInclude = tpl.msgs.slice();
    }

    var firstMsg = null;
    var lastMsg = null;
    msgsToInclude.forEach(function (m, mIdx) {
      var msgAt = isoAgo(spec.age_min - mIdx * 5);
      var msg = {
        id: 'msg-' + convId + '-' + mIdx,
        conversation_id: convId,
        author_type: m[0] === 'cu' ? 'customer' : 'agent',
        author_id: m[0] === 'cu' ? customer.id : agent.id,
        body: m[1],
        internal_note: false,
        created_at: msgAt
      };
      MESSAGES.push(msg);
      if (mIdx === 0) firstMsg = msg;
      lastMsg = msg;
      lastTime = msgAt;
    });

    // Sentiment: mock-classify by template & message tone
    var sent = 'neu';
    if (lastMsg && /thank|appreciate|great|perfect|love/i.test(lastMsg.body)) sent = 'pos';
    if (/angry|frustrat|never|cancel|refund.*now|terrible|hour/i.test(JSON.stringify(msgsToInclude))) sent = 'neg';
    if (spec.priority === 'urgent') sent = 'neg';

    CONVERSATIONS.push({
      id: convId,
      customer_id: customer.id,
      assignee_id: spec.status === 'open' && (idx % 5 === 0) ? null : agent.id,
      category_id: tpl.cat,
      subject: tpl.subject,
      status: spec.status,
      priority: spec.priority,
      sentiment: sent,
      locale: locale,
      channel: idx % 4 === 0 ? 'email' : idx % 4 === 1 ? 'chat' : idx % 4 === 2 ? 'in-app' : 'whatsapp',
      created_at: createdAt,
      last_message_at: lastTime,
      unread_count: spec.status === 'open' ? (1 + (idx % 3)) : 0,
      closed_at: spec.status === 'closed' ? isoAgo(Math.max(5, spec.age_min - 60)) : null,
      preview: (firstMsg ? firstMsg.body : '').slice(0, 140)
    });
  });

  // ===================== KB ARTICLES =====================
  var ARTICLE_SOURCES = [
    { cat: 'cat-account', title: 'Resetting your password', body: "If you've forgotten your password, you can reset it from the login screen.\n\n## Steps\n1. Go to the login page\n2. Click **Forgot password?**\n3. Enter the email on your account\n4. Check your inbox (and spam) for a reset link, valid for 30 minutes\n5. Click the link and set a new password\n\nIf the email never arrives within 5 minutes, check that your IT team hasn't blocked our sender domain `mail.sanad.app`.\n\n## Two-factor accounts\nIf you have 2FA enabled, you'll be asked for a 2FA code after setting the new password. If you've lost your 2FA device, see [Recovering 2FA access](#kb/recover-2fa)." },
    { cat: 'cat-account', title: 'Recovering 2FA access', body: "If you've lost access to your 2FA device, follow the recovery flow.\n\n## What you'll need\n- The email on your account\n- One of the 10 recovery codes shown when you enabled 2FA\n\n## If you saved the codes\n1. Click **Use recovery code** on the 2FA prompt\n2. Enter one of the codes — each works once\n3. You're in. Visit **Settings → Security** to re-enable 2FA on the new device.\n\n## If you didn't save the codes\nContact support with proof of identity. We'll send a verification email and reset 2FA within ~10 minutes during business hours." },
    { cat: 'cat-account', title: 'Setting up SSO with SAML', body: "SSO via SAML is available on Business and Enterprise plans.\n\n## Supported IdPs\n- Okta\n- Azure AD / Entra ID\n- Google Workspace\n- OneLogin\n- Any SAML 2.0-compliant IdP\n\n## Setup\n1. **Settings → Security → SSO → Configure**\n2. Copy the ACS URL and Entity ID into your IdP\n3. Map claims: `email` → NameID, `firstName`, `lastName`, `groups`\n4. Save the IdP metadata XML or paste the SSO URL + certificate\n5. Test with one user before rolling out\n\n## Group provisioning\nIf you push a `groups` claim, we auto-assign users to roles matching the group name (case-insensitive). Default fallback role is `member`." },
    { cat: 'cat-account', title: 'Inviting teammates', body: "Invite teammates from **Settings → Team → Invite**.\n\n- Enter one email at a time or paste a comma-separated list (up to 50 at once).\n- Choose a role: Admin, Agent, or Viewer.\n- Invitations expire after 7 days.\n\nViewer is read-only and free; Admin and Agent count toward your seat limit." },
    { cat: 'cat-billing', title: 'Understanding your invoice', body: "Your monthly invoice is generated on the same day each month — the date you first subscribed.\n\n## Line items\n- **Base plan**: your tier × number of seats\n- **Usage overage**: any month where you exceed plan limits\n- **Add-ons**: SSO, audit log retention, dedicated CSM\n- **Tax**: VAT in the UAE (5%), GST in eligible regions\n\nDownload PDF invoices from **Settings → Billing → Invoices** going back 24 months." },
    { cat: 'cat-billing', title: 'Updating your payment method', body: "1. **Settings → Billing → Payment method**\n2. Click **Replace card** (or **Add backup**)\n3. Enter the new card details. We use Stripe so we never store the full PAN on our servers.\n\nIf your current card is failing, the new card becomes primary immediately and we retry the failed invoice within 24h." },
    { cat: 'cat-billing', title: 'Upgrading or downgrading your plan', body: "Plan changes take effect at the start of your next billing cycle by default. To change immediately:\n\n## Upgrade\n- Prorated charge for the remainder of the cycle\n- New features unlock instantly\n\n## Downgrade\n- Stays on the higher plan until end of cycle\n- Credit applied to the next invoice if you downgraded immediately\n\nDowngrading from Business → Pro removes SSO, audit-log export, and dedicated support. Your data remains intact." },
    { cat: 'cat-billing', title: 'Refund policy', body: "We offer refunds within 14 days of any new subscription, no questions asked.\n\n## How to request\nReply to your purchase receipt with the word **refund**, or email billing@sanad.app. We process within 2 business days; the refund hits your card in 3-5 business days depending on your bank.\n\n## Annual plans\nIf you switched to annual mid-cycle and changed your mind within 14 days, we refund the full annual amount minus the prorated monthly equivalent for the days used." },
    { cat: 'cat-tech', title: 'API quickstart', body: "Authenticate with a Bearer token from **Settings → Developers → API keys**.\n\n```bash\ncurl https://api.sanad.app/v1/conversations \\\n  -H \"Authorization: Bearer sk_live_...\" \\\n  -H \"Content-Type: application/json\"\n```\n\n## Rate limits\n- Free: 100 req/min\n- Pro: 500 req/min\n- Business: 2,000 req/min\n- Enterprise: custom\n\n429 responses include a `Retry-After` header — respect it." },
    { cat: 'cat-tech', title: 'Webhook signature verification', body: "Every webhook event is signed with your endpoint's signing key.\n\n## How to verify\nCompute HMAC-SHA256 over the **raw request body** (not parsed JSON) using your signing key. Compare it constant-time to the `Sanad-Signature` header.\n\n```js\nconst sig = req.headers['sanad-signature'];\nconst hash = crypto.createHmac('sha256', SIGNING_KEY)\n  .update(req.rawBody)\n  .digest('hex');\nif (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hash))) reject(401);\n```\n\nIf you're using Express, register `express.raw({ type: 'application/json' })` on your webhook route, NOT `express.json()`." },
    { cat: 'cat-tech', title: 'Available webhook events', body: "We send `application/json` POST requests to your configured endpoint.\n\n## Events\n- `conversation.created`\n- `conversation.assigned`\n- `conversation.status_changed`\n- `message.created`\n- `message.created.internal_note`\n- `customer.created`\n- `customer.updated`\n\nFilter by event in **Settings → Integrations → Webhooks**." },
    { cat: 'cat-tech', title: 'Embedding the chat widget', body: "Drop our widget into any web page with one script tag.\n\n```html\n<script src=\"https://widget.sanad.app/embed.js\"\n        data-workspace=\"ws_xxx\"\n        data-color=\"#8b5cf6\" async></script>\n```\n\n## Identity\nFor logged-in users, identify them so messages thread correctly:\n\n```js\nwindow.Sanad('identify', {\n  user_id: 'u_123',\n  email: 'user@example.com',\n  name: 'Sarah Chen'\n});\n```" },
    { cat: 'cat-tech', title: 'Custom domain for the help center', body: "Map a CNAME like `help.yourdomain.com` to `cname.sanad.app`. We issue and renew the TLS cert automatically." },
    { cat: 'cat-tech', title: 'Importing from Intercom / Zendesk', body: "Use **Admin → Import → From other tool**. Supported sources: Intercom, Zendesk, Help Scout, Front, Freshdesk.\n\nWhat gets imported: conversations, contacts, tags, articles. What doesn't: agent assignments (we map by email; unmatched fall to your account owner)." },
    { cat: 'cat-feature', title: 'How to file a feature request', body: "We track requests in a public board. Visit **roadmap.sanad.app** and search before opening a new one. Upvotes carry weight in our prioritization." },
    { cat: 'cat-bug', title: 'How to report a bug', body: "Include: steps to reproduce, expected vs actual, your plan tier, browser/OS, and any error message verbatim. Screen recordings help most. We respond within one business day on Pro and within one hour on Business." },
    { cat: 'cat-general', title: 'Languages supported', body: "Customer-facing surfaces (widget, help center, emails) support English and Arabic. The admin panel is English-only for now; Arabic is on the Q4 roadmap." },
    { cat: 'cat-general', title: 'Data residency', body: "Choose a region at workspace creation. We host in **eu-fra**, **us-east**, **ap-bom**. UAE-residency-compliant deployments use ap-bom. Migration between regions takes ~30 min and is one-time." },
    { cat: 'cat-general', title: 'GDPR + UAE PDPL compliance', body: "We sign a DPA on request. SCC modules in place for cross-border transfers. UAE PDPL: we comply with article 14 (data subject rights) and provide a workspace-owner-initiated export tool from **Settings → Privacy → Export workspace data**." },
    { cat: 'cat-general', title: 'Business hours and SLAs', body: "Free: best-effort, no SLA.\nPro: 8h first response (business hours).\nBusiness: 1h first response 24/5.\nEnterprise: 30min first response 24/7 + named CSM." }
  ];
  var ARTICLES = [];
  ARTICLE_SOURCES.forEach(function (a, i) {
    ARTICLES.push({
      id: 'kb-' + String(i + 1).padStart(3, '0'),
      category_id: a.cat,
      title: a.title,
      title_ar: '',
      slug: a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      body_md: a.body,
      body_md_ar: '',
      author_id: pick(AGENTS, i).id,
      views: 120 + (i * 137) % 4800,
      helpful_up: 15 + (i * 31) % 180,
      helpful_down: (i * 7) % 22,
      published_at: isoAgo(60 * 24 * (10 + i * 11))
    });
  });
  // Stub articles to round out to 80
  var stubTitles = [
    ['cat-account', 'Changing your email address'],['cat-account', 'Deleting your account'],['cat-account', 'Session timeout settings'],
    ['cat-account', 'Personal vs workspace settings'],['cat-account', 'Password requirements'],['cat-account', 'Account recovery options'],
    ['cat-billing', 'Free trial details'],['cat-billing', 'Cancelling your subscription'],['cat-billing', 'Adding a tax ID to invoices'],
    ['cat-billing', 'Setting spending alerts'],['cat-billing', 'Paying by bank transfer (ACH/SEPA)'],['cat-billing', 'Currency support'],
    ['cat-billing', 'Volume discounts for 100+ seats'],['cat-tech', 'Filtering events in webhook payloads'],['cat-tech', 'Pagination cursors'],
    ['cat-tech', 'Idempotency keys for API writes'],['cat-tech', 'SDK availability (Node, Python, Ruby, Go)'],['cat-tech', 'Self-hosted runner setup'],
    ['cat-tech', 'IP allowlist for outbound calls'],['cat-tech', 'TLS and encryption at rest'],['cat-tech', 'Backup and disaster recovery'],
    ['cat-tech', 'Working with the GraphQL API (beta)'],['cat-tech', 'Webhook retry behavior'],['cat-tech', 'Time zone handling'],
    ['cat-feature', 'Voting on roadmap items'],['cat-feature', 'Requesting custom fields'],['cat-feature', 'Macros and snippets'],
    ['cat-feature', 'Saved views for the inbox'],['cat-feature', 'Tagging and saved tag groups'],['cat-feature', 'Internal notes and mentions'],
    ['cat-feature', 'Triggers and automations'],['cat-feature', 'Round-robin assignment rules'],['cat-feature', 'Custom roles and permissions'],
    ['cat-bug', 'Known issues this week'],['cat-bug', 'Reporting accessibility issues'],['cat-bug', 'Browser support matrix'],
    ['cat-bug', 'Why is my widget not loading?'],['cat-bug', 'Email deliverability troubleshooting'],['cat-bug', 'Mobile app crash logs'],
    ['cat-general', 'Status page and incident history'],['cat-general', 'Pricing for non-profits and education'],['cat-general', 'Partner program'],
    ['cat-general', 'Press and brand assets'],['cat-general', 'Security disclosure policy'],['cat-general', 'Service-level agreement (Pro)'],
    ['cat-general', 'Service-level agreement (Business)'],['cat-general', 'About Sanad'],['cat-general', 'Changelog and release notes'],
    ['cat-general', 'Migration guide v1 → v2'],['cat-general', 'Help us improve — feedback channels'],['cat-general', 'Open-source acknowledgments'],
    ['cat-general', 'Cookie policy'],['cat-general', 'Terms of service'],['cat-general', 'Privacy policy'],
    ['cat-general', 'Subprocessors list'],['cat-general', 'Status of SOC 2 and ISO 27001'],['cat-general', 'Region availability map']
  ];
  var startIdx = ARTICLES.length;
  stubTitles.slice(0, 80 - startIdx).forEach(function (st, k) {
    var idx = startIdx + k + 1;
    ARTICLES.push({
      id: 'kb-' + String(idx).padStart(3, '0'),
      category_id: st[0],
      title: st[1],
      title_ar: '',
      slug: st[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      body_md: "## " + st[1] + "\n\nThis article covers " + st[1].toLowerCase() + ". For detailed steps, see the related articles in the sidebar or contact support.\n\n*Last updated: " + new Date(isoAgo(60 * 24 * (5 + k * 4))).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) + "*",
      body_md_ar: '',
      author_id: pick(AGENTS, k + 3).id,
      views: 40 + (k * 23) % 800,
      helpful_up: 3 + (k * 5) % 40,
      helpful_down: (k * 3) % 8,
      published_at: isoAgo(60 * 24 * (5 + k * 4))
    });
  });

  // ===================== AI LOGS =====================
  var AI_LOGS = [];
  var features = ['reply','summary','sentiment','category','kb_answer','translate'];
  for (var a = 0; a < 120; a++) {
    var feat = pick(features, a);
    var tIn = 200 + (a * 47) % 800;
    var tOut = 30 + (a * 13) % 220;
    AI_LOGS.push({
      id: 'ail-' + a,
      feature: feat,
      model: a % 7 === 0 ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001',
      tokens_in: tIn,
      tokens_out: tOut,
      cost_usd: +((tIn * 0.0000008) + (tOut * 0.000004)).toFixed(5),
      latency_ms: 280 + (a * 29) % 1400,
      fallback: a % 17 === 0,
      at: isoAgo(15 + a * 12)
    });
  }

  // ===================== INTEGRATIONS =====================
  var INTEGRATIONS = [
    { id: 'int-slack',   name: 'Slack',   status: 'connected',    connected_at: isoAgo(60 * 24 * 30), icon: '💬' },
    { id: 'int-linear',  name: 'Linear',  status: 'disconnected', connected_at: null, icon: '📋' },
    { id: 'int-stripe',  name: 'Stripe',  status: 'connected',    connected_at: isoAgo(60 * 24 * 90), icon: '💳' },
    { id: 'int-webhook', name: 'Webhook', status: 'connected',    connected_at: isoAgo(60 * 24 * 14), icon: '🔗' }
  ];

  // ===================== SETTINGS =====================
  var SETTINGS = {
    business_name: 'Sanad Demo Inc.',
    support_email: 'support@sanad.app',
    business_hours: 'Sun–Thu · 09:00–18:00 GST',
    languages: ['en', 'ar'],
    greeting: "👋 Hi there! I'm the Sanad assistant. I can help with billing, account, or technical questions. What can I do for you?",
    human_handoff_keywords: ['human', 'agent', 'person', 'representative', 'وكيل', 'بشر'],
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.4,
    max_tokens: 800,
    cache_enabled: true,
    system_prompt: "You are Sanad, an AI customer-support copilot for a SaaS platform. Be concise, friendly, and accurate. When citing knowledge-base articles, reference them by title. If you don't know, say so and offer to escalate to a human agent. Keep replies to 2-4 sentences unless asked for detail."
  };

  // ===================== EXPOSE =====================
  window.SANAD_DATA = {
    CATEGORIES: CATEGORIES,
    AGENTS: AGENTS,
    CUSTOMERS: CUSTOMERS,
    CONVERSATIONS: CONVERSATIONS,
    MESSAGES: MESSAGES,
    ARTICLES: ARTICLES,
    AI_LOGS: AI_LOGS,
    INTEGRATIONS: INTEGRATIONS,
    SETTINGS: SETTINGS
  };
})();
