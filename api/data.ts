import { handleData } from '../server/http.js';

/** GET /api/data — the whole Data Hub as normalised objects. `?refresh=1` asks for a fresh read. */
export const GET = (req: Request) => handleData(req);
