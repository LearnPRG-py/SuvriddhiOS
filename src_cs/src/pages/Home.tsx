import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import Header from "../components/home/header";
import LanguageSelector from "../components/home/languageselector";
import MenuCards from "../components/home/menucards";
import RecentActivity from "../components/home/recentactivity";
import type { Topic } from "../types/learningitems";
import { Home as HomeIcon } from "lucide-react";

export default function Home() {
    const {
        language,
        setLanguage,
        lastActivity,
        setLastActivity,
        markItemCompleted,
        isItemCompleted,
    } = useStore();

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
            .then((t: Topic[]) => setTopics(t))
            .catch(() => setTopics([]));
    }, [language]);

    useEffect(() => {
        // Persist last activity per-language to avoid showing cross-language resume
        if (lastActivity && language) {
            localStorage.setItem(
                `lastActivity_${language}`,
                JSON.stringify(lastActivity),
            );
        }
    }, [lastActivity]);

    useEffect(() => {
        if (topics.length === 0) return;
        const savedCompletedItems = localStorage.getItem("completedItems");
        if (savedCompletedItems) {
            const completedItems: { topicId: string; itemId: string }[] =
                JSON.parse(savedCompletedItems);
            completedItems.forEach((item) => {
                if (!isItemCompleted(item.itemId))
                    markItemCompleted(item.itemId);
            });
        }

        // Load last activity for the currently selected language only
        if (!language) return;
        const savedLast = localStorage.getItem(`lastActivity_${language}`);
        if (savedLast && !lastActivity) {
            setLastActivity(JSON.parse(savedLast));
        }
    }, [
        topics,
        lastActivity,
        markItemCompleted,
        isItemCompleted,
        setLastActivity,
    ]);

    return (
        <div className="min-h-screen bg-background flex flex-col text-foreground font-display">
            <Header />
            <div className="mx-auto grow flex flex-col max-w-7xl py-12 px-8">
                <section>
                    <h1 className="text-4xl font-bold tracking-tight text-balance">
                        Welcome back!
                    </h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Select Your Programming Language
                    </p>
                    <LanguageSelector
                        language={language}
                        setLanguage={setLanguage}
                    />
                </section>
                <div className="flex flex-col grow justify-center mt-12 space-y-16">
                    <section>
                        <h2 className="mb-6 text-2xl font-semibold">
                            Main Menu
                        </h2>
                        <MenuCards language={language} />
                    </section>
                    <section>
                        <RecentActivity
                            lastActivity={lastActivity ?? undefined}
                        />
                    </section>
                </div>
            </div>
            <a
                href="http://127.0.0.1:8080"
                className="fixed bottom-6 left-6 text-slate-200 hover:text-white rounded-lg p-2.5 flex items-center justify-center"
                aria-label="Home"
            >
                <HomeIcon className="fixed bottom-4 right-4 w-8 h-8 text-balance" />
            </a>
        </div>
    );
}
