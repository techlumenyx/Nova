# Auth API — Flutter Integration Guide

**Base URL:** `https://your-railway-url.up.railway.app/graphql`  
**Protocol:** GraphQL over HTTP (POST)

All requests are `POST` to `/graphql` with:
```
Content-Type: application/json
```

---

## Headers

| Header | When required | Value |
|--------|--------------|-------|
| `Authorization` | All authenticated requests | `Bearer <accessToken>` |
| `x-profile-id` | After profile is selected | `<profileId>` |

---

## Flutter Setup

Add to `pubspec.yaml`:
```yaml
dependencies:
  graphql_flutter: ^5.1.0
  flutter_secure_storage: ^9.0.0
  gql_http_link: ^1.0.1
```

---

### Token Storage

Create `lib/services/token_storage.dart`:
```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _storage = FlutterSecureStorage();

  static const _accessTokenKey  = 'accessToken';
  static const _refreshTokenKey = 'refreshToken';

  static Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: _accessTokenKey,  value: accessToken),
      _storage.write(key: _refreshTokenKey, value: refreshToken),
    ]);
  }

  static Future<String?> getAccessToken()  => _storage.read(key: _accessTokenKey);
  static Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);

  static Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
    ]);
  }
}
```

---

### Auth Link with Auto Token Refresh

Create `lib/services/graphql_client.dart`:
```dart
import 'package:graphql_flutter/graphql_flutter.dart';
import 'token_storage.dart';

const _baseUrl = 'https://your-railway-url.up.railway.app/graphql';

const _refreshTokenMutation = '''
  mutation RefreshToken(\$refreshToken: String!) {
    refreshToken(refreshToken: \$refreshToken) {
      accessToken
      refreshToken
    }
  }
''';

/// Attempts to refresh the access token using the stored refresh token.
/// Returns the new access token on success, null on failure.
Future<String?> _refreshAccessToken() async {
  final refreshToken = await TokenStorage.getRefreshToken();
  if (refreshToken == null) return null;

  final client = GraphQLClient(
    link: HttpLink(_baseUrl),
    cache: GraphQLCache(),
  );

  final result = await client.mutate(MutationOptions(
    document: gql(_refreshTokenMutation),
    variables: {'refreshToken': refreshToken},
  ));

  if (result.hasException || result.data == null) return null;

  final newAccessToken  = result.data!['refreshToken']['accessToken']  as String;
  final newRefreshToken = result.data!['refreshToken']['refreshToken'] as String;

  await TokenStorage.saveTokens(
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
  );

  return newAccessToken;
}

/// Returns a fully configured GraphQL client with:
/// - Auth header injected from secure storage
/// - Automatic token refresh on 401 / UNAUTHENTICATED errors
/// - Active profile header support
GraphQLClient buildGraphQLClient({String? profileId}) {
  final httpLink = HttpLink(_baseUrl);

  final authLink = AuthLink(
    getToken: () async {
      final token = await TokenStorage.getAccessToken();
      return token != null ? 'Bearer $token' : null;
    },
  );

  // Inject x-profile-id header if a profile is active
  final profileLink = profileId != null
      ? HeaderLink({'x-profile-id': profileId})
      : null;

  // Error link handles automatic token refresh
  final errorLink = ErrorLink(
    onGraphQLError: (request, forward, response) async* {
      final isUnauthenticated = response.errors?.any(
        (e) => e.extensions?['code'] == 'UNAUTHENTICATED',
      ) ?? false;

      if (!isUnauthenticated) {
        yield response;
        return;
      }

      // Try refreshing the token
      final newToken = await _refreshAccessToken();

      if (newToken == null) {
        // Refresh failed — user must log in again
        await TokenStorage.clear();
        yield response;
        return;
      }

      // Retry the original request with the new token
      yield* forward(request);
    },
  );

  final links = [
    errorLink,
    authLink,
    if (profileLink != null) profileLink,
    httpLink,
  ];

  return GraphQLClient(
    link: Link.from(links),
    cache: GraphQLCache(store: InMemoryStore()),
    defaultPolicies: DefaultPolicies(
      query:    Policies(fetch: FetchPolicy.networkOnly),
      mutate:   Policies(fetch: FetchPolicy.networkOnly),
    ),
  );
}
```

---

### Using the Client

Wrap your app in `GraphQLProvider` at the root:
```dart
// lib/main.dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initHiveForFlutter(); // required by graphql_flutter cache

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late ValueNotifier<GraphQLClient> _clientNotifier;

  @override
  void initState() {
    super.initState();
    _clientNotifier = ValueNotifier(buildGraphQLClient());
  }

  @override
  Widget build(BuildContext context) {
    return GraphQLProvider(
      client: _clientNotifier,
      child: MaterialApp(
        // your app
      ),
    );
  }
}
```

After profile selection, rebuild the client with the active profile ID:
```dart
_clientNotifier.value = buildGraphQLClient(profileId: selectedProfileId);
```

---

### Making Requests

**In widgets** — use `Query` / `Mutation` widgets:
```dart
Mutation(
  options: MutationOptions(document: gql(verifyOTPMutation)),
  builder: (runMutation, result) {
    if (result?.isLoading ?? false) return CircularProgressIndicator();
    return ElevatedButton(
      onPressed: () => runMutation({'target': phone, 'targetType': 'PHONE', 'otp': otp}),
      child: Text('Verify'),
    );
  },
)
```

