import React, { useEffect, useState } from "react";
import YouTubeNotes from "./note";

/* ---- mock data ---- */
const mockCourse = {
    id: 1,
    title: "React Basics",
    sections: [
        {
            id: 1,
            title: "Introduction",
            lessons: [
                { id: 101, title: "Welcome", videoUrl: "https://www.youtube.com/watch?v=bMknfKXIFA8" },
                { id: 102, title: "Setup", videoUrl: "https://www.youtube.com/watch?v=w7ejDZ8SWv8" },
            ],
        },
        {
            id: 2,
            title: "Core Concepts",
            lessons: [
                { id: 201, title: "Components", videoUrl: "https://www.youtube.com/watch?v=4UZrsTqkcW4" },
                { id: 202, title: "State & Props", videoUrl: "https://www.youtube.com/watch?v=Ke90Tje7VS0" },
            ],
        },
    ],
};

/* ---- helpers ---- */
function toEmbed(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
            return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
        }
        if (u.hostname === "youtu.be") {
            return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
        }
        return url;
    } catch {
        return url;
    }
}

/* ---- component ---- */
export default function CoursePage({ course = mockCourse }) {
    const [currentLesson, setCurrentLesson] = useState(course.sections[0].lessons[0]);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Remember state (optional)
    useEffect(() => {
        const saved = localStorage.getItem("sidebarOpen");
        if (saved != null) setSidebarOpen(JSON.parse(saved));
    }, []);
    useEffect(() => localStorage.setItem("sidebarOpen", JSON.stringify(sidebarOpen)), [sidebarOpen]);

    return (
        <div className="h-screen w-full flex flex-col bg-white">
            {/* Top bar */}
            <header className="h-14 border-b flex items-center gap-3 px-3 md:px-4 shrink-0">
                <button
                    onClick={() => setSidebarOpen(o => !o)}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-md border hover:bg-gray-50"
                    aria-label={sidebarOpen ? "Close menu" : "Open menu"}
                    aria-expanded={sidebarOpen}
                >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <h1 className="font-semibold text-lg truncate">{course.title}</h1>
            </header>

            {/* Body */}
            <div className="flex-1 relative flex overflow-hidden">
                {/* Backdrop for mobile */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/40 z-30 md:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Desktop/Tablet sidebar (docked; width collapses) */}
                <aside
                    className={[
                        "hidden md:block bg-gray-100 border-r overflow-y-auto transition-all duration-300 ease-in-out",
                        sidebarOpen ? "w-72" : "w-0",
                    ].join(" ")}
                    aria-hidden={!sidebarOpen}
                >
                    {/* Hide inner content visually when collapsed to avoid overflow hit-tests */}
                    <div className={sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}>

                        <div className="p-4 border-b sticky top-0 bg-gray-100 z-10">
                            <p className="text-sm text-gray-600">Course outline</p>
                        </div>

                        <div className="p-3">
                            {course.sections.map((section) => (
                                <div key={section.id} className="mb-3">
                                    <div className="text-sm font-semibold text-gray-700 mb-1">{section.title}</div>
                                    <ul className="space-y-1">
                                        {section.lessons.map((lesson) => (
                                            <li key={lesson.id}>
                                                <button
                                                    onClick={() => setCurrentLesson(lesson)}
                                                    className={[
                                                        "w-full text-left px-2 py-2 rounded hover:bg-blue-50",
                                                        currentLesson.id === lesson.id ? "bg-blue-200" : "",
                                                    ].join(" ")}
                                                >
                                                    {lesson.title}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                    </div>
                </aside>

                {/* Mobile sidebar (off-canvas) */}
                <aside
                    className={[
                        "md:hidden fixed inset-y-0 left-0 z-40 w-72 bg-gray-100 border-r overflow-y-auto",
                        "transform transition-transform duration-300 ease-in-out",
                        sidebarOpen ? "translate-x-0" : "-translate-x-full",
                    ].join(" ")}
                >
                    <div className="p-4 border-b sticky top-0 bg-gray-100 z-10">
                        <p className="text-sm text-gray-600">Course outline</p>
                    </div>
                    <div className="p-3">
                        {course.sections.map((section) => (
                            <div key={section.id} className="mb-3">
                                <div className="text-sm font-semibold text-gray-700 mb-1">{section.title}</div>
                                <ul className="space-y-1">
                                    {section.lessons.map((lesson) => (
                                        <li key={lesson.id}>
                                            <button
                                                onClick={() => {
                                                    setCurrentLesson(lesson);
                                                    setSidebarOpen(false); // auto-close on select (mobile)
                                                }}
                                                className={[
                                                    "w-full text-left px-2 py-2 rounded hover:bg-blue-50",
                                                    currentLesson.id === lesson.id ? "bg-blue-200" : "",
                                                ].join(" ")}
                                            >
                                                {lesson.title}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-auto">
                    <div className="p-4 md:p-6 flex justify-center">
                        <div className="w-full max-w-4xl">
                            <h2 className="text-2xl font-bold mb-4">{currentLesson.title}</h2>
                            <div className="rounded-lg shadow overflow-hidden">
                                {/* <iframe
                                    key={currentLesson.videoUrl}
                                    src={toEmbed(currentLesson.videoUrl)}
                                    width="100%"
                                    style={{ height: "70vh", display: "block" }}
                                    frameBorder="0"
                                    title={currentLesson.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                /> */}
                                <YouTubeNotes videoUrl={currentLesson.videoUrl} />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
