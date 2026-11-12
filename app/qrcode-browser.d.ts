declare module "qrcode/lib/browser" {
  import type * as QRCode from "qrcode";
  const browser: Pick<typeof QRCode, "toDataURL">;
  export default browser;
}
