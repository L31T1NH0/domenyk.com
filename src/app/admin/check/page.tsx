"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminCheck() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch("/admin/api/check", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          throw new Error("Failed to check admin status");
        }
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      } catch (error) {
        console.error("Error checking admin status:", error);
        setError("Failed to check admin status");
      } finally {
      }
    };

    checkAdminStatus();
  }, []);

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="flex justify-center items-center h-screen text-2xl font-bold">
      {isAdmin ? "Yes" : "No"}
    </div>
  );
}
