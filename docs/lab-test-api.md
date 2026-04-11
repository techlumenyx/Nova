# Lab Test API — Flutter Integration Guide

**Service:** Content  
**Protocol:** GraphQL over HTTP (POST)

All requests are `POST` to `/graphql` with:
```
Content-Type: application/json
```

This is a **public API** — no `Authorization` header required.

---

## Queries

### 1. Search Lab Tests

Full-text search across test names, tags, and descriptions. Returns matching individual tests and packages.

```graphql
query SearchLabTests($query: String!, $limit: Int) {
  searchLabTests(query: $query, limit: $limit) {
    query
    tests {
      id
      name
      subtitle
      slug
      image
      shortDescription
      tags
      sampleTypes
      price
    }
    packages {
      id
      name
      slug
      image
      tags
      testCount
      price
    }
  }
}
```

Variables:
```json
{
  "query": "Thyroid",
  "limit": 10
}
```

Flutter:
```dart
final result = await client.query(QueryOptions(
  document: gql(searchLabTestsQuery),
  variables: {'query': searchText, 'limit': 10},
));
final data = result.data?['searchLabTests'];
final tests    = data?['tests']    as List? ?? [];
final packages = data?['packages'] as List? ?? [];
```

---

### 2. Lab Test Suggestions

Returns top 3 individual tests + top 3 packages matching the query. Use this for the search bar dropdown / suggestion chips as the user types.

```graphql
query LabTestSuggestions($query: String!) {
  labTestSuggestions(query: $query) {
    testSuggestions {
      name
      slug
    }
    packageSuggestions {
      name
      slug
      image
      testCount
    }
  }
}
```

Variables:
```json
{
  "query": "Thyro"
}
```

Flutter (call on every debounced keystroke):
```dart
final result = await client.query(QueryOptions(
  document: gql(labTestSuggestionsQuery),
  variables: {'query': text},
  fetchPolicy: FetchPolicy.networkOnly,
));
final suggestions = result.data?['labTestSuggestions'];
final testSuggestions    = suggestions?['testSuggestions']    as List? ?? [];
final packageSuggestions = suggestions?['packageSuggestions'] as List? ?? [];

// Show testSuggestions as keyword chips ("Try searching for...")
// Show packageSuggestions as package cards ("Lab Test Suggestions for...")
```

> **UI tip:** If `testSuggestions` and `packageSuggestions` are both empty, show "No results found for \<query\>".

---

### 3. Lab Test Detail

Fetch full information for a single test to render the detail page.

```graphql
query LabTest($slug: String!) {
  labTest(slug: $slug) {
    id
    name
    subtitle
    slug
    image
    shortDescription
    description
    tags
    sampleTypes
    whenToTest
    includedTestNames
    preparations {
      text
    }
    sections {
      ranges
      resultInterpretation
      riskAssessment
      whatDetects
      frequency
      indications
      parameters
      risksLimitations
    }
    price
  }
}
```

Variables:
```json
{
  "slug": "thyroid-profile-test"
}
```

Flutter:
```dart
final result = await client.query(QueryOptions(
  document: gql(labTestQuery),
  variables: {'slug': slug},
));
final test = result.data?['labTest'];
if (test == null) {
  // test not found — navigate back or show error
}
```

---

### 4. Lab Tests by Tag (Popular Concerns)

Returns all tests for a given concern category. Use this for the "Search by Popular Concerns" grid on the home screen.

```graphql
query LabTestsByTag($tag: String!, $limit: Int) {
  labTestsByTag(tag: $tag, limit: $limit) {
    id
    name
    slug
    shortDescription
    sampleTypes
    price
  }
}
```

Variables:
```json
{
  "tag": "Heart",
  "limit": 10
}
```

Flutter:
```dart
final result = await client.query(QueryOptions(
  document: gql(labTestsByTagQuery),
  variables: {'tag': tag, 'limit': 10},
));
final tests = result.data?['labTestsByTag'] as List? ?? [];
```

---

## Types

### LabTest

| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | MongoDB document ID |
| `name` | `String!` | Full test name |
| `subtitle` | `String` | Short subtitle e.g. `(T3, T4, TSH) / TFT` |
| `slug` | `String!` | URL-safe unique identifier |
| `image` | `String` | Image URL |
| `shortDescription` | `String!` | One-line description for list views |
| `description` | `String!` | Full description for detail page |
| `tags` | `[String!]!` | Concern categories e.g. `["Thyroid", "Heart"]` |
| `sampleTypes` | `[String!]!` | e.g. `["Blood", "Urine"]` |
| `whenToTest` | `[String!]!` | Symptom chips e.g. `["Fatigue", "Hair Loss"]` |
| `includedTestNames` | `[String!]!` | Sub-tests included in this test |
| `preparations` | `[Preparation!]!` | Pre-test preparation steps |
| `sections` | `LabTestSections!` | Accordion sections for detail page |
| `price` | `Float` | Price in INR |

