import { describe, expect, it } from 'vitest';
import { fib, PHI, phiBackoff } from '../src/index.js';
describe('phi math foundation', () => {
    it('exports phi and fibonacci helpers', () => {
        expect(PHI).toBeGreaterThan(1.6);
        expect(fib(8)).toBe(21);
        expect(phiBackoff(3)).toBeGreaterThan(4000);
    });
});
//# sourceMappingURL=basic.test.js.map