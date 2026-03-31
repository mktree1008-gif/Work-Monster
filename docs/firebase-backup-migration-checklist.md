# Firebase Backup -> New Project Migration Checklist

## 0) Goal
Move all Firestore data from current project to a new Firebase project without losing old data.

## 1) Pre-check
1. Confirm current app is deployed and old project credentials are still valid in `.env.local`.
2. Create new Firebase project and Firestore database in Native mode.
3. Generate a new service account key for the new project.
4. Copy `.env.migration.example` to `.env.target.local` and fill:
   - `TARGET_FIREBASE_PROJECT_ID`
   - `TARGET_FIREBASE_CLIENT_EMAIL`
   - `TARGET_FIREBASE_PRIVATE_KEY`

## 2) Backup old project data
Run from repo root:

```bash
python3 tools/firestore_migration/firestore_backup.py --env-file .env.local
```

Expected result:
- A file is created under `backups/` like `firestore-backup-YYYYMMDD-HHMMSS.json`.

If auto-discovery fails due API quota on `listCollectionIds`, run with explicit collections:

```bash
python3 tools/firestore_migration/firestore_backup.py --env-file .env.local --collections users,submissions,scores,rules,rewards,reward_claims,penalty_history,audit_logs,announcements,notifications
```

Optional (custom output path):

```bash
python3 tools/firestore_migration/firestore_backup.py --env-file .env.local --output backups/pre-cutover.json
```

## 3) Dry-run restore to new project
Use latest backup file and run dry-run first:

```bash
python3 tools/firestore_migration/firestore_restore.py --backup-file backups/<YOUR_BACKUP_FILE>.json --env-file .env.target.local --dry-run
```

Expected result:
- `DRY_RUN complete` with document count.

## 4) Real restore to new project

```bash
python3 tools/firestore_migration/firestore_restore.py --backup-file backups/<YOUR_BACKUP_FILE>.json --env-file .env.target.local
```

Expected result:
- `DONE. docs=<count>`

## 5) Switch app env to new project
In Vercel (or your deployment env), replace Firebase vars with new project values:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Redeploy after update.

## 6) Post-migration validation
1. Login with existing user account.
2. Verify dashboard score values are visible.
3. Check manager page lists users/submissions/rewards.
4. Check record/history pages render existing data.
5. Create one new check-in and confirm write succeeds.

## 7) Rollback plan
If issue occurs:
1. Revert deployment env vars back to old Firebase project.
2. Redeploy.
3. App returns to old data immediately.

## Notes
- Old project data remains intact unless you delete it manually.
- New project will not contain old data unless restore is executed.
