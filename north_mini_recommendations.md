# EC Tower Live Monitor - Project Analysis & Recommendations

## Overview
Next.js/React application for real-time eddy covariance tower monitoring with 10 configured sites.

## Critical Issues

### 1. Server-Side File System I/O (HIGH)
**Location**: `src/app/page.tsx`
**Problem**: Uses `fs` module for reading CSV config on server-side
**Impact**: Breaks Next.js app directory conventions, may cause build issues
**Recommendation**: Move configuration loading to API routes or client-side

### 2. Redundant Config Loading (MEDIUM)
**Problem**: CSV config read in both `page.tsx` and `lib/poller.ts`
**Impact**: Duplicated logic, potential data inconsistency
**Recommendation**: Create shared API endpoint `/api/sites` for config access

### 3. Hardcoded External Dependency (MEDIUM)
**Location**: `src/components/Dashboard.tsx` line 293
**Problem**: Hardcoded Render backend URL `https://ec-tower-backend.onrender.com`
**Impact**: Difficult to deploy/maintain, breaks in production
**Recommendation**: Use environment variables (`NEXT_PUBLIC_RENDER_BACKEND_URL`)

## Code Quality Issues

### 4. Commented-Out Code (LOW)
**Location**: `src/components/Dashboard.tsx` lines 110-130 (time range slider)
**Problem**: Extended commented-out feature complicates code
**Recommendation**: Remove or implement properly

### 5. Inconsistent Error Handling (MEDIUM)
**Problem**: Vague error handling in data loading and polling
**Impact**: Poor user experience, difficult debugging
**Recommendation**: Implement standardized error types/responses

### 6. Missing Type Safety (MEDIUM)
**Problem**: Manual JSON parsing without validation
**Location**: `src/components/Dashboard.tsx` line 153, `src/lib/tcp.ts` line 132
**Recommendation**: Add Zod schemas or similar validation

## Architecture Problems

### 7. Mixed Concerns (HIGH)
**Location**: `src/lib/poller.ts`, `src/components/Dashboard.tsx`
**Problem**: Polling logic mixed with UI state management
**Recommendation**: Use proper abstraction layers (hooks, services)

### 8. Missing Data Persistence Strategy (MEDIUM)
**Problem**: Concept of 10,000 point circular buffer mentioned but not implemented
**Location**: Config mentions, `src/lib/storage.ts` needs review
**Recommendation**: Implement robust data storage with rotation

### 9. Global State Management (MEDIUM)
**Problem**: Multiple app-wide state variables without clear patterns
**Location**: Dashboard component - sites, data, error, loading, timeRange, siteStatuses
**Recommendation**: Consider state management library or Redux-like patterns

## Dependencies & Configuration

### 10. Unused Dependencies (LOW)
**Problem**: `DataTable.tsx` component exists but not used in Dashboard
**Recommendation**: Either integrate it or remove

### 11. Incomplete Configuration (MEDIUM)
**Problem**: No environment validation, missing Build/Deploy configs
**Location**: Missing `next.config.js` validation, `.env` samples
**Recommendation**: Add environment validation and CI/CD config

## Specific Recommendations

### Immediate (Week 1):
1. Extract config loading to API route
2. Add environment variables for external services
3. Remove commented-out code
4. Add basic error boundaries

### Short-term (Month 1):
1. Implement proper data validation schemas
2. Refactor polling logic into custom hooks
3. Add data persistence layer
4. Set up CI/CD pipeline

### Long-term (Quarter):
1. Implement real-time WebSocket updates
2. Add advanced caching strategies
3. Implement accessibility improvements
4. Add comprehensive testing suite

## Files to Prioritize for Fixes:
1. `src/app/page.tsx` - Remove server-side I/O
2. `src/components/Dashboard.tsx` - Refactor state management
3. `src/lib/poller.ts` - Extract polling logic
4. `src/lib/storage.ts` - Implement data persistence
5. `src/components/DataTable.tsx` - Either integrate or remove

## Technical Debt Summary:
- 6-8 hours of refactoring needed for immediate improvements
- 20-30 hours for comprehensive architecture overhaul
- High risk in current polling and data loading patterns
- Medium maintainability issues due to mixed concerns