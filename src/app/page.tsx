import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SignInPage from "./sign-in/page";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }
  return <SignInPage />;
}

