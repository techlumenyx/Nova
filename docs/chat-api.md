# Chat (Mini Doctor) API — Flutter Integration Guide

**Service:** Chat  
**Protocol:** GraphQL over HTTP (POST) + WebSocket (subscriptions)

All HTTP requests are `POST` to `/graphql` with:
```
Content-Type: application/json
Authorization: Bearer <accessToken>
```

Subscriptions use the `graphql-transport-ws` protocol over WebSocket at `/graphql`.

---

## Prerequisites

1. User must be authenticated — `Authorization: Bearer <accessToken>` on every request.
2. User must have a **complete profile** (at minimum `dateOfBirth` and `gender` set via `setupProfile`). Without this, `startSession` returns a `ProfileIncompleteError`.

---

## How the chat flow works

```
startSession
   │
   ├── ProfileIncompleteError → redirect to profile setup
   │
   └── DiagnosisSession (id, stage)
         │
         ├── [Background] Stages 2–4 run automatically (risk enrichment, ~2–3s)
         │
         └── subscribe sessionUpdated(sessionId)
               │
               └── sendMessage(sessionId, text)
                     │  (returns immediately with accepted: true)
                     │
                     └── [Async] LLM processes → SessionEvent pushed to subscription
                           │
                           ├── type: MESSAGE     → show assistant reply
                           ├── type: STAGE_CHANGE → update UI state
                           ├── type: COMPLETED   → show DiagnosisOutput
                           └── type: ESCALATED   → show emergency instructions
```

`sendMessage` is **fire-and-forget** — it returns `{ accepted: true, sessionId }` instantly.  
The actual AI reply arrives asynchronously via the `sessionUpdated` subscription.

---

## Flutter Setup

Add to `pubspec.yaml`:
```yaml
dependencies:
  graphql_flutter: ^5.1.0
  web_socket_channel: ^2.4.0
```

---

## Queries

### 1. Active Session

Returns the user's current `IN_PROGRESS` session, or `null` if none exists.

```graphql
query ActiveSession {
  activeSession {
    id
    userId
    title
    status
    stage
    questionCount
    redFlagTriggered
    messages {
      role
      content
      timestamp
    }
    output {
      severity
      probableCauses { condition confidence explanation }
      ruledOut       { condition reason }
      action
      actionDetail
      homeRemedies {
        nameEn nameHi
        preparationEn preparationHi
        ingredients source
      }
      labTestsRecommended { testName slug reason urgency }
      watchFor
      disclaimer
      emergencyNumber
      language
    }
    createdAt
    updatedAt
  }
}
```

Flutter:
```dart
final result = await client.query(QueryOptions(
  document: gql(activeSessionQuery),
));
final session = result.data?['activeSession'];
if (session == null) {
  // no active session — show "Start Checkup" button
}
```

---

### 2. Session by ID

Fetches a session including its full message history — use this to render an old conversation from the drawer.

```graphql
query Session($id: ID!) {
  session(id: $id) {
    id
    title
    status
    stage
    questionCount
    messages {
      role
      content
      timestamp
    }
    output {
      severity
      action
      actionDetail
      probableCauses { condition confidence explanation }
      homeRemedies   { nameEn preparationEn ingredients source }
      labTestsRecommended { testName slug reason urgency }
      watchFor
      disclaimer
      emergencyNumber
      language
    }
    createdAt
    updatedAt
  }
}
```

Variables:
```json
{ "id": "<sessionId>" }
```

---

### 3. Session History

Returns all sessions sorted by `updatedAt` descending — includes the active `IN_PROGRESS` session so it appears at the top of the drawer. Use `title` as the drawer item label.

```graphql
query SessionHistory($limit: Int, $offset: Int) {
  sessionHistory(limit: $limit, offset: $offset) {
    id
    title
    status
    stage
    output {
      severity
      action
      probableCauses { condition confidence }
    }
    createdAt
    updatedAt
  }
}
```

Variables:
```json
{ "limit": 10, "offset": 0 }
```

Flutter:
```dart
final result = await client.query(QueryOptions(
  document: gql(sessionHistoryQuery),
  variables: {'limit': 10, 'offset': 0},
));
final history = result.data?['sessionHistory'] as List? ?? [];
```

