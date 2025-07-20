import { encode } from "thirty-two";
import { getState } from "../state/store";
import { OtpData, MigrationOtpParameter } from "../types";

function convertToOtpData(otp: MigrationOtpParameter): OtpData {
  const secretText = encode(otp.secret);
  const accountName = otp.name || "N/A";
  const typeText = otp.type === 2 ? "totp" : "hotp";

  let label = accountName;
  if (otp.issuer) {
    label = `${otp.issuer}:${accountName}`;
  }
  const encodedLabel = encodeURIComponent(label);

  let otpAuthUrl = `otpauth://${typeText}/${encodedLabel}?secret=${secretText}`;
  if (otp.issuer) {
    otpAuthUrl += `&issuer=${encodeURIComponent(otp.issuer)}`;
  }
  if (typeText === "hotp") {
    otpAuthUrl += `&counter=${otp.counter || 0}`;
  }

  return {
    name: accountName,
    secret: secretText,
    issuer: otp.issuer || "",
    type: typeText,
    counter: typeText === "hotp" ? otp.counter || 0 : "",
    url: decodeURIComponent(otpAuthUrl),
  };
}

const escapeCsvField = (field: any): string => {
  const str = String(field ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export function downloadAsCsv(): void {
  const { otps } = getState();
  if (otps.length === 0) {
    alert("No data to export.");
    return;
  }

  const headers: (keyof OtpData)[] = [
    "name",
    "secret",
    "issuer",
    "type",
    "counter",
    "url",
  ];

  const otpDataForCsv = otps.map(convertToOtpData);
  const csvRows = [
    headers.join(","),
    ...otpDataForCsv.map((otp) =>
      headers.map((header) => escapeCsvField(otp[header])).join(",")
    ),
  ];

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "otp_secrets.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}