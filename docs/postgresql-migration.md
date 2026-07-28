# PostgreSQL deployment

The application uses PostgreSQL exclusively. Set `DATABASE_URL` for every
runtime process, then run the idempotent schema setup:

```powershell
bun run db:migrate
```

Create the first administrator before exposing the service:

```powershell
bun run auth:create-admin admin
```

The command prompts for the password. Do not pass the password on the command
line because it can be saved in shell history and process logs. For
non-interactive provisioning, set `RASHOD_ADMIN_PASSWORD` through a secret
manager or the process environment only.

`AUTH_ALLOW_INSECURE_LAN=true` is a development escape hatch only. Production
startup scripts must reject it; use HTTPS/TLS for real accounts.

The former SQLite migration has completed and its code is removed. The old
`.data/rashod.sqlite`, `-wal`, and `-shm` files are not read by the app. Keep
them only until an independent PostgreSQL backup has been verified, then they
can be deleted together.

## Offline bundle preflight

Before handing off `offline-transfer-postgresql-win10`, run:

```powershell
.\offline-transfer-postgresql-win10\check-offline.cmd
```

It checks required bundle files, `DATABASE_URL`, production safety flags,
source-to-bundle parity for migration files, API routes, the migration runner,
and `.next\BUILD_ID`. If `psql.exe` is available and `DATABASE_URL` is
reachable, it also performs read-only table/users health checks.

If parity fails, regenerate the bundle manually: rebuild the source app, copy
the refreshed app/build/migration files into `offline-transfer-postgresql-win10\app`,
refresh `database\rashod.dump`, then run `check-offline.cmd` again.
