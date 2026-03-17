// src/components/AiChatWidget.tsx
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const q = input.trim();
    if (!q || loading) return;

    setInput("");
    setRateLimitMsg(null);
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? "";

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ question: q }),
        }
      );

      if (resp.status === 429) {
        setRateLimitMsg("You've reached the limit (20 queries/hour). Please try again later.");
        return;
      }

      if (!resp.ok) {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
        return;
      }

      const data = await resp.json();
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: data.answer ?? "No response received." },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Network error. Please check your connection." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        aria-label="Ask AI"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg hover:bg-primary/90 transition-colors"
      >
        <Bot className="h-5 w-5 text-primary-foreground" />
      </button>

      {/* Slide-up panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="w-full h-[500px] flex flex-col p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4" />
              Pharmacy AI Assistant
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 px-4 py-3">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground mt-8 space-y-2">
                <Bot className="h-8 w-8 mx-auto opacity-30" />
                <p>Ask me anything about your pharmacy data.</p>
                <p className="text-xs">
                  Examples: "Which drugs are critically low?" or "How many requests are pending?"
                </p>
              </div>
            )}
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
            </div>
            <div ref={bottomRef} />
          </ScrollArea>

          <div className="border-t px-4 py-3 space-y-2">
            {rateLimitMsg && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                {rateLimitMsg}
              </p>
            )}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value.slice(0, 500))}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                className="resize-none min-h-[60px] text-sm"
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="h-auto self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-right text-xs text-muted-foreground">
              {input.length} / 500
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
