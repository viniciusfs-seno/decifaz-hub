import test from 'node:test'
import assert from 'node:assert/strict'
import {can} from '../src/access.ts'
test('matriz frontend nega desconhecidos e separa escrita por módulo',()=>{
 for(const role of ['admin','commercial','operations','finance']){
  assert.equal(can(role,'commercial'),true)
  assert.equal(can(role,'projects'),true)
  assert.equal(can(role,'commercial',true),['admin','commercial'].includes(role))
  assert.equal(can(role,'projects',true),['admin','operations'].includes(role))
  assert.equal(can(role,'finance'),['admin','finance'].includes(role))
 }
 assert.equal(can(undefined,'finance'),false)
})
