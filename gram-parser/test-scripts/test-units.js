// This is a test script for the changes made to unit conversions in units.js

const assert = require('assert');

const { normalizeUnit, getMass } = require('../src/compiler/units');

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

function testNormalize() {
  const cases = [
    { args: [1, 'lb'], unit: 'g', qty: 453.59237 },
    { args: [3.5, 'oz'], unit: 'g', qty: 99.2233309375 },
    { args: [2, 'cup'], unit: 'ml', qty: 473.176473 },
    { args: [{ value: 1 }, 'pint'], unit: 'ml', qty: 473.176473 },
    { args: [1, 'Fl. Oz.'], unit: 'ml', qty: 29.5735295625 },
    { args: [1, 'lbs'], unit: 'g', qty: 453.59237 },
    { args: [2, 'tbs'], unit: 'ml', qty: 29.5735295625 },
    { args: [100, 'g'], unit: 'g', qty: 100 },
    { args: [1, 'l'], unit: 'ml', qty: 1000 },
  ];

  for (const c of cases) {
    const res = normalizeUnit(...c.args);
    assert.strictEqual(res.unit, c.unit, `normalizeUnit unit mismatch for ${c.args[1]}`);
    assert.ok(approx(res.quantity, c.qty), `normalizeUnit qty mismatch for ${c.args[1]}: got ${res.quantity}, expected ${c.qty}`);
  }
}

function testGetMass() {
  const cases = [
    { args: [1, 'g'], mass: 1, valid: true },
    { args: [{ type: 'single', value: 1 }, 'lb'], mass: 453.59237, valid: true },
    { args: [1, 'cup'], mass: 236.5882365, valid: true }, // this is approximate of 1ml being 1g
    { args: [{ type: 'range', value: 2 }, 'tbsp'], mass: 29.5735295625, valid: true },
    { args: [1, 'banana'], mass: 0, valid: false },
  ];

  for (const c of cases) {
    const res = getMass(...c.args);
    assert.strictEqual(res.valid, c.valid, `getMass valid mismatch for ${c.args[1]}`);
    assert.ok(approx(res.mass, c.mass), `getMass mass mismatch for ${c.args[1]}: got ${res.mass}, expected ${c.mass}`);
  }
}

function main() {
  testNormalize();
  testGetMass();
  console.log('All unit conversion tests passed.');
}

main();