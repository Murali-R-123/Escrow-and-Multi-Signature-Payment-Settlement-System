// Application-level (zod) validation. The DATABASE re-validates everything with
// ENUM / CHECK / UNIQUE / FK constraints and triggers, so nothing here is trusted.
import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(150),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  role: z.enum(['BUYER', 'SELLER', 'ARBITRATOR']),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const createEscrowSchema = z.object({
  seller_id: z.coerce.number().int().positive(),
  arbitrator_id: z.coerce.number().int().positive().nullish(),
  amount: z.coerce.number().positive().max(9999999999.99),
  description: z.string().trim().min(3).max(500),
  deadline: z.string().min(8),
  required_signatures: z.coerce.number().int().min(1).max(3),
});

export const approveSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  remarks: z.string().trim().max(500).optional().nullable(),
});

export const disputeSchema = z.object({ reason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(1000) });

export const resolveSchema = z.object({
  outcome: z.enum(['RELEASE', 'REFUND', 'DISMISS']),
  note: z.string().trim().max(500).optional().nullable(),
});

export const ESCROW_STATUSES = ['PENDING', 'APPROVED', 'RELEASED', 'REFUNDED', 'DISPUTED', 'EXPIRED'];
