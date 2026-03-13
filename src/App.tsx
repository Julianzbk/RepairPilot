import { useState, useEffect } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Doc {
  id: number;
  title: string;
  score: number;
  passage: string;
  fullText: string;
}

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [hasStartedChat, setHasStartedChat] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(true);

  const uploadWords = ["Documents", "Manual", "Blueprint", "Guide"];
  const [uploadIndex, setUploadIndex] = useState(0);
  const [explainLevel, setExplainLevel] = useState("Beginner");

  useEffect(() => {
    const interval = setInterval(() => {
      setUploadIndex((prev) => (prev + 1) % uploadWords.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const theme = darkMode
    ? {
        bg: "bg-neutral-950",
        text: "text-neutral-100",
        border: "border-neutral-800",
        panel: "bg-neutral-900",
        bubbleUser: "bg-white text-black",
        bubbleAssistant: "bg-neutral-800 text-neutral-100",
        input: "bg-neutral-900 border-neutral-700 text-neutral-100",
        hover: "hover:bg-neutral-800"
      }
    : {
        bg: "bg-white",
        text: "text-black",
        border: "border-gray-200",
        panel: "bg-gray-50",
        bubbleUser: "bg-black text-white",
        bubbleAssistant: "bg-gray-200",
        input: "bg-white border-gray-300",
        hover: "hover:bg-gray-50"
      };

  const [docs] = useState<Doc[]>([
    { id: 1, title: "example_doc.pdf", score: 0.91, passage: "Reset the ECU by holding the ignition button for five seconds while the vehicle is powered off. The ECU will reinitialize and clear temporary fault states. After reset, cycle ignition once more before driving.", fullText: "Reset the ECU by holding the ignition button for five seconds while the vehicle is powered off. The ECU will reinitialize and clear temporary fault states. After reset, cycle ignition once more before driving. This procedure is useful when debugging intermittent electronic faults or sensor initialization errors." },
    { id: 2, title: "manual.txt", score: 0.86, passage: "The device enters pairing mode when the power button is held for three seconds. A blinking blue LED indicates that the system is broadcasting its pairing signal.", fullText: "The device enters pairing mode when the power button is held for three seconds. A blinking blue LED indicates that the system is broadcasting its pairing signal. If no device connects within 60 seconds the device exits pairing mode automatically." }
  ]);

  // API 接口
  const sendMessage = async () => {
    if (!input.trim()) return;

    if (!hasStartedChat) setHasStartedChat(true);

    const userPrompt = input;
    setInput("");

    // Immediately add the user message
    setMessages((prev) => [...prev, { role: "user", content: userPrompt }]);

    // Add a temporary assistant placeholder
    const tempId = Date.now();
    setMessages((prev) => [...prev, { role: "assistant", content: "Typing...", id: tempId } as any]);

    try {
      const formData = new FormData();
      formData.append("experience_level", "Explain it to me like I'm a " + explainLevel + ":\n");
      formData.append("prompt", userPrompt);

      uploadedFiles.forEach((file, idx) => {
        formData.append("file_" + idx, file);
      });

      const response = await fetch("/api/llm", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("LLM API error");

      const data = await response.json();
      // Expecting: { text: "LLM response here" }

      // Replace the temporary message with actual LLM response
      setMessages((prev) =>
        prev.map((m) => (m.role === "assistant" && (m as any).id === tempId ? { role: "assistant", content: data.text } : m))
      );
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.role === "assistant" && (m as any).id === tempId
            ? { role: "assistant", content: "Error: could not fetch LLM response." }
            : m
        )
      );
    }
  };

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setUploadedFiles(Array.from(e.target.files));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  if (!hasStartedChat) {
    return (
      <div className={`h-screen flex flex-col items-center justify-center gap-10 ${theme.bg} ${theme.text}`}>
        <div className="absolute top-4 right-4">
          <button onClick={() => setDarkMode(!darkMode)} className={`px-3 py-1 text-sm rounded border-2 ${theme.border} shadow-md font-medium backdrop-blur bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:scale-105 transition-transform`}>{darkMode ? "Light" : "Dark"}</button>
        </div>

        <div
          className={`text-5xl font-extrabold tracking-tight drop-shadow-lg ${
            darkMode
              ? "bg-[url('textures/metal-grunge.png')] bg-cover bg-center bg-clip-text text-transparent filter brightness-150"
              : "bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500 bg-clip-text text-transparent invert"
          }`}
        >
          RepairPilot
        </div>

        <label className="px-[20px] pr-[6px] py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white cursor-pointer font-semibold shadow-lg relative overflow-hidden flex justify-center items-center w-max">
            <span className="flex items-center">
              <span>Upload</span>
              <span className="relative h-6 w-28 flex items-center justify-center overflow-hidden ml-[-5px]">
                <span className="absolute top-0 animate-uploadScroll">
                  {uploadWords.map((w, i) => (
                    <div key={i} className="h-6 flex items-center justify-center">{w}</div>
                  ))}
                  {/* Repeat first word for smooth looping */}
                  <div className="h-6 flex items-center justify-center">{uploadWords[0]}</div>
                </span>
              </span>
            </span>
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.txt,.md,.doc,.docx"
              onChange={handleUpload}
            />
          </label>

        {uploadedFiles.length > 0 && <div className="text-sm opacity-70">{uploadedFiles.length} file(s) uploaded</div>}

        <div className="w-full max-w-2xl flex gap-3">
          <input className={`flex-1 border rounded-xl px-4 py-3 ${theme.input}`} value={input} placeholder="Ask a question about your products..." onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} />
          <button onClick={sendMessage} className="px-6 py-3 rounded-xl bg-blue-600 text-white">Ask</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-full flex flex-col ${theme.bg} ${theme.text}`}>
      <div className={`border-b p-4 flex items-center justify-between ${theme.border}`}>
        <div className="flex flex-col">
          <div className="text-xl font-semibold">RAG Chat</div>
          <div className="text-xs opacity-60">Product Name • Query Spec Placeholder</div>
        </div>

        <div className="flex items-center" style={{ gap: '20px' }}>
          <div className="flex items-center gap-2 text-sm">
            <span className="opacity-70">Explain it to me like I'm a...</span>
            <select value={explainLevel} onChange={(e) => setExplainLevel(e.target.value)} className={`px-2 py-1 rounded border ${theme.border} ${theme.panel}`}>
              <option>Beginner</option>
              <option>Adept</option>
              <option>Expert</option>
            </select>
          </div>

          <button onClick={() => setDarkMode(!darkMode)} className={`px-3 py-1 text-sm rounded border-2 ${theme.border} shadow-md font-medium backdrop-blur bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:scale-105 transition-transform`}>{darkMode ? "Light" : "Dark"}</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={`w-96 border-r overflow-y-auto p-4 space-y-4 ${theme.border} ${theme.panel}`}>
          <div className="font-semibold">Retrieved Documents</div>
          {docs.map((doc) => (
            <div key={doc.id} className={`border rounded-xl p-4 cursor-pointer ${theme.border} ${theme.hover}`} onClick={() => setActiveDoc(doc)}>
              <div className="font-medium">{doc.title}</div>
              <div className="text-xs opacity-60 mb-2">score: {doc.score}</div>
              <div className="text-sm whitespace-pre-wrap">{doc.passage}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col flex-1">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-xl p-3 rounded-2xl ${m.role === "user" ? `${theme.bubbleUser} ml-auto` : theme.bubbleAssistant}`}>{m.content}</div>
            ))}
          </div>

          <div className={`border-t p-4 flex gap-3 ${theme.border}`}>
            <input className={`flex-1 border rounded-xl px-4 py-2 ${theme.input}`} value={input} placeholder="Ask something..." onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} />
            <button onClick={sendMessage} className="px-4 py-2 rounded-xl bg-blue-600 text-white">Send</button>
          </div>
        </div>
      </div>

      {activeDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className={`w-3/4 h-3/4 rounded-2xl flex flex-col ${theme.panel}`}>
            <div className={`border-b p-4 flex justify-between items-center ${theme.border}`}>
              <div className="font-semibold">{activeDoc.title}</div>
              <button onClick={() => setActiveDoc(null)} className={`text-sm px-3 py-1 border rounded ${theme.border}`}>Close</button>
            </div>
            <div className="p-6 overflow-y-auto text-sm whitespace-pre-wrap">{activeDoc.fullText}</div>
          </div>
        </div>
      )}
    </div>
  );
}
