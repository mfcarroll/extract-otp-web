export interface OtpData {
  name: string;
  secret: string;
  issuer: string;
  type: string;
  typeDescription: string;
  counter: number | "";
  url: string;
}

// Define a more specific type for the raw OTP data from the protobuf payload.
export interface MigrationOtpParameter {
  secret: Uint8Array;
  name: string;
  issuer: string;
  algorithm: number; // ALGORITHM_UNSPECIFIED (0), SHA1 (1)
  digits: number; // DIGITS_UNSPECIFIED (0), SIX (1), EIGHT (2)
  type: number; // TYPE_UNSPECIFIED (0), HOTP (1), TOTP (2)
  counter?: number;
}

/**
 * Represents the structure of a single account within a LastPass QR code export.
 */
export interface LastPassQrAccount {
  // --- Essential OTP data ---
  oUN: string; // Original User Name (used as the primary 'name')
  oIN: string; // Original Issuer Name (used as the primary 'issuer')
  s: string; // Base32 encoded secret
  a: string; // Algorithm (e.g., "SHA1")
  d: 6 | 8; // Digits
  tS: number; // Time Step

  // --- Optional/Compatibility fields ---
  uN?: string; // User Name (often same as oUN)
  iN?: string; // Issuer Name (often same as oIN)
  aId?: string; // Account ID (UUID)
  cT?: number; // Creation Timestamp
  iF?: boolean; // isFavorite?
  pN?: boolean; // pushNotifications?
  fD?: { folderId: number; position: number }; // folderData
}

/**
 * Represents the structure of a single account within a LastPass JSON file export.
 * This is based on observed `accounts.json` files.
 */
export interface LastPassFileAccount {
  userName: string;
  issuerName: string;
  secret: string;
  algorithm: string;
  digits: 6 | 8;
  timeStep?: number;
  counter?: number;
  originalUserName?: string;
  originalIssuerName?: string;
  accountID?: string;
  creationTimestamp?: number;
  isFavorite?: boolean;
  folderData?: { position: number; folderId: number };
  lmiUserId?: string;
}

/**
 * Represents the overall JSON payload structure from a LastPass QR code export.
 */
export interface LastPassQrPayload {
  a: LastPassQrAccount[];
  dS?: string;
  dId?: string;
  f?: { iO: boolean; i: number; n: string }[];
}

/**
 * Represents the overall JSON payload structure from a LastPass json file export.
 */
export interface LastPassFilePayload {
  version: number;
  deviceName: string;
  folders: { id: number; isOpened: boolean; name: string }[];
  accounts: LastPassFileAccount[];
  localDeviceId: string | null;
}
