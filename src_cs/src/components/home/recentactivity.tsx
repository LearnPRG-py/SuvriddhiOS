import { Code2, BookOpen } from "lucide-preact";
import { useStore } from "../../store/useStore";
import { useEffect, useState } from "react";
import type { ActiveItem, Topic } from "../../types/learningitems";
import { Link } from "preact-router/match";
import type { LanguageType } from "../../types/language";

export default function RecentActivity({
    lastActivity,
}: {
    lastActivity?: ActiveItem;
}) {
    const { getTopicProgress, completed } = useStore();
    const { language } = useStore();
    const [topics, setTopics] = useState<Topic[]>([]);

    useEffect(() => {
        const path =
            language === "C"
                ? "/data/learn/topics.json"
                : language === "Python"
                  ? "/data/learn/topics_py.json"
                  : null;

        if (!path) {
            setTopics([]);
            return;
        }

        fetch(path)
            .then((r) => r.json())
            .then((t: Topic[]) => {
                const filtered = t.map((topic) => ({
                    ...topic,
                    items: topic.items.filter(
                        (item) =>
                            item.type !== "challenge" && item.type !== "quiz",
                    ),
                }));
                setTopics(filtered);
            })
            .catch(() => setTopics([]));
    }, [language]);

    if (!lastActivity) {
        return (
            <>
                <h2 className="mb-6 text-2xl font-semibold">Recent Activity</h2>
                <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
                    <p>
                        No recent activity yet. Start learning to see your
                        progress here!
                    </p>
                </div>
            </>
        );
    }

    const topic = topics.find((t) => t.id === lastActivity.topicId);
    const item = topic?.items.find((i) => i.id === lastActivity.itemId);
    const progress = getTopicProgress(topics, lastActivity.topicId);
    const hasAnyProgress = Object.keys(completed).length > 0;

    if (!topic || !item || (!hasAnyProgress && progress === 0)) {
        return (
            <>
                <h2 className="mb-6 text-2xl font-semibold">Recent Activity</h2>
                <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
                    <p>
                        No recent activity yet. Start learning to see your
                        progress here!
                    </p>
                </div>
            </>
        );
    }

    return (
        <>
            <h2 className="mb-6 text-2xl font-semibold">Recent Activity</h2>
            <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {item.type === "lesson" ? (
                                    <BookOpen size={20} />
                                ) : (
                                    <Code2 size={20} />
                                )}
                            </span>
                        </div>
                        <h3 className="mb-3 text-lg font-semibold">
                            {topic.title}
                        </h3>

                        <div className="mb-4 w-full max-w-xs">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                    Progress
                                </span>
                                <span className="text-xs font-medium text-primary">
                                    {progress}%
                                </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex sm:flex-col">
                        <Link href="/learn">
                            <button className="rounded-lg bg-primary-muted text-primary-foreground px-4 py-2 font-medium hover:opacity-80 active:scale-[0.97] transition-all">
                                Resume
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
