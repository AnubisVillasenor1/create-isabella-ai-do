// state: draft | engine-generated
export { handleNetlifyRequest as default } from "../../src/http/netlify-handler";

export const config = { path: "/*", preferStatic: true };
