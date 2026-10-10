import { describe, expect, it, vi } from "vitest";
import { loadDemoThreads, resolveDemoThread } from "../app/demo-threads";

describe("demo conversation recovery", () => {
  it("keeps the selected thread on refresh instead of creating a new one", () => {
    const createId = vi.fn(() => "new-thread");
    expect(
      resolveDemoThread(
        "selected-thread",
        [{ id: "latest", label: "Latest" }],
        createId,
      ),
    ).toBe("selected-thread");
    expect(createId).not.toHaveBeenCalled();
  });

  it("recovers an existing stateless conversation on the first visit", () => {
    expect(
      resolveDemoThread(
        null,
        [{ id: "old-generated-ui", label: "Dashboard" }],
        () => "new",
      ),
    ).toBe("old-generated-ui");
  });

  it("creates a thread only when neither a selection nor history exists", () => {
    expect(resolveDemoThread("  ", [], () => "first-thread")).toBe(
      "first-thread",
    );
  });

  it("labels restored threads using the original prompt without calling the agent", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          threads: [
            {
              id: "sales-dashboard",
              name: null,
              updatedAt: "2026-10-10T08:37:00Z",
            },
            {
              id: "unavailable-title",
              name: null,
              updatedAt: "2026-10-10T08:20:00Z",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          messages: [
            { role: "user", content: "生成一个销售看板\n使用模拟数据" },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const threads = await loadDemoThreads(
      "/api/copilotkit",
      new AbortController().signal,
      fetcher,
    );
    expect(threads[0].id).toBe("sales-dashboard");
    expect(threads[0].label).toContain("生成一个销售看板 使用模拟数据");
    expect(threads[1].id).toBe("unavailable-title");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/copilotkit/threads?agentId=default",
      "/api/copilotkit/threads/sales-dashboard/messages?agentId=default",
      "/api/copilotkit/threads/unavailable-title/messages?agentId=default",
    ]);
  });

  it("reports a history failure instead of treating it as an empty history", async () => {
    await expect(
      loadDemoThreads(
        "/api/copilotkit",
        new AbortController().signal,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(null, { status: 503 })),
      ),
    ).rejects.toThrow("Unable to load conversation history");
  });
});
