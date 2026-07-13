export type HomeChatMode = 'welcome' | 'chat';

export type StarterMode = 'agent' | 'group' | 'write' | 'video' | 'research' | 'image' | null;

export interface HomeInputState {
  homeChatMode: HomeChatMode;
  homeInputLoading: boolean;
  inputActiveMode: StarterMode;
}

export const initialHomeInputState: HomeInputState = {
  homeChatMode: 'welcome',
  homeInputLoading: false,
  inputActiveMode: null,
};
