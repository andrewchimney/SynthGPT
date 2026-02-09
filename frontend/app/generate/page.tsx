"use client";

import { useState } from "react";

type Preset = {
  id: string;
  title: string;
  score: number;
};

export default function Page() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Preset[]>([]);

  async function search() {
    const res = await fetch("http://localhost:8000/api/retrieve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, k: 5 }),
    });

    const data = await res.json();
    console.log(data);
    setResults(data.results || []);
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search"
      />

      <button onClick={search}>Go</button>

     <div>
  {results.map((r, i) => (
    <div key={i}>
      <div>{r.title}</div>

      <audio
        controls
        src={`https://tsgqkjbmcokktrdyyiro.supabase.co/storage/v1/object/public/previews/${r.preview_object_key}`}
      />
    </div>
  ))}
</div>
    </div>
  );
}