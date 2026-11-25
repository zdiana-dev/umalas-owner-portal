# Owner AI Chat — continuous, saved, fully automatic

Upgrade the existing «Задать вопрос» assistant into a full conversational bot for villa owners.

## What changes for owners
- One continuous chat per owner — every visit continues the same conversation, on any device.
- The bot answers automatically, in the owner's language (RU/EN), about:
  - their own reports, payouts, payment status and documents (already works),
  - project information (Umalas / Anoya / Sky Stars / Amara — general facts),
  - policies and rules (rental pool, management agreement terms, payment schedules).
- Answers render with formatting (lists, bold) instead of plain text.
- Admin can review what owners ask (read-only conversation log per owner).

## How it will be built

### 1. Database — save the conversation
- New table `chat_messages` (id, owner_id, role, content, sources, created_at), RLS: owner reads/writes only own rows, admin reads all. GRANTs included.
- One continuous chat = simply all messages of that owner, ordered by time. No threads UI.

### 2. Server (`src/lib/assistant.functions.ts`)
- `getChatHistory` — loads the owner's saved messages (last ~50).
- `askMyDocuments` extended:
  - saves each user question and each answer to `chat_messages`,
  - builds history from the saved conversation server-side (no longer trusts client-sent history),
  - system prompt gains a PROJECT INFO + POLICIES section (projects, rental pool rules, payment schedule, contact points) so the bot answers general questions too, not only document ones,
  - keeps the existing PDF/scan reading and source citations.
- `getOwnerChatLog` (admin only) — read a client's conversation.

### 3. Chat page (`src/routes/_authenticated/assistant.tsx`)
- Loads saved history on open; renders markdown answers (react-markdown).
- «New conversation» button clears the owner's history (with confirm).
- Keeps sample questions, sources list, RU/EN, focus behavior.

### 4. Admin view
- On the admin owner page: «Переписка с ассистентом» — read-only view of that owner's chat.

## Notes
- Model stays `openai/gpt-6-astra` via the AI Gateway (no keys to configure).
- Nothing is sent to owners; the bot only answers inside the portal.
- Project-info/policy text will be seeded from what I know of the portal; you can edit it later.
