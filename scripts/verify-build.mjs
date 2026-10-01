import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vite", "build"], {
  encoding: "utf8",
  shell: false,
});

const log = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.status !== 0) {
  console.error("\nShip blocked: production build failed.");
  process.exit(result.status ?? 1);
}

const blockers = [
  /Some chunks are larger than/i,
  /chunk size warning/i,
  /circular chunk/i,
  /invalid chunk/i,
  /dynamic import will not move module into another chunk/i,
  /failed to (load|fetch) dynamically imported module/i,
  /loading chunk \S+ failed/i,
  /chunkloaderror/i,
];

const hit = blockers.find((pattern) => pattern.test(log));
if (hit) {
  console.error(
    "\nShip blocked: the production build printed a chunking notice or error.",
    "Large or broken chunks delay the live Firebase site.",
    "Split or lazy-load the heavy module, then re-run npm run verify.",
    "Do not raise chunkSizeWarningLimit to hide the notice.",
    "Do not push GitHub, Supabase, or Firebase until this is clean.",
  );
  process.exit(1);
}
