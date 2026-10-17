/**
 * Preview-only package budget. Uses Redis holds, not production usage tables.
 */
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import WebSocket from "ws";
import { loadLearnCallTestEnv } from "./learn-call-test-env.mjs";
import {
  learnAiCallBudgetKey,
  learnAiCallClockKey,
  learnAiCallContextKey,
  learnAiCallHoldKey,
  learnAiCallQuotaTestKey,
  learnAiCallSessionKey,
  learnAiCallSettledKey,
  learnAiCallBudgetDay,
  learnAiCallUsageKey,
} from "../lib/beego/learn/ai-call-access.js";

const env = loadLearnCallTestEnv();
const userId = "900000001";
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const ymd = learnAiCallBudgetDay();

function tokenFor(plan, sid) {
  return jwt.sign({ sub: userId, plan, purpose: "learn_ai_call", sid, learnAllow: 1 }, env.VOICE_JWT_SECRET, { expiresIn: 120 });
}
async function bind(sid, maxMinutes) {
  await redis.set(learnAiCallSessionKey(sid), userId, "EX", 120);
  await redis.set(
    learnAiCallContextKey(sid),
    JSON.stringify({ userId, lessonId: "p1-g1-n01", title: "Chào một người mới", objective: "Nói tên", level: 1, maxMinutes }),
    "EX",
    120
  );
}
function open(plan, sid) {
  const ws = new WebSocket(`ws://127.0.0.1:${env.wsPort}/?token=${encodeURIComponent(tokenFor(plan, sid))}&sessionId=${encodeURIComponent(sid)}`);
  const messages = [];
  let closeCode = 0;
  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      try { messages.push(JSON.parse(String(data))); } catch (_e) {}
    }
  });
  ws.on("close", (code) => { closeCode = code; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("open timeout")), 4000);
    ws.once("open", () => {
      clearTimeout(timer);
      resolve({
        ws,
        messages,
        code: () => closeCode,
      });
    });
    ws.once("error", reject);
  });
}
function waitFor(list, pred, ms) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const found = list.find(pred);
      if (found) {
        clearInterval(timer);
        resolve(found);
      } else if (Date.now() - start > ms) {
        clearInterval(timer);
        reject(new Error(`timeout; saw ${list.map((item) => item.type).join(",")}`));
      }
    }, 50);
  });
}
async function resetBudget() {
  await redis.del(
    learnAiCallBudgetKey(userId, ymd),
    learnAiCallHoldKey(userId),
    learnAiCallQuotaTestKey(userId)
  );
}

await resetBudget();
await redis.set(learnAiCallQuotaTestKey(userId), "7000", "EX", 300);
const stopId = `pkg-stop-${Date.now()}`;
await bind(stopId, 2);
const stopping = await open("pro", stopId);
const helloStop = await waitFor(stopping.messages, (item) => item.type === "hello", 4000);
const ended = await waitFor(stopping.messages, (item) => item.type === "call_ended", 12000);
await new Promise((r) => setTimeout(r, 2500));
const usedAfterStop = Number(await redis.hget(learnAiCallBudgetKey(userId, ymd), "usedMs") || 0);
const holdAfterStop = await redis.hget(learnAiCallHoldKey(userId), stopId);

await resetBudget();
await redis.set(learnAiCallQuotaTestKey(userId), "12000", "EX", 300);
const leftId = `pkg-a-${Date.now()}`;
const rightId = `pkg-b-${Date.now()}`;
const thirdId = `pkg-c-${Date.now()}`;
await bind(leftId, 0.15);
await bind(rightId, 0.15);
await bind(thirdId, 0.15);
const left = await open("pro", leftId);
const right = await open("pro", rightId);
const helloLeft = await waitFor(left.messages, (item) => item.type === "hello" || item.type === "call_ended", 4000);
const helloRight = await waitFor(right.messages, (item) => item.type === "hello" || item.type === "call_ended", 4000);
const third = await open("pro", thirdId);
const thirdMsg = await waitFor(third.messages, (item) => item.type === "call_ended" || item.type === "hello", 4000);
left.ws.close();
right.ws.close();
third.ws.close();

await resetBudget();
await redis.set(learnAiCallQuotaTestKey(userId), "60000", "EX", 300);
const againId = `pkg-re-${Date.now()}`;
await bind(againId, 2);
const first = await open("pro", againId);
const helloFirst = await waitFor(first.messages, (item) => item.type === "hello", 4000);
first.ws.close();
await new Promise((r) => setTimeout(r, 300));
const second = await open("pro", againId);
const helloSecond = await waitFor(second.messages, (item) => item.type === "hello", 4000);
const usedDuringReconnect = Number(await redis.hget(learnAiCallBudgetKey(userId, ymd), "usedMs") || 0);
const holdDuring = await redis.hget(learnAiCallHoldKey(userId), againId);
second.ws.close();
await new Promise((r) => setTimeout(r, 2600));
const usedOnce = Number(await redis.hget(learnAiCallBudgetKey(userId, ymd), "usedMs") || 0);
await new Promise((r) => setTimeout(r, 1500));
const usedStill = Number(await redis.hget(learnAiCallBudgetKey(userId, ymd), "usedMs") || 0);

const expiredId = `pkg-expired-${Date.now()}`;
await bind(expiredId, 2);
const expired = new WebSocket(`ws://127.0.0.1:${env.wsPort}/?token=${encodeURIComponent(tokenFor("expired", expiredId))}&sessionId=${encodeURIComponent(expiredId)}`);
const expiredCode = await new Promise((resolve) => expired.once("close", (code) => resolve(code)));

const keys = [
  learnAiCallBudgetKey(userId, ymd),
  learnAiCallHoldKey(userId),
  learnAiCallQuotaTestKey(userId),
  learnAiCallSessionKey(stopId),
  learnAiCallContextKey(stopId),
  learnAiCallClockKey(stopId),
  learnAiCallSettledKey(stopId),
  learnAiCallUsageKey(stopId),
  learnAiCallSessionKey(leftId),
  learnAiCallContextKey(leftId),
  learnAiCallSessionKey(rightId),
  learnAiCallContextKey(rightId),
  learnAiCallSessionKey(thirdId),
  learnAiCallContextKey(thirdId),
  learnAiCallSessionKey(againId),
  learnAiCallContextKey(againId),
  learnAiCallClockKey(againId),
  learnAiCallSettledKey(againId),
  learnAiCallUsageKey(againId),
  learnAiCallSessionKey(expiredId),
  learnAiCallContextKey(expiredId),
];
await redis.del(...keys);
await redis.quit();
console.log(JSON.stringify({
  packageStopsCall: ended.reason === "package_quota" && helloStop.packageQuota?.allowanceMs === 7000,
  sessionShorterThanTwoMinutes: Number(helloStop.callClock?.remainingMs) < 120000 && Number(helloStop.callClock?.remainingMs) <= 7000,
  settledNearGrant: usedAfterStop >= 6000 && usedAfterStop <= 9000,
  holdReleased: holdAfterStop == null,
  concurrentFits: helloLeft.type === "hello" && helloRight.type === "hello",
  thirdDenied: thirdMsg.type === "call_ended" && thirdMsg.reason === "package_quota",
  reconnectDeadline: helloFirst.callClock?.deadlineAt === helloSecond.callClock?.deadlineAt,
  reconnectUnsettled: usedDuringReconnect === 0 && Number(holdDuring) > 0,
  settledOnce: usedOnce > 0 && usedOnce === usedStill,
  expiredClose: expiredCode,
}));
