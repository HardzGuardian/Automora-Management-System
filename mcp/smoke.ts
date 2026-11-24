/**
 * Smoke test: starts the MCP server as a child process, lists its tools and calls a few of them.
 *   AUTOMORA_MCP_USER_EMAIL=admin@e2e.test pnpm mcp:smoke
 * Add AUTOMORA_MCP_USER_EMAIL=employee@e2e.test to see permission limits in action.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    args: ["mcp"],
    env: { ...(process.env as Record<string, string>) },
    stderr: "inherit",
  });
  const client = new Client({ name: "smoke", version: "1.0.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(`tools (${tools.length}): ${tools.map((t) => t.name).join(", ")}`);

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
    const text = r.content[0]?.text ?? "";
    console.log(`\n# ${name} ${JSON.stringify(args)} ${r.isError ? "[ERROR]" : ""}\n${text.length > 600 ? `${text.slice(0, 600)}…` : text}`);
    return r;
  };

  await call("whoami");
  await call("list_tasks", { status: "Pending" });
  await call("list_projects");
  await call("dashboard_summary", { preset: "month" });
  await call("list_clients");
  await call("list_invoices");
  await call("run_report", { report: "task-register" });
  await call("get_task", { id: "00000000-0000-4000-8000-000000000000" });
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
