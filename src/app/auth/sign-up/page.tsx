import { redirect } from "next/navigation";

export const metadata = {
  title: "Create account",
  description: "Create your Repair Series account with your mobile number.",
};

export default function SignUpPage() {
  redirect("/auth");
}