---

## Mutations

### 1. Start Session (resume or create)

Use this when the app opens — it resumes an existing `IN_PROGRESS` session if one exists, or creates a new one.



Starts a new session or resumes an existing `IN_PROGRESS` one.  
Returns a union — handle both types.

```graphql
mutation StartSession {
  startSession {
    ... on DiagnosisSession {
      id
      status
      stage
      questionCount
      createdAt
    }
    ... on ProfileIncompleteError {
      message
      missingFields
    }
  }
}
```

**`ProfileIncompleteError`** means the user hasn't set `dateOfBirth` or `gender` yet.  
`missingFields` will contain one or both of `["dateOfBirth", "gender"]`.

Flutter:
```dart
final result = await client.mutate(MutationOptions(
  document: gql(startSessionMutation),
));
final data = result.data?['startSession'];
if (data == null) return;

if (data['__typename'] == 'ProfileIncompleteError') {
  // navigate to profile setup screen
  final missing = List<String>.from(data['missingFields']);
  showProfileIncompleteDialog(missing);
  return;
}

// DiagnosisSession
final sessionId = data['id'] as String;
final stage     = data['stage'] as int;
// subscribe to updates and open chat screen
```

**Session resume behavior:**  
If an `IN_PROGRESS` session already exists and the user hasn't interacted for >30s, a re-entry greeting is automatically added to the conversation before the session is returned.

---

### 2. New Session (force-start fresh)

Use this when the user taps **"New Chat"** in the session drawer. Abandons the current `IN_PROGRESS` session and starts a brand-new one.

```graphql
mutation NewSession {
  newSession {
    ... on DiagnosisSession {
      id
      status
      stage
    }
    ... on ProfileIncompleteError {
      message
      missingFields
    }
  }
}
```

Flutter:
```dart
final result = await client.mutate(MutationOptions(
  document: gql(newSessionMutation),
));
final data = result.data?['newSession'];
if (data?['__typename'] == 'DiagnosisSession') {
  final sessionId = data['id'] as String;
  sub.connect(sessionId: sessionId, ...);
  openChatScreen(sessionId);
}
```

The previous session is marked `ABANDONED` and will appear in `sessionHistory`.

---

### 3. Send Message

```graphql
mutation SendMessage($sessionId: ID!, $message: String!) {
  sendMessage(sessionId: $sessionId, message: $message) {
    accepted
    sessionId
  }
}
```

Variables:
```json
{
  "sessionId": "<sessionId>",
  "message": "I have a high fever and severe headache since 2 days"
}
```

Returns immediately with `{ accepted: true, sessionId }`.  
The AI response arrives via `sessionUpdated` subscription.

Flutter:
```dart
Future<void> sendMessage(String sessionId, String text) async {
  final result = await client.mutate(MutationOptions(
    document: gql(sendMessageMutation),
    variables: {'sessionId': sessionId, 'message': text},
  ));

  final ack = result.data?['sendMessage'];
  if (ack?['accepted'] == true) {
    // show message in chat bubble — wait for subscription to deliver AI reply
    addUserBubble(text);
    showTypingIndicator();
  }
}
```

---

### 3. Submit Follow-Up

Called after a `COMPLETED` session to report how the patient feels now.  
Use this when you show a "How are you feeling?" follow-up card.

```graphql
mutation SubmitFollowUp(
  $sessionId: ID!,
  $outcome: FollowUpOutcome!,
  $doctorDiagnosis: String
) {
  submitFollowUp(
    sessionId: $sessionId,
    outcome: $outcome,
    doctorDiagnosis: $doctorDiagnosis
  ) {
    id
    status
    stage
    output {
      severity
      action
    }
  }
}
```

Variables:
```json
{
  "sessionId": "<sessionId>",
  "outcome": "WORSENED",
  "doctorDiagnosis": "Viral pharyngitis"
}
```

`doctorDiagnosis` is optional — only pass it when `outcome` is `SAW_DOCTOR`.

**Outcome behavior:**

