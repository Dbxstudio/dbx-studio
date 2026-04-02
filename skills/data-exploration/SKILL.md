---
name: data-exploration
description: "Systematic database schema discovery, table profiling, and data quality assessment for DBX Studio. Use when a user wants to explore schema structure, profile tables, check null rates, or understand relationships between tables."
---

# Data Exploration — DBX Studio

## Exploration Workflow

### Step 1: Schema Discovery
Call tools in this order to map the database:

```
1. read_schema(schema_name: "public")     → list all tables
2. describe_table(table_name: "<table>")   → columns, types, FKs
3. get_table_stats(table_name: "<table>")  → row counts, distributions
```

### Step 2: Table Profiling
For each table of interest, gather:
- Row count and column types via `get_table_stats`
- Sample rows via `get_table_data` (default LIMIT 100)
- Null rates and value distributions via `execute_query`

### Step 3: Relationship Discovery
Identify foreign key patterns:
- Columns named `*_id` linking to other tables
- Common join patterns: `users.id → orders.user_id`
- Cross-reference with `describe_table` FK metadata

### Step 4: Validate Findings
Before presenting results:
- Confirm row counts match across joined tables where expected
- Verify FK columns reference valid target tables via `read_schema`
- Flag any orphaned records or broken FK relationships

## Quality Scoring

| Score | Completeness |
|-------|-------------|
| Green | > 95% populated |
| Yellow | 80–95% populated |
| Orange | 50–80% populated |
| Red | < 50% populated |

## Common Exploration Queries

### Row count
```sql
SELECT COUNT(*) AS row_count FROM "public"."table_name";
```

### Column null rates
```sql
SELECT
  COUNT(*) AS total,
  COUNT(column_name) AS non_null,
  ROUND(100.0 * COUNT(column_name) / COUNT(*), 2) AS pct_filled
FROM "public"."table_name";
```

### Distinct values
```sql
SELECT column_name, COUNT(*) AS frequency
FROM "public"."table_name"
GROUP BY 1
ORDER BY 2 DESC
LIMIT 20;
```

### Date range
```sql
SELECT MIN(created_at), MAX(created_at) FROM "public"."table_name";
```

## Error Handling

- **Empty schema**: If `read_schema` returns no tables, confirm the schema name with the user (common: `public`, `dbo`, `main`)
- **Permission errors**: Report the specific table/schema that failed and suggest the user check connection permissions
- **Timeout on large tables**: Use `LIMIT` and `TABLESAMPLE` when profiling tables with millions of rows

## Output Format

Present a structured summary after exploration:
- **Tables**: list with row counts
- **Key relationships**: how tables connect
- **Data quality flags**: columns with high null rates (Orange/Red from scoring above)
- **Suggested next queries**: what the user might want to know next
