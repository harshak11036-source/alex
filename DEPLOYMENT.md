# ALEX Deployment Guide: Vercel + Neon PostgreSQL

## Overview
This guide covers deploying the ALEX application to Vercel with Neon PostgreSQL database.

## Prerequisites
- GitHub account
- Vercel account (free tier)
- Neon account (free tier)

---

## Step 1: Create Neon PostgreSQL Database

1. Go to https://console.neon.tech and sign up
2. Create a new project:
   - Project name: `alex-db`
   - PostgreSQL version: 16
   - Region: Choose closest to your users
3. Copy the connection strings:
   - **Pooled connection** (for app): `postgresql://user:pass@ep-xxx.region.neon.tech/neondb?sslmode=require`
   - **Direct connection** (for migrations): `postgresql://user:pass@ep-xxx.region.neon.tech/neondb?sslmode=require`
4. Save these for Step 3

---

## Step 2: Push to GitHub

```bash
cd C:\Users\harsh\Downloads\Project_1 (2)\Project_1\alex

# Initialize git if not already done
git init
git add .
git commit -m "Initial commit for Vercel deployment"

# Create GitHub repo and push
gh repo create alex --private --source=. --push
```

---

## Step 3: Configure Vercel Project

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web` (important!)
   - **Build Command**: `pnpm run build:web` (or leave default)
   - **Install Command**: `pnpm install --frozen-lockfile`
5. Add Environment Variables (see below)
6. Click "Deploy"

---

## Step 4: Environment Variables in Vercel

Add these in Vercel Project Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | Your Neon pooled connection string | Production, Preview, Development |
| `DIRECT_URL` | Your Neon direct connection string | Production, Preview, Development |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -hex 32` | Production, Preview, Development |
| `NEXTAUTH_URL` | Your Vercel production URL (e.g., `https://alex.vercel.app`) | Production |
| `ENCRYPTION_KEY` | Generate with `openssl rand -hex 32` | Production, Preview, Development |
| `AUTH_MODE` | `local` | Production, Preview, Development |
| `NEXT_PUBLIC_AUTH_MODE` | `local` | Production, Preview, Development |
| `STORAGE_MODE` | `local` | Production, Preview, Development |
| `AI_MODE` | `mock` (or `nemotron` if you have API key) | Production, Preview, Development |
| `NVIDIA_NEMOTRON_API_KEY` | Your NVIDIA API key (optional) | Production |
| `OPENAI_API_KEY` | Your OpenAI API key (optional) | Production |
| `NEXT_PUBLIC_APP_URL` | Your Vercel production URL | Production |

**Important**: Never commit real secrets to git. Use Vercel's environment variable UI.

---

## Step 5: Run Database Migrations

After first deployment, run migrations:

```bash
# Option 1: Vercel CLI (recommended)
vercel env pull .env.local
cd apps/web
pnpm run db:migrate:deploy

# Option 2: Local with Neon connection
# Set DATABASE_URL in local .env.local to Neon direct URL
cd apps/web
pnpm run db:migrate:deploy
```

---

## Step 6: Seed Database (Optional)

```bash
# Run seed script against Neon
cd apps/web
DATABASE_URL="your-neon-direct-url" pnpm run db:seed
```

---

## Step 7: Configure Custom Domain (Optional)

1. In Vercel Project Settings → Domains
2. Add your custom domain
3. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to the new domain
4. Redeploy

---

## Important Notes

### File Storage
- Currently uses **local filesystem** (`STORAGE_MODE=local`)
- **Vercel's filesystem is ephemeral** - files will be lost on redeploy
- For production, migrate to:
  - **Vercel Blob** (easiest, has free tier)
  - **AWS S3 / Cloudflare R2**
  - **Firebase Storage** (if you want to keep Firebase for storage only)

### Background Jobs
- Document processing runs inline (in API response)
- For heavy workloads, consider:
  - **Vercel Cron Jobs** (for scheduled tasks)
  - **Vercel Queue** (for async processing)
  - **Upstash Redis + Queue** (more control)

### AI Features
- Set `AI_MODE=mock` for testing without API keys
- For production AI, add provider API keys and set `AI_MODE=nemotron` (or other provider)

### Session Security
- `NEXTAUTH_SECRET` must be 32+ characters
- In production, cookies are Secure (HTTPS only)
- Sessions expire in 7 days

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
cd apps/web
rm -rf .next node_modules/.prisma
pnpm install
pnpm run build
```

### Database Connection Issues
- Verify Neon allows connections from Vercel IPs (default: allow all)
- Check `sslmode=require` in connection string
- Use pooled connection for app, direct for migrations

### Auth Not Working
- Verify `NEXTAUTH_URL` matches your deployment URL exactly
- Check `NEXTAUTH_SECRET` is set and same across environments
- Ensure cookies aren't blocked (HTTPS required in production)

### Prisma Client Errors
```bash
# Regenerate client
cd apps/web
pnpm run db:generate
```

---

## Cost Estimate (Free Tiers)

| Service | Free Tier Limits |
|---------|------------------|
| Vercel | 100GB bandwidth, 100GB-hours serverless functions |
| Neon | 0.5 GB storage, 190 hours compute/month |
| Total | **$0/month** for low-traffic apps |

---

## Files Changed for Deployment

- `apps/web/next.config.ts` - Removed static export, added image optimization
- `apps/web/vercel.json` - Vercel configuration
- `apps/web/package.json` - Removed Firebase, shared packages dependencies
- `apps/web/tsconfig.json` - Removed shared package path aliases
- `apps/web/src/lib/supabase/client.ts` - Local auth only, no Firebase
- `apps/web/src/lib/storage/client.ts` - Local storage only
- `apps/web/src/lib/supabase/server-auth.ts` - Local auth support
- `apps/web/src/app-api` → `apps/web/app/api` - Moved API routes to correct location
- Root `package.json`, `pnpm-workspace.yaml` - Removed functions workspace

---

## Next Steps After Deployment

1. Test all major user flows
2. Set up monitoring (Vercel Analytics, Neon monitoring)
3. Configure file storage for production (Vercel Blob recommended)
4. Set up background job processing if needed
5. Add real AI provider API keys