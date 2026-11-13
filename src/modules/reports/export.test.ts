import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { createTask } from "@/modules/tasks";
import { MANAGER_KEYS, workWorld } from "@/test/work";
import { exportFinanceReportResponse, exportReport } from "./export";
import { runReport } from "./reports";

const KEYS = [...MANAGER_KEYS, "reports.all.read", "reports.export", "employees.read", "employees.workload.read"] as never[];

const text = (r: Response) => r.text();

describe("exportReport", () => {
  it("returns a CSV with the report's header and the same rows as the on-screen report", async () => {
    const w = await workWorld(KEYS);
    await createTask(w.manager, { title: "Alpha", priority: "High" });
    await createTask(w.manager, { title: "Beta, with comma" });
    const res = await exportReport(w.manager, "task-register", "csv", {});
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="task-register-.*\.csv"/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await text(res);
    const lines = body.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Code,Title,Status,Priority,Due date,Overdue,Project,Client,Assignees,Completed on");
    expect(lines).toHaveLength(1 + (await runReport(w.manager, "task-register", {})).total);
    expect(body).toContain('"Beta, with comma"');
  });

  it("neutralises a formula-injection title end to end (CSV and XLSX)", async () => {
    const w = await workWorld(KEYS);
    await createTask(w.manager, { title: '=HYPERLINK("http://evil","click")' });
    const csv = await text(await exportReport(w.manager, "task-register", "csv", {}));
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""click"")"`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await (await exportReport(w.manager, "task-register", "xlsx", {})).arrayBuffer()) as never);
    const cell = wb.worksheets[0].getRow(2).getCell(2);
    expect(cell.value).toBe(`'=HYPERLINK("http://evil","click")`);
    expect(cell.formula).toBeUndefined();
  });

  it("applies the same filters and scope as the report", async () => {
    const w = await workWorld(KEYS);
    const e = await w.employee(["reports.personal.read", "reports.export", "tasks.status.update.own"] as never[]);
    await createTask(w.manager, { title: "Mine", assigneeIds: [e.employeeId], priority: "Urgent" });
    await createTask(w.manager, { title: "Not mine", priority: "Urgent" });
    const mine = await text(await exportReport(e.actor, "task-register", "csv", {}));
    expect(mine).toContain("Mine");
    expect(mine).not.toContain("Not mine");
    const filtered = await text(await exportReport(w.manager, "task-register", "csv", { priority: ["Low"] }));
    expect(filtered.trim().split("\r\n")).toHaveLength(1);
  });

  it("requires reports.export and access to the report", async () => {
    const w = await workWorld([...MANAGER_KEYS, "reports.all.read"] as never[]);
    await expect(exportReport(w.manager, "task-register", "csv", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    const noReport = await workWorld([...MANAGER_KEYS, "reports.export"] as never[]);
    await expect(exportReport(noReport.manager, "task-register", "csv", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    const e = await w.employee(["reports.personal.read", "reports.export"] as never[]);
    await expect(exportReport(e.actor, "employee-workload", "csv", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unknown formats and invalid ranges", async () => {
    const w = await workWorld(KEYS);
    await expect(exportReport(w.manager, "task-register", "docx" as never, {})).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(exportReport(w.manager, "employee-workload", "csv", { preset: "custom", from: "2026-05-01", to: "2026-01-01" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("produces a PDF", async () => {
    const w = await workWorld(KEYS);
    await createTask(w.manager, { title: "For the PDF" });
    const res = await exportReport(w.manager, "task-register", "pdf", {});
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("audits every export with report, format and filters", async () => {
    const w = await workWorld(KEYS);
    await text(await exportReport(w.manager, "task-register", "csv", { priority: ["High"] }));
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.companyId, w.company.id));
    const log = logs.find((l) => l.action === "report.exported");
    expect(log).toBeDefined();
    expect(log!.after).toMatchObject({ report: "task-register", format: "csv", filters: { priority: ["High"] } });
  });
});

describe("finance report export (Chintan's service on our export library)", () => {
  it("streams a CSV for permitted users and refuses others", async () => {
    const w = await workWorld([...KEYS, "finance.reports.read", "finance.reports.export"] as never[]);
    const res = await exportFinanceReportResponse(w.manager, { report: "summary", format: "csv", fromDate: "2026-01-01", toDate: "2026-12-31" });
    expect(res.headers.get("content-type")).toContain("text/csv");
    await res.text();
    const none = await workWorld(KEYS);
    await expect(exportFinanceReportResponse(none.manager, { report: "summary", format: "csv", fromDate: "2026-01-01", toDate: "2026-12-31" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
