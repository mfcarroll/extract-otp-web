import { getState } from "../state/store";
import { OtpData } from "../types";
import { announceToScreenReader } from "../ui/notifications";
import { convertToOtpData } from "./otpFormatter";
import { triggerDownload } from "./download";

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
    announceToScreenReader("No data to export.");
    return;
  }

  const headers: (keyof OtpData)[] = [
    "name",
    "secret",
    "issuer",
    "type",
    "typeDescription",
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
  triggerDownload("otp_secrets.csv", csvString, "text/csv;charset=utf-8;");
}
