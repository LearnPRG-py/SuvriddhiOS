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
<<<<<<< HEAD
    input?: string | string[];
=======
    input: string;
>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
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

<<<<<<< HEAD
    const [hintIndex, setHintIndex] = useState(0);
=======
    const [showHints, setShowHints] = useState(false);
    const [showWarnings, setShowWarnings] = useState(false);
>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125

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
<<<<<<< HEAD
                setCompletedTasks(new Array(data.tasks.length).fill(false));

                const savedTaskIndex = localStorage.getItem(
                    `exercise-task-${item.id}`,
                );
                const taskIdx = savedTaskIndex
                    ? parseInt(savedTaskIndex, 10)
                    : 0;
                setTaskIndex(taskIdx);
=======
                setTaskIndex(0);
                setCompletedTasks(new Array(data.tasks.length).fill(false));
>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
            } catch (err) {
                console.error(err);
                setExercise(null);
            }
        }

        loadExercise();
    }, [item.id]);

    useEffect(() => {
        if (!exercise) return;
<<<<<<< HEAD

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
=======
>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125

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
    }, [item.id]);

    if (!exercise) {
        return (
            <div className="flex-1 flex items-center justify-center">
                Loading exercise...
            </div>
        );
    }

    const task = exercise.tasks[taskIndex];

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
<<<<<<< HEAD
=======
            // const currentTask = exercise.tasks[taskIndex];

>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
            const endpoint =
                language === "Python"
                    ? "http://127.0.0.1:8000/api/python"
                    : "http://127.0.0.1:8000/api/compile";

            if (language === "Python") {
<<<<<<< HEAD
=======
                console.log(task.tests);
                console.log(
                    JSON.stringify(
                        {
                            code,
                            tests: task.tests,
                        },
                        null,
                        2,
                    ),
                );
>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
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
<<<<<<< HEAD
                    } else {
                        setTaskIndex(taskIndex + 1);
=======
>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
                    }

                    return;
                }

                setIsSuccess(false);
