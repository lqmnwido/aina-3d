import {existsSync,copyFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkAssets} from './check-assets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<12))throw new Error('Install Node.js 22.12 or newer.');
if(!existsSync(path.join(root,'.env')))copyFileSync(path.join(root,'.env.example'),path.join(root,'.env'));
console.log(`Setup complete: ${checkAssets()} bundled assets verified. Existing .env preserved. No GPU, API key or Python needed.`);
