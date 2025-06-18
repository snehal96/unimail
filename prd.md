**Product Requirements Document (PRD)**

**Project Name:** Unimail
**Tagline:** "Unified email fetching & document extraction layer for modern web apps"

---

### 1. **Objective**

To build an open-source Node.js library that abstracts email integration across Gmail, Outlook, Yahoo, and IMAP sources. It will fetch emails, parse attachments, normalize metadata, and provide a pluggable base for document processing workflows.

---

### 2. **Target Users**

* Developers building inbox-integrated apps (e.g., CRMs, document processors, AI email assistants)
* Indie hackers, SaaS founders (like IntelliDocs)
* OSS contributors looking for plug-and-play email ingestion layer

---

### 3. **Core Use Cases**

* "I want to fetch all recent emails with PDF attachments from Gmail."
* "Give me the last 50 messages from Outlook, with subject, sender, and parsed attachments."
* "Push all attachments from all inboxes into my file parser or document classifier."

---

### 4. **Key Features**

#### Phase 1: MVP

1. **Gmail Integration via OAuth2 + Gmail API**
2. **Message Fetching API**

   * `fetchEmails({ since, query, limit })`
   * Normalized output across providers
3. **Attachment Extractor**

   * Saves attachments as Buffers with metadata (name, mime)
   * Skips inline images
4. **Email Normalization Schema**

   ```json
   {
     "thread_id": "xyz",
     "from": "abc@domain.com",
     "to": ["you@inbox.com"],
     "subject": "License Expiry",
     "body_text": "...",
     "body_html": "<p>...</p>",
     "attachments": [{ "filename": "invoice.pdf", "mime": "application/pdf", "buffer": Buffer }]
   }
   ```
5. **mailparser Integration** for HTML/text cleaning
6. **Token Persistence Layer** (in-memory + file + pluggable)

#### Phase 2

7. **Outlook/Office365 Integration (Microsoft Graph API)**
8. **IMAP Adapter (Yahoo, custom mail)**
9. **Webhook-friendly poller (cron-based or push-ready)**
10. **Auto-tagging of attachments by content type**

---

### 5. **Technical Architecture**

```
            ┌────────────────────┐
            │   User's App       │
            └────────┬───────────┘
                     │
                     ▼
            ┌────────────────────┐
            │ Unimail SDK   │
            ├────────────────────┤
            │ GmailAdapter       │
            │ OutlookAdapter     │
            │ ImapAdapter        │
            └────────┬───────────┘
                     ▼
      ┌───────────────────────────────┐
      │ Normalized Email Output       │
      └───────────────────────────────┘
                     ▼
      ┌───────────────────────────────┐
      │ mailparser + Attachment Utils │
      └───────────────────────────────┘
```

* Written in **TypeScript**
* Pluggable adapter pattern: `GmailAdapter`, `OutlookAdapter`, `IMAPAdapter`
* Uses Gmail API, Microsoft Graph API, or `imapflow`
* Internal queuing for batch/paginated fetching

---

### 6. **Success Criteria**

* One-line install: `npm install unimail`
* Fetch + parse from Gmail in <10 lines of code
* 500+ GitHub stars in 6 months
* Used by at least 3 production SaaS tools or side projects

---

### 7. **README Template (For GitHub)**

````md
# Unimail

> 📬 Unified Node.js SDK to fetch and parse emails from Gmail, Outlook, IMAP.

**Features:**
- Unified `fetchEmails()` interface across providers
- Easy attachment parsing + metadata
- Works with Gmail API, Microsoft Graph, IMAP
- Built with TypeScript

## Install
```bash
npm install unimail
````

## Quick Start (Gmail)

```ts
import { GmailAdapter } from 'unimail';

const gmail = new GmailAdapter({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
});

const emails = await gmail.fetchEmails({ query: 'has:attachment filename:pdf', limit: 10 });

emails.forEach(email => {
  console.log(email.subject, email.attachments.length);
});
```

## Roadmap

* ✅ Gmail (OAuth2)
* 🛠️ Outlook (Graph API)
* 🛠️ IMAP support
* 🛠️ Background poller + webhook mode

## License

MIT

```

---

**Maintainer:** Snehal Maheshwari  
**Prepared by:** ChatGPT (2025-06-07)

```
