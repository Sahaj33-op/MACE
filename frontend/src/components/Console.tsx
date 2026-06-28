import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { Terminal, Send, Power, ChevronDown, ChevronUp } from "lucide-react";
import {
  subscribeConsole,
  unsubscribeConsole,
  onConsoleLog,
  offConsoleLog,
  sendCommand
} from "../ipc/serverAPI";

interface ConsoleProps {
  serverId: string;
  serverName: string;
}

function getMessageBody(line: string): string {
  const prefixRegex = /^\[\d{2}:\d{2}:\d{2}\]?(?:\s+\[[^\]]+\])?:\s*/;
  return line.replace(prefixRegex, "");
}

function parseAnsi(text: string): React.ReactNode {
  const ansiRegex = /[\u001b\x1b]\[([0-9;]*)m/g;
  if (!ansiRegex.test(text)) {
    return null;
  }
  ansiRegex.lastIndex = 0;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let currentFG = "";
  let currentBG = "";
  let currentBold = false;

  const colorMap: Record<string, string> = {
    "30": "#000000",
    "31": "#ff5555",
    "32": "#55ff55",
    "33": "#ffff55",
    "34": "#5555ff",
    "35": "#ff55ff",
    "36": "#55ffff",
    "37": "#ffffff",
    "90": "#555555",
    "91": "#ff5555",
    "92": "#55ff55",
    "93": "#ffff55",
    "94": "#5555ff",
    "95": "#ff55ff",
    "96": "#55ffff",
    "97": "#ffffff",
  };

  const bgMap: Record<string, string> = {
    "40": "#000000",
    "41": "#aa0000",
    "42": "#00aa00",
    "43": "#aaaa00",
    "44": "#0000aa",
    "45": "#aa00aa",
    "46": "#00aaaa",
    "47": "#aaaaaa",
  };

  let match;
  let keyCounter = 0;
  while ((match = ansiRegex.exec(text)) !== null) {
    const prevText = text.substring(lastIndex, match.index);
    if (prevText) {
      parts.push(
        <span
          key={keyCounter++}
          style={{
            color: currentFG || undefined,
            backgroundColor: currentBG || undefined,
            fontWeight: currentBold ? "bold" : undefined,
          }}
        >
          {prevText}
        </span>
      );
    }

    const codes = match[1].split(";");
    for (const code of codes) {
      if (code === "0" || code === "") {
        currentFG = "";
        currentBG = "";
        currentBold = false;
      } else if (code === "1") {
        currentBold = true;
      } else if (colorMap[code]) {
        currentFG = colorMap[code];
      } else if (bgMap[code]) {
        currentBG = bgMap[code];
      }
    }
    lastIndex = ansiRegex.lastIndex;
  }

  const remainingText = text.substring(lastIndex);
  if (remainingText) {
    parts.push(
      <span
        key={keyCounter++}
        style={{
          color: currentFG || undefined,
          backgroundColor: currentBG || undefined,
          fontWeight: currentBold ? "bold" : undefined,
        }}
      >
        {remainingText}
      </span>
    );
  }
  return <>{parts}</>;
}

interface LogLine {
  text: string;
  count: number;
}

export default function Console({ serverId, serverName }: ConsoleProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [command, setCommand] = useState("");
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem("mace-console-collapsed") === "true");

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("mace-console-collapsed", String(next));
      return next;
    });
  };
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const scrollToBottom = useCallback((force = false) => {
    setTimeout(() => {
      if (terminalBodyRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = terminalBodyRef.current;
        if (force || scrollHeight - scrollTop - clientHeight < 100) {
          terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }, 50);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setLogs([]);
    setWsStatus("connecting");

    subscribeConsole(serverId)
      .then(() => {
        if (!mountedRef.current) return;
        setWsStatus("connected");
        setLogs((prev) => [...prev, { text: "[MACE] Console stream connected.", count: 1 }]);
        scrollToBottom(true);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setWsStatus("disconnected");
        setLogs((prev) => [...prev, { text: `[MACE] Failed to connect stream: ${err}`, count: 1 }]);
      });

    const unsubscribeFn = onConsoleLog(serverId, (line: string) => {
      if (!mountedRef.current) return;
      setLogs((prev) => {
        if (prev.length > 0 && getMessageBody(prev[prev.length - 1].text) === getMessageBody(line)) {
          const last = prev[prev.length - 1];
          const updated = [...prev.slice(0, -1), { text: line, count: last.count + 1 }];
          return updated;
        } else {
          const updated = [...prev, { text: line, count: 1 }];
          return updated.length > 1000 ? updated.slice(updated.length - 1000) : updated;
        }
      });
      scrollToBottom();
    });

    return () => {
      mountedRef.current = false;
      unsubscribeFn();
      offConsoleLog(serverId);
      unsubscribeConsole(serverId).catch(() => {});
    };
  }, [serverId, scrollToBottom]);

  const handleSendCommand = async (e: FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    if (wsStatus === "connected") {
      const cmdToSend = command;
      setCommand("");
      setLogs((prev) => [...prev, { text: `> ${cmdToSend}`, count: 1 }]);
      scrollToBottom(true);
      try {
        await sendCommand(serverId, cmdToSend);
      } catch (err: any) {
        setLogs((prev) => [...prev, { text: `[MACE] Failed to execute: ${err.message || err}`, count: 1 }]);
        scrollToBottom(true);
      }
    } else {
      setLogs((prev) => [...prev, { text: "[MACE] Cannot send — console is not connected.", count: 1 }]);
      scrollToBottom(true);
    }
  };

  const getStatusColor = () => {
    if (wsStatus === "connected") return "var(--success-color)";
    if (wsStatus === "connecting") return "var(--warning-color)";
    return "var(--error-color)";
  };

  const formatLogLine = (line: string) => {
    if (line.startsWith("> "))
      return <span style={{ color: "var(--btn-primary-inner-color)", fontWeight: 600 }}>{line}</span>;
    if (line.startsWith("[MACE]"))
      return <span style={{ color: "#818cf8", fontWeight: 600 }}>{line}</span>;

    const ansiParsed = parseAnsi(line);
    if (ansiParsed !== null) {
      return ansiParsed;
    }

    const errMatch = line.includes("ERROR") || line.includes("FATAL");
    const warnMatch = line.includes("WARN") || line.includes("WARNING");
    const doneMatch = line.includes("Done") || line.includes("started");
    const infoMatch = line.includes("INFO");

    if (errMatch) return <span style={{ color: "var(--error-color)" }}>{line}</span>;
    if (warnMatch) return <span style={{ color: "var(--warning-color)" }}>{line}</span>;
    if (doneMatch) return <span style={{ color: "var(--success-color)" }}>{line}</span>;
    if (infoMatch) return <span style={{ color: "#e5e7eb" }}>{line}</span>;
    return <span>{line}</span>;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: isCollapsed ? "auto" : "500px",
        background: "#0a0c0a",
        border: "3px solid var(--hr-top-color)",
        overflow: "hidden",
      }}
    >
      {/* Terminal Header */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        aria-label={`${serverName} Terminal Toggle`}
        style={{
          width: "100%",
          padding: "0.75rem 1.25rem",
          background: "var(--primary-color)",
          border: "none",
          borderBottom: isCollapsed ? "none" : "3px solid var(--hr-top-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
          color: "inherit",
          fontFamily: "inherit",
          fontSize: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Terminal size={16} style={{ color: "var(--btn-primary-inner-color)" }} />
          <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{serverName} Terminal</span>
          {isCollapsed ? <ChevronDown size={16} style={{ color: "var(--accent-color)" }} /> : <ChevronUp size={16} style={{ color: "var(--accent-color)" }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", background: getStatusColor() }} />
          <span style={{ fontSize: "0.75rem", color: "var(--accent-color)", textTransform: "capitalize" }}>
            {wsStatus}
          </span>
        </div>
      </button>

      {!isCollapsed && (
        <>
          {/* Log output */}
          <div
            ref={terminalBodyRef}
            style={{
              flex: 1,
              padding: "1rem 1.25rem",
              overflowY: "auto",
              fontFamily: "MinecraftRegular, monospace",
              fontSize: "0.82rem",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              lineHeight: "1.6",
              wordBreak: "break-all",
              background: "#0d100d",
            }}
          >
            {logs.length === 0 ? (
              <div style={{ margin: "auto", color: "var(--accent-color)", textAlign: "center" }}>
                <Power size={32} style={{ marginBottom: "0.5rem", opacity: 0.3 }} />
                <p>Console is inactive.</p>
                <p style={{ fontSize: "0.75rem" }}>Start the Minecraft server to capture logs.</p>
              </div>
            ) : (
              logs.map((line, idx) => (
                <div key={idx} style={{ minHeight: "18px", display: "flex", alignItems: "flex-start", gap: "0.5rem", justifyContent: "space-between", width: "100%" }}>
                  <div style={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}>{formatLogLine(line.text)}</div>
                  {line.count > 1 && (
                    <span
                      style={{
                        background: "var(--accent-color)",
                        color: "var(--primary-color)",
                        padding: "1px 6px",
                        fontSize: "0.7rem",
                        fontWeight: "bold",
                        borderRadius: "4px",
                        userSelect: "none",
                        flexShrink: 0,
                      }}
                    >
                      x{line.count}
                    </span>
                  )}
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Command input */}
          <form
            onSubmit={handleSendCommand}
            style={{
              padding: "0.5rem",
              background: "var(--primary-color)",
              borderTop: "3px solid var(--hr-top-color)",
              display: "flex",
              gap: "0.5rem",
            }}
          >
            <input
              className="form-input"
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={wsStatus !== "connected"}
              placeholder={
                wsStatus === "connected"
                  ? "Type a command (e.g. op name, say Hello, stop)..."
                  : wsStatus === "connecting"
                  ? "Connecting to server console..."
                  : "Terminal connection unavailable."
              }
              style={{ flex: 1, height: "36px", fontSize: "0.82rem" }}
            />
            <button
              type="submit"
              disabled={wsStatus !== "connected" || !command.trim()}
              className="button-primary"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.4rem 0.9rem",
                margin: 0,
                opacity: wsStatus === "connected" && command.trim() ? 1 : 0.5,
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