**Outside widgets** — use the client directly:
```dart
final client = GraphQLProvider.of(context).value;
final result = await client.mutate(MutationOptions(
  document: gql(verifyOTPMutation),
  variables: {'target': phone, 'targetType': 'PHONE', 'otp': otp},
));
```

---

## Flows

### 1. Sign Up

**Step 1 — Send OTP**
```graphql
mutation Signup($input: SignupInput!) {
  signup(input: $input) {
    success
    message
  }
}
```
Variables:
```json
{
  "input": {
    "name": "Pranav",
    "target": "+919876543210",
    "targetType": "PHONE",
    "language": "EN"
  }
}
```
`targetType` is `PHONE` or `EMAIL`. `language` is `EN`, `HI`, or `HINGLISH`.

Flutter:
```dart
final result = await client.mutate(MutationOptions(
  document: gql(signupMutation),
  variables: {
    'input': {
      'name': name,
      'target': phoneOrEmail,
      'targetType': 'PHONE',
      'language': 'EN',
    }
  },
));
```

**Step 2 — Verify OTP**
```graphql
mutation VerifyOTP($target: String!, $targetType: OTPTargetType!, $otp: String!) {
  verifyOTP(target: $target, targetType: $targetType, otp: $otp) {
    accessToken
    refreshToken
    expiresIn
    user {
      id
      name
      phone
      email
      language
      status
    }
  }
}
```
Variables:
```json
{
  "target": "+919876543210",
  "targetType": "PHONE",
  "otp": "5599"
}
```

On success — store tokens securely:
```dart
final storage = FlutterSecureStorage();
await storage.write(key: 'accessToken', value: data['verifyOTP']['accessToken']);
await storage.write(key: 'refreshToken', value: data['verifyOTP']['refreshToken']);
```

---

### 2. Login

**Step 1 — Send OTP**
```graphql
mutation Login($target: String!, $targetType: OTPTargetType!) {
  login(target: $target, targetType: $targetType) {
    success
    message
  }
}
```
> Returns error if account does not exist.

**Step 2 — Verify OTP** — same as signup Step 2 above.

---

### 3. Resend OTP

```graphql
mutation ResendOTP($target: String!, $targetType: OTPTargetType!) {
  resendOTP(target: $target, targetType: $targetType) {
    success
    message
  }
}
```
> Has a 90 second cooldown. Returns error with remaining wait time if called too early.

---

### 4. Google Sign-In

Get the `idToken` from Google Sign-In on Flutter, then:
```graphql
mutation GoogleAuth($idToken: String!, $language: Language) {
  googleAuth(idToken: $idToken, language: $language) {
    accessToken
    refreshToken
    expiresIn
    user {
      id
      name
      email
    }
  }
}
```
Variables:
```json
{
  "idToken": "<token-from-google-signin>",
  "language": "EN"
}
```

Flutter package to get `idToken`: `google_sign_in: ^6.0.0`
```dart
final GoogleSignIn googleSignIn = GoogleSignIn(
  clientId: 'YOUR_GOOGLE_CLIENT_ID',
);
final account = await googleSignIn.signIn();
final auth = await account!.authentication;
final idToken = auth.idToken; // pass this to googleAuth mutation
```

---

### 5. Refresh Token

Access tokens expire in **15 minutes**. Call this silently when a request returns `401`:
```graphql
mutation RefreshToken($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) {
    accessToken
    refreshToken
    expiresIn
  }
}
```
Store the new `accessToken` and retry the original request.

---

### 6. Logout

```graphql
mutation Logout {
  logout
}
```
On success — clear stored tokens:
```dart
final storage = FlutterSecureStorage();
await storage.delete(key: 'accessToken');
await storage.delete(key: 'refreshToken');
```

---

### 7. Get Current User

Requires `Authorization` header.
```graphql
query Me {
  me {
    id
    name
    phone
    email
    emailVerified
    phoneVerified
    language
    authProvider
    status
    createdAt
  }
}
```

---

### 8. Add Contact (from Settings)

For a logged-in user adding an email to a phone account or vice versa.

**Step 1 — Request OTP to new contact**
```graphql
mutation RequestAddContact($target: String!, $targetType: OTPTargetType!) {
  requestAddContact(target: $target, targetType: $targetType) {
    success
    message
  }
}
```

**Step 2 — Verify and save**
```graphql
mutation VerifyAddContact($target: String!, $targetType: OTPTargetType!, $otp: String!) {
  verifyAddContact(target: $target, targetType: $targetType, otp: $otp)
}
```

---

## Error Handling

All errors follow GraphQL error format:
```json
{
  "errors": [
    {
      "message": "Account already exists. Please login.",
      "extensions": {
        "code": "VALIDATION_ERROR"
      }
    }
  ]
}
```

| Code | Meaning |
|------|---------|
| `VALIDATION_ERROR` | Invalid input or business rule violation |
| `NOT_FOUND` | User does not exist |
| `UNAUTHENTICATED` | Missing or invalid token |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

Flutter error handling:
```dart
if (result.hasException) {
  final errors = result.exception!.graphqlErrors;
  final code = errors.first.extensions?['code'];
  final message = errors.first.message;
  // show message to user
}
```

---

## Enum Values

| Enum | Values |
|------|--------|
| `OTPTargetType` | `PHONE`, `EMAIL` |
| `Language` | `EN`, `HI`, `HINGLISH` |
| `AuthProvider` | `OTP`, `GOOGLE`, `APPLE` |
| `UserStatus` | `ACTIVE`, `INACTIVE`, `SUSPENDED` |
