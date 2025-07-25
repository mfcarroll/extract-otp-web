import { getState } from "../state/store";
import { OtpData } from "../types";
import { announceToScreenReader } from "../ui/notifications";
import { convertToOtpData } from "./otpFormatter";

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
