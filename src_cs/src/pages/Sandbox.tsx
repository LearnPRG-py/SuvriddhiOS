import { useEffect, useState, useRef } from "react";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/theme-tomorrow_night_eighties";
import { ChevronLeft, ChevronRight, Home } from "lucide-preact";
import { Link } from "preact-router/match";

export default function Sandbox() {
    const starterCode = "print('Hello, World!')\n";

    const [code, setCode] = useState(starterCode);
    const [output, setOutput] = useState("");
    const [status, setStatus] = useState("Idle");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [currentFile, setCurrentFile] = useState<string>("sandbox");
    const [fileList, setFileList] = useState<string[]>([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const editorRef = useRef<AceEditor>(null);

    async function handleFileList() {
        try {
            const res = await fetch("http://127.0.0.1:8000/api/list");
            const json = await res.json();
            setFileList(json.files || []);
            if (
                json.files.length &&
                (currentFile === "sandbox" || !currentFile)
            ) {
                setCurrentFile(json.files[0]);
                loadFile(json.files[0]);
            }
        } catch (err) {
            console.error("Error fetching file list", err);
        }
    }

    async function loadFile(filename: string) {
        try {
            const res = await fetch("http://127.0.0.1:8000/api/load", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename }),
            });
            const json = await res.json();
            setCode(json.code || starterCode);
            setCurrentFile(filename);
            setHasUnsavedChanges(false);
        } catch (err) {
            console.error("Error loading file", err);
            setCode(starterCode);
        }
    }

    async function saveFile(filename: string, content: string) {
        try {
            await fetch("http://127.0.0.1:8000/api/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename, code: content }),
            });

            if (!fileList.includes(filename)) handleFileList();
        } catch (err) {
            console.error("Error saving file", err);
        }
    }

    async function handleRun() {
        if (!code) return;

        setStatus("Running...");
        setOutput("");

        try {
            const res = await fetch("http://127.0.0.1:8000/api/python", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    tests: [], // sandbox: explicitly empty
                }),
            });

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || "Runtime Error");
            }

            setOutput(json.output ?? "");
            setStatus("Done");
        } catch (e: any) {
            setOutput(`Error: ${e.message ?? String(e)}`);
            setStatus("Error");
        }
    }

    useEffect(() => {
        if (currentFile && hasUnsavedChanges) {
            const timer = setTimeout(() => {
                saveFile(currentFile, code);
                setHasUnsavedChanges(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [code, currentFile, hasUnsavedChanges]);

    useEffect(() => {
        handleFileList();
    }, []);

    // focus the editor when a file is loaded
    useEffect(() => {
        if (editorRef.current && currentFile) {
            const editor = editorRef.current.editor;
            if (editor) {
                editor.focus();
                editor.gotoLine(4, 2);
            }
        }
    }, [currentFile]);

    return (
        <div className="flex h-screen bg-background text-foreground">
            {sidebarOpen && (
                <div className="w-48 bg-card border-r border-border flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                        <h2 className="text-sm font-semibold">My Programs</h2>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="opacity-70 hover:opacity-100"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    </div>

                    <div className="flex-1 p-2 overflow-auto">
                        <div className="mb-2">
                            <button
                                className="w-full bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90 text-xs"
                                onClick={async () => {
                                    const input = prompt("Enter new filename:");
                                    if (!input) return;
                                    const filename = input.endsWith(".py")
                                        ? input.slice(0, -3)
                                        : input;

                                    await fetch(
                                        "http://127.0.0.1:8000/api/save",
                                        {
                                            method: "POST",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                            },
                                            body: JSON.stringify({
                                                filename,
                                                code: starterCode,
                                            }),
                                        },
                                    );

                                    await handleFileList();
                                    setCurrentFile(filename);
                                    setCode(starterCode);
                                    setHasUnsavedChanges(false);
                                }}
                            >
                                + New File
                            </button>
                        </div>

                        {fileList.map((f) => (
                            <button
                                key={f}
                                className={`block w-full text-left text-sm py-1 px-2 rounded hover:bg-muted ${
                                    currentFile === f ? "bg-muted" : ""
                                }`}
                                onClick={() => loadFile(f)}
                            >
                                {f + ".py"}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-1 flex-col relative">
                <div className="bg-card border-b border-border px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {!sidebarOpen && (
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="bg-card rounded hover:bg-secondary hover:text-foreground transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        )}

                        <Link
                            href="/"
                            className="bg-card rounded px-1 py-1 text-xs hover:bg-secondary hover:text-foreground transition-colors"
                        >
                            <Home size={16} />
                        </Link>

                        <h1 className="font-semibold text-sm opacity-90">
                            {currentFile
                                ? currentFile + ".py"
                                : "No file selected"}
                        </h1>
                    </div>
                    <span className="text-xs opacity-60">{status}</span>
                </div>

                <div className="flex-1">
                    <AceEditor
                        ref={editorRef}
                        mode="python"
                        theme="tomorrow_night_eighties"
                        name="editor"
                        width="100%"
                        height="100%"
                        value={code}
                        onChange={(val) => {
                            setCode(val);
                            setHasUnsavedChanges(true);
                        }}
                        fontSize={14}
                        showPrintMargin={false}
                        showGutter={true}
                        highlightActiveLine={true}
                        setOptions={{
                            enableBasicAutocompletion: true,
                            enableLiveAutocompletion: true,
                            enableSnippets: false,
                            useWorker: false,
                            tabSize: 2,
                        }}
                    />
                </div>

                <div className="bg-card border-t border-border p-2 flex items-center justify-between">
                    <div className="flex space-x-2">
                        <button
                            onClick={handleRun}
                            className="bg-primary-muted text-secondary-foreground px-3 py-1 rounded hover:opacity-90"
                        >
                            Run
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-120 bg-card border-l border-border flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <h2 className="text-sm font-semibold">Output</h2>
                    <button
                        onClick={() => setOutput("")}
                        className="text-xs opacity-70 hover:opacity-100"
                    >
                        Clear
                    </button>
                </div>

                <div
                    className="flex-1 p-4 overflow-auto text-xs font-mono bg-card" // Maybe change the color here
                >
                    {output ? (
                        <pre className="whitespace-pre-wrap leading-relaxed">
                            {output.split("\n").map((line, i) => (
                                <span key={i} className="text-foreground">
                                    {line}
                                    {"\n"}
                                </span>
                            ))}
                        </pre>
                    ) : (
                        <div className="opacity-60 text-center mt-10">
                            No output yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
