declare const Deno: any;

declare module "https://*" {
  export const createClient: any;
  const value: any;
  export default value;
}
