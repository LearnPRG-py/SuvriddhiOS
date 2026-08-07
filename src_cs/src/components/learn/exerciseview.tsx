import { useEffect, useMemo, useRef, useState } from "react";
import type { ExerciseItem } from "../../types/learningitems";
import { useStore } from "../../store/useStore";
import OutputFeedback from "../common/outputfeedback";

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/theme-tomorrow_night_eighties";
import "ace-builds/src-noconflict/ext-language_tools";

interface ExerciseTest {
    input?: string | string[];
    expected: string;
}

interface ExerciseTask {
    taskId: string;
    title: string;
    difficulty: string | null;
    background: string;
    backgroundCode: string;
    backgroundCodeOutput: string;
    instructions: string[];
    expectedOutput: string;
    checkMode: string;
    hints: string[];
    warnings: string[];
    tests: ExerciseTest[];
}
interface ExerciseData {
    id: string;
    title: string;
    lead: string;
    starterCode: string;
    tasks: ExerciseTask[];
}

interface Props {
    item: ExerciseItem;
    onMarkComplete: () => void;
}

export default function ExerciseView({ item, onMarkComplete }: Props) {
    const { language, getDraftForExercise, saveDraftForExercise } = useStore();

    const [exercise, setExercise] = useState<ExerciseData | null>(null);

    const [taskIndex, setTaskIndex] = useState(0);
    const [completedTasks, setCompletedTasks] = useState<boolean[]>([]);
    const [code, setCode] = useState("");
    const [output, setOutput] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const [draftLoaded, setDraftLoaded] = useState(false);
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

    const [hintIndex, setHintIndex] = useState(0);

    const editorRef = useRef<AceEditor>(null);

    useEffect(() => {
        async function loadExercise() {
            try {
                const res = await fetch("/data/learn/exercises.json");
                const allExercises = await res.json();

                const data = allExercises[item.id];

                if (!data) {
                    throw new Error(`Exercise '${item.id}' not found.`);
                }

                setExercise(data);
                setCompletedTasks(new Array(data.tasks.length).fill(false));

                const savedTaskIndex = localStorage.getItem(
                    `exercise-task-${item.id}`,
                );
                const taskIdx = savedTaskIndex
                    ? parseInt(savedTaskIndex, 10)
                    : 0;
                setTaskIndex(taskIdx);
            } catch (err) {
                console.error(err);
                setExercise(null);
            }
        }

        loadExercise();
    }, [item.id]);

    useEffect(() => {
        if (!exercise) return;

        const draft = getDraftForExercise(item.id);

        setCode(draft ?? exercise.starterCode);
        setDraftLoaded(true);
    }, [exercise, item.id]);

    useEffect(() => {
        if (!draftLoaded) return;

        saveDraftForExercise(item.id, code);
    }, [code, draftLoaded]);

    useEffect(() => {
        editorRef.current?.editor.focus();
        setHintIndex(0);
    }, [item.id, taskIndex]);

    useEffect(() => {
        if (exercise) {
            localStorage.setItem(
                `exercise-task-${item.id}`,
                taskIndex.toString(),
            );
        }
    }, [taskIndex, exercise, item.id]);

    if (!exercise) {
        return (
            <div className="flex-1 flex items-center justify-center">
                Loading exercise...
            </div>
        );
    }

    const task = exercise.tasks[taskIndex];

    const nextUnlockedIndex = completedTasks.findIndex((done) => !done);
    const maxUnlockedIndex =
        nextUnlockedIndex === -1
            ? exercise.tasks.length - 1
            : nextUnlockedIndex;
    const isTaskUnlocked = (index: number) => index <= maxUnlockedIndex;

    const difficultyColor = useMemo(() => {
        switch (task.difficulty) {
            case "stretch":
                return "bg-purple-600";

            case "hard":
                return "bg-red-600";

            case "medium":
                return "bg-yellow-500";

            default:
                return "bg-green-600";
        }
    }, [task]);

    const hasPrevious = taskIndex > 0;
    const hasNext = taskIndex < exercise.tasks.length - 1;
    async function handleSubmit() {
        if (!exercise) return;

        setRunning(true);
        setOutput(null);
        setIsSuccess(null);

        try {
            const endpoint =
                language === "Python"
                    ? "http://127.0.0.1:8000/api/python"
                    : "http://127.0.0.1:8000/api/compile";

            if (language === "Python") {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        code,
                        tests: task.tests,
                    }),
                });

                const json = await res.json();

                if (json.success) {
                    setCompletedTasks((prev) => {
                        const next = [...prev];
                        next[taskIndex] = true;
                        return next;
                    });

                    setIsSuccess(true);
                    setOutput("All tests passed!");

                    if (taskIndex === exercise.tasks.length - 1) {
                        onMarkComplete();
                    } else {
                        setTaskIndex(taskIndex + 1);
                    }

                    return;
                }

                setIsSuccess(false);
                setOutput(
                    `Test Failed

Output:
${json.output}

Expected:
${json.expected}`,
                );
            } else {
                const compile = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        code,
                    }),
                });

                const compileJson = await compile.json();

                if (compileJson.error) {
                    setIsSuccess(false);
                    setOutput(compileJson.error);
                    return;
                }

                const run = await fetch("http://127.0.0.1:8000/api/run", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        token: compileJson.token,
                        tests: task.tests,
                    }),
                });

                const runJson = await run.json();

                if (runJson.success) {
                    setCompletedTasks((prev) => {
                        const next = [...prev];
                        next[taskIndex] = true;
                        return next;
                    });
                    setIsSuccess(true);
                    setOutput("All tests passed!");

                    if (taskIndex === exercise.tasks.length - 1) {
                        onMarkComplete();
                    } else {
                        setTaskIndex(taskIndex + 1);
                    }
                } else {
                    setIsSuccess(false);
                    setOutput(
                        `Test Failed

Output:
${runJson.output}

Expected:
${runJson.expected}`,
                    );
                }
            }
        } catch (err: any) {
            setIsSuccess(false);
            setOutput(String(err));
        } finally {
            setRunning(false);
        }
    }
    return (
        <div className="grow overflow-y-auto p-6">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">
                        {exercise.title}
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        {exercise.lead}
                    </p>
                </div>

                {/* Task Selection */}
                <div className="mb-8 flex flex-wrap gap-2">
                    {exercise.tasks.map((t, i) => (
                        <button
                            key={t.taskId}
                            onClick={() => isTaskUnlocked(i) && setTaskIndex(i)}
                            disabled={!isTaskUnlocked(i)}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                                i === taskIndex
                                    ? "bg-primary text-white shadow-[0_8px_30px_rgba(142,124,195,0.25)]"
                                    : completedTasks[i]
                                      ? "bg-violet-700 text-white hover:bg-violet-600"
                                      : isTaskUnlocked(i)
                                        ? "bg-secondary text-foreground hover:bg-secondary/80"
                                        : "bg-secondary text-muted-foreground cursor-not-allowed opacity-50"
                            }`}
                        >
                            {completedTasks[i] ? "✓ " : ""}
                            {t.title}
                        </button>
                    ))}
                </div>

                {/* Task Content */}
                <div className="space-y-6 mb-8">
                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            {task.title}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-2">
                            Task {taskIndex + 1} of {exercise.tasks.length}
                            {task.difficulty && ` • ${task.difficulty}`}
                        </p>
                        <p className="text-foreground leading-7">
                            {task.background}
                        </p>
                    </section>

                    {task.backgroundCode && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3">
                                Example
                            </h3>
                            <pre className="bg-card p-4 rounded-lg overflow-x-auto text-sm text-foreground border border-border">
                                {task.backgroundCode}
                            </pre>
                        </section>
                    )}

                    {task.backgroundCodeOutput && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3">
                                Expected Output
                            </h3>
                            <pre className="bg-card p-4 rounded-lg overflow-auto text-sm text-primary border border-border break-words whitespace-pre-wrap">
                                {task.backgroundCodeOutput}
                            </pre>
                        </section>
                    )}

                    {task.instructions.length > 0 && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3">
                                Instructions
                            </h3>
                            <div className="space-y-2">
                                {task.instructions.map((instruction, i) => (
                                    <label
                                        key={i}
                                        className="flex gap-3 items-start"
                                    >
                                        <input
                                            type="checkbox"
                                            className="mt-1 accent-primary"
                                        />
                                        <span className="text-foreground">
                                            {instruction}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </section>
                    )}

                    {task.hints.length > 0 && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3">
                                💡 Hints
                            </h3>
                            <div className="space-y-3">
                                {hintIndex > 0 && (
                                    <div className="space-y-2">
                                        {task.hints
                                            .slice(0, hintIndex)
                                            .map((hint, i) => (
                                                <div
                                                    key={i}
                                                    className="bg-card p-4 rounded-lg border border-border"
                                                >
                                                    <p className="text-sm text-muted-foreground mb-1">
                                                        Hint {i + 1}
                                                    </p>
                                                    <p className="text-foreground">
                                                        {hint}
                                                    </p>
                                                </div>
                                            ))}
                                    </div>
                                )}
                                <button
                                    onClick={() => setHintIndex(hintIndex + 1)}
                                    disabled={hintIndex >= task.hints.length}
                                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {hintIndex >= task.hints.length
                                        ? "No more hints"
                                        : `Show Next Hint (${hintIndex + 1}/${task.hints.length})`}
                                </button>
                            </div>
                        </section>
                    )}

                    {task.warnings.length > 0 && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3">
                                ⚠ Warnings
                            </h3>
                            <ul className="space-y-2 list-disc ml-4 text-foreground">
                                {task.warnings.map((warning, i) => (
                                    <li key={i}>{warning}</li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                {/* Code Editor Section */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-3">
                        Your Solution
                    </h3>
                    <div className="rounded-lg border border-border bg-card overflow-hidden">
                        <AceEditor
                            ref={editorRef}
                            mode={language === "Python" ? "python" : "c_cpp"}
                            theme="tomorrow_night_eighties"
                            width="100%"
                            height="320px"
                            value={code}
                            onChange={setCode}
                            showPrintMargin={false}
                            setOptions={{
                                useWorker: false,
                                tabSize: 4,
                            }}
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            onClick={handleSubmit}
                            disabled={running}
                            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                            {running ? "Running..." : "Test"}
                        </button>
                        <button
                            onClick={() => setCode(exercise.starterCode)}
                            className="rounded-lg border border-border px-4 py-2 hover:bg-secondary transition-colors"
                        >
                            Reset
                        </button>
                    </div>

                    <div className="mt-6">
                        <OutputFeedback output={output} isSuccess={isSuccess} />
                    </div>
                </div>
            </div>
        </div>
    );
}
