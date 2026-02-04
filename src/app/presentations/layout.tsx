import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createPgPool } from "@/db/pgClient";
import { requireEnv } from "@/config/env";
import { getSessionByToken } from "@/auth/session";

export default async function PresentationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) {
    redirect("/login");
  }

  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    const session = await getSessionByToken(pool, token);
    if (!session) {
      redirect("/login");
    }
  } finally {
    await pool.end();
  }

  return <>{children}</>;
}
