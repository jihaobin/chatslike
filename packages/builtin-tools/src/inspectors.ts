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
import { DocumentApiName, PageAgentManifest } from '@lobechat/builtin-tool-page-agent';
import {
  SelfFeedbackIntentApiName,
  selfFeedbackIntentManifest,
} from '@lobechat/builtin-tool-self-iteration';
import { SkillStoreApiName, SkillStoreManifest } from '@lobechat/builtin-tool-skill-store';
import { SkillsApiName, SkillsManifest } from '@lobechat/builtin-tool-skills';
import { TaskApiName, TaskManifest } from '@lobechat/builtin-tool-task';
import { WebBrowsingApiName, WebBrowsingManifest } from '@lobechat/builtin-tool-web-browsing';
import {
  WebOnboardingApiName,
  WebOnboardingManifest,
} from '@lobechat/builtin-tool-web-onboarding';
import {
  LINEAR_MCP_PREFIX,
  LINEAR_TOOL_NAMES,
} from '@lobechat/shared-tool-ui/inspectors/linear-labels';
import type { BuiltinInspector, BuiltinInspectorProps } from '@lobechat/types';
import { createElement, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';

/**
 * Builtin tools inspector registry
 * Organized by toolset (identifier) -> API name
 *
 * Inspector components are used to customize the title/header area
 * of tool calls in the conversation UI.
 */

export interface BuiltinInspectorRegistryEntry {
  apiName: string;
  identifier: string;
  inspector: BuiltinInspector;
}

type LazyInspectorModule = Record<string, unknown>;
type LazyInspectorMap = Record<string, BuiltinInspector | null | undefined>;
type LazyInspectorLoader = () => Promise<LazyInspectorModule>;

const EmptyInspector: ComponentType<BuiltinInspectorProps> = () => null;

const getInspectorMap = (module: LazyInspectorModule, exportName: string): LazyInspectorMap => {
  const value = module[exportName];

  return value && typeof value === 'object' ? (value as LazyInspectorMap) : {};
};

const createLazyInspector = (
  loadModule: LazyInspectorLoader,
  exportName: string,
  apiName: string,
): BuiltinInspector => {
  const Inspector = lazy(async () => {
    const module = await loadModule();
    const inspector = getInspectorMap(module, exportName)[apiName];

    return {
      default: (inspector || EmptyInspector) as ComponentType<BuiltinInspectorProps>,
    };
  });

  return ((props) =>
    createElement(
      Suspense,
      { fallback: null },
      createElement(Inspector, props as BuiltinInspectorProps),
    )) as BuiltinInspector;
};

const createLazyInspectorFactory = (
  loadModule: LazyInspectorLoader,
  exportName: string,
  ...factoryArgs: string[]
): BuiltinInspector => {
  const Inspector = lazy(async () => {
    const module = await loadModule();
    const factory = module[exportName] as ((...args: string[]) => BuiltinInspector) | undefined;
    const inspector = typeof factory === 'function' ? factory(...factoryArgs) : undefined;

    return {
      default: (inspector || EmptyInspector) as ComponentType<BuiltinInspectorProps>,
    };
  });

  return ((props) =>
    createElement(
      Suspense,
      { fallback: null },
      createElement(Inspector, props as BuiltinInspectorProps),
    )) as BuiltinInspector;
};

const createLazyInspectorMap = (
  apiNames: readonly string[],
  loadModule: LazyInspectorLoader,
  exportName: string,
): Record<string, BuiltinInspector> =>
  Object.fromEntries(
    apiNames.map((apiName) => [apiName, createLazyInspector(loadModule, exportName, apiName)]),
  );

const createLazyInspectorProxy = (
  loadModule: LazyInspectorLoader,
  exportName: string,
): Record<string, BuiltinInspector> => {
  const cache: Record<string, BuiltinInspector> = {};

  return new Proxy(cache, {
    get: (target, prop) => {
      if (typeof prop !== 'string') return undefined;
      target[prop] ||= createLazyInspector(loadModule, exportName, prop);
      return target[prop];
    },
  });
};

const localSystemInspectorApiNames = [
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

const cloudSandboxInspectorApiNames = [
  CloudSandboxApiName.editFile,
  CloudSandboxApiName.executeCode,
  CloudSandboxApiName.exportFile,
  CloudSandboxApiName.globFiles,
  CloudSandboxApiName.grepContent,
  CloudSandboxApiName.listFiles,
  CloudSandboxApiName.moveFiles,
  CloudSandboxApiName.readFile,
  CloudSandboxApiName.runCommand,
  CloudSandboxApiName.searchFiles,
  CloudSandboxApiName.writeFile,
  'editLocalFile',
  'globLocalFiles',
  'listLocalFiles',
  'moveLocalFiles',
  'readLocalFile',
  'searchLocalFiles',
  'writeLocalFile',
] as const;

const linearInspectorApiNames = LINEAR_TOOL_NAMES;
const claudeCodeLinearInspectorApiNames = LINEAR_TOOL_NAMES.map(
  (tool) => `${LINEAR_MCP_PREFIX}${tool}`,
);

const GithubIdentifier = 'github';
const LinearIdentifier = 'linear';
const TwitterIdentifier = 'twitter';

const BuiltinToolInspectors: Record<string, Record<string, BuiltinInspector>> = {
  [AgentBuilderManifest.identifier]: createLazyInspectorMap(
    [
      AgentBuilderApiName.getAvailableModels,
      AgentBuilderApiName.installPlugin,
      AgentBuilderApiName.searchMarketTools,
      AgentBuilderApiName.updateAgentConfig,
      AgentBuilderApiName.updatePrompt,
    ],
    () => import('@lobechat/builtin-tool-agent-builder/client'),
    'AgentBuilderInspectors',
  ),
  [AgentDocumentsManifest.identifier]: createLazyInspectorMap(
    [
      AgentDocumentsApiName.copyDocument,
      AgentDocumentsApiName.createDocument,
      AgentDocumentsApiName.listDocuments,
      AgentDocumentsApiName.modifyNodes,
      AgentDocumentsApiName.readDocument,
      AgentDocumentsApiName.removeDocument,
      AgentDocumentsApiName.renameDocument,
      AgentDocumentsApiName.replaceDocumentContent,
      AgentDocumentsApiName.updateLoadRule,
    ],
    () => import('@lobechat/builtin-tool-agent-documents/client'),
    'AgentDocumentsInspectors',
  ),
  [AgentManagementManifest.identifier]: createLazyInspectorMap(
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
    'AgentManagementInspectors',
  ),
  [ClaudeCodeIdentifier]: createLazyInspectorMap(
    [
      ClaudeCodeApiName.Agent,
      ClaudeCodeApiName.AskUserQuestion,
      ClaudeCodeApiName.Bash,
      ClaudeCodeApiName.Edit,
      ClaudeCodeApiName.Glob,
      ClaudeCodeApiName.Grep,
      ClaudeCodeApiName.Monitor,
      ClaudeCodeApiName.Read,
      ClaudeCodeApiName.ScheduleWakeup,
      ClaudeCodeApiName.Skill,
      ClaudeCodeApiName.TaskCreate,
      ClaudeCodeApiName.TaskGet,
      ClaudeCodeApiName.TaskList,
      ClaudeCodeApiName.TaskOutput,
      ClaudeCodeApiName.TaskStop,
      ClaudeCodeApiName.TaskUpdate,
      ClaudeCodeApiName.TodoWrite,
      ClaudeCodeApiName.ToolSearch,
      ClaudeCodeApiName.WebFetch,
      ClaudeCodeApiName.WebSearch,
      ClaudeCodeApiName.Write,
      ...claudeCodeLinearInspectorApiNames,
    ],
    () => import('@lobechat/builtin-tool-claude-code/client'),
    'ClaudeCodeInspectors',
  ),
  [CloudSandboxManifest.identifier]: createLazyInspectorMap(
    cloudSandboxInspectorApiNames,
    () => import('@lobechat/builtin-tool-cloud-sandbox/client'),
    'CloudSandboxInspectors',
  ),
  [GroupAgentBuilderManifest.identifier]: createLazyInspectorMap(
    [
      GroupAgentBuilderApiName.batchCreateAgents,
      GroupAgentBuilderApiName.createAgent,
      GroupAgentBuilderApiName.createGroup,
      GroupAgentBuilderApiName.getAgentInfo,
      GroupAgentBuilderApiName.inviteAgent,
      GroupAgentBuilderApiName.removeAgent,
      GroupAgentBuilderApiName.searchAgent,
      GroupAgentBuilderApiName.updateAgentPrompt,
      GroupAgentBuilderApiName.updateGroup,
      GroupAgentBuilderApiName.updateGroupPrompt,
      GroupAgentBuilderApiName.getAvailableModels,
      GroupAgentBuilderApiName.installPlugin,
      GroupAgentBuilderApiName.searchMarketTools,
      GroupAgentBuilderApiName.updateAgentConfig,
    ],
    () => import('@lobechat/builtin-tool-group-agent-builder/client'),
    'GroupAgentBuilderInspectors',
  ),
  [GroupManagementManifest.identifier]: createLazyInspectorMap(
    [
      GroupManagementApiName.broadcast,
      GroupManagementApiName.executeAgentTask,
      GroupManagementApiName.executeAgentTasks,
      GroupManagementApiName.speak,
    ],
    () => import('@lobechat/builtin-tool-group-management/client'),
    'GroupManagementInspectors',
  ),
  [KnowledgeBaseManifest.identifier]: createLazyInspectorMap(
    [KnowledgeBaseApiName.readKnowledge, KnowledgeBaseApiName.searchKnowledgeBase],
    () => import('@lobechat/builtin-tool-knowledge-base/client'),
    'KnowledgeBaseInspectors',
  ),
  [LobeAgentManifest.identifier]: createLazyInspectorMap(
    [
      LobeAgentApiName.analyzeVisualMedia,
      LobeAgentApiName.callSubAgent,
      LobeAgentApiName.callSubAgents,
      LobeAgentApiName.clearTodos,
      LobeAgentApiName.createPlan,
      LobeAgentApiName.createTodos,
      LobeAgentApiName.updatePlan,
      LobeAgentApiName.updateTodos,
    ],
    () => import('@lobechat/builtin-tool-lobe-agent/client'),
    'LobeAgentInspectors',
  ),
  [LocalSystemManifest.identifier]: createLazyInspectorMap(
    localSystemInspectorApiNames,
    () => import('@lobechat/builtin-tool-local-system/client'),
    'LocalSystemInspectors',
  ),
  [MemoryManifest.identifier]: createLazyInspectorMap(
    [
      MemoryApiName.addContextMemory,
      MemoryApiName.addExperienceMemory,
      MemoryApiName.addIdentityMemory,
      MemoryApiName.addPreferenceMemory,
      MemoryApiName.queryTaxonomyOptions,
      MemoryApiName.removeIdentityMemory,
      MemoryApiName.searchUserMemory,
      MemoryApiName.updateIdentityMemory,
    ],
    () => import('@lobechat/builtin-tool-memory/client'),
    'MemoryInspectors',
  ),
  [PageAgentManifest.identifier]: createLazyInspectorMap(
    [
      DocumentApiName.editTitle,
      DocumentApiName.getPageContent,
      DocumentApiName.initPage,
      DocumentApiName.modifyNodes,
      DocumentApiName.replaceText,
    ],
    () => import('@lobechat/builtin-tool-page-agent/client'),
    'PageAgentInspectors',
  ),
  [LobeActivatorManifest.identifier]: createLazyInspectorMap(
    [ActivatorApiName.activateSkill, ActivatorApiName.activateTools],
    () => import('@lobechat/builtin-tool-activator/client'),
    'LobeActivatorInspectors',
  ),
  [selfFeedbackIntentManifest.identifier]: createLazyInspectorMap(
    [SelfFeedbackIntentApiName.declareSelfFeedbackIntent],
    () => import('@lobechat/builtin-tool-self-iteration/client'),
    'SelfFeedbackIntentInspectors',
  ),
  [SkillStoreManifest.identifier]: createLazyInspectorMap(
    [
      SkillStoreApiName.importFromMarket,
      SkillStoreApiName.importSkill,
      SkillStoreApiName.searchSkill,
    ],
    () => import('@lobechat/builtin-tool-skill-store/client'),
    'SkillStoreInspectors',
  ),
  [SkillsManifest.identifier]: createLazyInspectorMap(
    [
      SkillsApiName.execScript,
      SkillsApiName.readReference,
      SkillsApiName.runCommand,
      SkillsApiName.activateSkill,
      'runSkill',
    ],
    () => import('@lobechat/builtin-tool-skills/client'),
    'SkillsInspectors',
  ),
  [TaskManifest.identifier]: createLazyInspectorMap(
    [
      TaskApiName.addTaskComment,
      TaskApiName.createTask,
      TaskApiName.createTasks,
      TaskApiName.deleteTask,
      TaskApiName.deleteTaskComment,
      TaskApiName.editTask,
      TaskApiName.listTasks,
      TaskApiName.runTask,
      TaskApiName.runTasks,
      TaskApiName.setTaskSchedule,
      TaskApiName.updateTaskComment,
      TaskApiName.updateTaskStatus,
      TaskApiName.viewTask,
    ],
    () => import('@lobechat/builtin-tool-task/client'),
    'TaskInspectors',
  ),
  [WebBrowsingManifest.identifier]: createLazyInspectorMap(
    [
      WebBrowsingApiName.crawlMultiPages,
      WebBrowsingApiName.crawlSinglePage,
      WebBrowsingApiName.search,
    ],
    () => import('@lobechat/builtin-tool-web-browsing/client'),
    'WebBrowsingInspectors',
  ),
  [WebOnboardingManifest.identifier]: createLazyInspectorMap(
    [
      WebOnboardingApiName.finishOnboarding,
      WebOnboardingApiName.readDocument,
      WebOnboardingApiName.saveUserQuestion,
      WebOnboardingApiName.showAgentMarketplace,
      WebOnboardingApiName.submitAgentPick,
      WebOnboardingApiName.updateDocument,
      WebOnboardingApiName.writeDocument,
    ],
    () => import('@lobechat/builtin-tool-web-onboarding/client'),
    'WebOnboardingInspectors',
  ),
  codex: {
    ...createLazyInspectorMap(['file_change', 'todo_list'], () => import('./codex'), 'CodexInspectors'),
    command_execution: createLazyInspectorFactory(
      () => import('@lobechat/shared-tool-ui/inspectors'),
      'createRunCommandInspector',
      'Run',
    ),
  },
  [GithubIdentifier]: createLazyInspectorMap(
    ['run_command'],
    () => import('./github'),
    'GithubInspectors',
  ),
  [LinearIdentifier]: createLazyInspectorMap(
    linearInspectorApiNames,
    () => import('./linear'),
    'LinearInspectors',
  ),
  [TwitterIdentifier]: createLazyInspectorProxy(() => import('./twitter'), 'TwitterInspectors'),
};

export const listBuiltinInspectorEntries = (): BuiltinInspectorRegistryEntry[] =>
  Object.entries(BuiltinToolInspectors).flatMap(([identifier, toolset]) =>
    Object.entries(toolset)
      .filter((entry): entry is [string, BuiltinInspector] => !!entry[1])
      .map(([apiName, inspector]) => ({
        apiName,
        identifier,
        inspector,
      })),
  );

/**
 * Get builtin inspector component for a specific API
 * @param identifier - Tool identifier (e.g., 'lobe-code-interpreter')
 * @param apiName - API name (e.g., 'executeCode')
 */
export const getBuiltinInspector = (
  identifier?: string,
  apiName?: string,
): BuiltinInspector | undefined => {
  if (!identifier || !apiName) return undefined;

  const toolset = BuiltinToolInspectors[identifier];
  if (!toolset) return undefined;

  return toolset[apiName];
};
