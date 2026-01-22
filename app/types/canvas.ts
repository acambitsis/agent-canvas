/**
 * Canvas type definitions
 *
 * Canvas type is derived from Convex schema to ensure frontend/backend alignment.
 * Changes to canvas fields should be made in convex/schema.ts.
 */

import { Doc } from '../../convex/_generated/dataModel';

/**
 * Canvas document type - derived from Convex schema
 */
export type Canvas = Doc<"canvases">;
