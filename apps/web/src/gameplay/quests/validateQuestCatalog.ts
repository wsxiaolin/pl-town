import type { QuestDefinition } from './types';

const ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function validateQuestCatalog(definitions: readonly QuestDefinition[]): void {
  const errors: string[] = [];
  const questIds = new Set<string>();

  const scanForFunctions = (value: unknown, path: string): void => {
    if (typeof value === 'function') {
      errors.push(`${path} must be serializable and cannot contain functions`);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) scanForFunctions(child, `${path}.${key}`);
  };

  definitions.forEach((quest, questIndex) => {
    const path = `quests[${questIndex}]`;
    if (!ID_PATTERN.test(quest.id)) errors.push(`${path}.id must be a stable namespaced id`);
    if (questIds.has(quest.id)) errors.push(`${path}.id duplicates ${quest.id}`);
    questIds.add(quest.id);
    if (!quest.giverNpcId) errors.push(`${path}.giverNpcId is required`);
    if (!quest.receiverNpcId) errors.push(`${path}.receiverNpcId is required`);
    if (quest.stages.length === 0) errors.push(`${path}.stages must not be empty`);

    const stageIds = new Set<string>();
    quest.stages.forEach((stage, stageIndex) => {
      const stagePath = `${path}.stages[${stageIndex}]`;
      if (!ID_PATTERN.test(stage.id)) errors.push(`${stagePath}.id must be stable`);
      if (stageIds.has(stage.id)) errors.push(`${stagePath}.id duplicates ${stage.id}`);
      stageIds.add(stage.id);
      if (stage.objectives.length === 0) errors.push(`${stagePath}.objectives must not be empty`);
      const objectiveIds = new Set<string>();
      stage.objectives.forEach((objective, objectiveIndex) => {
        const objectivePath = `${stagePath}.objectives[${objectiveIndex}]`;
        if (!ID_PATTERN.test(objective.id)) errors.push(`${objectivePath}.id must be stable`);
        if (objectiveIds.has(objective.id)) errors.push(`${objectivePath}.id duplicates ${objective.id}`);
        objectiveIds.add(objective.id);
        if (!Number.isInteger(objective.required) || objective.required < 1) {
          errors.push(`${objectivePath}.required must be a positive integer`);
        }
      });
    });
    scanForFunctions(quest, path);
  });

  const knownQuestIds = new Set(definitions.map((quest) => quest.id));
  definitions.forEach((quest, questIndex) => {
    quest.prerequisites?.forEach((condition, conditionIndex) => {
      if (condition.type === 'quest.completed' && !knownQuestIds.has(condition.questId)) {
        errors.push(`quests[${questIndex}].prerequisites[${conditionIndex}] references unknown quest ${condition.questId}`);
      }
    });
  });

  if (errors.length > 0) throw new Error(`Invalid quest catalog:\n- ${errors.join('\n- ')}`);
}

