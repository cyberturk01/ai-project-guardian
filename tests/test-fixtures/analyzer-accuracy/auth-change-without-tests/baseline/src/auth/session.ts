export function canAccessSession(userRole: string): boolean {
  return userRole === "admin";
}
