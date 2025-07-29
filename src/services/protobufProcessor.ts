import protobuf from "protobufjs";
import { MigrationOtpParameter } from "../types";
import { logger } from "./logger";

// Pre-load the protobuf definition once for better performance.
const protobufRoot = protobuf.load("otp_migration.proto");

export function base64ToUint8Array(base64: string): Uint8Array {
  // The atob function in browsers handles spaces, but it's good practice to remove them.
  // The `+` character is often replaced with a space in URL parameters.
  const base64Fixed = base64.replace(/ /g, "+");
  const binaryString = atob(base64Fixed);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a Base64 encoded string.
 * @param bytes The byte array to encode.
 * @returns The Base64 encoded string.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // The btoa function in browsers creates a Base64-encoded ASCII string.
  return btoa(binary);
}

/** Helper for debugging to convert a Uint8Array to a hex string. */
const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

/**
 * Decodes the final protobuf binary data into OTP parameters.
 * @param protobufData The raw protobuf binary data.
 * @returns A promise that resolves to an array of OTP parameters.
 */
export async function decodeProtobufPayload(
  protobufData: Uint8Array
): Promise<MigrationOtpParameter[]> {
  const root = await protobufRoot;
  const MigrationPayload = root.lookupType("MigrationPayload");

  try {
    const payload = MigrationPayload.decode(protobufData) as unknown as {
      otpParameters: MigrationOtpParameter[];
    };
    if (!payload || !Array.isArray(payload.otpParameters)) {
      throw new Error("Decoded payload is not in the expected format.");
    }
    return payload.otpParameters;
  } catch (error) {
    logger.error("Failed to parse final protobuf data:", error);
    logger.error(
      "Protobuf Decode Error. Offending data (hex):",
      toHexString(protobufData)
    );
    throw new Error(
      "Failed to parse the final data payload. It may be corrupted or in an unexpected format."
    );
  }
}
