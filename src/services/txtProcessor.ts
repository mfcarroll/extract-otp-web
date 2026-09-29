// src/services/txtProcessor.ts
import { MigrationOtpParameter } from '../types';
import { parseFlexibleInput } from './otpUrlParser';
import { t } from '../i18n';

export async function processText(
  fileContent: string
): Promise<MigrationOtpParameter[]> {
  const lines = fileContent.trim().split(/\r?\n/);
  const allOtpParams: MigrationOtpParameter[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    try {
      const params = await parseFlexibleInput(trimmedLine);
      allOtpParams.push(...params);
    } catch (error: any) {
      errors.push(
        t('error.textLine', {
          line: i + 1,
          message: error.message || t('error.invalidFormat'),
        })
      );
    }
  }

  if (allOtpParams.length === 0 && errors.length > 0) {
    throw new Error(t('error.textParse', { detail: errors[0] }));
  }

  return allOtpParams;
}
