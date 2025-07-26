declare module "thirty-two" {
  export function encode(secret: Uint8Array): string;
  export function decode(secret: string): Buffer;
}
