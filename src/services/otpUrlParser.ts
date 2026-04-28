import pako from 'pako';
import { MigrationOtpParameter } from '../types';
import { base64ToUint8Array, decodeProtobufPayload } from './protobufProcessor';
import { processLastPassQrJson } from './lastPassFormatter';
import { mapToMigrationOtpParameter, RawOtpAccount } from './otpDataMapper';
import base32 from 'thirty-two';
import { logger } from './logger';
import { t } from '../i18n';

/**
 * Parses either an otpauth URL, a Google Migration URL, a LastPass JSON string,
 * or a raw Base32 secret string.
 */
export async function parseFlexibleInput(
  input: string
): Promise<MigrationOtpParameter[]> {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // 1. First, attempt to run it through the main parser.
  // This handles otpauth://, otpauth-migration://, and LastPass JSON arrays natively!
  try {
    const params = await getOtpParametersFromUrl(trimmed);
    if (params && params.length > 0) {
      return params;
    }
  } catch (e) {
    // If it fails to parse as a known URI/JSON format, we swallow the error
    // and see if it's a raw base32 secret.
  }

  // 2. Try raw Base32 secret
  // Remove spaces, dashes, and ensure uppercase for validation
  const cleanedSecret = trimmed.replace(/[\s-]/g, '').toUpperCase();

  // Base32 Regex: letters A-Z, numbers 2-7, optional padding =
  const base32Regex = /^[A-Z2-7]{10,}=*$/;

  if (base32Regex.test(cleanedSecret)) {
    // Decode the base32 string into a Uint8Array to satisfy MigrationOtpParameter
    const decodedSecret = new Uint8Array(base32.decode(cleanedSecret));

    return [
      {
        secret: decodedSecret,
        name: 'One-Time Password', // URL output must include a name
        issuer: '',
        type: 2, // OTP_TYPE_TOTP
        algorithm: 1, // ALGORITHM_SHA1
        digits: 6,
      },
    ];
  }

  throw new Error(t('error.invalidInput'));
}

/**
 * Decodes a standard otpauth:// URL into OTP parameters.
 * This is used for single-account QR codes, sometimes exported by apps like LastPass.
 * @param otpUrlString The full otpauth:// URL.
 */
async function decodeStandardOtpAuthUrl(
  otpUrlString: string
): Promise<MigrationOtpParameter[]> {
  const url = new URL(otpUrlString);

  const type = url.hostname.toLowerCase(); // 'totp' or 'hotp'
  if (type !== 'totp' && type !== 'hotp') {
    throw new Error(t('error.unsupportedOtpType', { type }));
  }

  const label = decodeURIComponent(url.pathname.substring(1));
  const params = url.searchParams;

  const secretB32 = params.get('secret');
  if (!secretB32) {
    throw new Error(t('error.missingSecret'));
  }

  let issuer = params.get('issuer');
  let name = label;

  if (issuer) {
    // If issuer is in params, it's the authority.
    // The label might still contain the issuer. If so, remove it for a cleaner name.
    if (name.startsWith(`${issuer}:`)) {
      name = name.substring(issuer.length + 1).trim();
    }
  } else {
    // If issuer is not in params, try to extract from label "Issuer:Name".
    const parts = label.split(':');
    if (parts.length > 1) {
      issuer = parts[0];
      name = parts.slice(1).join(':').trim();
    }
  }

  const algorithmStr = (params.get('algorithm') || 'SHA1').toUpperCase();
  const digitsStr = params.get('digits') || '6';
  const digits = parseInt(digitsStr, 10);

  const rawAccount: RawOtpAccount = {
    name: name,
    issuer: issuer || '',
    secret: secretB32,
    algorithm: algorithmStr,
    digits: digits === 6 || digits === 8 ? digits : 6,
    type: type,
  };

  if (type === 'hotp') {
    const counterStr = params.get('counter');
    if (!counterStr) {
      throw new Error(t('error.missingCounter'));
    }
    rawAccount.counter = parseInt(counterStr, 10);
  }

  const otp = mapToMigrationOtpParameter(rawAccount);
  return [otp];
}

