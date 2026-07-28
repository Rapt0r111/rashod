# Rashod

LAN roster service with PostgreSQL storage and RBAC.

## First start

Create the first administrator on the server before opening the service to LAN:

```powershell
bun run auth:create-admin admin
```

The command prompts for a password without writing it to command history. For
non-interactive provisioning, pass `RASHOD_ADMIN_PASSWORD` only through the
secret manager/environment of the deployment. The password must have at least
12 characters. The command stores an Argon2id hash; no default account or
password is shipped. Then start the service:

```powershell
bun run build
bun run start
```

`bun run start` binds to all local interfaces on HTTP, port `3000`, and enables
the LAN-only HTTP session mode. Open `http://192.168.0.101:3000` (replace the
address with the server's LAN IPv4 address). To bind to one exact address or
port, set these before starting:

```powershell
$env:RASHOD_LAN_HOST = "192.168.0.101"
$env:RASHOD_PORT = "3000"
bun run start
```

HTTP sends login credentials and session cookies without encryption. Keep port
`3000` on a trusted private network, allow it only through the Windows Private
firewall profile, for example:

```powershell
New-NetFirewallRule -DisplayName "Rashod HTTP LAN" -Direction Inbound `
  -Action Allow -Protocol TCP -LocalPort 3000 `
  -RemoteAddress 192.168.0.0/24 -Profile Private
```

Never forward port `3000` to the Internet. For a secure local
loopback-only production start, use `bun run start:secure` instead.

## PostgreSQL

Set `DATABASE_URL` only in the deployment shell, then start the service:

```powershell
$env:DATABASE_URL = "postgresql://user:password@host:5432/rashod"
bun run db:migrate
bun run auth:create-admin admin
bun run build
bun run start
```

The active application runtime uses PostgreSQL only. SQLite service code and
the one-time importer have been removed. Existing `.data/rashod.sqlite*` files
are not loaded by the application and may be retained only as a rollback
backup.

Read [`docs/postgresql-migration.md`](docs/postgresql-migration.md) for
deployment and backup details.

## Offline Windows bundle

Before transfer, run:

```powershell
.\offline-transfer-postgresql-win10\check-offline.cmd
```

The preflight checks required files, `DATABASE_URL`, production auth flags,
source/bundle parity for migrations, API routes, the migration runner, and the
production build id. With `psql.exe` available, it also runs read-only schema
and users health checks.

Manual regeneration steps:

1. Build the source app: `bun --bun run build`.
2. Copy refreshed app files/build output into `offline-transfer-postgresql-win10\app`.
3. Refresh `offline-transfer-postgresql-win10\database\rashod.dump`.
4. Ensure `app\.env` has `DATABASE_URL` and does not enable `AUTH_ALLOW_INSECURE_LAN`.
5. Run `check-offline.cmd` until it passes.

## Access control

Every page and API handler checks permissions on the server. `proxy.ts` adds
response hardening only; it is not an authorization source. Permissions imply
their read counterpart where an endpoint returns a snapshot (`roster:write` and
`references:manage` imply `roster:read`; `groups:write` implies `groups:read`).

`access:grant` is deliberately sensitive: it is required together with the
management permission to assign roles or change a role. Delegated access
managers can grant only permissions they already have; only the protected
administrator role can grant the system administrator role. Password, role and
active-state changes revoke existing sessions. Keep `access:grant` assigned
only to trusted security administrators.

For multiple application replicas, place the app behind a TLS reverse proxy,
set `AUTH_ENABLE_HSTS=true`; set `AUTH_TRUST_PROXY=true` only when that proxy
overwrites inbound `X-Forwarded-For`. Login throttling uses PostgreSQL and is
therefore shared across replicas. SSE events use PostgreSQL `LISTEN/NOTIFY`,
so change notifications reach every app replica connected to the same database.

## Development

The development server also binds to all local interfaces. Use
`http://<server-lan-ip>:3000` from another device on the private LAN.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000), or
`http://<server-lan-ip>:3000` from another LAN device.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
