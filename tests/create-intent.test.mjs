import assert from 'node:assert/strict';
import test from 'node:test';
import {readCreateIntent,createIntentUrl} from '../src/lib/create-intent.ts';
import {getSafeAuthNext} from '../src/lib/auth-next.ts';

test('assistant scenes and templates survive sign-in as safe local drafts',()=>{
 const draft=readCreateIntent({scene:'My Butler study group has become a snack club.',tone:'deadpan',template:'181913649'});
 const url=createIntentUrl(draft);
 assert.equal(getSafeAuthNext(url),url);
 assert.deepEqual(readCreateIntent({scene:['bad'],tone:'unknown',template:'https://evil.test'}),{});
 assert.equal(getSafeAuthNext('/templates'),'/templates');
 assert.equal(getSafeAuthNext('/demo'),'/demo');
 const combined=createIntentUrl({prompt:'today',template:'181913649',tone:'witty'});
 assert.equal(getSafeAuthNext(combined),combined);
});
test('draft return paths reject duplicate, excessive, external, and control-character input',()=>{
 for(const url of ['/create?template=1&template=2','/create?template=//evil.test','/create?scene=short','/create?scene='+encodeURIComponent('x'.repeat(281)),'/create?scene='+encodeURIComponent('valid scene\nheader'),' /create?template=1','/create?template=1&redirect=https://evil.test','/create?template=1#evil','/create?template=1&tone=malicious']) assert.equal(getSafeAuthNext(url),null,url);
});
