import { useCallback, useRef, useState } from "react";
import type { Library } from "../shared";
import { loadLibrary, saveLibrary } from "./storage";

interface Edited {
  library: Library;
  /** Whether the last save worked. */
  saved: boolean;
}

function loadAndSave(): Edited {
  const library = loadLibrary();
  return { library, saved: saveLibrary(library) };
}

/** The library being edited; every change is saved and published at once. */
export function useLibrary() {
  const [edited, setEdited] = useState(loadAndSave);
  const current = useRef(edited.library);
  const update = useCallback((change: (library: Library) => Library) => {
    const library = change(current.current);
    current.current = library;
    setEdited({ library, saved: saveLibrary(library) });
  }, []);
  return { library: edited.library, update, saved: edited.saved };
}
