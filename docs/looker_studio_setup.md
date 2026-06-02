# KULA Looker Studio & BigQuery Dashboard Setup Guide

This guide takes you step-by-step through setting up a fully serverless, real-time analytics pipeline using Google BigQuery and Looker Studio to visualize KULA's onboarding conversion funnel and A-ha! moment activation rates.

---

## Part 1: Firebase Analytics to BigQuery (Event Logs)

This connection streams the client-side telemetry events (such as `login_completed` and `onboarding_step_reached`) automatically to BigQuery.

1.  **Navigate to the Firebase Console**:
    *   Open [Firebase Console](https://console.firebase.google.com/).
    *   Click the **Gear Icon** next to *Project Overview* and select **Project Settings**.
2.  **Enable the BigQuery Integration**:
    *   Go to the **Integrations** tab.
    *   Find the **BigQuery** card and click **Link**.
3.  **Configure Ingestion Settings**:
    *   Enable **Google Analytics**.
    *   Ensure **Include Advertising Identifiers** is **disabled** (this maintains KULA's privacy compliance of no third-party marketing tracking).
    *   Select **Daily Export** (adds a table representing the previous day's events) and/or **Streaming Export** (real-time stream of events into a temporary table, recommended for immediate tracking).
4.  **Confirm BigQuery Dataset**:
    *   BigQuery will automatically create a dataset named `analytics_<property_id>` under your Google Cloud project.

---

## Part 2: Firestore Collections to BigQuery (Transactional Data)

To track vouches, gratitude exchanges, and comment contributions, we stream the relevant Firestore collections to BigQuery using the official, serverless Firebase extension.

### Collection Targets:
*   `users`: Tracks the list of registered neighbors.
*   `vouches`: Tracks accepted vouch relationships.
*   `gratitude_notes`: Tracks completed gratitude exchanges.

### Setup Steps:
For each collection, deploy the `firestore-bigquery-export` extension.

#### Option A: Using the Firebase CLI (Recommended)
Run the following commands in your terminal:

```bash
# Stream 'users' collection
firebase ext:install firebase/firestore-bigquery-export \
  --project=your-firebase-project-id \
  --local

# Stream 'vouches' collection
firebase ext:install firebase/firestore-bigquery-export \
  --project=your-firebase-project-id \
  --local

# Stream 'gratitude_notes' collection
firebase ext:install firebase/firestore-bigquery-export \
  --project=your-firebase-project-id \
  --local
```

#### Option B: Using the Firebase Console
1.  Go to the **Extensions** section in the Firebase Console.
2.  Search for **Stream Collections to BigQuery** by Firebase.
3.  Click **Install** and fill out the configuration parameters:

| Parameter | Configuration for `users` | Configuration for `vouches` | Configuration for `gratitude_notes` |
| :--- | :--- | :--- | :--- |
| **Collection Path** | `users` | `vouches` | `gratitude_notes` |
| **Dataset ID** | `firestore_export` | `firestore_export` | `firestore_export` |
| **Table ID** | `users_raw` | `vouches_raw` | `gratitude_notes_raw` |
| **BigQuery Location** | Choose your GCP region (e.g. `europe-west3` for Frankfurt, Germany) | Choose same region | Choose same region |
| **Wildcard Query Columns**| Leave blank | Leave blank | Leave blank |

---

## Part 3: Setting Up Looker Studio Dashboards

With your events and transactional tables streaming to BigQuery, you can now build a beautiful visual dashboard in Looker Studio.

### Step 1: Create a Looker Studio Report
1.  Go to [Looker Studio](https://lookerstudio.google.com/).
2.  Click **Blank Report**.
3.  In the *Add data to report* panel, select **BigQuery**.
4.  Choose **Custom Query** and select your GCP Project.

### Step 2: Configure Onboarding Funnel View
1.  Enter the custom SQL query from the Onboarding Funnel section in [analytics_dashboards_spec.md](file:///Users/serdar/ANTIGRAVITY/KULA/docs/analytics_dashboards_spec.md#L20-L64).
2.  Click **Add**.
3.  Add a **Bar Chart** to your dashboard:
    *   **Dimension**: Funnel Step (e.g. Signed Up, Manifesto, Mechanics, Circles, Profile, First Act, Complete).
    *   **Metric**: User Count (percentage value).
4.  **Styling & Art Direction**:
    *   Set the background color of the report to a warm oatmeal/cream tone (Hex `#FAF7F2` or HSL `#F3F1EB` fallback).
    *   Set the bar colors to KULA's signature organic sage green (Hex `#5B6B56`).

### Step 3: Configure "A-ha!" Moment Activation View
1.  Create another data source using **Custom Query**.
2.  Enter the custom SQL query from the A-ha! Moment Activation section in [analytics_dashboards_spec.md](file:///Users/serdar/ANTIGRAVITY/KULA/docs/analytics_dashboards_spec.md#L80-L158).
3.  Add the following components to the page:
    *   **Scorecards** for:
        *   `pct_fully_activated_aha_moment` (labeled "Overall Activation Rate").
        *   `pct_connected_neighbors` (labeled "Vouch Connection Rate").
        *   `pct_completed_exchanges` (labeled "Gratitude Exchange Rate").
        *   `pct_active_dialogues` (labeled "Dialogue Comment Rate").
4.  **Styling & Art Direction**:
    *   Place scorecards inside rounded containers to mimic KULA's bento grid style.
    *   Set the overall activation metric font to a bold serif/modern typeface (e.g. Outfit or Inter).
    *   Use KULA's warm earthy colors: **Indigo** (`#4D5680`) for connections, **Terracotta** (`#C86A51`) for exchanges, and **Mustard** (`#D29C44`) for dialogues.

---

## Part 4: Scheduling & Sharing

1.  **Scheduled Email Delivery**:
    *   Click **Share** > **Schedule email delivery**.
    *   Set the frequency (e.g., every Monday at 9:00 AM) to keep the cooperative steering committee updated on onboarding drop-offs and activation rates automatically.
2.  **Access Control**:
    *   Share access to the Looker Studio report with other community guardians using their Google Accounts. Since data is aggregated and does not contain PII or message details, it is safe to share with cooperative members.
