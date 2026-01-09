#!/usr/bin/env node
import { getCustomerClient } from '../auth.js';
import { formatSuccess, formatError } from '../utils/response-format.js';

/**
 * Execute mutation operations using GoogleAdsService.Mutate
 * Supports any write operation with dry_run validation
 *
 * @param {Object} params - Mutation parameters
 * @param {string} params.customer_id - Google Ads customer ID (optional, uses env default)
 * @param {Array} params.operations - Array of mutation operation objects
 * @param {boolean} params.partial_failure - Enable partial failure mode (default: true)
 * @param {boolean} params.dry_run - Validate only, don't execute (default: true)
 * @returns {Promise<Object>} Mutation results
 */
export async function mutate(params) {
  const {
    customer_id = process.env.GOOGLE_ADS_CUSTOMER_ID,
    operations,
    partial_failure = true,
    dry_run = true
  } = params;

  try {
    // Validate required parameters
    if (!customer_id) {
      throw new Error('customer_id is required (either as parameter or GOOGLE_ADS_CUSTOMER_ID env var)');
    }

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      throw new Error('operations array is required and must contain at least one operation');
    }

    const customer = getCustomerClient(customer_id);

    // Execute mutation with validation options
    const response = await customer.mutateResources(operations, {
      partialFailure: partial_failure,
      validateOnly: dry_run
    });

    // Extract results from response
    const results = response.mutate_operation_responses || [];
    const partialFailureErrors = [];

    // Check for partial failure errors - these are returned in the response body,
    // NOT thrown as exceptions when partial_failure=true
    if (response.partial_failure_error) {
      // Handle different error structures from the API
      const errorDetails = response.partial_failure_error.errors
        || response.partial_failure_error.details
        || [];

      for (const error of errorDetails) {
        partialFailureErrors.push({
          message: error.message || error.error_message || JSON.stringify(error),
          error_code: error.error_code || error.code,
          operation_index: error.location?.field_path_elements?.[0]?.index ?? -1
        });
      }
    }

    // If ALL operations failed, throw an error so it's not silent
    if (partialFailureErrors.length > 0 && partialFailureErrors.length >= operations.length) {
      const errorMessages = partialFailureErrors.map(e => e.message).join('; ');
      throw new Error(`All operations failed: ${errorMessages}`);
    }

    // Calculate success/failure counts
    // Success = total operations minus failures (works for create, update, and remove)
    const failCount = partialFailureErrors.length;
    const successCount = operations.length - failCount;

    // Build appropriate message
    let message;
    if (dry_run) {
      message = failCount > 0
        ? `Validation completed with ${failCount} error(s) - no changes made`
        : 'Validation successful - no changes made';
    } else {
      message = failCount > 0
        ? `Mutations completed: ${successCount} succeeded, ${failCount} failed`
        : 'Mutations applied successfully';
    }

    return formatSuccess({
      summary: `${message} (${operations.length} operation${operations.length !== 1 ? 's' : ''})`,
      data: results.map(r => ({
        resource_name: r?.resource_name || null
      })),
      metadata: {
        dry_run,
        operations_count: operations.length,
        success_count: successCount,
        failure_count: failCount,
        customer_id,
        ...(partialFailureErrors.length > 0 && { errors: partialFailureErrors })
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
