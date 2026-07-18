// Single source of truth: re-export the Prisma-generated enum so app code
// imports roles from one stable path (avoids drift with the DB schema).
export { UserRole } from '@prisma/client';
