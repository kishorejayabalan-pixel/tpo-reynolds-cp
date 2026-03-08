# Deploy Reynolds CP – Promo Scenario Planning Tool to Azure

This guide covers two deployment options: **Azure App Service** (Node) and **Azure Container Apps** (Docker).

## Quick start (Azure App Service)

```bash
az login
RESOURCE_GROUP="rg-tpo-reynolds"
APP_NAME="tpo-reynolds-cp"   # pick a unique name
az group create --name $RESOURCE_GROUP --location eastus
az appservice plan create --name plan-tpo --resource-group $RESOURCE_GROUP --sku B1 --is-linux
az webapp create --name $APP_NAME --resource-group $RESOURCE_GROUP --plan plan-tpo --runtime "NODE:20-lts"
az webapp config appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP \
  --settings DATABASE_URL="file:/home/site/wwwroot/data/sqlite.db" NODE_ENV=production SCM_DO_BUILD_DURING_DEPLOYMENT=true
# Deploy from repo (GitHub Actions via Portal Deploy Center) or: npm run build && az webapp deploy ...
```

Then run migrations once (SSH or Kudu): `npx prisma migrate deploy && npx tsx prisma/seed.ts`. Open `https://<APP_NAME>.azurewebsites.net`.

---

## Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in (`az login`)
- [Node.js 18+](https://nodejs.org/) (for local build)
- (Optional) [Docker](https://docs.docker.com/get-docker/) for Container Apps

---

## Option 1: Azure App Service (Node)

Best for: quick deploy, no container image to maintain.

### 1. Create a resource group and App Service plan

```bash
RESOURCE_GROUP="rg-tpo-reynolds"
LOCATION="eastus"
APP_NAME="tpo-reynolds-cp"   # must be globally unique; use something like tpo-reynolds-cp-<youralias>

az group create --name $RESOURCE_GROUP --location $LOCATION
az appservice plan create --name plan-tpo-reynolds --resource-group $RESOURCE_GROUP --sku B1 --is-linux
az webapp create --name $APP_NAME --resource-group $RESOURCE_GROUP --plan plan-tpo-reynolds --runtime "NODE:20-lts"
```

### 2. Configure the app

- **Startup command**: App Service runs `npm start` by default. Ensure your `package.json` has `"start": "next start"`.
- **Node version**: Set in App Service **Configuration** → **Application settings** or via CLI:

```bash
az webapp config appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP \
  --settings \
  WEBSITE_NODE_DEFAULT_VERSION="20-lts" \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

### 3. Environment variables

Set these in **Azure Portal** → your Web App → **Configuration** → **Application settings** (or use CLI below).

| Name | Description | Example |
|------|-------------|---------|
| `DATABASE_URL` | SQLite file path (see note below) | `file:/home/site/wwwroot/data/sqlite.db` |
| `OPENAI_API_KEY` | OpenAI API key (optional; for agent features) | `sk-...` |
| `NODE_ENV` | Set to `production` | `production` |

**SQLite on App Service**: The app uses SQLite. Use a path under the app directory so it persists (e.g. `/home/site/wwwroot/data/sqlite.db`). Create the `data` folder in your repo and add a `.gitkeep`; the first run will create the DB, or run migrations in deployment.

```bash
az webapp config appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP \
  --settings \
  DATABASE_URL="file:/home/site/wwwroot/data/sqlite.db" \
  NODE_ENV="production"
# Add OPENAI_API_KEY in the Portal if you use agent features (secrets are not shown in CLI output)
```

### 4. Build and deploy from your machine

From the project root:

```bash
# Install deps and build (includes Prisma generate)
npm ci
npm run build

# Create deployment package (App Service expects the built app + node_modules)
# Option A: Deploy with Azure CLI from local build
az webapp deploy --name $APP_NAME --resource-group $RESOURCE_GROUP --src-path . --type zip
```

If `az webapp deploy` is not available, use **Zip Deploy** or **Git**:

- **Zip deploy**: Build locally, then zip `package.json`, `package-lock.json`, `next.config.ts`, `src`, `public`, `prisma`, `.next`, and run:
  ```bash
  zip -r deploy.zip . -x "node_modules/*" ".git/*" ".env*"
  az webapp deploy --name $APP_NAME --resource-group $RESOURCE_GROUP --src-path deploy.zip --type zip
  ```
  App Service will run `npm install --production` and use your `.next` if you include it, or run build on the server if you omit `.next` and set `SCM_DO_BUILD_DURING_DEPLOYMENT=true`.

- **Git (GitHub Actions)**: Use the **Deploy Center** in the Portal to connect your repo and deploy on push. Add the same app settings as above and ensure the workflow runs `npm ci && npx prisma generate && npm run build` and uses `next start` as the start command.

### 5. Run migrations and seed (one-time)

Use **SSH** or **Advanced Tools (Kudu)** → **SSH** for your App Service, then:

```bash
cd /home/site/wwwroot
mkdir -p data
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

Or run migrations in a **deployment script** (e.g. in GitHub Actions after deploy):

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

### 6. Open the app

```text
https://<APP_NAME>.azurewebsites.net
```

---

## Option 2: Azure Container Apps (Docker)

Best for: consistent runs across environments and easier scaling.

### 1. Build and push the image

From the project root (after adding the `Dockerfile` from this repo):

```bash
ACR_NAME="acrtporeynolds"   # must be globally unique
IMAGE_NAME="tpo-reynolds-cp"
IMAGE_TAG="latest"

az acr create --name $ACR_NAME --resource-group $RESOURCE_GROUP --sku Basic
az acr login --name $ACR_NAME
docker build -t $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG .
docker push $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG
```

### 2. Create Container App

```bash
ENVIRONMENT="env-tpo-reynolds"
CONTAINER_APP="app-tpo-reynolds"

az containerapp env create --name $ENVIRONMENT --resource-group $RESOURCE_GROUP --location $LOCATION
az containerapp create \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT \
  --image $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \
  --registry-server $ACR_NAME.azurecr.io \
  --ingress external \
  --target-port 3000 \
  --env-vars \
    "DATABASE_URL=file:/app/data/sqlite.db" \
    "NODE_ENV=production"
```

Add `OPENAI_API_KEY` as a **secret** in the Container App, then reference it as an env var.

### 3. Run migrations and seed

Use **Console** in the Container App, or a one-off job that runs:

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

---

## Production recommendation: Azure SQL or PostgreSQL

SQLite is fine for demos and single-instance App Service. For production (scale-out, backups, high availability):

1. Create **Azure Database for PostgreSQL** (or **Azure SQL Database**).
2. Change Prisma `schema.prisma` to use the appropriate provider and connection string:
   - PostgreSQL: `provider = "postgresql"`, `url = env("DATABASE_URL")` with a connection string like `postgresql://user:pass@server.postgres.database.azure.com:5432/dbname?sslmode=require`.
   - Azure SQL: use `provider = "sqlserver"` and a SQL Server connection string.
3. Run `npx prisma migrate deploy` (and seed if needed) after deploy.
4. Set `DATABASE_URL` in App Service or Container App to the Azure DB URL.

---

## Checklist

- [ ] Resource group and App Service (or Container App) created
- [ ] `DATABASE_URL` set (SQLite path or Azure SQL/Postgres URL)
- [ ] `NODE_ENV=production` set
- [ ] `OPENAI_API_KEY` set in Application settings (if using agent)
- [ ] Build runs `prisma generate` and `next build`
- [ ] Start command is `npm start` (Next.js) or the container runs `node server.js` (standalone)
- [ ] Migrations and seed run once after first deploy
- [ ] App opens at `https://<your-app>.azurewebsites.net` or your Container App URL

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| 502 / App not starting | Check **Log stream** and **Diagnose and solve problems**. Ensure `npm start` runs and port is 3000 (or set `WEBSITE_PORT` if needed). |
| Prisma / DB errors | Ensure `DATABASE_URL` is set and the path (or server) is writable/reachable. Run `prisma migrate deploy` after deploy. |
| Build fails on deploy | Set `SCM_DO_BUILD_DURING_DEPLOYMENT=true` and ensure Node 18+; or build locally and include `.next` in the zip. |
| SQLite file missing | Create the directory (e.g. `data`) in the app and ensure the process can write to it; or use Azure Files mount for persistent storage. |

For more detail, see [Azure App Service Node docs](https://docs.microsoft.com/en-us/azure/app-service/configure-language-nodejs) and [Azure Container Apps](https://docs.microsoft.com/en-us/azure/container-apps/).
