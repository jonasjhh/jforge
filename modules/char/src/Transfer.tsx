import { useState } from "react";
import { parseLibrary, type Library } from "../shared";

interface TransferProps {
  library: Library;
  onImport: (library: Library) => void;
}

/** Export the library as a JSON file, or replace it with an exported one. */
export function Transfer({ library, onImport }: TransferProps) {
  const [message, setMessage] = useState<string | null>(null);
  const href = `data:application/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(library, null, 2),
  )}`;
  return (
    <section className="panel">
      <h2>Backup</h2>
      <div className="button-row">
        <a className="secondary" href={href} download="jforge-char.json">
          Export
        </a>
        <label className="secondary">
          Import
          <input
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const imported = parseLibrary(await file.text());
              if (imported) onImport(imported);
              setMessage(
                imported
                  ? `Imported ${file.name}.`
                  : `${file.name} is not a char library.`,
              );
            }}
          />
        </label>
      </div>
      {message && (
        <p className="muted small" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
