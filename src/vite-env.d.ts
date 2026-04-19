interface ImportMetaEnv {
  readonly VITE_POLITE_MAILTO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  mountTopicAnim?: (
    el: HTMLElement,
    topicId: string,
    variant?: 'desktop' | 'mobile'
  ) => void;
  PV_TOPIC_ANIM_IDS?: string[];
}
