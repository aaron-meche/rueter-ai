#!/usr/bin/env node
```
```javascript
import {main} from '../src/cli.js';

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});