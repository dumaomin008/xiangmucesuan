/** 普通对话 / 智能解读。不得与资料解析共用。 */
export const AI_CHAT_TIMEOUT_MS = 9_000;

/** 资料解析单次模型请求。页面需同时展示“正在解析资料”。 */
export const AI_DOCUMENT_TIMEOUT_MS = 25_000;

/** 健康检查只探测可达性，不占用对话超时。 */
export const AI_HEALTH_TIMEOUT_MS = 5_000;
