/** Micro-harnais de test, sans dépendance. */
const suites = [];
let current = null;

export function describe(name, fn) {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
}

export function it(name, fn) {
  current.tests.push({ name, fn });
}

export function assert(cond, message = 'assertion échouée') {
  if (!cond) throw new Error(message);
}

export function equal(actual, expected, message = '') {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message} attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
  }
}

export function deepEqual(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message}\n  attendu ${b}\n  obtenu  ${a}`);
}

export function run() {
  let passed = 0;
  const failures = [];
  for (const suite of suites) {
    console.log(`\n\x1b[1m${suite.name}\x1b[0m`);
    for (const test of suite.tests) {
      try {
        test.fn();
        passed++;
        console.log(`  \x1b[32m✓\x1b[0m ${test.name}`);
      } catch (err) {
        failures.push({ suite: suite.name, test: test.name, err });
        console.log(`  \x1b[31m✗\x1b[0m ${test.name}\n      ${err.message}`);
      }
    }
  }
  console.log(`\n${passed} réussis, ${failures.length} échoués`);
  if (failures.length) process.exitCode = 1;
}
