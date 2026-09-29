import { describe, it, expect } from 'vitest';
import { encode } from 'thirty-two';
import { parseFlexibleInput } from './otpUrlParser';

const secretOf = async (input: string) => {
  const [otp] = await parseFlexibleInput(input);
  return encode(otp.secret).toString().replace(/=+$/, '');
};

describe('parseFlexibleInput: raw Base32 secrets', () => {
  it('accepts secrets written plainly, in lowercase, or in even groups', async () => {
    expect(await secretOf('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
    expect(await secretOf('jbsw y3dp ehpk 3pxp')).toBe('JBSWY3DPEHPK3PXP');
    expect(await secretOf('JBSW-Y3DP-EHPK-3PXP')).toBe('JBSWY3DPEHPK3PXP');
    expect(await secretOf('GEZDG NBVGY 3TQOJ QGEZD GNBVG Y3TQO JQ')).toBe(
      'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    );
  });

  it('rejects ordinary text that happens to use Base32 letters', async () => {
    await expect(parseFlexibleInput('not a valid code')).rejects.toThrow();
    await expect(parseFlexibleInput('hello world again')).rejects.toThrow();
  });

  it('rejects secrets shorter than 80 bits (16 characters)', async () => {
    await expect(parseFlexibleInput('JBSWY3DPEHPK3PX')).rejects.toThrow();
  });

  it('rejects characters outside Base32', async () => {
    await expect(parseFlexibleInput('JBSWY3DPEHPK3PX1')).rejects.toThrow();
  });
});