/**
 * Decodes a standard Google Authenticator payload.
 * Format: Base64(Protobuf)
 * @param dataBase64 The base64 data from the URL.
 */
async function decodeGoogleAuthenticatorPayload(
  dataBase64: string
): Promise<MigrationOtpParameter[]> {
  const protobufData = base64ToUint8Array(dataBase64);
  return decodeProtobufPayload(protobufData);
}

/**
 * Decodes a LastPass Authenticator payload.
 * The format is a gzipped JSON string, which itself contains a
 * base64-encoded, gzipped JSON payload.
 * Format: Base64(Gzip(JSON({ content: Base64(Gzip(JSON_final)) })))
 * @param dataBase64 The base64 data from the URL.
 */
async function decodeLastPassPayload(
  dataBase64: string
): Promise<MigrationOtpParameter[]> {
  logger.debug('[LastPass Import] Step 1: Received Base64 data', dataBase64);
  const decodedBytes = base64ToUint8Array(dataBase64);
  logger.debug(
    '[LastPass Import] Step 2: Decoded Base64 to Uint8Array',
    decodedBytes
  );

  try {
    // The outer layer is Gzipped JSON.
    const jsonWrapperBytes = pako.inflate(decodedBytes);
    logger.debug(
      '[LastPass Import] Step 3: Inflated outer payload',
      jsonWrapperBytes
    );
    const jsonWrapperString = new TextDecoder().decode(jsonWrapperBytes);
    logger.debug(
      '[LastPass Import] Step 4: Decoded outer payload to JSON string',
      jsonWrapperString
    );
    const jsonWrapper = JSON.parse(jsonWrapperString);

    if (jsonWrapper.content && typeof jsonWrapper.content === 'string') {
      const contentBase64 = jsonWrapper.content;
      logger.debug(
        '[LastPass Import] Step 5: Extracted inner Base64 content',
        contentBase64
      );

      // The 'content' field is a Base64 encoded, Gzipped JSON string.
      const gzippedInnerPayload = base64ToUint8Array(contentBase64);
      const finalJsonBytes = pako.inflate(gzippedInnerPayload);
      const finalJsonString = new TextDecoder().decode(finalJsonBytes);
      logger.debug(
        '[LastPass Import] Step 6: Decoded final inner JSON string',
        finalJsonString
      );

      // The final JSON string can be processed by our formatter.
      return processLastPassQrJson(finalJsonString);
    }

    // If we are here, the 'content' property was missing from the outer JSON.
    throw new Error(t('error.invalidLastPassPayload'));
  } catch (e) {
    logger.error('Failed to decode or decompress LastPass payload:', e);
    throw new Error(t('error.lastPassDecodeFailed'));
  }
}

/**
 * Extracts OTP parameters from an authenticator export URL.
 * @param otpUrl The full otpauth-migration or lpaauth-migration URL from the QR code.
 * @returns A promise that resolves to an array of OTP parameters.
 */
export async function getOtpParametersFromUrl(
  otpUrl: string
): Promise<MigrationOtpParameter[]> {
  const trimmedUrl = otpUrl.trim();
  const isLastPass = trimmedUrl.startsWith('lpaauth-migration://');
  const isGoogleAuth = trimmedUrl.startsWith('otpauth-migration://');
  const isStandardOtp = trimmedUrl.startsWith('otpauth://');

  if (isStandardOtp) {
    return decodeStandardOtpAuthUrl(trimmedUrl);
  }

  if (!isLastPass && !isGoogleAuth) {
    throw new Error(t('error.unsupportedQrFormat'));
  }

  const url = new URL(otpUrl);
  const dataBase64 = url.searchParams.get('data');

  if (!dataBase64) {
    throw new Error(t('error.missingDataParam'));
  }

  if (isLastPass) {
    return decodeLastPassPayload(dataBase64);
  } else {
    return decodeGoogleAuthenticatorPayload(dataBase64);
  }
}
