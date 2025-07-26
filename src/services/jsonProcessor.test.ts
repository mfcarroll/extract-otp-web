import { describe, it, expect } from "vitest";
import { processJson } from "./jsonProcessor";
import { encode } from "thirty-two";

const mockLastPassJson = `
{
  "version": 3,
  "deviceName": "Test iPhone",
  "folders": [],
  "accounts": [
    {
      "userName": "test@example.com",
      "issuerName": "TestService",
      "secret": "JBSWY3DPEHPK3PXP",
      "algorithm": "SHA1",
      "digits": 6,
      "timeStep": 30,
      "isFavorite": false
    },
    {
      "userName": "another-user",
      "issuerName": "AnotherService",
      "secret": "MFRGGZDFMZTWQ2LK",
      "algorithm": "SHA256",
      "digits": 8,
      "timeStep": 30,
      "isFavorite": true
    }
  ],
  "localDeviceId": null
}
`;

const mockOwnJsonExport = `
[
  {
    "name": "test@example.com",
    "secret": "JBSWY3DPEHPK3PXP",
    "issuer": "TestService",
    "type": "totp",
    "typeDescription": "Time-based (TOTP)",
    "counter": "",
    "url": "otpauth://totp/test%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=TestService"
  },
  {
    "name": "another-user",
    "secret": "MFRGGZDFMZTWQ2LK",
    "issuer": "AnotherService",
    "type": "totp",
    "typeDescription": "Time-based (TOTP)",
    "counter": "",
    "url": "otpauth://totp/another-user?secret=MFRGGZDFMZTWQ2LK&issuer=AnotherService&algorithm=SHA256&digits=8"
  }
]
`;

describe("JSON Processor", () => {
  describe("LastPass JSON File Import", () => {
    it("should correctly parse a valid LastPass JSON export file", async () => {
      const otpParameters = await processJson(mockLastPassJson);

      expect(otpParameters).toHaveLength(2);

      const firstOtp = otpParameters[0];
      expect(firstOtp.name).toBe("test@example.com");
      expect(firstOtp.issuer).toBe("TestService");
      expect(firstOtp.algorithm).toBe(1); // SHA1
      expect(firstOtp.digits).toBe(1); // 6 digits
      expect(firstOtp.type).toBe(2); // TOTP
      // Verify the secret was decoded correctly
      expect(encode(firstOtp.secret).toString()).toBe("JBSWY3DPEHPK3PXP");

      const secondOtp = otpParameters[1];
      expect(secondOtp.issuer).toBe("AnotherService");
      expect(secondOtp.algorithm).toBe(2); // SHA256
      expect(secondOtp.digits).toBe(2); // 8 digits
    });
  });

  describe("Own JSON File Import", () => {
    it("should correctly parse a valid self-exported JSON file", async () => {
      const otpParameters = await processJson(mockOwnJsonExport);
      expect(otpParameters).toHaveLength(2);
      expect(otpParameters[0].name).toBe("test@example.com");
      expect(otpParameters[1].issuer).toBe("AnotherService");
    });
  });

  describe("Error Handling", () => {
    it("should throw an error for an unsupported JSON structure", async () => {
      const unsupportedJson = `{"foo": "bar"}`;
      await expect(processJson(unsupportedJson)).rejects.toThrow(
        "Invalid JSON format: Expected an array of OTP accounts or a LastPass export object."
      );
    });
  });
});
