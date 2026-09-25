import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <iframe
      title="TwoFly Dispatch"
      src="/twofly/index.html"
      className="block h-screen w-full border-0 bg-[#152228]"
    />
  );
}