import { BicepsFlexed, BookOpen, Code2 } from "lucide-preact";
import { Link } from "preact-router/match";
import type { LanguageType } from "../../types/language";

const buttons = [
    {
        id: 0,
        title: "Learn",
        desc: "Learn with structured lessons and exercises",
        icon: <BookOpen size={32} />,
        to: "/learn",
    },
    {
        id: 1,
        title: "Train",
        desc: "Practice additional drills to strengthen your skills",
        icon: <BicepsFlexed size={32} />,
        to: "/train",
    },
    {
        id: 2,
        title: "Sandbox",
        desc: "Experiment freely with code",
        icon: <Code2 size={32} />,
        to: "/sandbox",
    },
];

interface MenuCardsProps {
    language: LanguageType;
}

export default function MenuCards({ language }: MenuCardsProps) {
    const isLanguageSelected = language !== "";

    return (
        <div className="grid gap-6 grid-cols-3">
            {buttons.map((item) => {
                const isTrain = item.title === "Train";
                const disabled = !isLanguageSelected || isTrain;
                const cardClasses = `menu-card ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;

                const cardBody = (
                    <>
                        <div className="mb-4 text-4xl">{item.icon}</div>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="mb-2 text-xl font-semibold">
                                    {item.title}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {item.desc}
                                </p>
                            </div>
                            {isTrain && (
                                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/80">
                                    Coming soon
                                </span>
                            )}
                        </div>
                    </>
                );

                return disabled ? (
                    <div key={item.id} className={cardClasses}>
                        <div className="menu-card-content">{cardBody}</div>
                    </div>
                ) : (
                    <Link key={item.id} href={item.to} className={cardClasses}>
                        <div className="menu-card-content">{cardBody}</div>
                    </Link>
                );
            })}
        </div>
    );
}
