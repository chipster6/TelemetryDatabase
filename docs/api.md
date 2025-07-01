# API Documentation

## Overview

The AI Biometric Platform provides a comprehensive REST API for managing biometric data, prompt engineering, and user authentication. All endpoints use JSON for request and response bodies.

## Base URL

```
http://localhost:5000/api
```

## Authentication

The API uses session-based authentication. After logging in, the session cookie is automatically included in subsequent requests.

### Login
```http
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

### Logout
```http
POST /api/logout
```

**Response:**
```json
{
  "message": "Logout successful"
}
```

### Check Auth Status
```http
GET /api/auth/status
```

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

## Biometric Data Endpoints

### Get Biometric Data
```http
GET /api/biometric?sessionId=1&limit=50
```

**Query Parameters:**
- `sessionId` (optional) - Filter by session ID
- `limit` (optional) - Limit number of results (default: 50)

**Response:**
```json
[
  {
    "id": 1,
    "sessionId": 1,
    "heartRate": 72,
    "hrv": 45,
    "stressLevel": 0.3,
    "attentionLevel": 0.8,
    "cognitiveLoad": 0.6,
    "timestamp": 1640995200000,
    "deviceId": "sim-device-001"
  }
]
```

### Create Biometric Data
```http
POST /api/biometric
Content-Type: application/json

{
  "sessionId": 1,
  "heartRate": 75,
  "hrv": 42,
  "stressLevel": 0.4,
  "attentionLevel": 0.7,
  "cognitiveLoad": 0.5,
  "deviceId": "sim-device-001"
}
```

### Get Latest Biometric Data
```http
GET /api/biometric/latest?userId=1
```

### Get Anonymized Stats
```http
GET /api/biometric/anonymized-stats?userId=1&timeRange=24h
```

**Response:**
```json
{
  "totalSamples": 150,
  "timeRange": {
    "start": 1640908800000,
    "end": 1640995200000
  },
  "aggregatedMetrics": {
    "heartRate": {
      "min": 65,
      "max": 85,
      "avg": 72,
      "trend": "stable"
    },
    "stress": {
      "low": 60,
      "medium": 30,
      "high": 10
    }
  },
  "wellnessScore": 78,
  "recommendations": ["Consider taking breaks during high stress periods"]
}
```

## Prompt Engineering Endpoints

### Get Prompt Templates
```http
GET /api/prompts?userId=1
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Code Review",
    "description": "Template for code review requests",
    "content": "Please review the following code for...",
    "category": "development",
    "userId": 1,
    "isPublic": true,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

### Create Prompt Template
```http
POST /api/prompts
Content-Type: application/json

{
  "name": "Bug Report Analysis",
  "description": "Template for analyzing bug reports",
  "content": "Analyze this bug report and provide...",
  "category": "debugging",
  "isPublic": false
}
```

### Update Prompt Template
```http
PUT /api/prompts/1
Content-Type: application/json

{
  "name": "Updated Template Name",
  "content": "Updated template content..."
}
```

### Delete Prompt Template
```http
DELETE /api/prompts/1
```

## Prompt Sessions

### Get Prompt Sessions
```http
GET /api/sessions?userId=1&limit=20
```

### Create Prompt Session
```http
POST /api/sessions
Content-Type: application/json

{
  "templateId": 1,
  "originalPrompt": "Review this JavaScript function...",
  "refinedPrompt": "Please conduct a thorough code review...",
  "response": "The function looks good overall...",
  "biometricContext": {
    "avgHeartRate": 72,
    "stressLevel": 0.3
  }
}
```

## Vector Database Endpoints

### Weaviate Status
```http
GET /api/vector/status
```

**Response:**
```json
{
  "connected": true,
  "version": "1.31.3",
  "health": "healthy",
  "lastCheck": 1640995200000
}
```

### Semantic Search
```http
POST /api/vector/search
Content-Type: application/json

{
  "query": "biometric data analysis",
  "limit": 10,
  "threshold": 0.7
}
```

### Health Check
```http
GET /api/vector/health
```

## Device Management

### Get Device Connections
```http
GET /api/devices?userId=1
```

### Update Device Connection
```http
PUT /api/devices/1
Content-Type: application/json

{
  "isConnected": true,
  "batteryLevel": 85,
  "signalStrength": 92
}
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

**Error Response Format:**
```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "timestamp": 1640995200000
}
```

## Rate Limiting

API endpoints are rate limited to prevent abuse:
- Authentication endpoints: 5 requests per 5 minutes per IP
- General endpoints: 100 requests per minute per user
- Biometric data endpoints: 1000 requests per minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995260
```

## WebSocket Events

Real-time biometric data is available via WebSocket connection:

```javascript
const ws = new WebSocket('ws://localhost:5000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'biometric_update') {
    console.log('New biometric data:', data.payload);
  }
};
```

**Event Types:**
- `biometric_update` - New biometric data received
- `device_status` - Device connection status change
- `session_update` - Prompt session status change