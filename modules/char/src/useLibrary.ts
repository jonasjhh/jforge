import { useCallback, useEffect, useState } from "react";
import type { Library } from "../shared";
import { loadLibrary, saveLibrary } from "./storage";

/** The library being edited; every change is saved and published at once. */
export function useLibrary() {
  const [library, setLibrary] = useState<Library>(loadLibrary);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    setSaved(saveLibrary(library));
  }, [library]);
  const update = useCallback(
    (change: (library: Library) => Library) => setLibrary(change),
    [],
  );
  return { library, update, saved };
}
