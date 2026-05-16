# Laboratory Logbook

Next.js web app for analytical instrument daily use records.

## Features

- Email/password login with Supabase Auth
- Role-based access: analyst, supervisor, admin
- Analyst daily use submission form
- Supervisor dashboard at `/admin`
- Pending, approved, and rejected statuses
- Supervisor comments
- Telegram notification on new submissions
- Supabase Postgres storage

## Local Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Arch/CachyOS with fish, install Node 22 first:

```bash
sudo pacman -S nodejs-lts-jod npm
node -v
```

`node -v` should print `v22.x`.

Open `http://localhost:3000`.

## Supabase Setup

Full deployment guide: `SUPABASE_VERCEL_SETUP.md`.

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. In Supabase Auth, create users for analysts and supervisors.
5. Copy each Auth user UUID.
6. Insert matching rows into `public.profiles`.

Example:

```sql
insert into public.profiles (id, email, full_name, role)
values
  ('auth-user-uuid-here', 'analyst@example.com', 'Analyst Name', 'analyst'),
  ('auth-user-uuid-here', 'boss@example.com', 'Supervisor Name', 'supervisor');
```

## Environment Variables

Create `.env.local` locally and add the same values in Netlify site environment variables.

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
LAB_INITIAL_PASSWORD=replace_with_a_strong_temporary_password
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

Keep `SUPABASE_SERVICE_ROLE_KEY`, `LAB_INITIAL_PASSWORD`, and `TELEGRAM_BOT_TOKEN` secret. Do not put private values in browser code or commit `.env.local`.

## Telegram Setup

1. Create a bot with Telegram BotFather.
2. Get the bot token.
3. Send a message to the bot from the supervisor account or group.
4. Get the chat ID.
5. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env.local` and Netlify.

## Netlify Deployment

1. Push this folder to GitHub.
2. Import the GitHub repo in Netlify.
3. Framework preset: Next.js.
4. Add all environment variables from `.env.example`.
5. Deploy.
6. Change `NEXT_PUBLIC_APP_URL` to the Netlify URL, then redeploy.

The project uses Node `22.x` in `package.json` and includes `netlify.toml` for Netlify builds.
