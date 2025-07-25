import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { getOtpParametersFromUrl } from "../src/services/qrProcessor";
import { convertToOtpData } from "../src/services/otpFormatter";
import { OtpData } from "../src/types";

// Load the expected results from the ported JSON file.
const expectedResults: OtpData[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/example_output.json"), "utf-8")
).map((otp: any) => ({
  ...otp,
  // The TS type uses "" for counter, while the python output uses null.
  counter: otp.counter ?? "",
}));

// Load the migration URLs from the ported text file.
const migrationUrls = fs
  .readFileSync(path.join(__dirname, "data/example_export.txt"), "utf-8")
  .split("\n")
  .filter((line) => line.startsWith("otpauth-migration://"));

describe("QR Processor and Formatter", () => {
  it("should correctly parse a single-account migration URL", async () => {
    // Test Case 1: First URL from the file
    const url = migrationUrls[0];
    const expected = expectedResults[0];

    const otpParams = await getOtpParametersFromUrl(url);
    expect(otpParams).toHaveLength(1);

    const formattedData = convertToOtpData(otpParams[0]);

    expect(formattedData.name).toBe(expected.name);
    expect(formattedData.issuer).toBe(expected.issuer);
    expect(formattedData.secret).toBe(expected.secret);
    expect(formattedData.type).toBe("totp");
    expect(formattedData.url).toBe(expected.url);
  });

  it("should correctly parse a multi-account migration URL", async () => {
    // Test Case 2: The third URL contains two accounts
    const url = migrationUrls[2];
    const expected1 = expectedResults[2];
    const expected2 = expectedResults[3];

    const otpParams = await getOtpParametersFromUrl(url);
    expect(otpParams).toHaveLength(2);

    const formattedData1 = convertToOtpData(otpParams[0]);
    const formattedData2 = convertToOtpData(otpParams[1]);

    // Check first account
    expect(formattedData1.name).toBe(expected1.name);
    expect(formattedData1.issuer).toBe(expected1.issuer); // ""
    expect(formattedData1.secret).toBe(expected1.secret);
    expect(formattedData1.url).toBe(expected1.url);

    // Check second account
    expect(formattedData2.name).toBe(expected2.name);
    expect(formattedData2.issuer).toBe(expected2.issuer);
    expect(formattedData2.secret).toBe(expected2.secret);
    expect(formattedData2.url).toBe(expected2.url);
  });

  it("should correctly parse an HOTP account", async () => {
    const url = migrationUrls[3]; // HOTP entry
    const expected = expectedResults[4];

    const otpParams = await getOtpParametersFromUrl(url);
    expect(otpParams).toHaveLength(1);

    const formattedData = convertToOtpData(otpParams[0]);
    expect(formattedData.type).toBe("hotp");
    expect(formattedData.counter).toBe(expected.counter);
    expect(formattedData.url).toBe(expected.url);
  });
});

describe("Error Handling and Edge Cases in qrProcessor", () => {
  it("should throw an error for a URL with invalid base64 data", async () => {
    // This URL is from the python project's `test_export_wrong_data.txt`
    const invalidUrl = fs
      .readFileSync(
        path.join(__dirname, "data/test_export_wrong_data.txt"),
        "utf-8"
      )
      .trim();
    // The `atob` function inside `getOtpParametersFromUrl` should fail.
    // We assert that the promise is rejected with any error.
    await expect(getOtpParametersFromUrl(invalidUrl)).rejects.toThrow();
  });

  it("should throw an error for a URL missing the 'data' parameter", async () => {
    const urlWithoutData = "otpauth-migration://offline?foo=bar";

    // We assert that the promise is rejected with the specific error message
    // thrown by our function.
    await expect(getOtpParametersFromUrl(urlWithoutData)).rejects.toThrow(
      'Invalid OTP URL: Missing "data" parameter.'
    );
  });

  it("should throw an error for input that is not a valid URL", async () => {
    const notAUrl = fs
      .readFileSync(
        path.join(__dirname, "data/test_export_wrong_content.txt"),
        "utf-8"
      )
      .trim();

    // The `new URL()` constructor in getOtpParametersFromUrl should fail.
    await expect(getOtpParametersFromUrl(notAUrl)).rejects.toThrow();
  });

  it("should correctly parse a URL with space characters in the data parameter", async () => {
    // This file contains a real-world URL where the base64 `+` was replaced by a space.
    // Our code explicitly handles this by replacing spaces back to `+`.
    const urlWithSpaces = fs
      .readFileSync(
        path.join(__dirname, "data/test_plus_problem_export.txt"),
        "utf-8"
      )
      .trim();

    const otpParams = await getOtpParametersFromUrl(urlWithSpaces);
    expect(otpParams).toHaveLength(4);

    const formattedData = convertToOtpData(otpParams[0]);
    expect(formattedData.name).toBe("SerenityLabs:test1@serenitylabs.co.uk");
    expect(formattedData.secret).toBe("A4RFDYMF4GSLUIBQV4ZP67OJEZ2XUQVM");
  });

  it("should throw an error for a URL with an invalid prefix", async () => {
    const urlWithPrefix = fs
      .readFileSync(
        path.join(__dirname, "data/test_export_wrong_prefix.txt"),
        "utf-8"
      )
      .trim();

    // The `new URL()` constructor should fail on the "QR-Code:otpauth-migration..." string
    await expect(getOtpParametersFromUrl(urlWithPrefix)).rejects.toThrow();
  });
});