<<<<<<< HEAD
                setOutput(
                    `❌ Test Failed

Output:
${json.output}

=======

                setOutput(
                    `❌ Test Failed

Output:
${json.output}

>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
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
<<<<<<< HEAD
                    } else {
                        setTaskIndex(taskIndex + 1);
                    }
                } else {
                    setIsSuccess(false);
=======
                    }
                } else {
                    setIsSuccess(false);

>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
                    setOutput(
                        `❌ Test Failed

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
<<<<<<< HEAD
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
=======
        <div className="grow overflow-y-auto p-8">
            <div className="mx-auto max-w-6xl flex flex-col gap-8">
                {/* Header */}

                <div className="space-y-2">
                    <h1 className="text-4xl font-bold">{exercise.title}</h1>

                    <p className="text-zinc-400 text-lg">{exercise.lead}</p>
                </div>

                {/* Task Card */}

                <div className="rounded-xl border border-zinc-800 bg-zinc-900">
                    <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
                        <div>
                            <h2 className="text-2xl font-semibold">
                                {task.title}
                            </h2>

                            <p className="text-sm text-zinc-500 mt-1">
                                Task {taskIndex + 1} of {exercise.tasks.length}
                            </p>
                        </div>

                        <div
                            className={`rounded-full px-3 py-1 text-sm font-semibold text-white ${difficultyColor}`}
                        >
                            {task.difficulty ?? "Core"}
                        </div>
                    </div>

                    <div className="p-6 flex flex-col gap-8">
                        {/* Background */}

                        <section>
                            <h3 className="text-xl font-semibold mb-3">
                                Background
                            </h3>

                            <p className="leading-7 text-zinc-300">
                                {task.background}
                            </p>
                        </section>

                        {/* Example */}

                        <section className="space-y-3">
                            <h3 className="text-xl font-semibold">Example</h3>

                            <AceEditor
                                mode={
                                    language === "Python" ? "python" : "c_cpp"
                                }
                                theme="tomorrow_night_eighties"
                                value={task.backgroundCode}
                                readOnly
                                width="100%"
                                height="170px"
                                showPrintMargin={false}
                                setOptions={{
                                    useWorker: false,
                                }}
                            />
                        </section>

                        {/* Output */}

                        {task.backgroundCodeOutput && (
                            <section>
                                <h3 className="text-xl font-semibold mb-3">
                                    Output
                                </h3>

                                <pre className="rounded-lg bg-black p-4 font-mono text-green-400 overflow-x-auto">
                                    {task.backgroundCodeOutput}
                                </pre>
                            </section>
                        )}

                        {/* Instructions */}

                        <section>
                            <h3 className="text-xl font-semibold mb-4">
                                Instructions
                            </h3>

                            <div className="space-y-3">
>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
                                {task.instructions.map((instruction, i) => (
                                    <label
                                        key={i}
                                        className="flex gap-3 items-start"
                                    >
                                        <input
                                            type="checkbox"
<<<<<<< HEAD
                                            className="mt-1 accent-primary"
                                        />
                                        <span className="text-foreground">
                                            {instruction}
                                        </span>
=======
                                            className="mt-1"
                                        />

                                        <span>{instruction}</span>
>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
                                    </label>
                                ))}
                            </div>
                        </section>
<<<<<<< HEAD
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
=======

                        {/* Hints */}

                        <section className="rounded-lg border border-zinc-700">
                            <button
                                onClick={() => setShowHints(!showHints)}
                                className="w-full flex justify-between items-center px-5 py-4 text-left font-semibold"
                            >
                                <span>💡 Hints</span>

                                <span>{showHints ? "−" : "+"}</span>
                            </button>

                            {showHints && (
                                <ul className="px-8 pb-5 list-disc space-y-2">
                                    {task.hints.map((hint, i) => (
                                        <li key={i}>{hint}</li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* Warnings */}

                        <section className="rounded-lg border border-yellow-700">
                            <button
                                onClick={() => setShowWarnings(!showWarnings)}
                                className="w-full flex justify-between items-center px-5 py-4 text-left font-semibold"
                            >
                                <span>⚠ Warnings</span>

                                <span>{showWarnings ? "−" : "+"}</span>
                            </button>

                            {showWarnings && (
                                <ul className="px-8 pb-5 list-disc space-y-2">
                                    {task.warnings.map((warning, i) => (
                                        <li key={i}>{warning}</li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* Expected */}

                        <section>
                            <h3 className="text-xl font-semibold mb-3">
                                Expected Output
                            </h3>

                            <pre className="rounded-lg bg-black p-4 font-mono text-cyan-300 overflow-x-auto">
                                {task.expectedOutput}
                            </pre>
                        </section>
                    </div>
                </div>

                {/* Code Editor */}

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <h2 className="text-2xl font-semibold mb-4">
                        Your Solution
                    </h2>

                    <AceEditor
                        ref={editorRef}
                        mode={language === "Python" ? "python" : "c_cpp"}
                        theme="tomorrow_night_eighties"
                        width="100%"
                        height="420px"
                        value={code}
                        onChange={setCode}
                        showPrintMargin={false}
                        setOptions={{
                            useWorker: false,
                            tabSize: 4,
                        }}
                    />

                    <div className="mt-6 flex gap-4">
                        <button
                            onClick={handleSubmit}
                            disabled={running}
                            className="rounded-lg bg-blue-600 px-5 py-3 font-medium hover:bg-blue-500 disabled:opacity-50"
                        >
                            {running ? "Running..." : "Compile & Run"}
                        </button>

                        <button
                            onClick={() => setCode(exercise.starterCode)}
                            className="rounded-lg border border-zinc-700 px-5 py-3"
>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
                        >
                            Reset
                        </button>
                    </div>

                    <div className="mt-6">
                        <OutputFeedback output={output} isSuccess={isSuccess} />
                    </div>
                </div>
<<<<<<< HEAD
=======

                {/* Navigation */}

                <div className="flex flex-wrap gap-3">
                    {exercise.tasks.map((t, i) => (
                        <button
                            key={t.taskId}
                            onClick={() => setTaskIndex(i)}
                            className={`rounded-lg px-4 py-2 transition

                        ${
                            i === taskIndex
                                ? "bg-blue-600 text-white"
                                : completedTasks[i]
                                  ? "bg-green-700 text-white"
                                  : "bg-zinc-800 hover:bg-zinc-700"
                        }`}
                        >
                            {completedTasks[i] ? "✓ " : ""}

                            {t.title}
                        </button>
                    ))}
                </div>
>>>>>>> 38e3240ab3587eb52f677570c1ad2cfc5b8ed125
            </div>
        </div>
    );
}
