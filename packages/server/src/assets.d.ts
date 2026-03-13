// YAML/텍스트 파일을 `with { type: "text" }` import assertion으로 가져올 때 타입 선언
declare module "*.yml" {
  const content: string;
  export default content;
}
