# Phase 4 Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Find and keep videos and articles for a topic.
**Architecture:** `topic_resources` table; pure cleaning in `lib/resources`; AI call with the web search tool in `lib/ai/resources.ts`; route `/api/ai/resources`; self-contained `TopicResources` component inside the Topics list.
**Tech Stack:** Supabase SQL, OpenAI Responses API web_search, TypeScript, React 19, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-11-phase-4-resources-design.md

## Global Constraints
1 AI action per find; only cited http(s) links; only topic and course name sent; at most 6 per find and 20 per topic; links open with rel="noopener noreferrer".

## Review Focus
Hallucinated or unsafe URLs; duplicate variants of one address; topic of someone else; prompt injection through a topic name; AI failure leaves saved links alone; refund on failure.

### Task 1: table and DB tests (`supabase/migrations/20261021000000_topic_resources.sql`, `tests/db/topicResources.test.ts`)
### Task 2: cleaning and AI call (`lib/resources/clean.ts`, `lib/ai/resources.ts`, `tests/unit/resourcesClean.test.ts`, `tests/unit/aiResources.test.ts`)
### Task 3: route and fake search (`app/api/ai/resources/route.ts`, fake route, `tests/unit/aiResourcesRoute.test.ts`)
### Task 4: data layer and component (`lib/data/resources.ts`, `components/progress/TopicResources.tsx`, `TopicsSection.tsx`, `tests/unit/topicResources.test.tsx`)
### Task 5: E2E and review (`e2e/resources.spec.ts`)
