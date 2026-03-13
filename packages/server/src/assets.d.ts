// Type declarations for YAML/text files imported with `with { type: "text" }` import assertions
declare module "*.yml" {
  const content: string;
  export default content;
}
