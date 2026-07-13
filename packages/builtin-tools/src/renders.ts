import {
  ActivatorApiName,
  LobeActivatorManifest,
} from '@lobechat/builtin-tool-activator';
import {
  AgentBuilderApiName,
  AgentBuilderManifest,
} from '@lobechat/builtin-tool-agent-builder';
import {
  AgentDocumentsApiName,
  AgentDocumentsManifest,
} from '@lobechat/builtin-tool-agent-documents';
import {
  AgentManagementApiName,
  AgentManagementManifest,
} from '@lobechat/builtin-tool-agent-management';
import { ClaudeCodeApiName, ClaudeCodeIdentifier } from '@lobechat/builtin-tool-claude-code';
import { CloudSandboxApiName, CloudSandboxManifest } from '@lobechat/builtin-tool-cloud-sandbox';
import {
  GroupAgentBuilderApiName,
  GroupAgentBuilderManifest,
} from '@lobechat/builtin-tool-group-agent-builder';
import {
  GroupManagementApiName,
  GroupManagementManifest,
} from '@lobechat/builtin-tool-group-management';
import {
  KnowledgeBaseApiName,
  KnowledgeBaseManifest,
} from '@lobechat/builtin-tool-knowledge-base';
import { LobeAgentApiName, LobeAgentManifest } from '@lobechat/builtin-tool-lobe-agent';
import { LocalSystemApiName, LocalSystemManifest } from '@lobechat/builtin-tool-local-system';
import { MemoryApiName, MemoryManifest } from '@lobechat/builtin-tool-memory';
import { NotebookApiName, NotebookIdentifier } from '@lobechat/builtin-tool-notebook';
import { DocumentApiName, PageAgentManifest } from '@lobechat/builtin-tool-page-agent';
import { SkillStoreApiName, SkillStoreManifest } from '@lobechat/builtin-tool-skill-store';
import { SkillsApiName, SkillsManifest } from '@lobechat/builtin-tool-skills';
import { TaskApiName, TaskManifest } from '@lobechat/builtin-tool-task';
import { WebBrowsingApiName, WebBrowsingManifest } from '@lobechat/builtin-tool-web-browsing';
import {
  WebOnboardingApiName,
  WebOnboardingManifest,
} from '@lobechat/builtin-tool-web-onboarding';
import type { BuiltinRender, BuiltinRenderProps } from '@lobechat/types';
import { createElement, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';

export interface BuiltinRenderRegistryEntry {
  apiName: string;
  identifier: string;
  render: BuiltinRender;
}

type LazyRenderModule = Record<string, unknown>;
type LazyRenderMap = Record<string, BuiltinRender | null | undefined>;
type LazyRenderLoader = () => Promise<LazyRenderModule>;

const EmptyRender: ComponentType<BuiltinRenderProps> = () => null;

const getRenderMap = (module: LazyRenderModule, exportName: string): LazyRenderMap => {
  const value = module[exportName];

  return value && typeof value === 'object' ? (value as LazyRenderMap) : {};
};

const createLazyRender = (
  loadModule: LazyRenderLoader,
  exportName: string,
  apiName: string,
): BuiltinRender => {
  const Render = lazy(async () => {
    const module = await loadModule();
    const render = getRenderMap(module, exportName)[apiName];

    return {
      default: (render || EmptyRender) as ComponentType<BuiltinRenderProps>,
    };
  });

  return ((props) =>
    createElement(
      Suspense,
      { fallback: null },
      createElement(Render, props as BuiltinRenderProps),
    )) as BuiltinRender;
};

const createLazyRenderExport = (
  loadModule: LazyRenderLoader,
  exportName: string,
): BuiltinRender => {
  const Render = lazy(async () => {
    const module = await loadModule();
    const render = module[exportName] as BuiltinRender | undefined;

    return {
      default: (render || EmptyRender) as ComponentType<BuiltinRenderProps>,
    };
  });

  return ((props) =>
    createElement(
      Suspense,
      { fallback: null },
      createElement(Render, props as BuiltinRenderProps),
    )) as BuiltinRender;
};

const createLazyRenderMap = (
  apiNames: readonly string[],
  loadModule: LazyRenderLoader,
  exportName: string,
): Record<string, BuiltinRender> =>
  Object.fromEntries(
    apiNames.map((apiName) => [apiName, createLazyRender(loadModule, exportName, apiName)]),
  );

const localSystemRenderApiNames = [
  LocalSystemApiName.editFile,
  LocalSystemApiName.listFiles,
  LocalSystemApiName.moveFiles,
  LocalSystemApiName.readFile,
  LocalSystemApiName.runCommand,
  LocalSystemApiName.searchFiles,
  LocalSystemApiName.writeFile,
  'editLocalFile',
  'listLocalFiles',
  'moveLocalFiles',
  'readLocalFile',
  'searchLocalFiles',
  'writeLocalFile',
] as const;

const cloudSandboxRenderApiNames = [
  CloudSandboxApiName.editFile,
  CloudSandboxApiName.executeCode,
  CloudSandboxApiName.exportFile,
  CloudSandboxApiName.listFiles,
  CloudSandboxApiName.moveFiles,
  CloudSandboxApiName.readFile,
  CloudSandboxApiName.runCommand,
  CloudSandboxApiName.searchFiles,
  CloudSandboxApiName.writeFile,
  'editLocalFile',
  'listLocalFiles',
  'moveLocalFiles',
  'readLocalFile',
  'searchLocalFiles',
  'writeLocalFile',
] as const;

/**
 * Builtin tools renders registry
 * Organized by toolset (identifier) -> API name
 */
const BuiltinToolsRenders: Record<string, Record<string, BuiltinRender>> = {
  [AgentBuilderManifest.identifier]: createLazyRenderMap(
    [
      AgentBuilderApiName.getAvailableModels,
      AgentBuilderApiName.searchMarketTools,
      AgentBuilderApiName.installPlugin,
      AgentBuilderApiName.updateAgentConfig,
      AgentBuilderApiName.updatePrompt,
    ],
    () => import('@lobechat/builtin-tool-agent-builder/client'),
    'AgentBuilderRenders',
  ),
  [AgentDocumentsManifest.identifier]: createLazyRenderMap(
    [AgentDocumentsApiName.createDocument],
    () => import('@lobechat/builtin-tool-agent-documents/client'),
    'AgentDocumentsRenders',
  ),
  [AgentManagementManifest.identifier]: createLazyRenderMap(
    [
      AgentManagementApiName.callAgent,
      AgentManagementApiName.createAgent,
      AgentManagementApiName.duplicateAgent,
      AgentManagementApiName.getAgentDetail,
      AgentManagementApiName.installPlugin,
      AgentManagementApiName.searchAgent,
      AgentManagementApiName.updateAgent,
      AgentManagementApiName.updatePrompt,
    ],
    () => import('@lobechat/builtin-tool-agent-management/client'),
    'AgentManagementRenders',
  ),
  [ClaudeCodeIdentifier]: createLazyRenderMap(
    [
      ClaudeCodeApiName.Agent,
      ClaudeCodeApiName.AskUserQuestion,
      ClaudeCodeApiName.Bash,
      ClaudeCodeApiName.Edit,
      ClaudeCodeApiName.Glob,
      ClaudeCodeApiName.Grep,
      ClaudeCodeApiName.Read,
      ClaudeCodeApiName.Skill,
      ClaudeCodeApiName.TaskList,
      ClaudeCodeApiName.TaskUpdate,
      ClaudeCodeApiName.TodoWrite,
      ClaudeCodeApiName.WebFetch,
      ClaudeCodeApiName.WebSearch,
      ClaudeCodeApiName.Write,
    ],
    () => import('@lobechat/builtin-tool-claude-code/client'),
    'ClaudeCodeRenders',
  ),
  [CloudSandboxManifest.identifier]: createLazyRenderMap(
    cloudSandboxRenderApiNames,
    () => import('@lobechat/builtin-tool-cloud-sandbox/client'),
    'CloudSandboxRenders',
  ),
  [GroupAgentBuilderManifest.identifier]: createLazyRenderMap(
    [
      GroupAgentBuilderApiName.batchCreateAgents,
      GroupAgentBuilderApiName.updateAgentPrompt,
      GroupAgentBuilderApiName.updateGroupPrompt,
    ],
    () => import('@lobechat/builtin-tool-group-agent-builder/client'),
    'GroupAgentBuilderRenders',
  ),
  [GroupManagementManifest.identifier]: createLazyRenderMap(
    [
      GroupManagementApiName.broadcast,
      GroupManagementApiName.executeAgentTask,
      GroupManagementApiName.executeAgentTasks,
      GroupManagementApiName.speak,
    ],
    () => import('@lobechat/builtin-tool-group-management/client'),
    'GroupManagementRenders',
  ),
  [KnowledgeBaseManifest.identifier]: createLazyRenderMap(
    [KnowledgeBaseApiName.readKnowledge, KnowledgeBaseApiName.searchKnowledgeBase],
    () => import('@lobechat/builtin-tool-knowledge-base/client'),
    'KnowledgeBaseRenders',
  ),
  [LobeAgentManifest.identifier]: createLazyRenderMap(
    [
      LobeAgentApiName.callSubAgent,
      LobeAgentApiName.callSubAgents,
      LobeAgentApiName.createPlan,
      LobeAgentApiName.updatePlan,
      LobeAgentApiName.clearTodos,
      LobeAgentApiName.createTodos,
      LobeAgentApiName.updateTodos,
    ],
    () => import('@lobechat/builtin-tool-lobe-agent/client'),
    'LobeAgentRenders',
  ),
  [LocalSystemManifest.identifier]: createLazyRenderMap(
    localSystemRenderApiNames,
    () => import('@lobechat/builtin-tool-local-system/client'),
    'LocalSystemRenders',
  ),
  [MemoryManifest.identifier]: createLazyRenderMap(
    [
      MemoryApiName.addExperienceMemory,
      MemoryApiName.addPreferenceMemory,
      MemoryApiName.searchUserMemory,
    ],
    () => import('@lobechat/builtin-tool-memory/client'),
    'MemoryRenders',
  ),
  [NotebookIdentifier]: createLazyRenderMap(
    [NotebookApiName.createDocument],
    () => import('./notebook'),
    'NotebookRenders',
  ),
  [PageAgentManifest.identifier]: createLazyRenderMap(
    [DocumentApiName.modifyNodes],
    () => import('@lobechat/builtin-tool-page-agent/client'),
    'PageAgentRenders',
  ),
  [SkillStoreManifest.identifier]: createLazyRenderMap(
    [
      SkillStoreApiName.importFromMarket,
      SkillStoreApiName.importSkill,
      SkillStoreApiName.searchSkill,
    ],
    () => import('@lobechat/builtin-tool-skill-store/client'),
    'SkillStoreRenders',
  ),
  [SkillsManifest.identifier]: createLazyRenderMap(
    [
      SkillsApiName.execScript,
      SkillsApiName.readReference,
      SkillsApiName.runCommand,
      SkillsApiName.activateSkill,
    ],
    () => import('@lobechat/builtin-tool-skills/client'),
    'SkillsRenders',
  ),
  [TaskManifest.identifier]: createLazyRenderMap(
    [TaskApiName.createTask, TaskApiName.createTasks, TaskApiName.runTasks],
    () => import('@lobechat/builtin-tool-task/client'),
    'TaskRenders',
  ),
  [LobeActivatorManifest.identifier]: createLazyRenderMap(
    [ActivatorApiName.activateSkill],
    () => import('@lobechat/builtin-tool-activator/client'),
    'LobeActivatorRenders',
  ),
  [WebBrowsingManifest.identifier]: createLazyRenderMap(
    [
      WebBrowsingApiName.crawlMultiPages,
      WebBrowsingApiName.crawlSinglePage,
      WebBrowsingApiName.search,
    ],
    () => import('@lobechat/builtin-tool-web-browsing/client'),
    'WebBrowsingRenders',
  ),
  [WebOnboardingManifest.identifier]: createLazyRenderMap(
    [
      WebOnboardingApiName.saveUserQuestion,
      WebOnboardingApiName.updateDocument,
      WebOnboardingApiName.writeDocument,
      WebOnboardingApiName.showAgentMarketplace,
      WebOnboardingApiName.submitAgentPick,
    ],
    () => import('@lobechat/builtin-tool-web-onboarding/client'),
    'WebOnboardingRenders',
  ),
  codex: {
    ...createLazyRenderMap(['file_change', 'todo_list'], () => import('./codex'), 'CodexRenders'),
    command_execution: createLazyRenderExport(
      () => import('@lobechat/shared-tool-ui/renders'),
      'RunCommandRender',
    ),
  },
  github: createLazyRenderMap(['run_command'], () => import('./github'), 'GithubRenders'),
};

export const listBuiltinRenderEntries = (): BuiltinRenderRegistryEntry[] =>
  Object.entries(BuiltinToolsRenders).flatMap(([identifier, toolset]) =>
    Object.entries(toolset)
      .filter((entry): entry is [string, BuiltinRender] => !!entry[1])
      .map(([apiName, render]) => ({
        apiName,
        identifier,
        render,
      })),
  );

/**
 * Get builtin render component for a specific API
 * @param identifier - Tool identifier (e.g., 'lobe-local-system')
 * @param apiName - API name (e.g., 'searchFiles')
 */
export const getBuiltinRender = (
  identifier?: string,
  apiName?: string,
): BuiltinRender | undefined => {
  if (!identifier) return undefined;

  const toolset = BuiltinToolsRenders[identifier];
  if (!toolset) return undefined;

  if (apiName && toolset[apiName]) {
    return toolset[apiName];
  }

  return undefined;
};

export { getBuiltinRenderDisplayControl } from './displayControls';
