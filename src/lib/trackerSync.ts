import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { TRACKER_SYNC_TABLES, type TrackerSyncTable } from "./mcpBridge";

export const REALTIME_SUBSCRIBE_TIMEOUT_MS = 4_000;
export const REST_POLL_INTERVAL_MS = 6_000;
export const REALTIME_REFRESH_DEBOUNCE_MS = 200;

export type TrackerSyncTransport = "realtime" | "rest" | "disconnected";
export type RealtimeSubscribeStatus = "SUBSCRIBED" | "TIMED_OUT" | "CHANNEL_ERROR" | "CLOSED";
export type TrackerRefreshReason = "realtime" | "rest";

export const trackerSyncEvents = new EventTarget();

export function emitTrackerTableChange(table: TrackerSyncTable | "*") {
  trackerSyncEvents.dispatchEvent(new CustomEvent("change", { detail: { table } }));
}

type TimerFn = (handler: () => void, ms: number) => unknown;
type IntervalFn = (handler: () => void, ms: number) => unknown;

export function subscribeTrackerRealtime(
  sb: SupabaseClient,
  handlers: {
    onTable: (table: TrackerSyncTable) => void;
    onStatus: (status: RealtimeSubscribeStatus) => void;
  },
): () => void {
  let channel: RealtimeChannel = sb.channel("rrt-tracker-sync");
  for (const table of TRACKER_SYNC_TABLES) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => handlers.onTable(table),
    );
  }
  channel.subscribe((status) => {
    if (
      status === "SUBSCRIBED" ||
      status === "TIMED_OUT" ||
      status === "CHANNEL_ERROR" ||
      status === "CLOSED"
    ) {
      handlers.onStatus(status);
    }
  });
  return () => {
    void sb.removeChannel(channel);
  };
}

export function createTrackerSync(options: {
  subscribeRealtime: (
    onTable: (table: TrackerSyncTable) => void,
    onStatus: (status: RealtimeSubscribeStatus) => void,
  ) => () => void;
  fetchFallback: () => Promise<{ ok: boolean }>;
  onRefresh: (reason: TrackerRefreshReason) => void;
  subscribeTimeoutMs?: number;
  pollIntervalMs?: number;
  debounceMs?: number;
  setTimeoutFn?: TimerFn;
  clearTimeoutFn?: (id: unknown) => void;
  setIntervalFn?: IntervalFn;
  clearIntervalFn?: (id: unknown) => void;
}) {
  const subscribeTimeoutMs = options.subscribeTimeoutMs ?? REALTIME_SUBSCRIBE_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? REST_POLL_INTERVAL_MS;
  const debounceMs = options.debounceMs ?? REALTIME_REFRESH_DEBOUNCE_MS;
  const setTimeoutFn: TimerFn = options.setTimeoutFn ?? ((handler, ms) => setTimeout(handler, ms));
  const clearTimeoutFn = options.clearTimeoutFn ?? ((id: unknown) => {
    clearTimeout(id as number);
  });
  const setIntervalFn: IntervalFn = options.setIntervalFn ?? ((handler, ms) => setInterval(handler, ms));
  const clearIntervalFn = options.clearIntervalFn ?? ((id: unknown) => {
    clearInterval(id as number);
  });

  let transport: TrackerSyncTransport = "disconnected";
  let stopped = false;
  let debounceTimer: unknown = null;
  let subscribeTimer: unknown = null;
  let pollTimer: unknown = null;
  let pollInflight = false;

  const refresh = (reason: TrackerRefreshReason, table: TrackerSyncTable | "*" = "*") => {
    if (stopped) return;
    emitTrackerTableChange(table);
    options.onRefresh(reason);
  };

  const stopPoll = () => {
    if (pollTimer != null) {
      clearIntervalFn(pollTimer);
      pollTimer = null;
    }
  };

  const runFallback = async () => {
    if (stopped || pollInflight) return;
    pollInflight = true;
    try {
      const result = await options.fetchFallback();
      if (result.ok) refresh("rest");
    } finally {
      pollInflight = false;
    }
  };

  const startPoll = () => {
    if (stopped || pollTimer != null) return;
    transport = "rest";
    void runFallback();
    pollTimer = setIntervalFn(() => {
      void runFallback();
    }, pollIntervalMs);
  };

  const unsubscribe = options.subscribeRealtime(
    (table) => {
      if (stopped) return;
      if (debounceTimer != null) clearTimeoutFn(debounceTimer);
      debounceTimer = setTimeoutFn(() => {
        debounceTimer = null;
        refresh("realtime", table);
      }, debounceMs);
    },
    (status) => {
      if (stopped) return;
      if (status === "SUBSCRIBED") {
        if (subscribeTimer != null) {
          clearTimeoutFn(subscribeTimer);
          subscribeTimer = null;
        }
        stopPoll();
        transport = "realtime";
        return;
      }
      if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
        startPoll();
      }
    },
  );

  subscribeTimer = setTimeoutFn(() => {
    subscribeTimer = null;
    if (transport !== "realtime") startPoll();
  }, subscribeTimeoutMs);

  return {
    stop() {
      stopped = true;
      transport = "disconnected";
      if (debounceTimer != null) clearTimeoutFn(debounceTimer);
      if (subscribeTimer != null) clearTimeoutFn(subscribeTimer);
      stopPoll();
      unsubscribe();
    },
    transport() {
      return transport;
    },
  };
}
