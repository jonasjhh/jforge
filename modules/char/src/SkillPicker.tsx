import { useState } from "react";
import type { Skill } from "@jforge/melee/shared";
import { effectSummary } from "../shared";

/** How many skills to offer before asking for a narrower search. */
const SHOWN = 8;

interface SkillPickerProps {
  /** Ids of the skills it knows, in order. */
  known: string[];
  /** Every skill in the library. */
  skills: Skill[];
  onChange: (known: string[]) => void;
  /** Opens a known skill in the skill editor. */
  onOpen?: (id: string) => void;
}

/** The skills a class or enemy type knows, and a search to add more. */
export function SkillPicker({
  known,
  skills,
  onChange,
  onOpen,
}: SkillPickerProps) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const knownSkills = known.flatMap((id) => {
    const skill = skills.find((s) => s.id === id);
    return skill ? [skill] : [];
  });
  const q = query.trim().toLowerCase();
  const offered = skills.filter(
    (s) =>
      !known.includes(s.id) &&
      (q === "" ||
        s.name.toLowerCase().includes(q) ||
        effectSummary(s).toLowerCase().includes(q)),
  );
  const shown = all ? offered : offered.slice(0, SHOWN);

  return (
    <fieldset className="group">
      <legend>Skills</legend>
      {skills.length === 0 ? (
        <p className="muted">No skills designed yet.</p>
      ) : (
        <>
          {knownSkills.length === 0 ? (
            <p className="muted small">Knows no skills yet.</p>
          ) : (
            <ul className="known" aria-label="Known skills">
              {knownSkills.map((skill) => (
                <li key={skill.id} className="known-skill">
                  {onOpen ? (
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`Open ${skill.name}`}
                      onClick={() => onOpen(skill.id)}
                    >
                      {skill.name}
                    </button>
                  ) : (
                    <span>{skill.name}</span>
                  )}
                  <button
                    type="button"
                    className="remove"
                    aria-label={`Remove ${skill.name}`}
                    onClick={() =>
                      onChange(known.filter((id) => id !== skill.id))
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            type="search"
            className="search"
            aria-label="Find a skill to add"
            placeholder="Find a skill to add"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="offers" aria-label="Skills to add">
            {shown.map((skill) => (
              <li key={skill.id}>
                <button
                  type="button"
                  className="offer"
                  aria-label={`Add ${skill.name}`}
                  onClick={() => onChange([...known, skill.id])}
                >
                  <span className="offer-name">+ {skill.name}</span>
                  <span className="item-note">{effectSummary(skill)}</span>
                </button>
              </li>
            ))}
          </ul>
          {offered.length === 0 && (
            <p className="muted small">
              {q
                ? `No other skill matches “${query.trim()}”.`
                : "Knows every skill."}
            </p>
          )}
          {offered.length > shown.length && (
            <button
              type="button"
              className="link-button"
              onClick={() => setAll(true)}
            >
              Show all {offered.length}
            </button>
          )}
        </>
      )}
    </fieldset>
  );
}
