export type StaffUser = {
  id: number;
  name: string;
  role: "Admin" | "Staff";
  active: number;
  createdAt: string;
};

export async function loadCurrentStaff(api: any): Promise<StaffUser | null> {
  try {
    const user = await api.getCurrentStaff();
    return user ?? null;
  } catch {
    return null;
  }
}

export function isAdmin(user: StaffUser | null) {
  return user?.role === "Admin";
}

export function isStaffLoggedIn(user: StaffUser | null) {
  return !!user?.id;
}