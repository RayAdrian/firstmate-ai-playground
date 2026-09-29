/** Environment variables as a plain string map (Next's ProcessEnv augmentation requires NODE_ENV, which tests and callers don't set). */
export type Env = Readonly<Record<string, string | undefined>>;
