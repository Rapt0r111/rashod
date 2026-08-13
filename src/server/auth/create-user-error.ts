export function mapCreateUserFailure(error: unknown): never {
  if (error instanceof Error && error.message === "ROLE_NOT_FOUND") throw error;
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code === "23505") throw new Error("USERNAME_EXISTS");
  throw error;
}
