# StudyPilot AI

A React and Vite student dashboard connected to n8n Cloud. Assignments, statistics, calendar deadlines, planner priorities, and notification alerts all come from the live read workflow. The custom AI assistant uses n8n's Embedded Chat protocol.

## Local development

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and set `VITE_N8N_ASSIGNMENTS_URL` to the production Assignments Read webhook. The sample URL is the one supplied for this project.
3. Run `npm run dev`.
4. Run `npm run lint` and `npm run build` before deployment.

Vite serves `/api/assignments` and `/api/chat` locally. Vercel serves those paths as serverless functions. The browser calls only those same-origin routes, avoiding browser CORS restrictions. The Vercel SPA rewrite sends all other routes to `index.html`.

## Vercel deployment

Import the GitHub repository into Vercel. Use the Vite preset, `npm run build`, and the `dist` output directory. Add these environment variables in Vercel for Production and Preview as needed:

| Variable | Purpose |
| --- | --- |
| `VITE_N8N_ASSIGNMENTS_URL` | Assignments Read webhook URL; required |
| `N8N_CHAT_URL` | Chat Trigger URL; optional because this project's supplied URL is the server-side default |
| `N8N_ASSIGNMENTS_AUTH_HEADER` | Optional complete `Authorization` header value for the read webhook |
| `N8N_CHAT_AUTH_HEADER` | Optional complete `Authorization` header value for the chat webhook |

The `VITE_` prefix is required by this project's configuration, but a URL with that prefix is not a secret. The frontend never reads it. Keep credentials in the unprefixed server-only variables. If a workflow needs n8n User Auth or another interactive login, configure an appropriate server-side authentication flow before making the app public. A shared Basic Auth or bearer value can be passed through the server-only header variables.

## Assignments Read API contract

The configured webhook must respond to **GET** with JSON containing an `assignments` array. An empty array is valid and produces the empty states. For each assignment, `title` is required; the remaining fields are optional:

```json
{
  "assignments": [
    {
      "id": "stable-row-id",
      "title": "Research paper",
      "subject": "History",
      "dueDate": "2026-11-05T18:00:00+05:00",
      "status": "in-progress",
      "progress": 40,
      "priority": "high",
      "difficulty": "medium",
      "estimatedMinutes": 180,
      "notes": "Draft the outline"
    }
  ]
}
```

This is a contract example, not data used by the application. `dueDate` should include a timezone. Status may be `pending`, `in-progress`, or `completed`. The adapter also accepts common alternatives such as `name`, `course`, `deadline`, `due_date`, `assignmentId`, and `percentComplete`. Invalid or missing dates are displayed as having no deadline. A response without an `assignments` array is treated as an error, never as an empty result.

## AI chat contract

The app POSTs `{ "action": "sendMessage", "sessionId": "...", "chatInput": "..." }` to the Embedded Chat URL through `/api/chat`. The session ID and conversation display history persist in this browser. On opening the assistant, it also POSTs `{ "action": "loadPreviousSession", "sessionId": "..." }`. For server-side history, set the n8n Chat Trigger's **Load Previous Session** option to **From Memory** and connect the same memory node to both Chat Trigger and AI Agent. If that action is unsupported, the local conversation history still remains visible. The assistant accepts `output`, `text`, `message`, or `response` fields from a successful n8n response.

Every successful chat response triggers an assignment refresh. The dashboard refreshes on load, every 60 seconds while the tab is visible, when it becomes visible again, when the connection comes online, and when the user presses Refresh.

## Data and notification behavior

Assignment data is never hardcoded or simulated. The app shows loading, error, retry, empty, and stale-data states. Upcoming alerts are computed from due dates within 72 hours; overdue assignments remain urgent until marked complete by the backend. Notification read and dismissal states and settings are stored locally until backend support exists. The existing n8n scheduled email reminders remain separate from in-app alerts.
