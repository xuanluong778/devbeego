// Browser checks use real catalog fixtures and intercept APIs; no account/progress is changed.
// Run with the repository alias loader. Playwright is a test-only external tool.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLearningPathFromCatalog } from "../lib/beego/learning-path-build.js";
const { chromium } = await import(process.env.BEEGO_PLAYWRIGHT_MODULE || "playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "docs/beego-icon-cua-1/manifest.json")));
const base = process.env.BEEGO_TEST_BASE_URL || "http://127.0.0.1:3099";
const fixtures = {};
for (const [name, activeLessonId] of Object.entries({ initial: "g01l01", mixed: "g01l05", exam: "g01exam", completed: "g02l01" })) {
  fixtures[name] = buildLearningPathFromCatalog({ activeLessonId });
}
fixtures.locked = structuredClone(fixtures.initial);
fixtures.locked.sections[0].nodes.forEach((node) => { node.status = "locked"; });
(async()=>{
 const browser=await chromium.launch({...(process.env.BEEGO_CHROMIUM_PATH ? { executablePath: process.env.BEEGO_CHROMIUM_PATH } : {}),headless:true,args:['--no-sandbox']});
 const results=[];
 for(const width of [360,390,1024]){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:3,isMobile:width<768,hasTouch:width<768,serviceWorkers:"block"});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let fixture=fixtures.mixed;
  const requests=[];
  const callAccess=[];
  page.on('request',req=>{if(req.url().includes('/lesson-icons/'))requests.push(req.url())});
  await page.route('**/api/**',route=>{
   const pathname=new URL(route.request().url()).pathname;
   let data={success:true,data:{}};
   if(pathname==='/api/learning-path')data={success:true,data:fixture};
   else if(pathname==='/api/learn/ai-call/status')data={success:true,data:{enabled:true}};
   else if(pathname==='/api/auth/me')data={success:false};
   else if(pathname==='/api/dashboard')data={success:true,data:{}};
   else if(pathname==='/api/learn/ai-call/access'){
    callAccess.push(new URL(route.request().url()));
    return route.fulfill({status:401,json:{success:false,code:'AUTH_REQUIRED'}});
   }
   return route.fulfill({json:data});
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:120000});
  const gate=page.locator('section[data-section-id="c50-g01"]');
  await gate.locator('[data-lesson-id="g01l05"][data-node-status="active"]').waitFor();
  assert.equal(await gate.locator('button[data-lesson-id]').count(),17);
  assert.deepEqual(await gate.locator('button[data-lesson-id]').evaluateAll(els=>els.map(e=>e.dataset.lessonId)),fixture.sections[0].nodes.map(n=>n.lessonId));
  const loadedBeforeScroll=requests.length;
  for(const node of fixture.sections[0].nodes){
   const button=gate.locator(`button[data-lesson-id="${node.lessonId}"]`);
   const image=button.locator('img');
   const entry=manifest.find(row=>row.id===node.lessonId);
   assert.equal(await image.getAttribute('src'),'/uploads/lesson-icons/gate-01/'+entry.file.replace('.png','.webp'));
   assert.equal(await image.getAttribute('alt'),'');assert.equal(await image.getAttribute('loading'),'lazy');
   assert.equal(await button.locator('.beego-learn-node__title').textContent(),node.title);
   assert.equal(await button.getAttribute('data-node-status'),node.status);
   await button.scrollIntoViewIfNeeded();
   await image.evaluate(img=>img.decode());
   const rects=await button.evaluate(el=>{
    const rect=selector=>{const r=el.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const badge=el.querySelector('.beego-learn-node__artwork-status');
    return {circle:rect('.beego-learn-node__circle'),image:rect('img'),badge:badge?rect('.beego-learn-node__artwork-status'):null};
   });
   assert(rects.circle.width>=72&&rects.circle.width<=80);
   assert(rects.image.width>=62&&rects.image.width<=66);
   assert(rects.image.x>=0&&rects.image.right<=width,`${node.lessonId} outside ${width}px viewport`);
   if(node.status==='completed'||node.status==='locked'){
    assert(rects.badge,`${node.lessonId} missing status`);
    assert(rects.badge.x>=rects.image.right-1||rects.badge.y>=rects.image.bottom-1,'Badge covers artwork');
   } else assert.equal(rects.badge,null);
  }
  const call=gate.locator('button[data-gate-call="c50-g01"]');
  assert.equal(await call.count(),1);assert.equal(await call.isEnabled(),true);
  assert.equal(await call.getAttribute('data-lesson-id'),null);
  assert((await call.locator('img').getAttribute('src')).endsWith('19-gau-goi-gia-su-ai.webp'));
  await call.click();
  const callDialog=page.locator('[role="dialog"][aria-label="Gọi gia sư AI"]');
  await callDialog.getByRole('button',{name:'Quay lại bản đồ'}).waitFor();
  assert.equal(callAccess.length,1);
  assert.equal(callAccess[0].searchParams.get('lessonId'),'g01l05');
  assert.equal(callAccess[0].searchParams.get('sectionId'),'c50-g01');
  await callDialog.getByRole('button',{name:'Quay lại bản đồ'}).click();
  assert.equal(await page.locator('img[src*="18-gia-su-ai"]').count(),0);
  assert.equal(await page.locator('section[data-section-id="c50-g02"] .beego-learn-node--gate-01').count(),0);
  const other=page.locator('button[data-lesson-id="g02l01"]');
  await other.scrollIntoViewIfNeeded();
  assert.equal(await other.locator('img').count(),0);assert.equal(await other.locator('svg').count(),1);
  const target=gate.locator('button[data-lesson-id="g01l05"]');
  await target.scrollIntoViewIfNeeded();await target.focus();
  assert(await target.evaluate(el=>el.matches(':focus')));
  assert(await target.locator('..').evaluate(el=>el.classList.contains('is-open')));
  if(width>=768)await target.locator('..').locator('[role="tooltip"]').waitFor();
  await page.keyboard.press('Enter');
  await page.locator('[role="dialog"]').waitFor();
  assert((await page.locator('[role="dialog"]').innerText()).includes('Gặp giáo viên'));
  await page.keyboard.press('Escape');
  // Close button handles sheets that do not support Escape.
  if(await page.locator('[role="dialog"]').count())await page.locator('[role="dialog"] button[aria-label="Đóng"]').click();
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await target.locator('img').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await target.scrollIntoViewIfNeeded();
  await page.screenshot({path:`/tmp/beego-gate-01-${width}.png`,scale:'css'});
  // A broken WebP must switch to SVG once, keep the same button and dimensions.
  let failures=0;
  await page.route('**/01-chao-lan-dau.webp',route=>{failures++;return route.abort()});
  fixture=fixtures.initial;
  await page.reload({waitUntil:'domcontentloaded'});
  const failed=page.locator('button[data-lesson-id="g01l01"]');
  await failed.scrollIntoViewIfNeeded();
  await failed.locator('.beego-learn-node-icon > svg').waitFor();
  assert.equal(await failed.locator('img').count(),0);assert.equal(failures,1);
  assert(await failed.isEnabled());
  await page.unroute('**/01-chao-lan-dau.webp');
  fixture=fixtures.locked;
  await page.reload({waitUntil:'domcontentloaded'});
  await gate.locator('button[data-gate-call="c50-g01"]:disabled').waitFor();
  assert.equal(await gate.locator('button[data-gate-call] .beego-learn-node__artwork-status--locked').count(),1);
  await gate.locator('button[data-lesson-id="g01l02"]').click();
  await page.locator('[role="dialog"]').waitFor();
  assert((await page.locator('[role="dialog"]').innerText()).includes('Hoàn thành bài trước'));
  // The exam uses its trophy image in active/completed states too.
  for (const state of ['exam', 'completed']) {
   fixture=fixtures[state];
   await page.reload({waitUntil:'domcontentloaded'});
   const exam=page.locator('button[data-lesson-id="g01exam"]');
   await page.locator(`button[data-lesson-id="g01exam"][data-node-status="${state==='completed'?'completed':'active'}"]`).waitFor();
   await exam.scrollIntoViewIfNeeded();
   await exam.locator('img').evaluate(img=>img.decode());
   assert((await exam.locator('img').getAttribute('src')).endsWith('17-thi-vuot-cua.webp'));
   assert.equal(await exam.locator('.beego-learn-node__artwork-status').count(),state==='completed'?1:0);
   assert.equal(await exam.getAttribute('data-node-status'),state==='completed'?'completed':'active');
  }
  // A broken feature icon retains the legacy camera, without a fake lesson ID.
  let callFailures=0;
  await page.route('**/19-gau-goi-gia-su-ai.webp',route=>{callFailures++;return route.abort()});
  fixture=fixtures.initial;
  await page.reload({waitUntil:'domcontentloaded'});
  const brokenCall=page.locator('button[data-gate-call="c50-g01"]');
  await brokenCall.scrollIntoViewIfNeeded();
  await brokenCall.locator('.beego-learn-node-icon--camera > svg').waitFor();
  assert.equal(await brokenCall.locator('img').count(),0);
  assert.equal(await brokenCall.getAttribute('data-lesson-id'),null);
  assert.equal(callFailures,1);
  assert.deepEqual(errors,[]);
  results.push({width,lessons:17,call:'bear',loadedBeforeScroll,errors,fallbackRequests:failures});
  await context.close();
 }
 console.log(JSON.stringify({result:'PASS',base,results}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
