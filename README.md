# Work Monster

Mobile-first motivation game web app (Next.js + Firebase) with user and manager roles.

## Highlights

- App name fixed as **Work Monster**
- Mobile-first UX with bottom tabs: Questions, Record, Rewards, Score, Rules
- Google login support via Firebase Auth
- English + Korean language selection
- Font setup:
  - Base UI: **Pretendard**
  - Cute display accent: **Jua**
- Rule versioning with onboarding modal + change highlights
- Recoverable penalty flow in **Score tab** (Risk Zone)
- Manager panel for submission review, rules, rewards, and penalty reward claims

## Stack

- Next.js App Router + TypeScript + Tailwind
- Firebase Auth + Firestore (with in-memory fallback when env vars are missing)

## Setup

1. Install Node.js 20+ and npm.
2. Copy env:

```bash
cp .env.example .env.local
```

3. Fill Firebase client/admin variables.
4. Install dependencies and run:

```bash
npm install
npm run dev
```

Google login works when Firebase client + admin envs are configured.

## Firebase Data Contract

- `users/{uid}`
- `submissions/{id}`
- `scores/{uid}`
- `rules/current`
- `rewards/{id}`
- `reward_claims/{id}`
- `penalty_history/{id}`
- `audit_logs/{id}`

## Tests

```bash
npm run test
npm run test:e2e
```

## Deploy fixed URL

Recommended: Vercel

```bash
npm i -g vercel
vercel
vercel --prod
```

Then set the production domain in Vercel project settings for a fixed URL.

## Git push

```bash
git add .
git commit -m "feat: scaffold Work Monster mobile app with Firebase roles/rules/penalty system"
git remote add origin <YOUR_REMOTE_URL>
git push -u origin main
```
