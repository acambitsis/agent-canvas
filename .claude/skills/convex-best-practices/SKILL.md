---
name: convex-best-practices
description: Best practices for working with Convex database in AgentCanvas. Use when writing Convex queries, mutations, or optimizing database operations.
---

# Convex Best Practices for AgentCanvas

## Understanding Convex's Query Model

Convex is a **document database with real-time sync**, not a traditional SQL database. Key differences:

| Feature | SQL | Convex |
|---------|-----|--------|
| JOINs | Native support | Not supported |
| WHERE IN (list) | Native support | Not supported |
| Subqueries | Native support | Not supported |
| Indexes | Query planner decides | Explicit, developer chooses |
| Query location | Client → Network → DB | Server-side, close to DB |

## Fetching Multiple Documents

### By ID Array

Use `Promise.all` with `db.get()`:

```typescript
// Fetch multiple documents by ID
const documents = await Promise.all(
  ids.map((id) => ctx.db.get(id))
);
```

Or use `convex-helpers` package:
```typescript
import { getAll } from "convex-helpers/server/relationships";
const documents = await getAll(ctx.db, ids);
```

### By Related Field (Back-references)

When you need documents that reference a parent (e.g., votes for an agent):

```typescript
// Single agent - straightforward
const votes = await ctx.db
  .query("agentVotes")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .collect();
```

## Batch Queries: Parallel vs Sequential

### The Problem (N+1 Pattern)

**Bad - Sequential queries (one-by-one):**
```typescript
// ❌ SLOW: Each iteration waits for the previous to complete
const result = {};
for (const agent of agents) {
  const votes = await ctx.db
    .query("agentVotes")
    .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
    .collect();
  result[agent._id] = votes.length;
}
```

For 15 agents, this runs 15 queries **sequentially** - each waits for the previous.

### The Solution (Parallel Queries)

**Good - Parallel queries with Promise.all:**
```typescript
// ✅ FAST: All queries start immediately, results collected together
const votesPerAgent = await Promise.all(
  agents.map((agent) =>
    ctx.db
      .query("agentVotes")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect()
  )
);

// Build result from parallel query results
const result = {};
agents.forEach((agent, index) => {
  result[agent._id] = votesPerAgent[index].length;
});
```

For 15 agents, all 15 queries run **concurrently**.

### Why This Works Well in Convex

Unlike traditional client-server setups where N queries = N network round-trips, Convex queries run **server-side, close to the database**. This means:

1. No network latency between query code and database
2. Parallel queries have minimal overhead
3. The main benefit is starting all queries at once vs waiting between each

## Index Design

### Always Use Explicit Indexes

Convex requires explicit index selection - there's no query planner:

```typescript
// ❌ Scans entire table (only for prototyping)
const votes = await ctx.db
  .query("agentVotes")
  .filter((q) => q.eq(q.field("agentId"), agentId))
  .collect();

// ✅ Uses index, fast lookup
const votes = await ctx.db
  .query("agentVotes")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .collect();
```

### Compound Indexes for Multiple Fields

When filtering on multiple fields, create compound indexes:

```typescript
// Schema
.index("by_user_agent", ["workosUserId", "agentId"])

// Query - fields must be in index order
const vote = await ctx.db
  .query("agentVotes")
  .withIndex("by_user_agent", (q) =>
    q.eq("workosUserId", userId).eq("agentId", agentId)
  )
  .first();
```

## Relationships Pattern

### One-to-Many

Parent stores nothing extra; children reference parent ID:

```typescript
// Schema
agents: defineTable({ canvasId: v.id("canvases"), ... })
  .index("by_canvas", ["canvasId"])

// Query children
const agents = await ctx.db
  .query("agents")
  .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
  .collect();
```

### Many-to-Many

Use a junction table:

```typescript
// Schema
agentTags: defineTable({
  agentId: v.id("agents"),
  tagId: v.id("tags"),
})
  .index("by_agent", ["agentId"])
  .index("by_tag", ["tagId"])
```

## Pagination for Large Result Sets

Use `.paginate()` for large collections:

```typescript
const results = await ctx.db
  .query("comments")
  .withIndex("by_agent_time", (q) => q.eq("agentId", agentId))
  .order("desc")
  .paginate(paginationOpts);

return {
  page: results.page,
  isDone: results.isDone,
  continueCursor: results.continueCursor,
};
```

## Soft Deletes

Prefer soft deletes for audit trails:

```typescript
// Schema
.field("deletedAt", v.optional(v.number()))

// Query non-deleted
const agents = await ctx.db
  .query("agents")
  .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
  .filter((q) => q.eq(q.field("deletedAt"), undefined))
  .collect();

// Soft delete
await ctx.db.patch(id, { deletedAt: Date.now() });
```

## Real-Time Subscriptions

Convex queries automatically create real-time subscriptions. Frontend components using `useQuery` will re-render when data changes:

```typescript
// Frontend - automatically updates when votes change
const voteCounts = useQuery(api.agentVotes.getVoteCounts, { agentId });
```

## Helper Libraries

### convex-helpers

Install: `npm install convex-helpers`

Useful utilities:
- `getAll(db, ids)` - Fetch multiple documents by ID
- `getManyFrom(db, table, index, value)` - Query by index
- `asyncMap(array, fn)` - Parallel async mapping

```typescript
import { getAll, getManyFrom, asyncMap } from "convex-helpers/server/relationships";
```

## Common Patterns in This Codebase

### Auth Check Pattern
```typescript
const auth = await requireAuth(ctx);
await getAgentWithAccess(ctx, auth, agentId);
```

### Canvas Access Check
```typescript
const canvas = await ctx.db.get(canvasId);
if (!canvas || canvas.deletedAt) {
  throw new Error("NotFound: Canvas not found");
}
const hasAccess = auth.isSuperAdmin ||
  auth.orgs.some((org) => org.id === canvas.workosOrgId);
if (!hasAccess) {
  throw new Error("Auth: Organization access denied");
}
```

## MCP Tools for Debugging

Use the Convex MCP tools for debugging:

```
mcp__convex__status - Get deployment info
mcp__convex__logs - Fetch recent logs
mcp__convex__tables - List tables and schemas
mcp__convex__data - Read table data
mcp__convex__run - Execute a function
mcp__convex__runOneoffQuery - Run ad-hoc query
```

## References

- [Convex Reading Data](https://docs.convex.dev/database/reading-data/)
- [Database Relationship Helpers](https://stack.convex.dev/functional-relationships-helpers)
- [Queries that Scale](https://stack.convex.dev/queries-that-scale)
- [Convex Best Practices](https://docs.convex.dev/understanding/best-practices/)
