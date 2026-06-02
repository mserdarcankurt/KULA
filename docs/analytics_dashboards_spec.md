# KULA Analytics & Dashboard Specification

This document defines the telemetry data schemas, definitions, and SQL queries needed to build dashboards (e.g. in Looker Studio) to track **user onboarding drop-off** and **"A-ha! moment" activation rates**.

---

## 1. Onboarding Funnel Specification

KULA's onboarding is structured as a series of sequential story screens to build community context. We track this via the `onboarding_step_reached` event with the `step` parameter.

### Funnel Steps
1.  **Arrived / Authenticated**: Triggered on `login_completed` (First Sign-up).
2.  **Manifesto (Philosophy)**: Triggered when the user enters the invite gate code and enters the Philosophy screen.
3.  **Mechanics (HowTo)**: Triggered when the user advances to the Mechanics screen.
4.  **Circles selection**: Triggered when the user advances to the Circles screen.
5.  **Profile Presence**: Triggered when the user starts setting up their Name/Neighborhood/Language.
6.  **First Act Selection**: Triggered when the profile setup is saved and the user reaches the "First Act" landing page (offers options to Give, Ask, or Explore).
7.  **Onboarding Complete**: Triggered when onboarding is completed (e.g. they post their first item or skip to explore).

### BigQuery SQL: Onboarding Funnel Analysis
This query aggregates the raw event logs from the Firebase Analytics export to compute step-by-step conversion and drop-off rates.

```sql
WITH user_onboarding_steps AS (
  -- Identify the first time each user reaches each onboarding step
  SELECT
    user_pseudo_id,
    MAX(IF(event_name = 'login_completed', 1, 0)) as step_1_signup,
    MAX(IF(event_name = 'onboarding_step_reached' AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'step') = 'PHILOSOPHY', 1, 0)) as step_2_philosophy,
    MAX(IF(event_name = 'onboarding_step_reached' AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'step') = 'HOWTO', 1, 0)) as step_3_howto,
    MAX(IF(event_name = 'onboarding_step_reached' AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'step') = 'CIRCLES', 1, 0)) as step_4_circles,
    MAX(IF(event_name = 'onboarding_step_reached' AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'step') = 'PROFILE', 1, 0)) as step_5_profile,
    MAX(IF(event_name = 'onboarding_step_reached' AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'step') = 'FIRST_ACT', 1, 0)) as step_6_first_act,
    MAX(IF(event_name = 'onboarding_step_reached' AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'step') = 'COMPLETE', 1, 0)) as step_7_complete
  FROM
    `your-firebase-project.analytics_123456789.events_*`
  WHERE
    _TABLE_SUFFIX BETWEEN '20260101' AND '20261231'
  GROUP BY
    user_pseudo_id
)

SELECT
  SUM(step_1_signup) as signed_up,
  SUM(step_2_philosophy) as reached_philosophy,
  SUM(step_3_howto) as reached_mechanics,
  SUM(step_4_circles) as reached_circles,
  SUM(step_5_profile) as reached_profile,
  SUM(step_6_first_act) as reached_first_act,
  SUM(step_7_complete) as completed_onboarding,
  
  -- Step-by-Step Conversion Rates
  SAFE_DIVIDE(SUM(step_2_philosophy), SUM(step_1_signup)) * 100 as signup_to_manifesto_pct,
  SAFE_DIVIDE(SUM(step_3_howto), SUM(step_2_philosophy)) * 100 as manifesto_to_mechanics_pct,
  SAFE_DIVIDE(SUM(step_4_circles), SUM(step_3_howto)) * 100 as mechanics_to_circles_pct,
  SAFE_DIVIDE(SUM(step_5_profile), SUM(step_4_circles)) * 100 as circles_to_profile_pct,
  SAFE_DIVIDE(SUM(step_6_first_act), SUM(step_5_profile)) * 100 as profile_to_first_act_pct,
  SAFE_DIVIDE(SUM(step_7_complete), SUM(step_6_first_act)) * 100 as first_act_to_complete_pct,
  
  -- Overall Conversion Rate
  SAFE_DIVIDE(SUM(step_7_complete), SUM(step_1_signup)) * 100 as overall_completion_pct
FROM
  user_onboarding_steps;
```

---

## 2. "A-ha! Moment" Activation Specification

