// `node --import ./test/register-ts.mjs --test ...`: lets the unit tests import the TypeScript
// plugin and the TSX component directly on Node 20+, without a test framework.
import { register } from 'node:module';

register('./ts-loader.mjs', import.meta.url);
