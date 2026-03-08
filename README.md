# TPO Simulator — Reynolds CP Agent Demo

Full-stack TPO (Trade Promotion Optimization) agent demo: Next.js + LLM tool-calling + SQLite + exec dashboard.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Add your OpenAI API key to .env
# Copy .env.example to .env and set OPENAI_API_KEY

# 3. Initialize database
npx prisma migrate dev --name init

# 4. Seed sample data (10 retailers, 5 SKUs, 120 promo events, budgets)
npm run seed

# 5. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Logo

`public/rcp-logo.svg` is a placeholder. Replace it with the official Reynolds logo asset (PNG or SVG) to use the real brand. Keep the same filename if you want the app to pick it up automatically, or update the image reference in `src/app/page.tsx`.

## Demo Script

1. Select period **2026-Q2**, objective **Maximize Margin**
2. Click **Run** or ask in chat: *"Should we reallocate 10% from Club to Walmart? What's the impact?"*
3. Agent responds with recommended allocation, KPIs, confidence, and explanation bullets
4. Confidence will show *medium/low* when Circana gaps exist (Walmart, Club, Amazon, etc.)

> *"This isn't a chatbot giving opinions. It uses tools: it queries budgets, simulates hundreds of allocations, calculates margin impact, and explains confidence limits when data is missing."*

## Architecture

- **Visual**: Next.js 16, Tailwind, Recharts
- **Agent**: OpenAI tool-calling (getBudgets, getRetailers, runTpoOptimization)
- **DB**: SQLite + Prisma (Retailer, SKU, PromoEvent, Budget, Conversation, Message)
- **TPO Tools**: metrics, scenario generator (200 scenarios), optimizer, Circana coverage checker

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production (runs Prisma generate + Next build) |
| `npm run start` | Start production server |
| `npm run seed` | Seed sample data |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Generate Prisma client |

## Deploy to Azure

See **[DEPLOY_AZURE.md](./DEPLOY_AZURE.md)** for step-by-step instructions (App Service and Container Apps).