In KULA, the **"A-ha! Moment"** occurs when a user moves from reader to active participant in the local trust ecosystem. We define this using three primary milestones:

| Milestone | Code Indicator / Event | Description |
| :--- | :--- | :--- |
| **1. The Connected Neighbor** | `trust_vouch_accepted` | A vouch relationship is finalized. The user is now woven into the trust graph and has a connection degree of 1. |
| **2. The Reciprocal Exchange** | `gratitude_expressed` | An exchange is completed and gratitude (thankfulness) is sent or received. |
| **3. The Active Dialogue** | `comment_created` | A user posts a comment on another user's item/post, initiating community dialogue. |

**A-ha! Moment Fully Activated**: A user has achieved *any* of the three milestones.

### BigQuery SQL: A-ha! Moment Activation Rates
Since vouches, gratitude notes, and comments represent transactional records, they are synced from Cloud Firestore to BigQuery in real time. We join the user profiles with these collections to calculate the activation metrics.

```sql
WITH users_list AS (
  -- Get all unique registered users from the users table (synced from Firestore)
  SELECT DISTINCT
    document_id as uid,
    TIMESTAMP_SECONDS(CAST(JSON_VALUE(data, '$.createdAt.seconds') AS INT64)) as created_at
  FROM
    `your-firebase-project.firestore_export.users_raw_latest`
),

connected_neighbors AS (
  -- Users who have at least one accepted vouch connection
  SELECT DISTINCT
    from_user as uid
  FROM (
    SELECT JSON_VALUE(data, '$.fromUserId') as from_user, JSON_VALUE(data, '$.toUserId') as to_user FROM `your-firebase-project.firestore_export.vouches_raw_latest` WHERE JSON_VALUE(data, '$.status') = 'ACCEPTED'
    UNION DISTINCT
    SELECT JSON_VALUE(data, '$.toUserId') as from_user, JSON_VALUE(data, '$.fromUserId') as to_user FROM `your-firebase-project.firestore_export.vouches_raw_latest` WHERE JSON_VALUE(data, '$.status') = 'ACCEPTED'
  )
),

completed_exchanges AS (
  -- Users who have expressed or received gratitude
  SELECT DISTINCT
    uid
  FROM (
    SELECT JSON_VALUE(data, '$.fromUserId') as uid FROM `your-firebase-project.firestore_export.gratitude_notes_raw_latest`
    UNION DISTINCT
    SELECT JSON_VALUE(data, '$.toUserId') as uid FROM `your-firebase-project.firestore_export.gratitude_notes_raw_latest`
  )
),

active_dialogues AS (
  -- Users who have commented on any item
  SELECT DISTINCT
    JSON_VALUE(data, '$.userId') as uid
  FROM
    `your-firebase-project.firestore_export.comments_raw_latest`
),

user_activations AS (
  -- Combine status flags per user
  SELECT
    u.uid,
    u.created_at,
    IF(cn.uid IS NOT NULL, 1, 0) as has_connected,
    IF(ce.uid IS NOT NULL, 1, 0) as has_exchanged,
    IF(ad.uid IS NOT NULL, 1, 0) as has_commented,
    IF(cn.uid IS NOT NULL OR ce.uid IS NOT NULL OR ad.uid IS NOT NULL, 1, 0) as is_fully_activated
  FROM
    users_list u
  LEFT JOIN
    connected_neighbors cn ON u.uid = cn.uid
  LEFT JOIN
    completed_exchanges ce ON u.uid = ce.uid
  LEFT JOIN
    active_dialogues ad ON u.uid = ad.uid
)

SELECT
  COUNT(*) as total_users,
  
  -- Activation Counts
  SUM(has_connected) as count_connected,
  SUM(has_exchanged) as count_exchanged,
  SUM(has_commented) as count_commented,
  SUM(is_fully_activated) as count_fully_activated,
  
  -- Activation Percentages
  SAFE_DIVIDE(SUM(has_connected), COUNT(*)) * 100 as pct_connected_neighbors,
  SAFE_DIVIDE(SUM(has_exchanged), COUNT(*)) * 100 as pct_completed_exchanges,
  SAFE_DIVIDE(SUM(has_commented), COUNT(*)) * 100 as pct_active_dialogues,
  SAFE_DIVIDE(SUM(is_fully_activated), COUNT(*)) * 100 as pct_fully_activated_aha_moment
FROM
  user_activations;
```
