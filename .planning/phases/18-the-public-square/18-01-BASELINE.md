# 18-01 Baseline: the live public.* grant surface

Captured 2026-10-31 from Supabase project `kxsdzaojfaibhuzmclfq` (read-only: `pg_catalog`, `information_schema`, `pg_views`; no row data).

The machine-readable form is `scripts/fixtures/grant-surface.json`. It records the grants **as they are today**, not as they should be. Phase 18 Task 3 changes them.

## Summary

- 15 views in `public`. 12 are ours, 3 are foreign (`users_public`, `geography_columns`, `geometry_columns`).
- `security_invoker` is on for all but `geography_columns` and `geometry_columns` (owned by `supabase_admin`, PostGIS).
- `anon` and `authenticated` each hold all seven privileges (`DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`) on every one of the 15 views.

## Definitions of the five views with no migration in this repo

Verbatim from `pg_views.definition`. Task 3's migration must reproduce these column lists exactly: `CREATE OR REPLACE VIEW` cannot change a column list and errors if they differ.

### connected_profiles

```sql
 SELECT user_id,
    display_name,
    account_standing,
    created_at,
    updated_at,
    avatar_url,
    tier,
    is_suspended
   FROM civic_spaces.connected_profiles;
```

### posts

```sql
 SELECT id,
    slice_id,
    user_id,
    title,
    body,
    created_at,
    updated_at,
    is_deleted,
    edit_history,
    reply_count
   FROM civic_spaces.posts;
```

### replies

```sql
 SELECT id,
    post_id,
    parent_reply_id,
    user_id,
    body,
    created_at,
    updated_at,
    is_deleted
   FROM civic_spaces.replies;
```

### slice_members

```sql
 SELECT id,
    user_id,
    slice_id,
    joined_at
   FROM civic_spaces.slice_members;
```

### slices

```sql
 SELECT id,
    slice_type,
    geoid,
    sibling_index,
    current_member_count,
    created_at
   FROM civic_spaces.slices;
```
