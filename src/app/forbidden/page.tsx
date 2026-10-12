import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3">
      <h1 className="text-3xl font-bold">No access</h1>
      <p className="text-muted">Your role does not include this area.</p>
      <Link className="underline" href="/">Go back</Link>
    </main>
  );
}
