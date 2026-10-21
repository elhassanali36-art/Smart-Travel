// Known Prisma request errors that are client errors, not server faults.
export function httpFromPrismaCode(code: string | undefined): { status: number; message: string } | null {
  switch (code) {
    case 'P2002': return { status: 409, message: 'Resource already exists' };
    case 'P2025': return { status: 404, message: 'Resource not found' };
    case 'P2003': return { status: 409, message: 'Operation conflicts with related data' };
    case 'P2023': return { status: 400, message: 'Invalid identifier' };
    case 'P2034': return { status: 409, message: 'Conflict, please retry' };
    default: return null;
  }
}
