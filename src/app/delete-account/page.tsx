import type { Metadata } from "next";
import DeleteAccountClient from "./delete-account-client";

export const metadata: Metadata = {
  title: "Delete Account",
  robots: { index: false, follow: false },
};

export default function DeleteAccountPage() {
  return <DeleteAccountClient />;
}