| Outcome | Result |
|---------|--------|
| `IMPROVED` | Records response, session stays `COMPLETED` |
| `SAME` | Records response, session stays `COMPLETED` |
| `SAW_DOCTOR` | Records response + diagnosis, session stays `COMPLETED` |
| `WORSENED` | **Re-opens session** — stage resets to 5, fresh symptom interview starts. Subscribe again to get updates. |

Flutter:
```dart
final result = await client.mutate(MutationOptions(
  document: gql(submitFollowUpMutation),
  variables: {
    'sessionId': sessionId,
    'outcome': outcome, // 'IMPROVED' | 'SAME' | 'WORSENED' | 'SAW_DOCTOR'
    if (doctorDiagnosis != null) 'doctorDiagnosis': doctorDiagnosis,
  },
));

final session = result.data?['submitFollowUp'];
if (session['status'] == 'IN_PROGRESS') {
  // WORSENED path — re-open chat with fresh interview
  openChatScreen(session['id']);
}
```

---

## Subscription

### sessionUpdated

Subscribe to real-time events for an active session.  
**Must be started before calling `sendMessage`** — otherwise you'll miss the AI reply.

```graphql
subscription SessionUpdated($sessionId: ID!) {
  sessionUpdated(sessionId: $sessionId) {
    sessionId
    type
    message
    stage
    status
    requiresAction
    output {
      severity
      action
      actionDetail
      probableCauses { condition confidence explanation }
      ruledOut       { condition reason }
      homeRemedies   { nameEn nameHi preparationEn preparationHi ingredients source }
      labTestsRecommended { testName slug reason urgency }
      watchFor
      disclaimer
      emergencyNumber
      language
    }
  }
}
```

**Event types:**

| `type` | Meaning | What to do in UI |
|--------|---------|-----------------|
| `MESSAGE` | AI sent a reply | Hide typing indicator, show `message` in chat bubble |
| `STAGE_CHANGE` | Session advanced to next stage | Update internal state, no visible change needed |
| `COMPLETED` | Diagnosis ready | Hide chat input, show `output` (DiagnosisOutput card) |
| `ESCALATED` | Red flag detected — emergency | Show emergency banner, display `emergencyNumber` |

**`requiresAction` values:**

| Value | Meaning |
|-------|---------|
| `NONE` | Normal flow |
| `COMPLETE_PROFILE` | Prompt user to fill in missing profile fields |
| `EMERGENCY` | Show emergency contact immediately |
| `ANALYSIS_PENDING` | AI is still computing diagnosis (transient) |

Flutter (using `web_socket_channel`):
```dart
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

class ChatSubscription {
  late WebSocketChannel _channel;

  void connect({
    required String sessionId,
    required String userId,
    required String accessToken,
    required Function(Map<String, dynamic>) onEvent,
  }) {
    _channel = WebSocketChannel.connect(
      Uri.parse('wss://your-railway-url.up.railway.app/graphql'),
      protocols: ['graphql-transport-ws'],
    );

    // Handshake
    _send({'type': 'connection_init', 'payload': {
      'x-user-id': userId,
      'Authorization': 'Bearer $accessToken',
    }});

    _channel.stream.listen((raw) {
      final msg = jsonDecode(raw as String) as Map<String, dynamic>;

      switch (msg['type']) {
        case 'connection_ack':
          // Start subscription
          _send({
            'id': '1',
            'type': 'subscribe',
            'payload': {
              'query': '''
                subscription SessionUpdated(\$sessionId: ID!) {
                  sessionUpdated(sessionId: \$sessionId) {
                    sessionId type message stage status requiresAction
                    output {
                      severity action actionDetail disclaimer emergencyNumber language
                      probableCauses { condition confidence explanation }
                      homeRemedies { nameEn preparationEn ingredients }
                      labTestsRecommended { testName slug reason urgency }
                      watchFor
                    }
                  }
                }
              ''',
              'variables': {'sessionId': sessionId},
            },
          });
          break;

        case 'next':
          final event = msg['payload']['data']['sessionUpdated']
              as Map<String, dynamic>;
          onEvent(event);
          break;

        case 'error':
          debugPrint('Subscription error: ${msg['payload']}');
          break;
      }
    });
  }

  void disconnect() {
    _send({'id': '1', 'type': 'complete'});
    _channel.sink.close();
  }

  void _send(Map<String, dynamic> data) {
    _channel.sink.add(jsonEncode(data));
  }
}
```

