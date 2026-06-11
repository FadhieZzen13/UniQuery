UniQuery: Context-Aware Search Architecture
1. Objective
To achieve sub-2-second retrieval latency (FR-IDX-02), UniQuery uses PostgreSQL's native full-text search capabilities (tsvector and tsquery) via Supabase.

2. Schema Requirements
The questions table must utilize a generated tsvector column with a Generalized Inverted Index (GIN) applied to it (fastupdate = off).

Indexing Weights:

Title: Weight A (Highest priority)
Body: Weight B (Standard priority)
3. Querying & Ranking Algorithm
The backend utilizes a custom Supabase RPC function (search_questions_ranked) to parse user input safely using websearch_to_tsquery.

The Ranking Formula: Total Score = Lexical Match Score + Popularity Bonus

Lexical Match (ts_rank_cd): Standard density ranking based on A/B keyword matches.
Popularity Bonus: Adds (hot_score * 0.1) to the total score so highly upvoted questions rise to the top.
