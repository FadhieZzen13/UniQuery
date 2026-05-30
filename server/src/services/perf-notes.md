Performance tuning notes:
- Ensure pg_stat_statements is enabled in Supabase project settings.
- Use /api/v1/admin/perf/slow-queries to inspect heavy queries.
- Run EXPLAIN (ANALYZE, BUFFERS) manually on top offenders.
