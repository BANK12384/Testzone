import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactPlayer from "react-player";

export default function PlayerSelfTest({ url }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const urlString = typeof url === "string" ? url.trim() : "";
  const playable = ReactPlayer.canPlay(urlString);

  // If the player doesn't become ready in 2.5s, try iframe fallback (YouTube only)
  useEffect(() => {
    setReady(false);
    setError(null);
    setUseIframeFallback(false);
    if (!urlString) return;
    const t = setTimeout(() => {
      if (!ready) setUseIframeFallback(true);
    }, 2500);
    return () => clearTimeout(t);
  }, [urlString]);

  // Force remount when URL changes (important!)
  const key = useMemo(() => urlString || "no-url", [urlString]);

  if (!urlString)
    return <div className="p-3 text-sm text-gray-600">No URL provided.</div>;
  if (!playable)
    return (
      <div className="p-3 text-sm text-red-600">
        URL not supported by react-player.
      </div>
    );

  return (
    <div style={{ border: "2px solid #ddd", minHeight: 360 }}>
      {!useIframeFallback ? (
        <ReactPlayer
          key={key}
          url={urlString}
          controls
          width="100%"
          height="70vh"
          onReady={() => {
            setReady(true);
            console.log("[ReactPlayer] ready");
          }}
          onStart={() => console.log("[ReactPlayer] start")}
          onError={(e) => {
            setError(e);
            console.error("[ReactPlayer] error", e);
          }}
          config={{
            youtube: {
              playerVars: {
                origin: window.location.origin, // helps in some envs
                rel: 0,
                modestbranding: 1,
              },
            },
          }}
        />
      ) : (
        // Fallback iframe (YouTube only) so you can still demo
        <iframe
          title="YouTube fallback"
          width="100%"
          style={{ height: "70vh", display: "block" }}
          src={toEmbed(urlString)} // converts watch?v= to /embed/
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      <div className="p-2 text-xs text-gray-600">
        ready: {String(ready)} | fallback: {String(useIframeFallback)} |
        canPlay: {String(playable)} | url: {urlString}
        {error ? (
          <div className="text-red-600 mt-1">error: {String(error)}</div>
        ) : null}
      </div>
    </div>
  );
}

function toEmbed(youtubeUrl) {
  // converts https://www.youtube.com/watch?v=ABC to https://www.youtube.com/embed/ABC
  try {
    const u = new URL(youtubeUrl);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/iframe_api${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/iframe_api${u.pathname.slice(1)}`;
    }
    return youtubeUrl;
  } catch {
    return youtubeUrl;
  }
}
