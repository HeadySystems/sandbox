# @heady-ai/core

> Core utilities and shared primitives for the Heady™ AI Platform.

## Install

```bash
npm install @heady-ai/core
```

## API

```js
const { HeadyError, validateUserId, HEADY_VERSION } = require('@heady-ai/core');

// Validate user IDs
validateUserId('my-user'); // true

// Structured error handling
throw new HeadyError('Something broke', 'MY_CODE');
```

## What's Inside

| Export | Description |
|--------|-------------|
| `HEADY_VERSION` | Current platform version string |
| `HeadyConfig` | Configuration interface (TypeScript) |
| `HeadyError` | Error class with structured codes |
| `validateUserId()` | User ID format validator |

## License

Proprietary — © 2026 Heady™Systems Inc.
