# @siya/sdk

Official SDK for SIYA — a local AI coding agent powered by OpenRouter.

## Install

```bash
bun add @siya/sdk
```

## Usage

```typescript
import { SiyaClient } from '@siya/sdk'

const client = new SiyaClient({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const result = await client.run({
  agent: 'base2',
  prompt: 'Add a hello world function to src/index.ts',
  cwd: process.cwd(),
})

console.log(result.output)
```

## Environment

Set `OPENROUTER_API_KEY` in your environment or `.env` file.

## License

Apache-2.0
