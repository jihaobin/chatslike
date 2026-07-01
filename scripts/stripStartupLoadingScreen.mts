export const stripStartupLoadingScreen = (html: string) =>
  html
    .replace(/\n\s*#loading-screen\s*\{[\s\S]*?\n\s*\}/g, '')
    .replace(/\n\s*@keyframes loading-(?:draw|fill)\s*\{(?:\n\s*[^{}\n]*\{[^{}\n]*\})+\n\s*\}/g, '')
    .replace(/\n\s*#loading-brand\s*\{[\s\S]*?\n\s*\}/g, '')
    .replace(/\n\s*#loading-brand svg path\s*\{[\s\S]*?\n\s*\}/g, '')
    .replace(/\n\s*html\[data-theme='dark'\] #loading-brand\s*\{[\s\S]*?\n\s*\}/g, '')
    .replace(
      /\n\s*<div id=["']loading-screen["']>\s*\n\s*<div id=["']loading-brand["'][\s\S]*?\n\s*<\/div>\s*\n\s*<\/div>(?=\s*\n\s*<div id=["']root["'])/g,
      '',
    );
