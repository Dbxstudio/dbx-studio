---
name: data-visualization
description: "Generates and configures charts for DBX Studio using the generate_chart tool. Use when a user wants to visualize query results as bar charts, line graphs, pie charts, scatter plots, area charts, or histograms."
---

# Data Visualization — DBX Studio

## Chart Types Available

The `generate_chart` tool supports these types:

| Type | Best For |
|------|----------|
| `bar` | Comparisons between categories |
| `line` | Trends over time |
| `pie` | Part-to-whole relationships |
| `scatter` | Correlation between two numeric values |
| `area` | Cumulative trends over time |
| `histogram` | Distribution of a numeric column |

## Workflow

### Step 1: Understand the request
Identify what the user wants to visualize and pick the chart type using the selection guide below.

### Step 2: Write the data query
Build a SQL query that returns the right shape for the chart (see Data Query Patterns).

### Step 3: Generate the chart
Call `generate_chart` with the config — ensure title and axes are human-readable.

### Step 4: Validate the result
- Confirm the chart renders (non-empty result set)
- If the query returns 0 rows, inform the user and suggest adjusting filters
- For pie charts, verify ≤ 7 slices — group extras as "Other" if needed

## generate_chart Parameters

```json
{
  "chart_type": "bar",
  "title": "Monthly Revenue by Product Category",
  "x_axis": "category",
  "y_axis": "revenue",
  "data_query": "SELECT category, SUM(amount) AS revenue FROM orders GROUP BY 1 ORDER BY 2 DESC",
  "group_by": "category"
}
```

## Chart Selection Guide

**User says "trend" or "over time"** → `line` chart, x_axis = date column
**User says "compare" or "by category"** → `bar` chart
**User says "breakdown" or "share"** → `pie` chart
**User says "distribution" or "spread"** → `histogram`
**User says "relationship" or "correlation"** → `scatter`

## Data Query Patterns

### Bar: Top N categories
```sql
SELECT category, COUNT(*) AS count
FROM orders
GROUP BY category
ORDER BY count DESC
LIMIT 10
```

### Line: Time series
```sql
SELECT DATE_TRUNC('day', created_at) AS date, SUM(amount) AS revenue
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1
```

### Pie: Proportion breakdown
```sql
SELECT status, COUNT(*) AS count
FROM orders
GROUP BY status
```

## Design Principles
- Always give the chart a descriptive title including the time period if relevant
- Keep x_axis and y_axis names human-readable (not raw column names)
- For large result sets, aggregate before charting (avoid raw row-level data)

## Edge Cases
- **Empty result set**: Do not call `generate_chart` — tell the user no data matched their filters
- **Single data point**: Use a bar chart (line/area charts need ≥ 2 points)
- **Too many categories for pie**: Pie charts support max 7 slices — auto-group into top 6 + "Other" before charting
