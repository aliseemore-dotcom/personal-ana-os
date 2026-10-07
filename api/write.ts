import { handleWrite } from '../server/http.js';

/** POST /api/write — one change to the Data Hub, located by stable id. */
export const POST = (req: Request) => handleWrite(req);
