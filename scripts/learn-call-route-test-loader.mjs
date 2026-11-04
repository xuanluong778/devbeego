/** Test-only dependency injection. No production service or database is contacted. */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const data = code => ({ url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true });
export async function resolve(specifier, context, next) {
  if (specifier === 'next/server') return next(pathToFileURL(path.join(root, 'node_modules/next/server.js')).href, context);
  if (specifier === '@/lib/http/ai-entitlement') return data(`export async function getSessionUserIdFromRequest(r) { return r.headers.get('x-test-user') || null; }`);
  if (specifier === '@/lib/voice/redis') return data(`export function getVoiceRedis() { return globalThis.__learnCallRouteRedis; }`);
  if (specifier === '@/lib/voice/jwt') return data(`export function signVoiceJwt() { return 'synthetic-test-token'; }`);
  if (specifier === '@/lib/db') return data(`export default { async query(sql) { return [sql.includes('FROM users') ? [{email: 'learn-call-test@example.invalid'}] : [{plan:'pro'}]]; } };`);
  if (specifier === '@/lib/auth/admin-entitlement') return data(`export function shouldBypassEntitlementsForEmail() { return true; }`);
  if (specifier === '@/lib/subscriptions/subscription-service') return data(`export function getUserPlan() { return 'pro'; }`);
  if (specifier === '@/lib/beego/learning-path-progress') return data(`export async function getLearningPathForUser() { return { sections: [] }; }`);
  if (specifier === '@/lib/beego/learn/ai-call-access') return data(`export * from ${JSON.stringify(pathToFileURL(path.join(root,'lib/beego/learn/ai-call-access.js')).href)};
    export function resolveUnlockedGateCall() { return {ok:true, lessonId:'g01l01',sectionId:'p1-g1',topicTitle:'Chào hỏi'}; }`);
  return next(specifier, context);
}
