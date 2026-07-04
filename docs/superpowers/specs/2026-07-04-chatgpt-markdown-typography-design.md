# ChatGPT Markdown Typography Design

Date: 2026-07-04

## Context

The previous chat UI work focused on the conversation rail and the bottom composer. This design narrows the next step to the assistant message Markdown content area. The user compared the current LobeHub conversation page with ChatGPT's official web UI and clarified that the largest mismatch is not the composer, but the typography rhythm inside rendered Markdown.

The target is not to compress all spacing. The target is to reproduce ChatGPT's block rhythm: larger and clearer text hierarchy, stable line height, explicit spacing between paragraphs and content blocks, and stronger heading levels.

## Scope

In scope:

- Agent and group conversation assistant Markdown rendered through `src/features/Conversation/Markdown/index.tsx`.
- Typography tokens passed to `@lobehub/ui` `Markdown`: `fontSize`, `lineHeight`, `marginMultiple`, and `headerMultiple`.
- Scoped CSS for Markdown elements that define visual rhythm: paragraphs, headings, lists, blockquotes, horizontal rules, inline code, code blocks, and tables.
- Tests at the `MarkdownMessage` wrapper layer to prove the ChatGPT variant reaches the real `Markdown` component with the expected props and class.

Out of scope:

- Bottom chat input/composer layout or functionality.
- Conversation data flow, streaming behavior, citations, artifacts, Mermaid, HTML preview, or custom Markdown plugins.
- Global `@lobehub/ui` Markdown defaults.
- Non-conversation Markdown surfaces such as settings pages, community pages, share previews, or plugin details.

## Visual Target

The desired Markdown style should match the ChatGPT screenshot more closely:

- Body text should read larger and more confident than the current page. The initial target is `17px` for the ChatGPT conversation variant.
- Body line height should remain comfortable rather than compressed. The target range is `1.58` to `1.64`.
- Paragraphs should have clear block separation. Adjacent paragraphs should not collapse into a dense wall of text.
- Headings should be visibly distinct from body text. Large section headings should be much larger and heavier than normal paragraphs, similar to ChatGPT's "第一梯队" section heading.
- Lists should keep readable item spacing. They should not be squeezed, but also should not inherit the older loose document-style rhythm.
- Blockquotes should feel like highlighted content blocks, with a light left rule and enough vertical margin.
- Horizontal rules should create real section separation, with generous top and bottom spacing.

## Implementation Approach

Use a scoped ChatGPT Markdown variant, not a global Markdown change.

The existing `ConversationMarkdownVariantProvider` already lets agent and group conversation pages opt into a `chatgpt` variant. The implementation should refine that variant rather than introduce another rendering path.

`getConversationMarkdownVariantConfig('chatgpt')` should define semantic typography values for the wrapper:

- `fontSize`: target `17`
- `lineHeight`: target around `1.6`
- `marginMultiple`: adjusted for ChatGPT block rhythm, not minimum spacing
- `headerMultiple`: adjusted so headings are materially larger than body text

`MarkdownMessage` should continue to render `@lobehub/ui` `Markdown` and merge existing `componentProps`, plugins, and caller props. It should add a scoped class only when the conversation Markdown variant is `chatgpt`.

The scoped CSS should tune elements in terms of visual hierarchy:

- `p`: preserve normal line rhythm and add meaningful bottom margin.
- `h1`, `h2`, `h3`: increase size and set larger top margin than bottom margin.
- `ul`, `ol`, `li`: align with ChatGPT's readable list rhythm.
- `blockquote`: use a subtle left border, heavier quote text when appropriate, and distinct block spacing.
- `hr`: use a single light divider with generous vertical margin.
- `code:not(pre code)`: keep a light inline code treatment.
- `pre` and `table`: preserve existing functionality while aligning spacing with the surrounding Markdown.

## Testing

Add focused tests for `src/features/Conversation/Markdown/index.tsx`.

The tests should mock `@lobehub/ui` `Markdown` and verify:

- Default conversation Markdown does not receive ChatGPT-only typography overrides.
- ChatGPT conversation Markdown passes the intended `fontSize`, `lineHeight`, `marginMultiple`, and `headerMultiple`.
- Existing `componentProps.highlight` and `componentProps.mermaid` merging still preserves caller-provided props.
- The ChatGPT scoped class is attached only for the `chatgpt` variant.

Existing layout tests under `src/features/Conversation/ChatInput/layout.test.ts` should be updated only if typography token values move there.

## Validation

Run focused validation only:

```bash
bunx vitest run --silent='passed-only' src/features/Conversation/Markdown/index.test.tsx src/features/Conversation/ChatInput/layout.test.ts
node .\node_modules\eslint\bin\eslint.js src/features/Conversation/Markdown/index.tsx src/features/Conversation/Markdown/index.test.tsx src/features/Conversation/ChatInput/layout.ts
git diff --check
```

Full local SPA screenshot validation is not required for this task because the target page depends on real user data and local SPA cannot reproduce the user's authenticated conversation state.

## Risks

- If the current page uses a route that does not receive `ConversationMarkdownVariantProvider`, the style will not apply. The implementation should include a source-level check that agent and group conversation `ChatList` calls still pass `markdownVariant="chatgpt"`.
- If `@lobehub/ui` Markdown internal CSS has high specificity, scoped CSS may need to target element selectors inside the ChatGPT class rather than relying only on the official props.
- Over-tuning paragraph spacing can make non-heading long-form answers feel too loose. The first implementation should bias toward matching the provided screenshots and then rely on user screenshot feedback for final pixel tuning.
