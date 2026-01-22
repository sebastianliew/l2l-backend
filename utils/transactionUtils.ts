/**
 * Utility functions for transaction processing
 *
 * @module transactionUtils
 */

/**
 * Normalizes transaction type and status when payment is marked as paid.
 *
 * ## Business Rule
 * **Paid transactions cannot be drafts.** When a transaction has `paymentStatus === 'paid'`,
 * the system enforces that it must be a completed transaction, not a draft.
 *
 * ## State Transitions
 * When `paymentStatus` is `'paid'`:
 * - `type: 'DRAFT'` → `type: 'COMPLETED'`
 * - `status: 'draft'` → `status: 'completed'`
 *
 * ## Architecture: Dual Invocation Points
 * This function is intentionally called from two places to ensure consistent normalization:
 *
 * 1. **Pre-save middleware** (`Transaction.ts`):
 *    - Catches all `.save()` calls (new transactions, direct document updates)
 *    - Provides automatic enforcement for Mongoose document operations
 *
 * 2. **Controller logic** (`transactions.controller.ts`):
 *    - Required because `findByIdAndUpdate()` does NOT trigger pre-save middleware
 *    - Controllers have full context (existing document + update payload) to make
 *      informed decisions about state transitions
 *
 * ## Why No pre-findOneAndUpdate Middleware?
 * Mongoose's `pre-findOneAndUpdate` middleware only has access to the update object,
 * not the existing document values. This makes it impossible to correctly handle
 * partial updates where we need to know both the current state and the intended
 * changes. Controllers fetch the existing document first, enabling proper logic
 * like "was this a draft being completed?" checks.
 *
 * @param data - Object containing paymentStatus, status, and type fields
 * @returns void - mutates the data object in place
 *
 * @example
 * // Direct mutation for update payload
 * const updateData = { paymentStatus: 'paid', type: 'DRAFT', status: 'draft' };
 * normalizeTransactionForPayment(updateData);
 * // Result: { paymentStatus: 'paid', type: 'COMPLETED', status: 'completed' }
 *
 * @example
 * // No change when payment is not 'paid'
 * const pendingData = { paymentStatus: 'pending', type: 'DRAFT', status: 'draft' };
 * normalizeTransactionForPayment(pendingData);
 * // Result: unchanged - { paymentStatus: 'pending', type: 'DRAFT', status: 'draft' }
 */
export function normalizeTransactionForPayment(data: {
  paymentStatus?: string;
  status?: string;
  type?: string;
}): void {
  if (data.paymentStatus === 'paid') {
    if (data.type === 'DRAFT') {
      data.type = 'COMPLETED';
    }
    if (data.status === 'draft') {
      data.status = 'completed';
    }
  }
}
