import { describe, expect, it } from 'vitest';
import serviceCatalog from '../../configs/source/hcfullpipeline.json' assert { type: 'json' };

describe('bundle smoke', () => {
  it('contains source pipeline config', () => {
    expect(serviceCatalog).toBeTruthy();
  });
});
