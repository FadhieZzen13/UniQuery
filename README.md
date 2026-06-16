# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Backend database roles (`APPLICATION_DATABASE_URL`)

The API server (`server/`) connects at runtime as **`application_role`**, a non-superuser
role that **respects Row-Level Security**. `postgres`/`service_role` both `BYPASSRLS`, so
while the app connects as one of those the RLS policy on `identity_markers` is decorative.
Connecting as `application_role` activates it (checklist §2.2).

- `APPLICATION_DATABASE_URL` — `application_role` connection used for **all request handling**.
- `DATABASE_URL` — `postgres`-role connection kept for **migrations only** (the app falls back
  to it only if `APPLICATION_DATABASE_URL` is unset).
- `APPLICATION_DATABASE_URL_TEST` — disposable test branch for the integration suite
  (`NODE_ENV=test`). When unset, `server/tests/integration/*` self-skip.

One-time DBA setup in Supabase to grant `application_role` the privileges it needs (run as a
superuser; the audit-log overrides from `20260530_validation_fixes.sql` must remain):

```sql
GRANT CONNECT ON DATABASE postgres TO application_role;
GRANT USAGE ON SCHEMA public TO application_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO application_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO application_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO application_role;
ALTER ROLE application_role WITH LOGIN PASSWORD '<strong>';
-- moderation_audit_log stays append-only: application_role keeps SELECT, INSERT but
-- UPDATE, DELETE, TRUNCATE remain revoked, and the BEFORE triggers block mutation even
-- for accidental superuser connections.
```

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