### LabTestSections

All fields are optional — only show accordion item if value is present.

| Field | Description |
|-------|-------------|
| `ranges` | Reference ranges |
| `resultInterpretation` | How to read results |
| `riskAssessment` | Associated health risks |
| `whatDetects` | Conditions this test detects |
| `frequency` | How often to get tested |
| `indications` | Who should get this test |
| `parameters` | List of parameters measured |
| `risksLimitations` | Limitations and caveats |

### LabPackage

| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | MongoDB document ID |
| `name` | `String!` | Package name e.g. `Thyroid Care` |
| `slug` | `String!` | URL-safe unique identifier |
| `image` | `String` | Image URL |
| `tags` | `[String!]!` | Concern categories |
| `testCount` | `Int!` | Number of tests included |
| `price` | `Float` | Price in INR |

---

## Available Tags (Popular Concerns)

| Tag | Description |
|-----|-------------|
| `Thyroid` | Thyroid hormone tests |
| `Heart` | Cardiac and lipid tests |
| `Diabetes` | Blood sugar and insulin tests |
| `Liver` | Liver function and hepatitis tests |
| `Kidney` | Kidney function and urine tests |
| `Blood` | CBC, ESR, iron studies, vitamins |
| `Bone` | Vitamin D, PTH, calcium tests |
| `Infection` | CRP, hepatitis markers |

---

## Available Slugs

### Individual Tests

| Slug | Name |
|------|------|
| `thyroid-profile-test` | Thyroid Profile Test (T3, T4, TSH) |
| `thyroxine-t4-test` | Thyroxine (T4) Test |
| `triiodothyronine-t3-test` | Triiodothyronine (T3) Test |
| `tsh-test` | Thyroid Stimulating Hormone Test |
| `parathyroid-hormone-pth-test` | Parathyroid Hormone (PTH) Test |
| `anti-thyroglobulin-antibody-test` | Anti Thyroglobulin Antibody Test |
| `lipid-profile` | Lipid Profile |
| `cardiac-risk-markers` | Cardiac Risk Markers |
| `troponin-i-test` | Troponin I Test |
| `crp-test` | CRP (C-Reactive Protein) Test |
| `homocysteine-test` | Homocysteine Test |
| `hba1c-test` | HbA1c Test |
| `blood-glucose-fasting` | Blood Glucose Fasting |
| `blood-glucose-pp` | Blood Glucose PP |
| `insulin-fasting-test` | Insulin Fasting Test |
| `liver-function-test` | Liver Function Test (LFT) |
| `hepatitis-b-surface-antigen` | Hepatitis B Surface Antigen (HBsAg) |
| `hepatitis-c-antibody-test` | Hepatitis C Antibody Test |
| `kidney-function-test` | Kidney Function Test (KFT) |
| `urine-routine-examination` | Urine Routine Examination |
| `microalbumin-test` | Microalbumin Test |
| `complete-blood-count` | Complete Blood Count (CBC) |
| `esr-test` | ESR Test |
| `iron-studies` | Iron Studies |
| `vitamin-d-test` | Vitamin D Test |

### Packages

| Slug | Name | Tests |
|------|------|-------|
| `thyroid-care` | Thyroid Care | 31 |
| `thyroid-profile-package` | Thyroid Profile Test | 3 |
| `thyroid-lipid-panel` | Thyroid & Lipid Panel | 14 |
| `comprehensive-health-check` | Comprehensive Health Check | 72 |
| `diabetes-care-package` | Diabetes Care Package | 18 |

---

## UI Flow

### Search Screen

```
User types → debounce 300ms → call labTestSuggestions
                                    │
                      ┌─────────────┴─────────────┐
                      │                           │
            testSuggestions empty?         packageSuggestions
            + packageSuggestions empty?
                      │
                     YES → show "No results found"
                             + keyword chips from DB suggestions
                      │
                     NO  → show test name chips + package cards
```

On "View all results" or search submit → call `searchLabTests`.

### Detail Page

Navigate with `slug`. Call `labTest(slug)` and render:
1. Hero image + name + subtitle
2. Short description
3. `includedTestNames` — "Included Tests: ..."
4. `whenToTest` — symptom chips
5. `sampleTypes` — chips
6. `preparations` — list
7. Accordion from `sections` — only show sections where value is non-null

---

## Error Handling

```dart
if (result.hasException) {
  final errors = result.exception!.graphqlErrors;
  if (errors.isNotEmpty) {
    final message = errors.first.message;
    // show snackbar with message
  } else {
    // network error
  }
}
```
