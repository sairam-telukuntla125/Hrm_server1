const assert = require('assert');
const LeaveRequest = require('../src/models/LeaveRequest');

const validTypes = ['Sick', 'Casual', 'Earned', 'Unpaid', 'Annual'];

assert(validTypes.includes('Sick'), 'Sick leave should be supported');
assert(validTypes.includes('Annual'), 'Annual leave should be supported');

const modelEnum = LeaveRequest.schema.path('type').enumValues;
assert(modelEnum.includes('Sick'), 'Schema must accept Sick');
assert(modelEnum.includes('Annual'), 'Schema must accept Annual');

console.log('leave validation test passed');
