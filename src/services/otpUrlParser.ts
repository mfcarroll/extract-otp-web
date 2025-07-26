import pako from "pako";
import { MigrationOtpParameter } from "../types";
import { base64ToUint8Array, decodeProtobufPayload } from "./protobufProcessor";
import { processLastPassQrJson } from "./lastPassFormatter";

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
  const decodedBytes = base64ToUint8Array(dataBase64);

  try {
    // The outer layer is Gzipped JSON.
    const jsonWrapperBytes = pako.inflate(decodedBytes);
    const jsonWrapperString = new TextDecoder().decode(jsonWrapperBytes);
    const jsonWrapper = JSON.parse(jsonWrapperString);

    if (jsonWrapper.content && typeof jsonWrapper.content === "string") {
      const contentBase64 = jsonWrapper.content;

      // The 'content' field is a Base64 encoded, Gzipped JSON string.
      const gzippedInnerPayload = base64ToUint8Array(contentBase64);
      const finalJsonBytes = pako.inflate(gzippedInnerPayload);
      const finalJsonString = new TextDecoder().decode(finalJsonBytes);

      // The final JSON string can be processed by our formatter.
      return processLastPassQrJson(finalJsonString);
    }

    // If we are here, the 'content' property was missing from the outer JSON.
    throw new Error(
      "Invalid LastPass QR code: 'content' property not found in payload."
    );
  } catch (e) {
    console.error("Failed to decode or decompress LastPass payload:", e);
    throw new Error(
      "Failed to decode LastPass QR code. The data format is not recognized or is corrupted."
    );
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
  const isLastPass = trimmedUrl.startsWith("lpaauth-migration://");
  const isGoogleAuth = trimmedUrl.startsWith("otpauth-migration://");

  if (!isLastPass && !isGoogleAuth) {
    throw new Error(
      "QR code is not a supported OTP export format (Google or LastPass)."
    );
  }

  const url = new URL(otpUrl);
  const dataBase64 = url.searchParams.get("data");

  if (!dataBase64) {
    throw new Error('Invalid OTP URL: Missing "data" parameter.');
  }

  if (isLastPass) {
    return decodeLastPassPayload(dataBase64);
  } else {
    return decodeGoogleAuthenticatorPayload(dataBase64);
  }
}
