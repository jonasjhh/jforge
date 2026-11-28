import {
  effectSummary,
  skillProblems,
  type Archetype,
  type Library,
  type Skill,
} from "@jforge/rules/core";
import { Links } from "./Links";

interface SkillViewProps {
  skill: Skill;
  library: Library;
  onOpenArchetype: (archetype: Archetype) => void;
}

/** A skill: what it costs, whom it aims at, what it does and who has it. */
export function SkillView({ skill, library, onOpenArchetype }: SkillViewProps) {
  const costs = [
    skill.mpCost > 0 ? `${skill.mpCost} MP` : "",
    skill.hpCost ? `${skill.hpCost} HP` : "",
  ].filter(Boolean);
  const problems = skillProblems(skill, library);
  const { effect } = skill;
  const summon =
    effect.type === "summon"
      ? library.archetypes.find((a) => a.id === effect.source?.archetypeId)
      : undefined;
  return (
    <>
      <h2>{skill.name}</h2>
      {skill.description && <p>{skill.description}</p>}
      <p className="muted">
        {costs.length > 0 ? costs.join(" and ") : "Free"} · aims at{" "}
        {skill.target} · {skill.area}
      </p>
      <p>
        <strong>Does:</strong> {effectSummary(skill)}
      </p>
      {summon && (
        <fieldset className="group">
          <legend>Puts in</legend>
          <Links
            label="Puts in"
            items={[summon]}
            none="Nothing."
            onOpen={onOpenArchetype}
          />
        </fieldset>
      )}
      {problems.length > 0 && (
        <ul className="bad" aria-label="Problems">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <fieldset className="group">
        <legend>Known by</legend>
        <Links
          label="Known by"
          items={library.archetypes.filter((a) => a.skills.includes(skill.id))}
          none="No one here."
          onOpen={onOpenArchetype}
        />
      </fieldset>
    </>
  );
}
