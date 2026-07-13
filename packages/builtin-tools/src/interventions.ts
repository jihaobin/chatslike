import {
  AgentBuilderApiName,
  AgentBuilderManifest,
} from '@lobechat/builtin-tool-agent-builder';
import { ClaudeCodeApiName, ClaudeCodeIdentifier } from '@lobechat/builtin-tool-claude-code';
import { CloudSandboxApiName, CloudSandboxManifest } from '@lobechat/builtin-tool-cloud-sandbox';
import {
  GroupManagementApiName,
  GroupManagementManifest,
} from '@lobechat/builtin-tool-group-management';
import { LobeAgentApiName, LobeAgentManifest } from '@lobechat/builtin-tool-lobe-agent';
import { LocalSystemApiName, LocalSystemIdentifier } from '@lobechat/builtin-tool-local-system';
import { MemoryApiName, MemoryManifest } from '@lobechat/builtin-tool-memory';
import {
  UserInteractionApiName,
  UserInteractionIdentifier,
} from '@lobechat/builtin-tool-user-interaction';
import {
  WebOnboardingApiName,
  WebOnboardingManifest,
} from '@lobechat/builtin-tool-web-onboarding';
import type { BuiltinIntervention, BuiltinInterventionProps } from '@lobechat/types';
import { createElement, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';

type LazyInterventionModule = Record<string, unknown>;
type LazyInterventionMap = Record<string, BuiltinIntervention | null | undefined>;
type LazyInterventionLoader = () => Promise<LazyInterventionModule>;

const EmptyIntervention: ComponentType<BuiltinInterventionProps> = () => null;

const getInterventionMap = (
  module: LazyInterventionModule,
  exportName: string,
): LazyInterventionMap => {
  const value = module[exportName];

  return value && typeof value === 'object' ? (value as LazyInterventionMap) : {};
};

const createLazyIntervention = (
  loadModule: LazyInterventionLoader,
  exportName: string,
  apiName: string,
): BuiltinIntervention => {
  const Intervention = lazy(async () => {
    const module = await loadModule();
    const intervention = getInterventionMap(module, exportName)[apiName];

    return {
      default: (intervention || EmptyIntervention) as ComponentType<BuiltinInterventionProps>,
    };
  });

  return ((props) =>
    createElement(
      Suspense,
      { fallback: null },
      createElement(Intervention, props as BuiltinInterventionProps),
    )) as BuiltinIntervention;
};

const createLazyInterventionMap = (
  apiNames: readonly string[],
  loadModule: LazyInterventionLoader,
  exportName: string,
): Record<string, BuiltinIntervention> =>
  Object.fromEntries(
    apiNames.map((apiName) => [
      apiName,
      createLazyIntervention(loadModule, exportName, apiName),
    ]),
  );

const localSystemInterventionApiNames = [
  LocalSystemApiName.editFile,
  LocalSystemApiName.globFiles,
  LocalSystemApiName.grepContent,
  LocalSystemApiName.listFiles,
  LocalSystemApiName.moveFiles,
  LocalSystemApiName.readFile,
  LocalSystemApiName.runCommand,
  LocalSystemApiName.searchFiles,
  LocalSystemApiName.writeFile,
  'editLocalFile',
  'globLocalFiles',
  'listLocalFiles',
  'moveLocalFiles',
  'readLocalFile',
  'renameLocalFile',
  'searchLocalFiles',
  'writeLocalFile',
] as const;

const cloudSandboxInterventionApiNames = [
  CloudSandboxApiName.editFile,
  CloudSandboxApiName.executeCode,
  CloudSandboxApiName.moveFiles,
  CloudSandboxApiName.runCommand,
  CloudSandboxApiName.writeFile,
  'editLocalFile',
  'moveLocalFiles',
  'writeLocalFile',
] as const;

/**
 * Builtin tools interventions registry
 * Organized by toolset (identifier) -> API name
 * Only register APIs that have custom intervention UI
 */
export const BuiltinToolInterventions: Record<string, Record<string, BuiltinIntervention>> = {
  [AgentBuilderManifest.identifier]: createLazyInterventionMap(
    [AgentBuilderApiName.installPlugin],
    () => import('@lobechat/builtin-tool-agent-builder/client'),
    'AgentBuilderInterventions',
  ),
  [ClaudeCodeIdentifier]: createLazyInterventionMap(
    [ClaudeCodeApiName.AskUserQuestion],
    () => import('@lobechat/builtin-tool-claude-code/client'),
    'ClaudeCodeInterventions',
  ),
  [CloudSandboxManifest.identifier]: createLazyInterventionMap(
    cloudSandboxInterventionApiNames,
    () => import('@lobechat/builtin-tool-cloud-sandbox/client'),
    'CloudSandboxInterventions',
  ),
  [GroupManagementManifest.identifier]: createLazyInterventionMap(
    [GroupManagementApiName.executeAgentTask, GroupManagementApiName.executeAgentTasks],
    () => import('@lobechat/builtin-tool-group-management/client'),
    'GroupManagementInterventions',
  ),
  [LobeAgentManifest.identifier]: createLazyInterventionMap(
    [LobeAgentApiName.clearTodos, LobeAgentApiName.createPlan, LobeAgentApiName.createTodos],
    () => import('@lobechat/builtin-tool-lobe-agent/client'),
    'LobeAgentInterventions',
  ),
  [LocalSystemIdentifier]: createLazyInterventionMap(
    localSystemInterventionApiNames,
    () => import('@lobechat/builtin-tool-local-system/client'),
    'LocalSystemInterventions',
  ),
  [MemoryManifest.identifier]: createLazyInterventionMap(
    [MemoryApiName.addExperienceMemory],
    () => import('@lobechat/builtin-tool-memory/client'),
    'MemoryInterventions',
  ),
  [UserInteractionIdentifier]: createLazyInterventionMap(
    [UserInteractionApiName.askUserQuestion],
    () => import('@lobechat/builtin-tool-user-interaction/client'),
    'UserInteractionInterventions',
  ),
  [WebOnboardingManifest.identifier]: createLazyInterventionMap(
    [WebOnboardingApiName.saveUserQuestion, WebOnboardingApiName.showAgentMarketplace],
    () => import('@lobechat/builtin-tool-web-onboarding/client'),
    'WebOnboardingInterventions',
  ),
};

export interface BuiltinInterventionRegistryEntry {
  apiName: string;
  identifier: string;
  intervention: BuiltinIntervention;
}

export const listBuiltinInterventionEntries = (): BuiltinInterventionRegistryEntry[] =>
  Object.entries(BuiltinToolInterventions).flatMap(([identifier, toolset]) =>
    Object.entries(toolset)
      .filter((entry): entry is [string, BuiltinIntervention] => !!entry[1])
      .map(([apiName, intervention]) => ({
        apiName,
        identifier,
        intervention,
      })),
  );

/**
 * Get builtin intervention component for a specific API
 * @param identifier - Tool identifier (e.g., 'lobe-local-system')
 * @param apiName - API name (e.g., 'runCommand')
 */
export const getBuiltinIntervention = (
  identifier?: string,
  apiName?: string,
): BuiltinIntervention | undefined => {
  if (!identifier || !apiName) return undefined;

  const toolset = BuiltinToolInterventions[identifier];
  if (!toolset) return undefined;

  return toolset[apiName];
};
