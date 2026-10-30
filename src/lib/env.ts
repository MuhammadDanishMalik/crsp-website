/**
 * Reads an environment variable at run time. The key is looked up dynamically on purpose: a literal `process.env.NAME`
 * can be replaced by its value while the app is built, which would bake the build machine's value into the bundle
 * (and secret scanners then flag it).
 */
export const runtimeEnv = (key: string): string | undefined => process.env[key];
