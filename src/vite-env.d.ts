/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POLITE_MAILTO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// DS2 topic animations (public/topic-anim.js). The script is a vanilla IIFE
// loaded from index.html, so it attaches to `window`. Declared here so React
// components can call it without `// @ts-ignore`.
interface Window {
  mountTopicAnim?: (
    el: HTMLElement,
    topicId: string,
    variant?: 'desktop' | 'mobile'
  ) => void;
  PV_TOPIC_ANIM_IDS?: string[];
}
