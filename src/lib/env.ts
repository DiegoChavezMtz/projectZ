import 'server-only';
import { parseServerEnv } from './env.schema';
import { publicEnv } from './env.public';

// Solo servidor: `server-only` rompe el build si algún componente de cliente lo importa.
export const env = { ...publicEnv, ...parseServerEnv(process.env) };
