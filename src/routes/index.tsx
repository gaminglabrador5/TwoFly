import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="flex h-screen flex-col bg-[#152228]">
      <a
        href="/TwoFly-windows.zip"
        download="TwoFly-windows.zip"
        className="flex items-center justify-between gap-4 px-4 py-3 text-sm tracking-wide text-[#eef3f0] no-underline"
        style={{ background: "#22343c", borderBottom: "1px solid #355058" }}
      >
        <span>
          <span className="font-semibold">TwoFly</span>
          <span className="ml-3 text-[#9eb0aa]">WINDOWS PACK · EXE + README</span>
        </span>
        <span
          className="rounded px-3 py-1.5 font-semibold tracking-widest"
          style={{ background: "#c45b4a", color: "#eef3f0" }}
        >
          DOWNLOAD
        </span>
      </a>
      <iframe
        title="TwoFly Dispatch"
        src="/twofly/index.html"
        className="block min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
