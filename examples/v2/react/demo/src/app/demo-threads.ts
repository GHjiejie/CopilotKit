export const SELECTED_THREAD_KEY = "copilotkit-demo:selected-thread";

export interface DemoThread {
  id: string;
  label: string;
}

export function resolveDemoThread(
  savedThreadId: string | null,
  threads: DemoThread[],
  createId: () => string,
): string {
  return savedThreadId?.trim() || threads[0]?.id || createId();
}

/** Load history without running the agent or generating the UI again. */
export async function loadDemoThreads(
  runtimeUrl: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<DemoThread[]> {
  const response = await fetcher(`${runtimeUrl}/threads?agentId=default`, {
    signal,
  });
  if (!response.ok) throw new Error("Unable to load conversation history");
  const { threads } = (await response.json()) as {
    threads: { id: string; name?: string | null; updatedAt: string }[];
  };

  return Promise.all(
    threads.slice(0, 20).map(async (thread) => {
      let title = thread.name;
      if (!title) {
        try {
          const messagesResponse = await fetcher(
            `${runtimeUrl}/threads/${encodeURIComponent(thread.id)}/messages?agentId=default`,
            { signal },
          );
          if (messagesResponse.ok) {
            const { messages } = (await messagesResponse.json()) as {
              messages: { role: string; content?: unknown }[];
            };
            const prompt = messages.find((message) => message.role === "user");
            if (typeof prompt?.content === "string") title = prompt.content;
          }
        } catch (error) {
          if (signal.aborted) throw error;
          // A missing title should not prevent restoring the thread's events.
        }
      }
      const date = new Date(thread.updatedAt).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const summary = (title || thread.id.slice(0, 8))
        .replace(/\s+/g, " ")
        .slice(0, 50);
      return { id: thread.id, label: `${date} · ${summary}` };
    }),
  );
}
