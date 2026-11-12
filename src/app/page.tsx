import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export default async function Page() {
  const filePath = path.join(process.cwd(), "public", "vvu-console.html");
  const html = await readFile(filePath, "utf8");

  // The routing script is already appended to the HTML file
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
