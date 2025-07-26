import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import pako from "pako";
import protobuf from "protobufjs";
import { exportToGoogleAuthenticator, exportToLastPass } from "./otpExporter";
import { MigrationOtpParameter } from "../types";

// Mock data for testing
const mockOtps: MigrationOtpParameter[] = [
  {
    secret: new Uint8Array([72, 101, 108, 108, 111, 33, 222, 173, 190, 239]), // "Hello!"
    name: "test-account",
    issuer: "TestIssuer",
    algorithm: 1, // SHA1
    digits: 1, // 6 digits
    type: 2, // TOTP
    counter: 0,
  },
  {
    secret: new Uint8Array([
      71, 111, 111, 100, 98, 121, 101, 33, 239, 190, 173, 222,
    ]), // "Goodbye!߾­"
    name: "another-account",
    issuer: "AnotherIssuer",
    algorithm: 2, // SHA256
    digits: 2, // 8 digits
    type: 2, // TOTP
    counter: 0,
  },
];

describe("OTP Exporter", () => {
  // Mock non-deterministic functions to ensure consistent output
  beforeAll(() => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "MOCK-UUID-0000-0000-0000-000000000000"
    );
    vi.spyOn(Date, "now").mockReturnValue(1672531200000); // 2023-01-01
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("should correctly export to Google Authenticator format", async () => {
    const url = await exportToGoogleAuthenticator(mockOtps);
    expect(url).toContain("otpauth-migration://offline?data=");

    // Decode the URL to verify its contents
    const data = decodeURIComponent(url.split("data=")[1]);
    const buffer = Buffer.from(data, "base64");

    const root = await protobuf.load("otp_migration.proto");
    const MigrationPayload = root.lookupType("MigrationPayload");
    const payload = MigrationPayload.decode(buffer);
    const payloadObject = MigrationPayload.toObject(payload);

    expect(payloadObject.otpParameters).toHaveLength(2);
    expect(payloadObject.otpParameters[0].name).toBe("test-account");
    expect(payloadObject.otpParameters[1].issuer).toBe("AnotherIssuer");
    expect(payloadObject.version).toBe(1);
    // The value 2147483648 (2**31) overflows the positive range of a signed 32-bit
    // integer. When encoded and decoded by the protobuf library as an int32,
    // it wraps around to the most negative value.
    expect(payloadObject.batchId).toBe(-2147483648);
  });

  it("should correctly export to LastPass format", async () => {
    const url = await exportToLastPass(mockOtps);
    expect(url).toContain("lpaauth-migration://offline?data=");

    // --- Decode the doubly-gzipped and base64-encoded payload ---

    // 1. Decode outer layer
    const outerDataB64 = decodeURIComponent(url.split("data=")[1]);
    const outerGzipped = Buffer.from(outerDataB64, "base64");
    const outerJsonString = pako.ungzip(outerGzipped, { to: "string" });
    const outerPayload = JSON.parse(outerJsonString);

    expect(outerPayload.version).toBe(3);
    expect(outerPayload.batchId).toBe("MOCK-UUID-0000-0000-0000-000000000000");

    // 2. Decode inner layer
    const innerDataB64 = outerPayload.content;
    const innerGzipped = Buffer.from(innerDataB64, "base64");
    const innerJsonString = pako.ungzip(innerGzipped, { to: "string" });
    const innerPayload = JSON.parse(innerJsonString);

    // 3. Assert the final content
    expect(innerPayload.a).toHaveLength(2);
    const firstAccount = innerPayload.a[0];
    expect(firstAccount.oIN).toBe("TestIssuer");
    expect(firstAccount.oUN).toBe("test-account");
    expect(firstAccount.s).toBe("JBSWY3DPEHPK3PXP"); // Base32 of "Hello!"
    expect(firstAccount.a).toBe("SHA1");
    expect(firstAccount.d).toBe(6);
    expect(firstAccount.cT).toBe(1672531200000);
  });

  it("should throw an error if no compatible accounts are found for LastPass", async () => {
    const hotpOnly: MigrationOtpParameter[] = [
      {
        ...mockOtps[0],
        type: 1, // HOTP
      },
    ];

    await expect(exportToLastPass(hotpOnly)).rejects.toThrow(
      "No compatible (TOTP) accounts selected for LastPass export."
    );
  });
});