Usage in your chat screen:
```dart
final sub = ChatSubscription();

@override
void initState() {
  super.initState();

  sub.connect(
    sessionId:   widget.sessionId,
    userId:      authService.userId,
    accessToken: authService.accessToken,
    onEvent: (event) {
      final type   = event['type'] as String;
      final action = event['requiresAction'] as String;

      if (type == 'MESSAGE') {
        setState(() {
          hideTypingIndicator();
          addAssistantBubble(event['message'] as String);
        });
      } else if (type == 'COMPLETED') {
        setState(() {
          hideTypingIndicator();
          showDiagnosisCard(event['output']);
        });
      } else if (type == 'ESCALATED' || action == 'EMERGENCY') {
        showEmergencyBanner(event['output']?['emergencyNumber']);
      }
    },
  );
}

@override
void dispose() {
  sub.disconnect();
  super.dispose();
}
```

---

## Complete Chat Screen Flow

```dart
// 1. Start session
final sessionResult = await startSession();
if (sessionResult is ProfileIncompleteError) return navigateToProfile();
final sessionId = sessionResult.id;

// 2. Subscribe BEFORE sending any messages
sub.connect(sessionId: sessionId, ...);

// 3. On send button tap
await sendMessage(sessionId: sessionId, message: userText);
showTypingIndicator();

// 4. Subscription fires → hide indicator, show reply
//    On COMPLETED → show DiagnosisOutput card
//    On ESCALATED → show emergency banner

// 5. After COMPLETED — show follow-up card after 24-48h
//    On user response → submitFollowUp(...)
```

---

## DiagnosisOutput — UI Rendering Guide

Shown when `SessionEvent.type == 'COMPLETED'` or when loading a completed session.

| Field | UI component |
|-------|-------------|
| `severity` | Colored badge: `LOW` → green, `MODERATE` → orange, `HIGH` → red, `EMERGENCY` → red + pulse |
| `action` | CTA button: `SELF_CARE` → "Manage at home", `MONITOR` → "Monitor symptoms", `VISIT_DOCTOR` → "Book appointment", `ER_NOW` → "Go to ER now" |
| `actionDetail` | Subtitle text below CTA |
| `probableCauses` | Expandable cards sorted by confidence (highest first) |
| `ruledOut` | Collapsible section "Conditions ruled out" |
| `homeRemedies` | Show `nameEn` + `preparationEn`; toggle to Hindi with `nameHi` + `preparationHi` |
| `labTestsRecommended` | Cards with `testName`, `reason`, `urgency`; link `slug` to lab test detail page |
| `watchFor` | Bulleted warning list |
| `disclaimer` | Small footer text |
| `emergencyNumber` | Only present for `EMERGENCY` severity — show prominently |

---

## Error Handling

```dart
if (result.hasException) {
  final errors = result.exception!.graphqlErrors;
  final code    = errors.first.extensions?['code'];
  final message = errors.first.message;

  switch (code) {
    case 'UNAUTHENTICATED':
      // token expired — trigger refresh flow
      break;
    case 'VALIDATION_ERROR':
      // show message to user (e.g. "Session not found")
      break;
    default:
      // generic error snackbar
  }
}
```

---

## Enum Reference

| Enum | Values |
|------|--------|
| `SessionStatus` | `IN_PROGRESS`, `COMPLETED`, `ESCALATED`, `ABANDONED` |
| `SessionEventType` | `MESSAGE`, `STAGE_CHANGE`, `COMPLETED`, `ESCALATED` |
| `ActionType` | `NONE`, `COMPLETE_PROFILE`, `EMERGENCY`, `ANALYSIS_PENDING` |
| `FollowUpOutcome` | `IMPROVED`, `SAME`, `WORSENED`, `SAW_DOCTOR` |
| `Severity` | `LOW`, `MODERATE`, `HIGH`, `EMERGENCY` |
| `SessionAction` | `SELF_CARE`, `MONITOR`, `VISIT_DOCTOR`, `ER_NOW` |
