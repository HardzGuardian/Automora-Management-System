import type { employees } from "@/db/schema";

export type EmployeeDTO = {
  id: string;
  employeeCode: string;
  fullName: string;
  workEmail: string;
  phone: string | null;
  designation: string | null;
  department: string | null;
  joiningDate: string | null;
  profileImageFileId: string | null;
  employmentStatus: string;
  hasAccount: boolean;
  createdAt: Date;
};

export function toEmployeeDTO(row: typeof employees.$inferSelect): EmployeeDTO {
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    workEmail: row.workEmail,
    phone: row.phone,
    designation: row.designation,
    department: row.department,
    joiningDate: row.joiningDate,
    profileImageFileId: row.profileImageFileId,
    employmentStatus: row.employmentStatus,
    hasAccount: row.userId !== null,
    createdAt: row.createdAt,
  };
}
