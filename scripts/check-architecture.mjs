import { verifyArchitecture } from "./verify/architecture.mjs";

const result = await verifyArchitecture();
console.log(
  `Rust Pudding architecture: ${result.projects} projects across ${result.workspaces} workspaces; ` +
  `${result.files} source-controlled inputs inspected.`,
);
