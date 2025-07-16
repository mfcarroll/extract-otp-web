export interface OtpData {
  name: string;
  secret: string;
  issuer: string;
  type: string;
  counter: number | '';
  url: string;
}