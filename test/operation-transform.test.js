/**
 * Unit tests for operation format transformation
 * Tests conversion from standard Google Ads format to Opteo library format
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  normalizeOperations,
  inferEntityFromResourceName,
  inferEntityFromCreateResource,
  isOpteoFormat,
  getStandardOperationType,
  RESOURCE_PATH_TO_ENTITY
} from '../server/utils/operation-transform.js';

// ============================================
// inferEntityFromResourceName tests
// ============================================

describe('inferEntityFromResourceName', () => {

  test('infers campaign from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/campaigns/456');
    assert.strictEqual(result, 'campaign');
  });

  test('infers ad_group from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/adGroups/789');
    assert.strictEqual(result, 'ad_group');
  });

  test('infers ad_group_criterion from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/adGroupCriteria/456~789');
    assert.strictEqual(result, 'ad_group_criterion');
  });

  test('infers campaign_criterion from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/campaignCriteria/456~789');
    assert.strictEqual(result, 'campaign_criterion');
  });

  test('infers label from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/labels/456');
    assert.strictEqual(result, 'label');
  });

  test('infers campaign_budget from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/campaignBudgets/456');
    assert.strictEqual(result, 'campaign_budget');
  });

  test('infers shared_set from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/sharedSets/456');
    assert.strictEqual(result, 'shared_set');
  });

  test('returns null for invalid resource_name', () => {
    const result = inferEntityFromResourceName('invalid/path');
    assert.strictEqual(result, null);
  });

  test('returns null for null input', () => {
    const result = inferEntityFromResourceName(null);
    assert.strictEqual(result, null);
  });

  test('returns null for unknown resource type', () => {
    const result = inferEntityFromResourceName('customers/123/unknownResource/456');
    assert.strictEqual(result, null);
  });
});

// ============================================
// inferEntityFromCreateResource tests
// ============================================

describe('inferEntityFromCreateResource', () => {

  test('infers ad_group_criterion from ad_group + keyword', () => {
    const resource = {
      ad_group: 'customers/123/adGroups/456',
      keyword: { text: 'test', match_type: 'EXACT' }
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'ad_group_criterion');
  });

  test('infers ad_group_criterion from ad_group + negative', () => {
    const resource = {
      ad_group: 'customers/123/adGroups/456',
      negative: true,
      keyword: { text: 'test', match_type: 'EXACT' }
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'ad_group_criterion');
  });

  test('infers campaign_criterion from campaign + keyword', () => {
    const resource = {
      campaign: 'customers/123/campaigns/456',
      negative: true,
      keyword: { text: 'test', match_type: 'PHRASE' }
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'campaign_criterion');
  });

  test('infers shared_criterion from shared_set', () => {
    const resource = {
      shared_set: 'customers/123/sharedSets/456',
      keyword: { text: 'test', match_type: 'EXACT' }
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'shared_criterion');
  });

  test('infers label from name + text_label', () => {
    const resource = {
      name: 'Test Label',
      text_label: { background_color: '#FFFFFF' }
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'label');
  });

  test('infers ad_group from campaign + name', () => {
    const resource = {
      campaign: 'customers/123/campaigns/456',
      name: 'Test Ad Group',
      cpc_bid_micros: 1000000
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'ad_group');
  });

  test('infers campaign from advertising_channel_type', () => {
    const resource = {
      name: 'Test Campaign',
      advertising_channel_type: 'SEARCH',
      campaign_budget: 'customers/123/campaignBudgets/456'
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'campaign');
  });

  test('infers campaign_budget from amount_micros', () => {
    const resource = {
      amount_micros: 10000000,
      delivery_method: 'STANDARD'
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'campaign_budget');
  });

  test('returns null for unknown structure', () => {
    const resource = { unknown_field: 'value' };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, null);
  });

  test('returns null for null input', () => {
    const result = inferEntityFromCreateResource(null);
    assert.strictEqual(result, null);
  });
});

// ============================================
// isOpteoFormat tests
// ============================================

describe('isOpteoFormat', () => {

  test('returns true for valid Opteo format', () => {
    const op = {
      entity: 'campaign',
      operation: 'update',
      resource: { resource_name: 'customers/123/campaigns/456', status: 'PAUSED' }
    };
    assert.strictEqual(isOpteoFormat(op), true);
  });

  test('returns true for Opteo format with default operation', () => {
    const op = {
      entity: 'label',
      resource: { name: 'Test Label' }
    };
    assert.strictEqual(isOpteoFormat(op), true);
  });

  test('returns false for standard format', () => {
    const op = {
      update: { resource_name: 'customers/123/campaigns/456', status: 'PAUSED' }
    };
    assert.strictEqual(isOpteoFormat(op), false);
  });

  test('returns false for null', () => {
    assert.strictEqual(isOpteoFormat(null), false);
  });

  test('returns false for missing entity', () => {
    const op = {
      operation: 'update',
      resource: { status: 'PAUSED' }
    };
    assert.strictEqual(isOpteoFormat(op), false);
  });
});

// ============================================
// getStandardOperationType tests
// ============================================

describe('getStandardOperationType', () => {

  test('returns create for create operation', () => {
    const op = { create: { name: 'Test' } };
    assert.strictEqual(getStandardOperationType(op), 'create');
  });

  test('returns update for update operation', () => {
    const op = { update: { resource_name: '...', status: 'PAUSED' } };
    assert.strictEqual(getStandardOperationType(op), 'update');
  });

  test('returns remove for remove operation', () => {
    const op = { remove: 'customers/123/labels/456' };
    assert.strictEqual(getStandardOperationType(op), 'remove');
  });

  test('returns null for Opteo format', () => {
    const op = { entity: 'campaign', resource: {} };
    assert.strictEqual(getStandardOperationType(op), null);
  });

  test('returns null for invalid format', () => {
    const op = { invalid: 'format' };
    assert.strictEqual(getStandardOperationType(op), null);
  });

  test('returns null for null', () => {
    assert.strictEqual(getStandardOperationType(null), null);
  });
});

// ============================================
// normalizeOperations tests
// ============================================

describe('normalizeOperations', () => {

  describe('Opteo format passthrough', () => {

    test('passes through valid Opteo format unchanged', () => {
      const operations = [{
        entity: 'campaign',
        operation: 'update',
        resource: { resource_name: 'customers/123/campaigns/456', status: 'PAUSED' }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.deepStrictEqual(result, operations);
      assert.strictEqual(warnings.length, 0);
    });

    test('passes through multiple Opteo format operations', () => {
      const operations = [
        { entity: 'campaign', operation: 'update', resource: { status: 'PAUSED' } },
        { entity: 'ad_group', operation: 'update', resource: { status: 'ENABLED' } }
      ];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.deepStrictEqual(result, operations);
      assert.strictEqual(warnings.length, 0);
    });
  });

  describe('Standard format transformation', () => {

    test('transforms update operation with resource_name', () => {
      const operations = [{
        update: { resource_name: 'customers/123/campaigns/456', status: 'PAUSED' }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(result[0].operation, 'update');
      assert.deepStrictEqual(result[0].resource, operations[0].update);
      assert.strictEqual(warnings.length, 1);
    });

    test('transforms remove operation', () => {
      const operations = [{
        remove: 'customers/123/labels/789'
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'label');
      assert.strictEqual(result[0].operation, 'remove');
      assert.strictEqual(result[0].resource.resource_name, 'customers/123/labels/789');
      assert.strictEqual(warnings.length, 1);
    });

    test('transforms create operation for ad_group_criterion', () => {
      const operations = [{
        create: {
          ad_group: 'customers/123/adGroups/456',
          negative: true,
          keyword: { text: 'test', match_type: 'EXACT' }
        }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'ad_group_criterion');
      assert.strictEqual(result[0].operation, 'create');
      assert.strictEqual(warnings.length, 1);
    });

    test('transforms create operation for campaign_criterion', () => {
      const operations = [{
        create: {
          campaign: 'customers/123/campaigns/456',
          negative: true,
          keyword: { text: 'competitor', match_type: 'PHRASE' }
        }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign_criterion');
      assert.strictEqual(result[0].operation, 'create');
    });

    test('transforms create operation for label', () => {
      const operations = [{
        create: {
          name: 'Test Label',
          text_label: { background_color: '#FF0000' }
        }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'label');
      assert.strictEqual(result[0].operation, 'create');
    });
  });

  describe('Mixed format handling', () => {

    test('handles mixed Opteo and standard formats', () => {
      const operations = [
        { entity: 'campaign', operation: 'update', resource: { status: 'PAUSED' } },
        { update: { resource_name: 'customers/123/adGroups/789', status: 'ENABLED' } }
      ];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(result[1].entity, 'ad_group');
      assert.strictEqual(warnings.length, 1); // Only standard format generates warnings
    });
  });

  describe('Error handling', () => {

    test('throws on invalid operation format', () => {
      const operations = [{ invalid: 'format' }];

      assert.throws(
        () => normalizeOperations(operations),
        /Invalid format/
      );
    });

    test('throws when entity cannot be inferred from create', () => {
      const operations = [{
        create: { some_unknown_field: 'value' }
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /Could not infer entity type/
      );
    });

    test('throws when entity cannot be inferred from update without resource_name', () => {
      const operations = [{
        update: { status: 'PAUSED' } // No resource_name
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /Could not infer entity type/
      );
    });

    test('throws when remove value is not a string', () => {
      const operations = [{
        remove: { resource_name: 'customers/123/labels/456' }
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /'remove' value must be a resource_name string/
      );
    });

    test('throws when create value is not an object', () => {
      const operations = [{
        create: 'invalid'
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /'create' value must be an object/
      );
    });

    test('includes operation index in error message', () => {
      const operations = [
        { update: { resource_name: 'customers/123/campaigns/456', status: 'PAUSED' } },
        { invalid: 'format' }
      ];

      assert.throws(
        () => normalizeOperations(operations),
        /Operation 1:/
      );
    });
  });

  describe('_entity hint support', () => {

    test('uses _entity hint when inference fails', () => {
      const operations = [{
        create: { name: 'Test Item' },
        _entity: 'label'
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'label');
      assert.strictEqual(result[0].operation, 'create');
    });
  });

  // ============================================
  // Campaign creation - resource_name stripping
  // ============================================

  describe('Campaign creation - resource_name stripping', () => {

    test('strips resource_name from campaign create operation', () => {
      const operations = [{
        create: {
          resource_name: 'customers/123/campaigns/-1',
          name: 'Test Campaign',
          advertising_channel_type: 'SEARCH',
          campaign_budget: 'customers/123/campaignBudgets/456',
          status: 'PAUSED',
          manual_cpc: {}
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(result[0].operation, 'create');
      assert.strictEqual(result[0].resource.resource_name, undefined);
      assert.strictEqual(result[0].resource.name, 'Test Campaign');
    });

    test('preserves resource_name in campaign_budget create for atomic ops', () => {
      const operations = [{
        create: {
          resource_name: 'customers/123/campaignBudgets/-1',
          name: 'Test Budget',
          amount_micros: 50000000
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign_budget');
      assert.strictEqual(result[0].resource.resource_name, 'customers/123/campaignBudgets/-1');
    });

    test('preserves all other campaign fields when stripping resource_name', () => {
      const operations = [{
        create: {
          resource_name: 'customers/123/campaigns/-1',
          name: 'Test',
          advertising_channel_type: 'DISPLAY',
          campaign_budget: 'customers/123/campaignBudgets/456',
          target_cpa: { target_cpa_micros: 25000000 },
          network_settings: { target_content_network: true }
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].resource.name, 'Test');
      assert.strictEqual(result[0].resource.advertising_channel_type, 'DISPLAY');
      assert.deepStrictEqual(result[0].resource.target_cpa, { target_cpa_micros: 25000000 });
      assert.deepStrictEqual(result[0].resource.network_settings, { target_content_network: true });
      assert.strictEqual(result[0].resource.campaign_budget, 'customers/123/campaignBudgets/456');
    });

    test('does not strip resource_name from UPDATE operations', () => {
      const operations = [{
        update: {
          resource_name: 'customers/123/campaigns/456',
          status: 'PAUSED'
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(result[0].operation, 'update');
      assert.strictEqual(result[0].resource.resource_name, 'customers/123/campaigns/456');
    });

    test('strips resource_name from ad_group create operation', () => {
      const operations = [{
        create: {
          resource_name: 'customers/123/adGroups/-1',
          campaign: 'customers/123/campaigns/456',
          name: 'Test Ad Group',
          cpc_bid_micros: 1000000
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'ad_group');
      assert.strictEqual(result[0].operation, 'create');
      assert.strictEqual(result[0].resource.resource_name, undefined);
      assert.strictEqual(result[0].resource.name, 'Test Ad Group');
    });

    test('campaign create without resource_name still works', () => {
      const operations = [{
        create: {
          name: 'Test Campaign',
          advertising_channel_type: 'SEARCH',
          campaign_budget: 'customers/123/campaignBudgets/456',
          status: 'PAUSED'
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(result[0].operation, 'create');
      assert.strictEqual(result[0].resource.resource_name, undefined);
    });
  });
});

// ============================================
// RESOURCE_PATH_TO_ENTITY coverage
// ============================================

describe('RESOURCE_PATH_TO_ENTITY mapping', () => {

  test('has all common resource types', () => {
    const expectedTypes = [
      'campaigns',
      'adGroups',
      'adGroupCriteria',
      'campaignCriteria',
      'labels',
      'sharedSets',
      'sharedCriteria',
      'campaignBudgets'
    ];

    for (const type of expectedTypes) {
      assert.ok(RESOURCE_PATH_TO_ENTITY[type], `Missing mapping for ${type}`);
    }
  });
});
