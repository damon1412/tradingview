# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a stock volume profile visualization tool built with React 18 + TypeScript. It provides interactive candlestick charts, volume charts, and volume profile analysis for stock trading.

## Core Dependencies
- **Charts**: Recharts for all financial chart rendering
- **Styling**: Tailwind CSS with custom configuration
- **Backend**: 本地后端 API (localhost:8080) + DuckDB 数据库
- **Routing**: React Router DOM
- **Utilities**: date-fns for date handling, lucide-react for icons, framer-motion for animations

## Common Commands
```bash
# Start development server on localhost:3000
npm run dev

# Build production bundle to dist/ directory
npm run build

# Run TypeScript type checking
npm run typecheck
```

## Architecture
```
src/
├── components/          # UI components
│   ├── CandlestickChart.tsx    # K-line/candlestick chart component
│   ├── VolumeChart.tsx         # Volume bar chart component
│   ├── VolumeProfile.tsx       # Volume profile (POC, value areas) component
│   ├── StatsPanel.tsx          # Trading statistics display
│   ├── TimeFrameSelector.tsx   # Time interval selector (1H, 1D, 1W, etc.)
│   └── SignalScannerPage.tsx  # Signal scanner with volatility skew analysis
├── hooks/               # Custom React hooks
│   ├── useTheme.ts              # Dark/light theme management
│   └── useVolumeProfile.ts      # Volume profile data fetching and processing
├── services/            # API layer
│   └── stockApi.ts              # 本地后端 API 数据获取 (localhost:8080)
├── types/               # TypeScript type definitions
│   └── stock.ts                 # Stock data, OHLCV, volume profile types
└── utils/               # Helper functions
    └── stockData.ts             # Stock data processing, volume profile, skew calculation
```

## Key Features & Workflow
1. Data is fetched from 本地后端 API (localhost:8080) via `services/stockApi.ts`
2. Raw OHLCV data is processed in `utils/stockData.ts` to calculate volume profile, point of control (POC), value areas, and other trading metrics
3. Processed data is passed to the various chart components for visualization
4. Users can switch time frames which triggers refetching and recalculation of data
5. Dark/light theme is managed globally via the `useTheme` hook
6. Signal scanner analyzes volatility skew across multiple time periods
7. Volume profile supports automatic fallback to daily data when minute-level coverage is insufficient

## Important Conventions
- All stock-related types are defined in `types/stock.ts` - use these instead of creating duplicate types
- Data transformation logic belongs in `utils/stockData.ts`, not in components
- API calls should be encapsulated in the `services/stockApi.ts` layer
- Use Tailwind CSS utility classes for styling - avoid custom CSS where possible

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding
   Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2\. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

1. Surgical Changes
   Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

1. Goal-Driven Execution
   Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. \[Step] → verify: \[check]
2. \[Step] → verify: \[check]
3. \[Step] → verify: \[check]
   Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.



